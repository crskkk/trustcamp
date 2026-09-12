// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import WebSocket from "ws";
import { decodeClient, decodeServer, encode, hasPii, isValidEnvelope, type RoundEnvelopeLike, type ServerMsg } from "./protocol";
import { Db, levelFromXp } from "./db";
import { Rooms } from "./rooms";
import { startServer, type ServerHandle } from "./index";

const envelope: RoundEnvelopeLike = {
  version: 1, roundId: "r1", sessionId: "s1", minigame: "firewood-dash", playerId: "whoever", role: "scout",
  points: 40, maxPoints: 80, startedAt: 1000, endedAt: 61000,
};

describe("protocol codec", () => {
  it("round-trips valid client messages and rejects malformed ones", () => {
    expect(decodeClient(encode({ t: "hello", v: 1, seed: 42 }))).toEqual({ t: "hello", v: 1, seed: 42, token: undefined, nick: undefined, room: undefined });
    expect(decodeClient(encode({ t: "state", x: 1, y: 2, z: 3, role: "scout", score: 5 }))).toEqual({ t: "state", x: 1, y: 2, z: 3, role: "scout", score: 5 });
    expect(decodeClient(encode({ t: "round", envelope }))).toEqual({ t: "round", envelope });
    expect(decodeClient("not json")).toBeNull();
    expect(decodeClient(JSON.stringify({ t: "state", x: "1", y: 2, z: 3, role: "scout" }))).toBeNull();
    expect(decodeClient(JSON.stringify({ t: "hello", v: 99, seed: 1 }))).toBeNull();
    expect(decodeClient(JSON.stringify({ t: "nope" }))).toBeNull();
  });

  it("rejects PII at the door (AGENTS §5)", () => {
    expect(hasPii({ playerId: "x", name: "Alice" })).toBe(true);
    expect(hasPii({ envelope: { email: "a@b.c" } })).toBe(true);
    expect(decodeClient(JSON.stringify({ t: "state", x: 0, y: 0, z: 0, role: "scout", email: "a@b.c" }))).toBeNull();
    expect(isValidEnvelope({ ...envelope, given_name: "A" })).toBe(false);
    expect(isValidEnvelope({ ...envelope, points: 999 })).toBe(false);
  });

  it("validates server messages on the client side", () => {
    const welcome: ServerMsg = { t: "welcome", playerId: "p_1", token: "tok", room: "world", progress: { xp: 10, level: 1 }, peers: [{ playerId: "p_2", x: 1, y: 2, z: 3, role: "scout" }] };
    expect(decodeServer(encode(welcome))).toEqual(welcome);
    expect(decodeServer(JSON.stringify({ t: "states", ps: [{ playerId: "a", x: 1, y: 1, z: 1, role: "scout" }, { bogus: true }] }))).toEqual({ t: "states", ps: [{ playerId: "a", x: 1, y: 1, z: 1, role: "scout" }] });
    expect(decodeServer(JSON.stringify({ t: "welcome" }))).toBeNull();
  });
});

describe("db (node:sqlite)", () => {
  it("creates players with resume tokens, persists progress and rounds", () => {
    const db = new Db(":memory:");
    const a = db.getOrCreatePlayer(undefined, 7);
    expect(a.id).toMatch(/^p_[0-9a-f]{12}$/);
    expect(a.token).toHaveLength(48);
    expect(a).toMatchObject({ xp: 0, level: 1, seed: 7 });
    const again = db.getOrCreatePlayer(a.token, 9);
    expect(again.id).toBe(a.id);
    expect(again.seed).toBe(9);
    expect(db.getOrCreatePlayer("unknown-token", 1).id).not.toBe(a.id);

    expect(db.saveProgress(a.id, 70)).toEqual({ xp: 70, level: 2 });
    expect(db.getOrCreatePlayer(a.token, 9)).toMatchObject({ xp: 70, level: 2 });
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(60)).toBe(2);

    expect(db.recordRound(a.id, envelope)).toBe(true);
    expect(db.recordRound(a.id, envelope)).toBe(false); // idempotent by roundId
    expect(db.recordRound(a.id, { ...envelope, roundId: "r2", points: 20 })).toBe(true);
    expect(db.sessionScores("s1")).toEqual([{ playerId: a.id, points: 60, rounds: 2, maxPoints: 160 }]);
    expect(db.playerCount()).toBe(2);
    db.close();
  });
});

