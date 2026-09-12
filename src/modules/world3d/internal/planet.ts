// src/modules/world3d/internal/planet.ts — the pure planet model.
//
// No Three.js here: this file is the single source of truth for the terrain
// height field, the four areas (camp / lake / forest / hills), and the trail
// network. It runs identically in the browser, in vitest, and on the server
// (so movement can be validated authoritatively later). Everything is a pure
// function of a unit direction vector.

import { simplex3, fbm3 } from "./noise";

export type V3 = { x: number; y: number; z: number };

/** Base sphere radius. Character height is 1.0, so a lap is ~300 characters. */
export const PLANET_RADIUS = 48;
/** Water surface, as a height offset from PLANET_RADIUS. */
export const WATER_LEVEL = -0.7;
export const PLANET_SEED = 7;

export function sphDir(lon: number, lat: number): V3 {
  const c = Math.cos(lat);
  return { x: c * Math.cos(lon), y: Math.sin(lat), z: c * Math.sin(lon) };
}
export function dot(a: V3, b: V3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
export function cross(a: V3, b: V3): V3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
export function normalize(v: V3): V3 {
  const m = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}
function clamp(x: number, a: number, b: number): number {
  return x < a ? a : x > b ? b : x;
}
/** Angle (radians) between two unit vectors. */
export function angDist(a: V3, b: V3): number {
  return Math.acos(clamp(dot(a, b), -1, 1));
}
export function slerp(a: V3, b: V3, t: number): V3 {
  const o = angDist(a, b);
  if (o < 1e-6) return { ...a };
  const s = Math.sin(o), wa = Math.sin((1 - t) * o) / s, wb = Math.sin(t * o) / s;
  return { x: wa * a.x + wb * b.x, y: wa * a.y + wb * b.y, z: wa * a.z + wb * b.z };
}
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
/** 1 inside `inner`, fading to 0 at `outer` (both angular radii). */
export function mask(d: number, inner: number, outer: number): number {
  return 1 - smoothstep(inner, outer, d);
}

/** Area centres (unit directions). Laid out around the equator so a lap visits all four. */
export const REGIONS = {
  camp: sphDir(0, 0.05),
  lake: sphDir(Math.PI * 0.55, -0.12),
  forest: sphDir(Math.PI * 1.15, 0.0),
  hills: sphDir(Math.PI * 1.65, 0.35),
} as const;

export type Biome = "camp" | "lake" | "forest" | "hills" | "meadow";

/** Trail waypoints: a loop camp -> lake -> forest -> hills -> camp. */
export const TRAIL_WAYPOINTS: V3[][] = [
  [REGIONS.camp, sphDir(0.55, 0.12), sphDir(1.15, -0.04), REGIONS.lake],
  [REGIONS.lake, sphDir(2.2, -0.18), sphDir(2.9, 0.08), REGIONS.forest],
  [REGIONS.forest, sphDir(4.1, 0.1), sphDir(4.7, 0.3), REGIONS.hills],
  [REGIONS.hills, sphDir(5.6, 0.32), sphDir(6.0, 0.16), REGIONS.camp],
];

export const TRAIL_STEP = 0.02; // radians between samples
const TRAIL_WIGGLE = 0.035;

function buildTrailSamples(): V3[] {
  const out: V3[] = [];
  for (const wp of TRAIL_WAYPOINTS) {
    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i], b = wp[i + 1];
      const len = angDist(a, b);
      const n = Math.max(2, Math.ceil(len / TRAIL_STEP));
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        const p = slerp(a, b, t);
        // Wiggle sideways so trails meander like footpaths, not geodesics.
        const tangent = normalize(cross(cross(p, b), p));
        const side = normalize(cross(p, tangent));
        const w = simplex3(p.x * 6 + 3, p.y * 6, p.z * 6, PLANET_SEED + 9) * TRAIL_WIGGLE * Math.sin(t * Math.PI);
        out.push(normalize({ x: p.x + side.x * w, y: p.y + side.y * w, z: p.z + side.z * w }));
      }
    }
  }
  return out;
}
export const TRAIL_SAMPLES: V3[] = buildTrailSamples();

