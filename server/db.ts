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

  playerCount(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM players").get() as { n: number }).n;
  }

  close(): void {
    this.db.close();
  }
}
