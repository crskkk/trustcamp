// server/db.ts — session persistence on SQLite (node:sqlite, no native build).
// Players are opaque ids + a resume token; progress and rounds hang off them.
// No PII columns exist by design (AGENTS §5).
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { RoundEnvelopeLike } from "./protocol";

// node:sqlite is a Node 22.13+/24 builtin; loaded via require so Vite/vitest
// (which don't know this builtin yet) leave it alone.
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
type DatabaseSync = import("node:sqlite").DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  seed INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  session_id TEXT NOT NULL,
  minigame TEXT NOT NULL,
  role TEXT NOT NULL,
  points INTEGER NOT NULL,
  max_points INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rounds_session ON rounds(session_id, player_id);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  platform_sub_hash TEXT,
  context_id TEXT,
  lineitem_url TEXT,
  created_at INTEGER NOT NULL,
  wrapped_at INTEGER
);
CREATE TABLE IF NOT EXISTS lti_subs (
  sub_hash TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id)
);
CREATE TABLE IF NOT EXISTS session_players (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  sub TEXT NOT NULL,
  is_host INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, player_id)
);
`;

export interface PlayerRecord {
  id: string;
  token: string;
  seed: number;
  xp: number;
  level: number;
}

export function levelFromXp(totalXp: number): number {
  let xp = Math.max(0, Math.floor(totalXp)), level = 1;
  let need = Math.round(60 * Math.pow(level, 1.45));
  while (xp >= need) {
    xp -= need;
    level++;
    need = Math.round(60 * Math.pow(level, 1.45));
  }
  return level;
}

export class Db {
  private readonly db: DatabaseSync;

  constructor(path = ":memory:") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(SCHEMA);
  }

  /** Resume by token, or create a fresh player. Never trusts a client-supplied id. */
  getOrCreatePlayer(token: string | undefined, seed: number, now = Date.now()): PlayerRecord {
    if (token) {
      const row = this.db.prepare("SELECT id, token, seed FROM players WHERE token = ?").get(token) as { id: string; token: string; seed: number } | undefined;
      if (row) {
        this.db.prepare("UPDATE players SET last_seen = ?, seed = ? WHERE id = ?").run(now, seed, row.id);
        const p = this.db.prepare("SELECT xp, level FROM progress WHERE player_id = ?").get(row.id) as { xp: number; level: number } | undefined;
        return { id: row.id, token: row.token, seed, xp: p?.xp ?? 0, level: p?.level ?? 1 };
      }
    }
    const id = "p_" + randomBytes(6).toString("hex");
    const fresh = randomBytes(24).toString("hex");
    this.db.prepare("INSERT INTO players (id, token, seed, created_at, last_seen) VALUES (?, ?, ?, ?, ?)").run(id, fresh, seed, now, now);
    this.db.prepare("INSERT INTO progress (player_id, xp, level, updated_at) VALUES (?, 0, 1, ?)").run(id, now);
    return { id, token: fresh, seed, xp: 0, level: 1 };
  }

  touch(playerId: string, now = Date.now()): void {
    this.db.prepare("UPDATE players SET last_seen = ? WHERE id = ?").run(now, playerId);
  }

  saveProgress(playerId: string, xp: number, now = Date.now()): { xp: number; level: number } {
    const clean = Math.max(0, Math.floor(xp));
    const level = levelFromXp(clean);
    this.db.prepare("INSERT INTO progress (player_id, xp, level, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET xp = excluded.xp, level = excluded.level, updated_at = excluded.updated_at").run(playerId, clean, level, now);
    return { xp: clean, level };
  }

  getProgress(playerId: string): { xp: number; level: number } {
    const p = this.db.prepare("SELECT xp, level FROM progress WHERE player_id = ?").get(playerId) as { xp: number; level: number } | undefined;
    return p ?? { xp: 0, level: 1 };
  }

  /** Store a round for the authenticated player (the envelope's playerId is overridden). Idempotent by roundId. */
  recordRound(playerId: string, e: RoundEnvelopeLike): boolean {
    const r = this.db.prepare("INSERT OR IGNORE INTO rounds (id, player_id, session_id, minigame, role, points, max_points, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(`${playerId}:${e.roundId}`, playerId, e.sessionId, e.minigame, e.role, Math.round(e.points), Math.round(e.maxPoints), e.startedAt, e.endedAt);
    return Number(r.changes) > 0;
  }

  /** Total points per player in a session, best first. */
  sessionScores(sessionId: string, limit = 50): Array<{ playerId: string; points: number; rounds: number; maxPoints: number }> {
    return this.db.prepare("SELECT player_id AS playerId, SUM(points) AS points, COUNT(*) AS rounds, SUM(max_points) AS maxPoints FROM rounds WHERE session_id = ? GROUP BY player_id ORDER BY points DESC LIMIT ?")
      .all(sessionId, limit) as Array<{ playerId: string; points: number; rounds: number; maxPoints: number }>;
  }

  // ---- LTI ----

  /** The player bound to a platform user (hash of issuer|sub), created on first launch. */
  playerForSub(subHash: string, seed: number, now = Date.now()): PlayerRecord {
    const row = this.db.prepare("SELECT player_id FROM lti_subs WHERE sub_hash = ?").get(subHash) as { player_id: string } | undefined;
    if (row) {
      const p = this.db.prepare("SELECT id, token, seed FROM players WHERE id = ?").get(row.player_id) as { id: string; token: string; seed: number } | undefined;
      if (p) {
        this.touch(p.id, now);
        const pr = this.getProgress(p.id);
        return { id: p.id, token: p.token, seed: p.seed, xp: pr.xp, level: pr.level };
      }
    }
    const created = this.getOrCreatePlayer(undefined, seed, now);
    this.db.prepare("INSERT OR REPLACE INTO lti_subs (sub_hash, player_id) VALUES (?, ?)").run(subHash, created.id);
    return created;
  }

  playerByToken(token: string): { id: string; seed: number } | null {
    const p = this.db.prepare("SELECT id, seed FROM players WHERE token = ?").get(token) as { id: string; seed: number } | undefined;
    return p ?? null;
  }

  upsertSession(id: string, contextId: string | null, lineitemUrl: string | null, now = Date.now()): void {
    this.db.prepare("INSERT INTO sessions (id, context_id, lineitem_url, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET context_id = COALESCE(excluded.context_id, sessions.context_id), lineitem_url = COALESCE(excluded.lineitem_url, sessions.lineitem_url)")
      .run(id, contextId, lineitemUrl, now);
  }

  getSession(id: string): { id: string; context_id: string | null; lineitem_url: string | null; wrapped_at: number | null } | null {
    const s = this.db.prepare("SELECT id, context_id, lineitem_url, wrapped_at FROM sessions WHERE id = ?").get(id) as { id: string; context_id: string | null; lineitem_url: string | null; wrapped_at: number | null } | undefined;
    return s ?? null;
  }

  linkSessionPlayer(sessionId: string, playerId: string, sub: string, isHost: boolean): void {
    this.db.prepare("INSERT INTO session_players (session_id, player_id, sub, is_host) VALUES (?, ?, ?, ?) ON CONFLICT(session_id, player_id) DO UPDATE SET sub = excluded.sub, is_host = MAX(session_players.is_host, excluded.is_host)")
      .run(sessionId, playerId, sub, isHost ? 1 : 0);
  }

  sessionPlayers(sessionId: string): Array<{ playerId: string; sub: string; isHost: boolean }> {
    return (this.db.prepare("SELECT player_id AS playerId, sub, is_host AS isHost FROM session_players WHERE session_id = ?").all(sessionId) as Array<{ playerId: string; sub: string; isHost: number }>)
      .map((r) => ({ playerId: r.playerId, sub: r.sub, isHost: r.isHost === 1 }));
  }

  isHost(sessionId: string, playerId: string): boolean {
    const r = this.db.prepare("SELECT is_host FROM session_players WHERE session_id = ? AND player_id = ?").get(sessionId, playerId) as { is_host: number } | undefined;
    return r?.is_host === 1;
  }

  markWrapped(sessionId: string, now = Date.now()): void {
    this.db.prepare("UPDATE sessions SET wrapped_at = ? WHERE id = ?").run(now, sessionId);
  }

  playerCount(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM players").get() as { n: number }).n;
  }

  close(): void {
    this.db.close();
  }
}
