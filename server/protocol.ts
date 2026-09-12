// server/protocol.ts — the wire protocol shared by the server and the client
// transport (src/modules/bridge/internal/ws.ts imports this file). Pure:
// message types + JSON codec + validation. No PII ever crosses the wire
// (AGENTS §5): a message carrying a profile-like key is rejected at the door.

export const PROTOCOL_VERSION = 1;

export interface PlayerState {
  playerId: string;
  x: number;
  y: number;
  z: number;
  role: string;
  score?: number;
  level?: number;
  seed?: number;
  nick?: string;
  ts?: number;
}

export interface RoundEnvelopeLike {
  version: 1;
  roundId: string;
  sessionId: string;
  minigame: string;
  playerId: string;
  role: string;
  points: number;
  maxPoints: number;
  startedAt: number;
  endedAt: number;
}

export type ClientMsg =
  | { t: "hello"; v: number; token?: string; seed: number; nick?: string; room?: string }
  | { t: "state"; x: number; y: number; z: number; role: string; score?: number; level?: number; nick?: string }
  | { t: "round"; envelope: RoundEnvelopeLike }
  | { t: "progress"; xp: number }
  | { t: "ping"; ts: number };

export type ServerMsg =
  | { t: "welcome"; playerId: string; token: string; room: string; progress: { xp: number; level: number }; peers: PlayerState[] }
  | { t: "states"; ps: PlayerState[] }
  | { t: "leave"; playerId: string }
  | { t: "pong"; ts: number; server: number }
  | { t: "error"; code: string };

const PII_KEYS = new Set([
  "name", "email", "picture", "given_name", "givenname", "family_name", "familyname", "middle_name", "nickname",
  "preferred_username", "displayname", "phone", "address",
]);

/** True if any key (at any depth) looks like a profile claim. */
export function hasPii(value: unknown, depth = 0): boolean {
  if (depth > 4 || !value || typeof value !== "object") return false;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEYS.has(k.toLowerCase())) return true;
    if (v && typeof v === "object" && hasPii(v, depth + 1)) return true;
  }
  return false;
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown, max = 64): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

export function encode(msg: ClientMsg | ServerMsg): string {
  return JSON.stringify(msg);
}

function parse(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string" || raw.length > 8192) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function isValidEnvelope(e: unknown): e is RoundEnvelopeLike {
  if (!e || typeof e !== "object" || hasPii(e)) return false;
  const o = e as Record<string, unknown>;
  return (
    o.version === 1 && str(o.roundId, 96) && str(o.sessionId, 96) && str(o.minigame) && str(o.playerId, 96) && str(o.role) &&
    num(o.points) && num(o.maxPoints) && o.maxPoints > 0 && o.points >= 0 && o.points <= o.maxPoints &&
    num(o.startedAt) && num(o.endedAt) && o.endedAt >= o.startedAt
  );
}

/** Validate a client message. Returns null for anything malformed or PII-bearing. */
export function decodeClient(raw: unknown): ClientMsg | null {
  const m = parse(raw);
  if (!m || hasPii(m)) return null;
  switch (m.t) {
    case "hello":
      if (m.v !== PROTOCOL_VERSION || !num(m.seed)) return null;
      return {
        t: "hello", v: PROTOCOL_VERSION, seed: Math.floor(m.seed),
        token: str(m.token, 128) ? m.token : undefined, nick: str(m.nick, 32) ? m.nick : undefined, room: str(m.room, 64) ? m.room : undefined,
      };
    case "state": {
      if (!num(m.x) || !num(m.y) || !num(m.z) || !str(m.role, 24)) return null;
      const out: ClientMsg = { t: "state", x: m.x, y: m.y, z: m.z, role: m.role };
      if (num(m.score)) out.score = m.score;
      if (num(m.level)) out.level = m.level;
      if (str(m.nick, 32)) out.nick = m.nick;
      return out;
    }
    case "round":
      return isValidEnvelope(m.envelope) ? { t: "round", envelope: m.envelope } : null;
    case "progress":
      return num(m.xp) && m.xp >= 0 ? { t: "progress", xp: Math.floor(m.xp) } : null;
    case "ping":
      return num(m.ts) ? { t: "ping", ts: m.ts } : null;
    default:
      return null;
  }
}

function isPlayerState(v: unknown): v is PlayerState {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return str(o.playerId, 96) && num(o.x) && num(o.y) && num(o.z) && str(o.role, 24);
}

/** Validate a server message (client side). */
export function decodeServer(raw: unknown): ServerMsg | null {
  const m = parse(raw);
  if (!m) return null;
  switch (m.t) {
    case "welcome": {
      const p = m.progress as Record<string, unknown> | undefined;
      if (!str(m.playerId, 96) || !str(m.token, 128) || !str(m.room, 64) || !p || !num(p.xp) || !num(p.level)) return null;
      const peers = Array.isArray(m.peers) ? m.peers.filter(isPlayerState) : [];
      return { t: "welcome", playerId: m.playerId, token: m.token, room: m.room, progress: { xp: p.xp, level: p.level }, peers };
    }
    case "states":
      return Array.isArray(m.ps) ? { t: "states", ps: m.ps.filter(isPlayerState) } : null;
    case "leave":
      return str(m.playerId, 96) ? { t: "leave", playerId: m.playerId } : null;
    case "pong":
      return num(m.ts) && num(m.server) ? { t: "pong", ts: m.ts, server: m.server } : null;
    case "error":
      return str(m.code) ? { t: "error", code: m.code } : null;
    default:
      return null;
  }
}
