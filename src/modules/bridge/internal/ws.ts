// src/modules/bridge/internal/ws.ts — WebSocket transport to server/.
// This is the only place that knows the wire protocol (server/protocol.ts is
// imported for the codec so client and server cannot drift). Exactly one live
// socket at a time: every connect() starts a new generation, older sockets are
// closed and their events ignored, and reconnects (with backoff) only happen
// for the current generation.
import { decodeServer, encode, PROTOCOL_VERSION, type ClientMsg, type PlayerState, type RoundEnvelopeLike } from "../../../../server/protocol";
import type { WorldState, Unsubscribe } from "../api";

export interface Welcome {
  playerId: string;
  token: string;
  room: string;
  progress: { xp: number; level: number };
  peers: PlayerState[];
}

const TOKEN_KEY = "tc.token";
const MIN_SEND_MS = 1000 / 20;
const HANDSHAKE_MS = 8000;

let url: string | null = null;
let ws: WebSocket | null = null;
let welcome: Welcome | null = null;
let hello: { seed: number; nick?: string; room?: string } | null = null;
let generation = 0;
let backoff = 500;
let lastSentAt = 0;
let received = 0;
/** Rejects the connect() still waiting for a welcome when it gets superseded. */
let pendingReject: ((e: Error) => void) | null = null;
const stateCbs = new Set<(s: WorldState) => void>();
const leaveCbs = new Set<(playerId: string) => void>();
const welcomeCbs = new Set<(w: Welcome) => void>();

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function configure(u: string | null): void {
  url = u && u.trim() ? u.trim() : null;
}
export function isConfigured(): boolean {
  return !!url;
}
export function getWelcome(): Welcome | null {
  return welcome;
}
export function getSelfId(): string | null {
  return welcome?.playerId ?? null;
}
export function isOpen(): boolean {
  return !!ws && ws.readyState === WebSocket.OPEN && !!welcome;
}

// Dev/e2e seam: inspect the live socket without exporting module state.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __tcWs?: unknown }).__tcWs = {
    get url() { return url; },
    get readyState() { return ws?.readyState ?? null; },
    get welcome() { return welcome; },
    get received() { return received; },
    get listeners() { return stateCbs.size; },
    get generation() { return generation; },
    get socket() { return ws; },
  };
}

function toWorldState(p: PlayerState): WorldState {
  return { playerId: p.playerId, x: p.x, y: p.y, z: p.z, role: p.role, score: p.score, level: p.level, seed: p.seed, nick: p.nick };
}

function closeCurrent(): void {
  const old = ws;
  ws = null;
  welcome = null;
  if (pendingReject) {
    const r = pendingReject;
    pendingReject = null;
    r(new Error("superseded"));
  }
  if (old && (old.readyState === WebSocket.OPEN || old.readyState === WebSocket.CONNECTING)) {
    try { old.close(1000, "superseded"); } catch { /* ignore */ }
  }
}

/**
 * Open a socket for generation `gen`; resolves the pending connect on welcome.
 * `onFail` fires when the very first socket of a connect() closes before it
 * ever opened (server unreachable) so the caller can fall back at once.
 */
function open(gen: number, onWelcome: (w: Welcome) => void, onFail?: (e: Error) => void): void {
  if (gen !== generation || !url || !hello) return;
  const sock = new WebSocket(url);
  ws = sock;
  let opened = false;
  const mine = () => gen === generation && ws === sock;
  sock.onopen = () => {
    if (!mine()) return;
    opened = true;
    backoff = 500;
    // The handshake clock starts now: the world build can hold the main
    // thread for seconds before this event is even delivered.
    setTimeout(() => { if (mine() && !welcome) onFail?.(new Error("ws handshake timeout")); }, HANDSHAKE_MS);
    const token = storage()?.getItem(TOKEN_KEY) ?? undefined;
    sock.send(encode({ t: "hello", v: PROTOCOL_VERSION, seed: hello!.seed, nick: hello!.nick, room: hello!.room, token }));
  };
  sock.onmessage = (ev) => {
    if (!mine()) return;
    received++;
    const m = decodeServer(ev.data);
    if (!m) return;
    switch (m.t) {
      case "welcome":
        welcome = m;
        try { storage()?.setItem(TOKEN_KEY, m.token); } catch { /* ignore */ }
        for (const p of m.peers) for (const cb of stateCbs) cb(toWorldState(p));
        for (const cb of welcomeCbs) cb(m);
        onWelcome(m);
        break;
      case "states":
        for (const p of m.ps) for (const cb of stateCbs) cb(toWorldState(p));
        break;
      case "leave":
        for (const cb of leaveCbs) cb(m.playerId);
        break;
      case "error":
        console.warn("[bridge/ws] server error:", m.code);
        break;
    }
  };
  sock.onclose = () => {
    if (!mine()) return; // a superseded or deliberately closed socket
    ws = null;
    const hadWelcome = !!welcome;
    welcome = null;
    if (!opened && !hadWelcome && onFail) {
      onFail(new Error("ws unreachable")); // refused before opening: let the caller fall back now
      return;
    }
    const delay = backoff;
    backoff = Math.min(8000, backoff * 2);
    setTimeout(() => open(gen, onWelcome), delay);
  };
  sock.onerror = () => { /* onclose follows */ };
}

/** Connect and complete the hello/welcome handshake. Resolves on the first welcome. */
export function connect(h: { seed: number; nick?: string; room?: string }): Promise<Welcome> {
  hello = h;
  closeCurrent();
  const gen = ++generation;
  backoff = 500;
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error("ws not configured"));
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (pendingReject === myReject) pendingReject = null;
      fn();
    };
    const myReject = (e: Error) => settle(() => reject(e));
    pendingReject = myReject;
    open(gen, (w) => settle(() => resolve(w)), myReject);
  });
}

export function disconnect(): void {
  generation++; // stale sockets' events are ignored from here on
  closeCurrent();
}

/** Send the local player's state (throttled to 20 Hz; the server fans out at 15 Hz). */
export function sendState(s: WorldState): void {
  if (!isOpen()) return;
  const now = Date.now();
  if (now - lastSentAt < MIN_SEND_MS) return;
  lastSentAt = now;
  const msg: ClientMsg = { t: "state", x: s.x, y: s.y, z: s.z, role: s.role, score: s.score, level: s.level, nick: s.nick };
  ws!.send(encode(msg));
}

export function sendRound(envelope: RoundEnvelopeLike): void {
  if (isOpen()) ws!.send(encode({ t: "round", envelope }));
}

export function sendProgress(xp: number): void {
  if (isOpen()) ws!.send(encode({ t: "progress", xp }));
}

export function onState(cb: (s: WorldState) => void): Unsubscribe {
  stateCbs.add(cb);
  return () => stateCbs.delete(cb);
}
export function onLeave(cb: (playerId: string) => void): Unsubscribe {
  leaveCbs.add(cb);
  return () => leaveCbs.delete(cb);
}
export function onWelcome(cb: (w: Welcome) => void): Unsubscribe {
  welcomeCbs.add(cb);
  return () => welcomeCbs.delete(cb);
}
