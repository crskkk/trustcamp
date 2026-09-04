// src/modules/npc/motion.ts — the per-tick input policy for an NPC.
//
// Pure function, no DOM/network. Given an NPC's current surface position
// and an optional target, returns a Vector2 input suitable for
// PlayerController.Step(). NPCs are never faster than players
// (STANDARDS §5.1) and the no-target branch keeps a small drift so the
// world doesn't look frozen.

export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };

export const DEFAULT_PLAYER_SPEED = 6;
/** NPCs are at most as fast as players. */
export const maxNpcSpeed = DEFAULT_PLAYER_SPEED;
const DRIFT_MAG = 0.2;       // no-target drift magnitude (≤ 1)
const JITTER_AMP = 0.08;     // per-tick angular jitter for variety
const EPS = 1e-6;

function len(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function norm2(v: Vec2): Vec2 {
  const m = Math.hypot(v.x, v.y);
  if (m < EPS) return { x: 0, y: 0 };
  return { x: v.x / m, y: v.y / m };
}

/**
 * Compute a tangent-plane unit vector at `pos` whose azimuth is `azimuth`
 * in the surface frame defined by `up`. We project two world axes
 * (east, north) onto the tangent plane and combine.
 */
function tangentAt(pos: Vec3, up: Vec3, azimuth: number): Vec2 {
  // Pick two world reference directions not parallel to `up`.
  const east = Math.abs(up.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const north = cross(up, east);
  const tEast = norm2(project({ x: east.x, y: east.y, z: east.z } as Vec3, up));
  const tNorth = norm2(project(north, up));
  // The projected world directions are 3D; we approximate the surface
  // 2D basis by their (tEast, tNorth) coefficients and rotate by `azimuth`.
  const cos = Math.cos(azimuth);
  const sin = Math.sin(azimuth);
  return norm2({
    x: tEast.x * cos + tNorth.x * sin,
    y: tEast.y * cos + tNorth.y * sin,
  });
}

function project(v: Vec3, ontoNormal: Vec3): Vec2 {
  const d = v.x * ontoNormal.x + v.y * ontoNormal.y + v.z * ontoNormal.z;
  return {
    x: v.x - d * ontoNormal.x,
    y: v.y - d * ontoNormal.y,
  };
}

function unit(x: Vec3): Vec3 {
  const m = len(x);
  if (m < EPS) return { x: 0, y: 0, z: 0 };
  return { x: x.x / m, y: x.y / m, z: x.z / m };
}

/** Hash a non-negative integer to a deterministic angle in [0, 2π). */
function seedAngle(jitterSeed: number): number {
  // SplitMix32-ish: multiply-and-xor
  let s = (jitterSeed | 0) >>> 0;
  s = (s ^ (s >>> 16)) * 0x85ebca6b >>> 0;
  s = (s ^ (s >>> 13)) * 0xc2b2ae35 >>> 0;
  s = s ^ (s >>> 16);
  return ((s >>> 0) / 0x1_0000_0000) * Math.PI * 2;
}

export interface ChooseInputArgs {
  /** NPC's current world position. */
  npcPos: Vec3;
  /** NPC's current "up" (outward surface normal). */
  npcUp: Vec3;
  /** Optional world-space target the NPC should head toward. */
  target: Vec3 | null;
  /** Stable per-NPC seed; controls the deterministic jitter angle. */
  jitterSeed: number;
}

/**
 * The motion policy. See the unit tests for the falsifiable spec.
 */
export function chooseInput(args: ChooseInputArgs): Vec2 {
  if (!args.target) {
    // No target → small drift, direction derived from the jitter seed so
    // each NPC walks a different way.
    const a = seedAngle(args.jitterSeed);
    return { x: Math.cos(a) * DRIFT_MAG, y: Math.sin(a) * DRIFT_MAG };
  }
  // With a target: project (target - pos) onto the tangent plane at pos,
  // then add a small bounded jitter perpendicular to the desired direction.
  const toTarget = sub(args.target, args.npcPos);
  const d = toTarget.x * args.npcUp.x + toTarget.y * args.npcUp.y + toTarget.z * args.npcUp.z;
  const t = { x: toTarget.x - d * args.npcUp.x, y: toTarget.y - d * args.npcUp.y, z: toTarget.z - d * args.npcUp.z };
  const tmag = Math.hypot(t.x, t.y, t.z);
  if (tmag < EPS) {
    // NPC is essentially on top of the target; drift.
    const a = seedAngle(args.jitterSeed + 1);
    return { x: Math.cos(a) * DRIFT_MAG, y: Math.sin(a) * DRIFT_MAG };
  }
  // Normalize to a unit tangent vector.
  const base = { x: t.x / tmag, y: t.y / tmag, z: t.z / tmag };
  // Build a perpendicular (right) in the tangent plane.
  const right = cross(args.npcUp, base);
  const rmag = Math.hypot(right.x, right.y, right.z);
  const rightU = rmag > EPS ? { x: right.x / rmag, y: right.y / rmag, z: right.z / rmag } : { x: 0, y: 0, z: 0 };
  const j = (seedAngle(args.jitterSeed) - Math.PI) / Math.PI; // [-1, 1)
  const offset = j * JITTER_AMP;
  const x = base.x + rightU.x * offset;
  const y = base.y + rightU.y * offset;
  const z = base.z + rightU.z * offset;
  // Drop the up component (it was small by construction; we re-normalize).
  const flat = unit({ x, y, z });
  // Return the (x, y) components. The implementation here is the planar
  // 2D projection; for the planet world the PlayerController handles
  // the great-circle math itself given the input.
  return norm2({ x: flat.x, y: flat.y });
}

// Suppress unused-export warning for tangentAt (kept for clarity / future use).
void tangentAt;
