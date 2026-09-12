// src/modules/world3d/internal/props.ts — instanced vegetation and rocks.
// Every prop kind is a handful of primitive parts; each part becomes ONE
// InstancedMesh for all placements of that kind, so 5000+ props cost ~20 draw
// calls. Placement is deterministic (seeded) and biome-aware.
import {
  BufferGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Euler, Group, IcosahedronGeometry,
  InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3,
} from "three";
import { PALETTE } from "./palette";
import { toon } from "./lighting";
import { seededRandom } from "./noise";
import {
  PLANET_RADIUS, WATER_LEVEL, heightAt, trailMask, campMask, lakeMask, hillsMask, forestMask, frameAt, type V3,
} from "./planet";

interface Masks { tm: number; cm: number; lm: number; hm: number; fm: number }

interface Part {
  geo: BufferGeometry;
  color: number | readonly number[];
  offset: [number, number, number];
  scale?: [number, number, number];
  rot?: [number, number, number];
  shadow?: boolean;
}

interface Kind {
  name: string;
  seed: number;
  count: number;
  scale: [number, number];
  parts: Part[];
  /** 0..1 acceptance weight; `h` is lazy because heightAt is the expensive part. */
  weight: (m: Masks, h: () => number) => number;
}

interface Placement { d: V3; h: number; yaw: number; s: number; ci: number }

const _m = new Matrix4(), _local = new Matrix4(), _q = new Quaternion(), _pq = new Quaternion();
const _pos = new Vector3(), _scale = new Vector3(), _x = new Vector3(), _y = new Vector3(), _z = new Vector3();
const _color = new Color();

