// src/modules/world3d/internal/water.ts — the lake surface.
// A fine polar disc conformed to the sphere at WATER_LEVEL, with per-vertex
// depth so the shore gets foam and shallows exactly where the terrain crosses
// the water line. Stylised ripples, no reflections (cheap, and it reads).
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, ShaderMaterial, Uint32BufferAttribute } from "three";
import { PALETTE } from "./palette";
import { PLANET_RADIUS, WATER_LEVEL, REGIONS, heightAt, offsetDir } from "./planet";

const RINGS = 44;
const SEGS = 96;
const RADIUS_M = 28; // wider than the basin so the shoreline is the terrain, never the disc edge

function buildDisc(): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const depth: number[] = [];
  const push = (e: number, n: number) => {
    const d = offsetDir(REGIONS.lake, e, n);
    const r = PLANET_RADIUS + WATER_LEVEL;
    positions.push(d.x * r, d.y * r, d.z * r);
    normals.push(d.x, d.y, d.z);
    depth.push(WATER_LEVEL - heightAt(d));
  };
  push(0, 0);
  for (let i = 1; i <= RINGS; i++) {
    const rr = (RADIUS_M * i) / RINGS;
    for (let j = 0; j < SEGS; j++) {
      const a = (j / SEGS) * Math.PI * 2;
      push(Math.cos(a) * rr, Math.sin(a) * rr);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < SEGS; j++) idx.push(0, 1 + j, 1 + ((j + 1) % SEGS));
  for (let i = 1; i < RINGS; i++) {
    const a0 = 1 + (i - 1) * SEGS, b0 = 1 + i * SEGS;
    for (let j = 0; j < SEGS; j++) {
      const j1 = (j + 1) % SEGS;
      idx.push(a0 + j, b0 + j, b0 + j1, a0 + j, b0 + j1, a0 + j1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geo.setAttribute("depth", new Float32BufferAttribute(depth, 1));
  geo.setIndex(new Uint32BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

const VERT = `
uniform float uTime;
attribute float depth;
varying float vDepth;
varying vec3 vWorld;
void main() {
  vDepth = depth;
  float w = sin(uTime * 1.3 + position.x * 0.8 + position.z * 0.6) * 0.03
          + sin(uTime * 0.9 - position.y * 1.1 + position.z * 0.5) * 0.03;
  vec3 p = position + normal * w;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = `
uniform float uTime;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
varying float vDepth;
varying vec3 vWorld;
void main() {
  float d = clamp(vDepth / 2.6, 0.0, 1.0);
  vec3 c = mix(uShallow, uDeep, smoothstep(0.05, 1.0, d));
  float r1 = sin((vWorld.x * 1.9 + vWorld.z * 1.3 + vWorld.y * 0.7) * 1.6 + uTime * 1.4);
  float r2 = sin((vWorld.x * 0.7 - vWorld.z * 2.1 + vWorld.y * 1.3) * 1.9 - uTime * 1.0);
  float rip = smoothstep(0.55, 0.95, r1 * r2);
  c = mix(c, vec3(1.0), rip * 0.16);
  float foam = 1.0 - smoothstep(0.0, 0.3, vDepth + sin(uTime * 1.1 + vWorld.x * 3.0 + vWorld.z * 2.0) * 0.06);
  c = mix(c, uFoam, foam * 0.85);
  gl_FragColor = vec4(c, 0.9 - foam * 0.3);
}`;

export interface Water {
  mesh: Mesh;
  update(t: number): void;
}

export function createWater(): Water {
  const mat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uShallow: { value: new Color(PALETTE.water) },
      uDeep: { value: new Color(PALETTE.waterDeep) },
      uFoam: { value: new Color(0xf4fbff) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: true,
    side: DoubleSide,
  });
  const mesh = new Mesh(buildDisc(), mat);
  mesh.name = "water";
  mesh.receiveShadow = false;
  return {
    mesh,
    update(t: number) {
      mat.uniforms.uTime.value = t;
    },
  };
}
