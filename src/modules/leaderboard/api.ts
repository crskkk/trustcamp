// src/modules/leaderboard/api.ts — the ONLY public door to the leaderboard module.
import { onState, type WorldState } from "../bridge/api";

export interface LeaderRow {
  playerId: string;
  nick: string;
  seed: number;
  score: number;
  level: number;
  rounds: number;
  self: boolean;
  ts: number;
}

const STALE_MS = 12_000;
const ADJ = ["Mossy", "Sunny", "Pebble", "Breezy", "Maple", "Cocoa", "Misty", "Clover", "Ember", "Willow", "Tidal", "Frosty", "Dandy", "Marsh", "Pine", "Berry", "Cedar", "Lucky", "Fern", "Sable", "Honey", "Dusty", "Coral", "Sprout"];
const ANIMAL = ["Otter", "Fox", "Badger", "Heron", "Moose", "Beaver", "Marten", "Newt", "Finch", "Lynx", "Toad", "Wren", "Elk", "Hare", "Loon", "Mole", "Owl", "Trout", "Vole", "Crane", "Raccoon", "Squirrel", "Duck", "Bear"];

/** A friendly, PII-free camper name derived from the avatar seed. */
export function nickFor(seed: number): string {
  const s = Math.abs(Math.floor(seed));
  return `${ADJ[s % ADJ.length]} ${ANIMAL[Math.floor(s / 31) % ANIMAL.length]}`;
}

let self: LeaderRow | null = null;
const rows = new Map<string, LeaderRow>();
const listeners = new Set<(rows: LeaderRow[]) => void>();
let unsub: (() => void) | null = null;

function sorted(): LeaderRow[] {
  const all = [...rows.values()];
  if (self) all.push(self);
  return all.sort((a, b) => b.score - a.score || a.nick.localeCompare(b.nick));
}

function emit(): void {
  const r = sorted(); // no pruning here: callers with a synthetic clock use getRows(now)
  for (const cb of listeners) cb(r);
}

export function setSelf(p: { playerId: string; seed: number; level?: number }): void {
  const prev = self;
  self = {
    playerId: p.playerId, seed: p.seed, nick: nickFor(p.seed), score: prev?.score ?? 0, level: p.level ?? prev?.level ?? 1,
    rounds: prev?.rounds ?? 0, self: true, ts: Date.now(),
  };
  emit();
}

export function addSelfScore(points: number, rounds = 1): void {
  if (!self) return;
  self.score += Math.max(0, Math.round(points));
  self.rounds += rounds;
  self.ts = Date.now();
  emit();
}

export function setSelfLevel(level: number): void {
  if (!self || self.level === level) return;
  self.level = level;
  emit();
}

/** Absorb another player's bridge state (score/level/seed ride along). */
export function absorbRemote(state: WorldState, now = Date.now()): void {
  if (!state || typeof state.playerId !== "string") return;
  if (self && state.playerId === self.playerId) return;
  if (typeof state.score !== "number") return;
  const seed = typeof state.seed === "number" ? state.seed : 0;
  const prev = rows.get(state.playerId);
  rows.set(state.playerId, {
    playerId: state.playerId, seed, nick: state.nick ?? nickFor(seed), score: state.score, level: state.level ?? 1,
    rounds: prev?.rounds ?? 0, self: false, ts: now,
  });
  emit();
}

export function removePlayer(playerId: string): void {
  if (rows.delete(playerId)) emit();
}

/** Rows sorted by score desc (stale remotes pruned). The local row is always present once setSelf ran. */
export function getRows(now = Date.now()): LeaderRow[] {
  for (const [id, r] of rows) if (now - r.ts > STALE_MS) rows.delete(id);
  return sorted();
}

export function getTeamScore(now = Date.now()): number {
  return getRows(now).reduce((s, r) => s + r.score, 0);
}

/** Fields to attach to every outbound bridge state so peers can rank us. */
export function selfPublish(): { score: number; level: number; seed: number; nick: string } | Record<string, never> {
  return self ? { score: self.score, level: self.level, seed: self.seed, nick: self.nick } : {};
}

export function subscribeLeaderboard(cb: (rows: LeaderRow[]) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Subscribe to the bridge stream. Idempotent. */
export function startLeaderboard(): void {
  if (unsub) return;
  unsub = onState((s) => absorbRemote(s));
}
export function stopLeaderboard(): void {
  unsub?.();
  unsub = null;
}

/** Test helper. */
export function resetLeaderboard(): void {
  stopLeaderboard();
  rows.clear();
  self = null;
  listeners.clear();
}