/** Quaternion whose +Y is the surface normal at `d` and whose +Z is rotated `yaw` from east. */
export function surfaceQuaternion(d: V3, yaw: number, out: Quaternion): Quaternion {
  const f = frameAt(d);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  _z.set(f.east.x * c + f.north.x * s, f.east.y * c + f.north.y * s, f.east.z * c + f.north.z * s);
  _y.set(f.up.x, f.up.y, f.up.z);
  _x.crossVectors(_y, _z).normalize(); // right = up x forward (right-handed basis)
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

function placements(kind: Kind): Placement[] {
  const rnd = seededRandom(kind.seed * 1013 + 5);
  const out: Placement[] = [];
  let tries = 0;
  const max = kind.count * 30;
  while (out.length < kind.count && tries < max) {
    tries++;
    const z = rnd() * 2 - 1, phi = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    const d: V3 = { x: r * Math.cos(phi), y: z, z: r * Math.sin(phi) };
    const m: Masks = { tm: trailMask(d), cm: campMask(d), lm: lakeMask(d), hm: hillsMask(d), fm: forestMask(d) };
    let hv: number | null = null;
    const h = () => (hv ??= heightAt(d));
    const w = kind.weight(m, h);
    if (w <= 0 || rnd() > w) continue;
    out.push({ d, h: h(), yaw: rnd() * Math.PI * 2, s: kind.scale[0] + rnd() * (kind.scale[1] - kind.scale[0]), ci: Math.floor(rnd() * 64) });
  }
  return out;
}

function buildKind(kind: Kind, group: Group): number {
  const ps = placements(kind);
  if (ps.length === 0) return 0;
  for (const part of kind.parts) {
    const multi = Array.isArray(part.color);
    const mat = toon({ color: multi ? 0xffffff : (part.color as number) });
    const mesh = new InstancedMesh(part.geo, mat, ps.length);
    mesh.name = `${kind.name}:${part.geo.type}`;
    mesh.castShadow = part.shadow !== false;
    mesh.receiveShadow = true;
    const ps3 = part.scale ?? [1, 1, 1];
    const rot = part.rot ?? [0, 0, 0];
    _pq.setFromEuler(new Euler(rot[0], rot[1], rot[2]));
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const r = PLANET_RADIUS + p.h;
      _pos.set(p.d.x * r, p.d.y * r, p.d.z * r);
      surfaceQuaternion(p.d, p.yaw, _q);
      _scale.setScalar(p.s);
      _m.compose(_pos, _q, _scale);
      _local.compose(new Vector3(part.offset[0], part.offset[1], part.offset[2]), _pq, new Vector3(ps3[0], ps3[1], ps3[2]));
      _m.multiply(_local);
      mesh.setMatrixAt(i, _m);
      if (multi) {
        const arr = part.color as readonly number[];
        mesh.setColorAt(i, _color.setHex(arr[p.ci % arr.length]));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }
  return ps.length;
}

const notOnPath = (m: Masks) => m.tm < 0.06 && m.cm < 0.03 && m.lm < 0.06;

const KINDS: Kind[] = [
  {
    name: "tree", seed: 11, count: 540, scale: [0.8, 1.15],
    parts: [
      { geo: new CylinderGeometry(0.16, 0.24, 0.95, 7), color: PALETTE.trunk, offset: [0, 0.45, 0] },
      { geo: new IcosahedronGeometry(1.05, 1), color: PALETTE.canopy, offset: [0, 1.5, 0], scale: [1, 0.82, 1] },
      { geo: new IcosahedronGeometry(0.76, 1), color: PALETTE.canopy, offset: [0.24, 2.0, 0.14] },
      { geo: new IcosahedronGeometry(0.55, 1), color: PALETTE.canopy, offset: [-0.16, 2.45, -0.08] },
    ],
    weight: (m, h) => (!notOnPath(m) || h() > 3.4 ? 0 : m.fm * 0.9 + 0.045 + m.hm * 0.08),
  },
  {
    name: "pine", seed: 12, count: 210, scale: [0.85, 1.2],
    parts: [
      { geo: new CylinderGeometry(0.1, 0.15, 1.0, 6), color: PALETTE.trunk, offset: [0, 0.5, 0] },
      { geo: new ConeGeometry(0.95, 1.3, 7), color: PALETTE.pine, offset: [0, 1.35, 0] },
      { geo: new ConeGeometry(0.72, 1.1, 7), color: PALETTE.pine, offset: [0, 2.0, 0] },
      { geo: new ConeGeometry(0.46, 0.9, 7), color: PALETTE.pine, offset: [0, 2.6, 0] },
    ],
    weight: (m, h) => (!notOnPath(m) || h() > 4.9 ? 0 : m.hm * 0.8 + m.fm * 0.15),
  },
  {
    name: "bush", seed: 13, count: 320, scale: [0.7, 1.2],
    parts: [{ geo: new IcosahedronGeometry(0.46, 1), color: PALETTE.canopy, offset: [0, 0.3, 0], scale: [1, 0.72, 1] }],
    weight: (m, h) => (m.tm > 0.3 || m.lm > 0.4 || m.cm > 0.6 || h() > 4 ? 0 : m.fm * 0.5 + 0.1 + (m.tm > 0.02 ? 0.55 : 0)),
  },
  {
    name: "flower", seed: 14, count: 1200, scale: [0.8, 1.3],
    parts: [
      { geo: new CylinderGeometry(0.02, 0.025, 0.24, 4), color: 0x4f9a3a, offset: [0, 0.12, 0], shadow: false },
      { geo: new IcosahedronGeometry(0.1, 0), color: PALETTE.flower, offset: [0, 0.27, 0], shadow: false },
    ],
    weight: (m, h) => (m.tm > 0.5 || m.lm > 0.5 || m.cm > 0.7 || h() > 3.8 ? 0 : 0.28 + (m.tm > 0.02 ? 0.6 : 0) + m.cm * 0.4),
  },
  {
    name: "grass", seed: 15, count: 2600, scale: [0.7, 1.3],
    parts: [{ geo: new ConeGeometry(0.085, 0.32, 4), color: [PALETTE.grassLight, PALETTE.grassDark, PALETTE.grass], offset: [0, 0.16, 0], shadow: false }],
    weight: (m, h) => (m.tm > 0.4 || m.cm > 0.7 || h() < WATER_LEVEL + 0.25 || h() > 4.2 ? 0 : 0.9),
  },
  {
    name: "rock", seed: 16, count: 220, scale: [0.6, 1.4],
    parts: [{ geo: new DodecahedronGeometry(0.4, 0), color: [PALETTE.rock, PALETTE.rockDark], offset: [0, 0.12, 0], scale: [1, 0.7, 1.15] }],
    weight: (m) => (m.tm > 0.3 || m.cm > 0.5 || m.lm > 0.6 ? 0 : m.hm * 0.9 + 0.07),
  },
  {
    name: "mushroom", seed: 17, count: 120, scale: [0.7, 1.3],
    parts: [
      { geo: new CylinderGeometry(0.05, 0.075, 0.2, 6), color: PALETTE.mushroomStem, offset: [0, 0.1, 0] },
      { geo: new SphereGeometry(0.15, 8, 6), color: [PALETTE.mushroomCap, 0xd9a05b], offset: [0, 0.2, 0], scale: [1, 0.55, 1] },
    ],
    weight: (m) => (m.tm > 0.3 ? 0 : m.fm * 0.85),
  },
  {
    name: "log", seed: 18, count: 70, scale: [0.8, 1.2],
    parts: [{ geo: new CylinderGeometry(0.17, 0.19, 0.95, 8), color: PALETTE.woodDark, offset: [0, 0.17, 0], rot: [0, 0, Math.PI / 2] }],
    weight: (m) => (m.tm > 0.2 ? 0 : m.fm * 0.6),
  },
  {
    name: "reed", seed: 19, count: 170, scale: [0.8, 1.3],
    parts: [
      { geo: new CylinderGeometry(0.02, 0.025, 0.75, 4), color: 0x6e8f3d, offset: [0, 0.37, 0], shadow: false },
      { geo: new CylinderGeometry(0.05, 0.05, 0.2, 5), color: 0x6b4a2a, offset: [0, 0.74, 0], shadow: false },
    ],
    weight: (m, h) => (m.lm <= 0 ? 0 : h() > WATER_LEVEL - 0.3 && h() < WATER_LEVEL + 0.35 ? 0.9 : 0),
  },
];

export function createProps(): { group: Group; total: number } {
  const group = new Group();
  group.name = "props";
  let total = 0;
  for (const k of KINDS) total += buildKind(k, group);
  return { group, total };
}