/** Angular distance from `d` to the nearest trail sample. */
export function trailDistance(d: V3): number {
  let best = -1;
  for (let i = 0; i < TRAIL_SAMPLES.length; i++) {
    const s = TRAIL_SAMPLES[i];
    const dd = d.x * s.x + d.y * s.y + d.z * s.z;
    if (dd > best) best = dd;
  }
  return Math.acos(clamp(best, -1, 1));
}
/** 1 on the trail centre line, 0 beyond the shoulder (~2 character widths). */
export function trailMask(d: V3): number {
  return mask(trailDistance(d), 0.014, 0.034);
}

export function campMask(d: V3): number {
  return mask(angDist(d, REGIONS.camp), 0.22, 0.34);
}
export function lakeMask(d: V3): number {
  return mask(angDist(d, REGIONS.lake), 0.15, 0.30);
}
export function hillsMask(d: V3): number {
  return mask(angDist(d, REGIONS.hills), 0.22, 0.62);
}
export function forestMask(d: V3): number {
  return mask(angDist(d, REGIONS.forest), 0.30, 0.78);
}

/** Terrain height offset from PLANET_RADIUS at unit direction `d`. Deterministic. */
export function heightAt(d: V3): number {
  const n = fbm3(d.x * 2.2, d.y * 2.2, d.z * 2.2, 4, PLANET_SEED);
  let h = n * 1.1 + 0.35;
  const hm = hillsMask(d);
  if (hm > 0) {
    // A broad highland (1.4) with ridges on top (up to +4.2), quantised into
    // flat terraces with near-vertical cliff steps (the Animal Crossing cliff look).
    const r = 1 - Math.abs(simplex3(d.x * 3.3 + 5, d.y * 3.3, d.z * 3.3, PLANET_SEED + 1));
    const ridge = r * r * 4.2 + n * 0.5;
    const step = 1.15;
    const base = Math.floor(ridge / step) * step;
    const terraced = base + (ridge - base) * 0.12;
    h += hm * (1.4 + terraced);
  }
  const lm = lakeMask(d);
  if (lm > 0) h += (-2.4 + n * 0.2 - h) * lm;
  const cm = campMask(d);
  if (cm > 0) h += (0.5 - h) * cm;
  const tm = trailMask(d);
  if (tm > 0) h -= 0.1 * tm * (1 - cm); // no groove across the camp plateau
  return h;
}

/** Radius a body stands at (terrain, but never below the wading floor). */
export function surfaceRadius(d: V3): number {
  return PLANET_RADIUS + Math.max(heightAt(d), WATER_LEVEL - 0.35);
}

/** Can a walker stand here? Deep water is a boundary (you can wade the rim). */
export function isWalkable(d: V3): boolean {
  return heightAt(d) > WATER_LEVEL - 0.55;
}

export function biomeAt(d: V3): Biome {
  if (lakeMask(d) > 0.5) return "lake";
  if (campMask(d) > 0.5) return "camp";
  if (hillsMask(d) > 0.5) return "hills";
  if (forestMask(d) > 0.5) return "forest";
  return "meadow";
}

/** Local frame at `d`: east/north tangents + up. Stable away from the poles. */
export function frameAt(d: V3): { east: V3; north: V3; up: V3 } {
  const up = normalize(d);
  const ref = Math.abs(up.y) > 0.95 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const east = normalize(cross(ref, up));
  const north = normalize(cross(up, east));
  return { east, north, up };
}

/** Direction offset from `center` by (east, north) metres along the surface. */
export function offsetDir(center: V3, eastM: number, northM: number): V3 {
  const f = frameAt(center);
  const k = 1 / PLANET_RADIUS;
  return normalize({
    x: center.x + f.east.x * eastM * k + f.north.x * northM * k,
    y: center.y + f.east.y * eastM * k + f.north.y * northM * k,
    z: center.z + f.east.z * eastM * k + f.north.z * northM * k,
  });
}

/** World position (metres) of a body standing at `d`. */
export function worldPosition(d: V3, extraUp = 0): V3 {
  const r = surfaceRadius(d) + extraUp;
  return { x: d.x * r, y: d.y * r, z: d.z * r };
}
