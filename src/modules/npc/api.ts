// src/modules/npc/api.ts — the ONLY public door to the npc module.
//
// Public surface:
//   - spawnNpc(opts?): creates an NPC, returns its stable id ("npc-<seed>")
//     or null when the cap is reached.
//   - listNpcs(): returns the current array of NPC summaries
//     (id, seed, role, spec, position).
//   - clearNpcs(): removes every NPC from the presence layer.
//   - setNpcCap(n): change the cap. spawnNpc is a no-op at cap.
//
// NPCs are added to the presence layer as remote players with `role:
// "prospect"` (or the override from `opts.role`) and the playerId
// "npc-<seed>". They render in the dev `PresenceOverlay` chip strip just
// like real players; the avatar spec is produced by the same generator
// the player path uses (AGENTS §9). No "isNpc" branch anywhere.
//
// No PII. The only identifier is the seed.

import { generate, type AvatarSpec } from "../avatar/api";
import { absorbPeerHeartbeat, removePeer, startPresence, type PeerHeartbeat } from "../presence/api";

export interface SpawnNpcOptions {
  /** Deterministic seed for the avatar generator; same seed = same NPC. */
  seed?: number;
  /** Override the role (default "prospect"). Camo/locomotion land in 0104. */
  role?: string;
  /** Spawn position in world coords (default 0,0,0). */
  position?: { x: number; y: number; z: number };
}

export interface NpcEntry {
  id: string;
  seed: number;
  role: string;
  spec: AvatarSpec;
  position: { x: number; y: number; z: number };
}

const DEFAULT_CAP = 8;
const DEFAULT_ROLE = "prospect";
const ID_PREFIX = "npc-";
let counter = 0;

let cap = DEFAULT_CAP;
const npcs: NpcEntry[] = [];

/**
 * Pick a seed when the caller doesn't supply one: increment a counter so
 * each default-spawned NPC is unique. Caller-supplied seeds win (and are
 * idempotent — same seed yields the same id).
 */
function nextSeed(): number {
  counter = (counter + 1) >>> 0;
  return counter;
}

function makeId(seed: number): string {
  return `${ID_PREFIX}${seed}`;
}

function toHeartbeat(entry: NpcEntry): PeerHeartbeat {
  return {
    selfId: entry.id,
    role: entry.role,
    x: entry.position.x,
    y: entry.position.y,
    z: entry.position.z,
    ts: Date.now(),
  };
}

export function setNpcCap(n: number): void {
  if (!Number.isFinite(n) || n < 0) n = 0;
  cap = Math.floor(n);
}

export function getNpcCap(): number {
  return cap;
}

export function listNpcs(): NpcEntry[] {
  return npcs.slice();
}

export function spawnNpc(opts: SpawnNpcOptions = {}): NpcEntry | null {
  if (npcs.length >= cap) return null;
  const seed = opts.seed ?? nextSeed();
  const id = makeId(seed);
  // Idempotency: same seed = same entry, no new absorb.
  const existing = npcs.find((n) => n.id === id);
  if (existing) return existing;
  const entry: NpcEntry = {
    id,
    seed,
    role: opts.role ?? DEFAULT_ROLE,
    spec: generate(seed),
    position: opts.position ?? { x: 0, y: 0, z: 0 },
  };
  // Make sure the presence layer is up (idempotent).
  startPresence();
  npcs.push(entry);
  absorbPeerHeartbeat(toHeartbeat(entry));
  return entry;
}

export function clearNpcs(): void {
  for (const n of npcs) removePeer(n.id);
  npcs.length = 0;
}
