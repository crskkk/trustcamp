// src/modules/world3d/api.ts — the ONLY public door to the world3d module.
//
// React: <WorldCanvas/>. Imperative: getWorld() for the live world (remote
// bodies, player snapshot, seed swap), onFrame() for per-frame hooks,
// setOrbit()/setOrbitYaw() for the screensaver, npcWanderBy() so the npc
// module can stroll villagers along the trails without knowing Three.js.
// Pure planet math is re-exported for minigames / the server.

export { WorldCanvas, type WorldCanvasProps } from "./WorldCanvas";
export type { PlayerSnapshot, RemoteInput, Quality } from "./internal/world";
export type { PickupKind, PickupOpts } from "./internal/pickups";
export {
  PLANET_RADIUS, WATER_LEVEL, REGIONS, TRAIL_SAMPLES, heightAt, biomeAt, surfaceRadius, isWalkable, offsetDir, angDist,
  worldPosition, normalize, cross, type V3, type Biome,
} from "./internal/planet";

import type { World } from "./internal/world";
import type { AvatarSpec } from "../avatar/api";
import { getCurrentWorld, addFrameListener } from "./internal/registry";
import { REGIONS, TRAIL_SAMPLES, TRAIL_STEP, PLANET_RADIUS, slerp, cross, normalize, offsetDir, worldPosition, type V3 } from "./internal/planet";
import { SKIN, HAIR, EYES, OUTFIT } from "./internal/palette";

export type Area = "camp" | "lake" | "forest" | "hills";

/** A walkable spot to arrive at in each area (the lake one is the dock shore). */
export function landmark(area: Area): V3 {
  switch (area) {
    case "camp": return offsetDir(REGIONS.camp, 0.5, -3.2);
    case "lake": return slerp(REGIONS.lake, REGIONS.camp, 0.19);
    case "forest": return REGIONS.forest;
    case "hills": return slerp(REGIONS.hills, REGIONS.forest, 0.12);
  }
}

/** The colours a spec renders with (for menus/previews; no Three.js needed). */
export function avatarColors(spec: AvatarSpec): { skin: number; hair: number; eyes: number; outfit: number } {
  return { skin: SKIN[spec.skinTone % SKIN.length], hair: HAIR[spec.hairColor % HAIR.length], eyes: EYES[spec.eyeColor % EYES.length], outfit: OUTFIT[spec.bodyAccent % OUTFIT.length] };
}

/** The mounted world, or null before <WorldCanvas/> mounts (and in jsdom). */
export function getWorld(): World | null {
  return getCurrentWorld();
}

/** Per-frame hook (dt seconds, t total seconds). Returns an unsubscribe. */
export function onFrame(cb: (dt: number, t: number) => void): () => void {
  return addFrameListener(cb);
}

/** Screensaver: orbit the whole planet instead of chasing the player. */
export function setOrbit(enabled: boolean): void {
  getCurrentWorld()?.setCameraMode(enabled ? "orbit" : "chase");
}
export function setOrbitYaw(deg: number): void {
  getCurrentWorld()?.setOrbitYaw(deg);
}

// ---- NPC strolling along the trail loop (pure; no Three.js) ----
const cursors = new Map<number, number>();

/**
 * Advance NPC `seed` by `distanceM` metres along the trail loop and return its
 * new world position. Deterministic per seed: same seed, same stroll, on every
 * client. Alternate seeds walk the loop in opposite directions with a small
 * sideways offset so villagers don't stack.
 */
export function npcWanderBy(seed: number, distanceM: number): V3 {
  const n = TRAIL_SAMPLES.length;
  let c = cursors.get(seed);
  if (c === undefined) c = (seed * 37) % n;
  const dirSign = seed % 2 === 0 ? 1 : -1;
  c = (((c + (dirSign * distanceM) / (TRAIL_STEP * PLANET_RADIUS)) % n) + n) % n;
  cursors.set(seed, c);
  const i = Math.floor(c), f = c - i;
  const a = TRAIL_SAMPLES[i], b = TRAIL_SAMPLES[(i + 1) % n];
  const p = slerp(a, b, f);
  const tangent = normalize(cross(cross(p, b), p));
  const side = normalize(cross(p, tangent));
  const off = ((((seed * 7919) % 100) / 100) - 0.5) * 2.2;
  const d = normalize({ x: p.x + (side.x * off) / PLANET_RADIUS, y: p.y + (side.y * off) / PLANET_RADIUS, z: p.z + (side.z * off) / PLANET_RADIUS });
  return worldPosition(d);
}
