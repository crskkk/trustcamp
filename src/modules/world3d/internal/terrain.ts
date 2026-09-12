// src/modules/world3d/internal/terrain.ts — the planet mesh.
// A flat-shaded icosphere displaced by planet.heightAt, coloured per face by
// biome with the alternating light/dark "triangle grass" of Animal Crossing.
import { BufferAttribute, Color, IcosahedronGeometry, Mesh } from "three";
import { simplex3 } from "./noise";
import { PALETTE } from "./palette";
import { toon } from "./lighting";
import {
  PLANET_RADIUS, WATER_LEVEL, heightAt, trailMask, campMask, lakeMask, hillsMask, forestMask, smoothstep, type V3,
} from "./planet";

export function buildTerrain(detail = 80): Mesh {
  const geo = new IcosahedronGeometry(1, detail); // non-indexed: flat shading for free
  const pos = geo.attributes.position as BufferAttribute;
  const count = pos.count;
  const heights = new Float32Array(count);
  const dirs = new Float32Array(count * 3);
  const cache = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
    let h = cache.get(key);
    if (h === undefined) {
      h = heightAt({ x, y, z });
      cache.set(key, h);
    }
    heights[i] = h;
    dirs[i * 3] = x;
    dirs[i * 3 + 1] = y;
    dirs[i * 3 + 2] = z;
    const r = PLANET_RADIUS + h;
    pos.setXYZ(i, x * r, y * r, z * r);
  }

  const colors = new Float32Array(count * 3);
  const col = new Color();
  const cGrass = new Color(PALETTE.grass), cGL = new Color(PALETTE.grassLight), cGD = new Color(PALETTE.grassDark);
  const cMeadow = new Color(PALETTE.meadow), cDirt = new Color(PALETTE.dirt), cDirtL = new Color(PALETTE.dirtLight);
  const cCamp = new Color(PALETTE.campGround), cSand = new Color(PALETTE.sand), cLakebed = new Color(PALETTE.lakebed);
  const cRock = new Color(PALETTE.rock), cRockD = new Color(PALETTE.rockDark), cSnow = new Color(PALETTE.snow);
  const d: V3 = { x: 0, y: 0, z: 0 };

  for (let f = 0; f < count; f += 3) {
    const a = f * 3, b = (f + 1) * 3, c = (f + 2) * 3;
    d.x = dirs[a] + dirs[b] + dirs[c];
    d.y = dirs[a + 1] + dirs[b + 1] + dirs[c + 1];
    d.z = dirs[a + 2] + dirs[b + 2] + dirs[c + 2];
    const m = Math.hypot(d.x, d.y, d.z) || 1;
    d.x /= m; d.y /= m; d.z /= m;
    const h0 = heights[f], h1 = heights[f + 1], h2 = heights[f + 2];
    const h = (h0 + h1 + h2) / 3;
    const dh = Math.max(h0, h1, h2) - Math.min(h0, h1, h2);
    const tm = trailMask(d), cm = campMask(d), lm = lakeMask(d), hm = hillsMask(d), fm = forestMask(d);
    const v = simplex3(d.x * 38, d.y * 38, d.z * 38, 21);
    const parity = ((f / 3) | 0) & 1;

    col.copy(cGrass);
    col.lerp(v > 0 ? cGL : cGD, Math.min(1, Math.abs(v)) * 0.25);
    col.lerp(parity ? cGL : cGD, 0.04); // a whisper of the AC triangle-grass, not a checkerboard
    if (fm > 0) col.lerp(cGD, fm * 0.25);
    if (hm > 0) col.lerp(cMeadow, hm * 0.35);
    if (hm > 0 && h > 3.6) col.lerp(v > 0 ? cRock : cRockD, smoothstep(3.6, 4.6, h));
    if (dh > 0.42) col.lerp(v > 0 ? cRock : cRockD, smoothstep(0.42, 0.7, dh));
    if (h > 5.2) col.lerp(cSnow, smoothstep(5.2, 6.0, h));
    if (lm > 0) {
      if (h < WATER_LEVEL - 0.35) col.lerp(cLakebed, 0.9);
      else if (h < WATER_LEVEL + 0.6) col.lerp(cSand, smoothstep(WATER_LEVEL + 0.6, WATER_LEVEL - 0.35, h) * 0.95);
    }
    if (cm > 0) col.lerp(cCamp, cm * 0.6);
    if (tm > 0) col.lerp(v > 0 ? cDirtL : cDirt, tm);

    for (let k = 0; k < 3; k++) {
      colors[(f + k) * 3] = col.r;
      colors[(f + k) * 3 + 1] = col.g;
      colors[(f + k) * 3 + 2] = col.b;
    }
  }
  geo.setAttribute("color", new BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const mesh = new Mesh(geo, toon({ vertexColors: true }));
  mesh.name = "terrain";
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}
