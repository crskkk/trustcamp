// server/index.ts — THE BAR realtime + persistence server.
//
//   pnpm server            # ws://localhost:8787 (PORT), SQLite at data/thebar.sqlite (DB_PATH)
//   GET /health            # { ok, players, online }
//
// Clients open a WebSocket, send `hello` (resume token + avatar seed), get a
// `welcome` (server-assigned player id, token, persisted progress, current
// peers), then stream `state` at up to 15 Hz. Rounds and XP are persisted per
// player. The LTI 1.3 endpoints mount on the same HTTP server (server/lti.ts).
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { Db } from "./db";
import { Rooms, TICK_MS } from "./rooms";
import { decodeClient, encode, PROTOCOL_VERSION } from "./protocol";
import { Lti, ltiConfigFromEnv, type LtiConfig, type LtiDeps } from "./lti";

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? "data/thebar.sqlite";
const HELLO_TIMEOUT_MS = 5000;

export interface ServerHandle {
  port: number;
  close(): Promise<void>;
}

function readBody(req: IncomingMessage, limit = 64 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c: Buffer) => { data += c.toString(); if (data.length > limit) { reject(new Error("body too large")); req.destroy(); } });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export async function startServer(opts: { port?: number; dbPath?: string; log?: (s: string) => void; lti?: LtiConfig | null; ltiDeps?: LtiDeps } = {}): Promise<ServerHandle> {
  const port = opts.port ?? PORT;
  const log = opts.log ?? ((s: string) => console.log(s));
  const db = new Db(opts.dbPath ?? DB_PATH);
  const rooms = new Rooms();
  const ltiCfg = opts.lti === undefined ? ltiConfigFromEnv() : opts.lti;
  const lti = ltiCfg ? new Lti(ltiCfg, db, opts.ltiDeps) : null;
  if (lti) await lti.init();

  const handleLti = async (req: IncomingMessage, res: ServerResponse, path: string): Promise<void> => {
    if (!lti) return json(res, 404, { error: "LTI not configured (set LTI_ISSUER, LTI_CLIENT_ID, ...)" });
    try {
      if (path === "/lti/jwks" && req.method === "GET") return json(res, 200, lti.jwks());
      if (path === "/lti/config" && req.method === "GET") return json(res, 200, lti.toolConfig());
      if (path === "/lti/login") {
        const q = req.method === "POST" ? Object.fromEntries(new URLSearchParams(await readBody(req))) : Object.fromEntries(new URL(req.url ?? "/", "http://x").searchParams);
        res.statusCode = 302;
        res.setHeader("Location", lti.login(q));
        return res.end();
      }
      if (path === "/lti/launch" && req.method === "POST") {
        const form = Object.fromEntries(new URLSearchParams(await readBody(req)));
        const out = await lti.launch(form);
        log(`[lti] launch session=${out.sessionId} player=${out.playerId} host=${out.host}`);
        res.statusCode = 302;
        res.setHeader("Location", out.redirect);
        return res.end();
      }
      if (path === "/lti/wrap" && req.method === "POST") {
        const body = JSON.parse((await readBody(req)) || "{}") as { sessionId?: string; token?: string };
        if (!body.sessionId || !body.token) return json(res, 400, { error: "sessionId and token required" });
        const out = await lti.wrap(body.sessionId, body.token);
        log(`[lti] wrap session=${body.sessionId} pushed=${out.pushed} skipped=${out.skipped}`);
        return json(res, 200, out);
      }
      return json(res, 404, { error: "not found" });
    } catch (e) {
      const msg = (e as Error).message;
      log(`[lti] error ${path}: ${msg}`);
      return json(res, 400, { error: msg });
    }
  };

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/health") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, protocol: PROTOCOL_VERSION, players: db.playerCount(), online: rooms.members.size, lti: !!lti }));
      return;
    }
    if (path.startsWith("/lti/")) { void handleLti(req, res, path); return; }
    if (path === "/debug" && process.env.NODE_ENV !== "production") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ members: rooms.snapshot(), sockets: wss.clients.size }));
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });

  const wss = new WebSocketServer({ server: http });
  wss.on("connection", (ws: WebSocket) => {
    let playerId: string | null = null;
    const helloTimer = setTimeout(() => { if (!playerId) ws.close(4000, "hello timeout"); }, HELLO_TIMEOUT_MS);

    ws.on("message", (data) => {
      const msg = decodeClient(data.toString());
      if (!msg) { ws.send(encode({ t: "error", code: "bad-message" })); return; }
      if (!playerId) {
        if (msg.t !== "hello") { ws.send(encode({ t: "error", code: "hello-first" })); return; }
        clearTimeout(helloTimer);
        const p = db.getOrCreatePlayer(msg.token, msg.seed);
        playerId = p.id;
        const room = msg.room ?? "world";
        rooms.join(p.id, ws, room, p.seed, msg.nick);
        ws.send(encode({ t: "welcome", playerId: p.id, token: p.token, room, progress: { xp: p.xp, level: p.level }, peers: rooms.peersOf(p.id) }));
        log(`[server] join ${p.id} room=${room} online=${rooms.members.size}`);
        return;
      }
      switch (msg.t) {
        case "state":
          rooms.updateState(playerId, { x: msg.x, y: msg.y, z: msg.z, role: msg.role, score: msg.score, level: msg.level, nick: msg.nick });
          break;
        case "round":
          db.recordRound(playerId, msg.envelope);
          break;
        case "progress":
          db.saveProgress(playerId, msg.xp);
          break;
        case "ping":
          ws.send(encode({ t: "pong", ts: msg.ts, server: Date.now() }));
          break;
      }
    });

    ws.on("close", () => {
      clearTimeout(helloTimer);
      // Only evict if this socket is still the member's live socket (a resumed
      // player replaces the old socket; the old one closing must not evict them).
      if (playerId && rooms.members.get(playerId)?.socket === ws) {
        rooms.leave(playerId);
        db.touch(playerId);
        log(`[server] leave ${playerId} online=${rooms.members.size}`);
      }
    });
    ws.on("error", () => { /* handled by close */ });
  });

  const ticker = setInterval(() => rooms.flush(), TICK_MS);

  return new Promise((resolve) => {
    http.listen(port, () => {
      const bound = (http.address() as { port: number }).port;
      log(`[server] THE BAR listening on http://localhost:${bound} (ws) — db ${opts.dbPath ?? DB_PATH}`);
      resolve({
        port: bound,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(ticker);
            for (const c of wss.clients) c.terminate();
            wss.close(() => http.close(() => { db.close(); done(); }));
          }),
      });
    });
  });
}

// Run directly (`pnpm server`); tests import startServer instead.
const isMain = process.argv[1] && /server[\\/]index\.ts$/.test(process.argv[1]);
if (isMain) {
  startServer().catch((e) => { console.error(e); process.exit(1); });
}