describe("rooms fan-out", () => {
  function sock() {
    const sent: string[] = [];
    return { sent, socket: { send: (d: string) => sent.push(d), readyState: 1 } };
  }
  it("relays dirty states to the other members of the room once per tick and rate-limits inbound", () => {
    const rooms = new Rooms();
    const a = sock(), b = sock(), c = sock();
    rooms.join("a", a.socket, "world", 1);
    rooms.join("b", b.socket, "world", 2, "Custom");
    rooms.join("c", c.socket, "other", 3);
    expect(rooms.updateState("a", { x: 1, y: 2, z: 3, role: "scout", score: 4 }, 1000)).toBe(true);
    expect(rooms.flush()).toBe(1); // only b hears about a
    const msg = JSON.parse(b.sent[0]);
    expect(msg).toEqual({ t: "states", ps: [{ playerId: "a", x: 1, y: 2, z: 3, role: "scout", score: 4, seed: 1, nick: undefined, ts: 1000 }] });
    expect(a.sent).toHaveLength(0);
    expect(c.sent).toHaveLength(0);
    expect(rooms.flush()).toBe(0); // nothing dirty
    expect(rooms.peersOf("b")).toHaveLength(1);
    let accepted = 0;
    for (let i = 0; i < 60; i++) if (rooms.updateState("b", { x: i, y: 0, z: 0, role: "scout" }, 2000 + i)) accepted++;
    expect(accepted).toBe(40);
    rooms.leave("a");
    expect(JSON.parse(b.sent.at(-1)!)).toEqual({ t: "leave", playerId: "a" });
    expect(rooms.members.size).toBe(2);
  });
});

describe("server end-to-end over websockets", () => {
  let handle: ServerHandle | null = null;
  afterEach(async () => { await handle?.close(); handle = null; });

  function open(port: number): Promise<{ ws: WebSocket; next: () => Promise<ServerMsg> }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      const queue: ServerMsg[] = [];
      const waiters: Array<(m: ServerMsg) => void> = [];
      ws.on("message", (d) => { const m = decodeServer(d.toString()); if (!m) return; const w = waiters.shift(); if (w) w(m); else queue.push(m); });
      ws.on("open", () => resolve({ ws, next: () => new Promise((r) => { const q = queue.shift(); if (q) r(q); else waiters.push(r); }) }));
      ws.on("error", reject);
    });
  }

  it("hello -> welcome with a token, peers see each other's state within a tick, progress resumes by token", async () => {
    handle = await startServer({ port: 0, dbPath: ":memory:", log: () => undefined });
    const port = (handle as ServerHandle & { port: number }).port;
    const a = await open(port);
    a.ws.send(encode({ t: "hello", v: 1, seed: 11 }));
    const wa = await a.next();
    expect(wa.t).toBe("welcome");
    if (wa.t !== "welcome") return;
    expect(wa.peers).toEqual([]);

    const b = await open(port);
    b.ws.send(encode({ t: "hello", v: 1, seed: 22, nick: "Sunny Otter" }));
    const wb = await b.next();
    if (wb.t !== "welcome") throw new Error("no welcome");

    a.ws.send(encode({ t: "state", x: 48, y: 0, z: 1, role: "scout", score: 30, level: 2 }));
    const seen = await b.next();
    expect(seen.t).toBe("states");
    if (seen.t === "states") expect(seen.ps[0]).toMatchObject({ playerId: wa.playerId, x: 48, score: 30, level: 2, seed: 11 });

    a.ws.send(encode({ t: "progress", xp: 130 }));
    a.ws.send(encode({ t: "round", envelope }));
    await new Promise((r) => setTimeout(r, 60));
    a.ws.close();
    const left = await b.next();
    expect(left).toEqual({ t: "leave", playerId: wa.playerId });

    const a2 = await open(port);
    a2.ws.send(encode({ t: "hello", v: 1, seed: 11, token: wa.token }));
    const w2 = await a2.next();
    expect(w2.t === "welcome" && w2.playerId).toBe(wa.playerId);
    expect(w2.t === "welcome" && w2.progress).toEqual({ xp: 130, level: 2 });
    expect(w2.t === "welcome" && w2.peers.length).toBe(0); // b has no state yet
    a2.ws.close();
    b.ws.close();
  });
});
