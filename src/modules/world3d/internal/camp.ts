// src/modules/world3d/internal/camp.ts — the campground and lake dock.
// Hand-placed "manmade" structures on the camp plateau: lodge, cabins, tents,
// campfire, benches, lanterns, signposts, gate arch, flag; plus the dock at
// the lake shore. Built from primitives + toon materials, no external assets.
import {
  BoxGeometry, BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Float32BufferAttribute,
  Group, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, PointLight, Points, PointsMaterial, Quaternion, Vector3,
  DoubleSide, type Material,
} from "three";
import { PALETTE } from "./palette";
import { toon } from "./lighting";
import { surfaceQuaternion } from "./props";
import {
  PLANET_RADIUS, WATER_LEVEL, REGIONS, heightAt, offsetDir, slerp, angDist, normalize, cross, frameAt, surfaceRadius, type V3,
} from "./planet";

const _q = new Quaternion();

function mesh(geo: BufferGeometry, mat: Material, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) => mesh(new BoxGeometry(w, h, d), toon({ color }), x, y, z);
const cyl = (rt: number, rb: number, h: number, seg: number, color: number, x = 0, y = 0, z = 0) =>
  mesh(new CylinderGeometry(rt, rb, h, seg), toon({ color }), x, y, z);

/** Non-indexed triangular prism (gable roof / tent) along Z: width w, height h, depth d. */
export function gableGeometry(w: number, h: number, d: number): BufferGeometry {
  const x = w / 2, z = d / 2;
  const A = [-x, 0, z], B = [x, 0, z], C = [0, h, z], D = [-x, 0, -z], E = [x, 0, -z], F = [0, h, -z];
  const tris = [A, B, C, E, D, F, A, C, F, A, F, D, B, F, C, B, E, F];
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(tris.flat(), 3));
  geo.computeVertexNormals();
  return geo;
}
const gable = (w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) => mesh(gableGeometry(w, h, d), toon({ color }), x, y, z);

/** Seat `obj` on the surface at `d` (surface radius + extraUp, or an absolute radius), facing `yaw` from east. */
function seat(obj: Object3D, d: V3, yaw: number, extraUp = 0, absRadius?: number): void {
  const r = absRadius ?? surfaceRadius(d) + extraUp;
  obj.position.set(d.x * r, d.y * r, d.z * r);
  obj.quaternion.copy(surfaceQuaternion(d, yaw, _q));
}
/** Place on the camp plateau at (east, north) metres, facing the plateau centre unless `yaw` given. */
function placeCamp(obj: Object3D, e: number, n: number, yaw?: number, extraUp = 0): void {
  const d = offsetDir(REGIONS.camp, e, n);
  seat(obj, d, yaw ?? Math.atan2(-n, -e), extraUp);
}

function lodge(): Group {
  const g = new Group();
  g.add(box(7, 3.2, 5, PALETTE.wood, 0, 1.6, 0));
  g.add(gable(8, 3.0, 6.2, PALETTE.roof, 0, 3.2, 0));
  g.add(box(1.1, 2.0, 0.12, PALETTE.woodDark, 0, 1.0, 2.52));
  for (const x of [-2.3, 2.3]) g.add(box(1.0, 0.85, 0.1, 0x8fd2ff, x, 1.8, 2.52));
  for (const x of [-2.3, 2.3]) g.add(box(1.0, 0.85, 0.1, 0x8fd2ff, x, 1.8, -2.52));
  g.add(box(7.4, 0.28, 2.2, PALETTE.woodDark, 0, 0.14, 3.6)); // porch deck
  for (const x of [-3.3, -1.1, 1.1, 3.3]) g.add(cyl(0.1, 0.11, 2.3, 7, PALETTE.woodDark, x, 1.4, 4.5));
  g.add(box(7.8, 0.16, 2.6, PALETTE.roof, 0, 2.6, 3.6)); // porch roof
  g.add(box(0.7, 1.6, 0.7, PALETTE.rockDark, 2.3, 4.2, -1.2)); // chimney
  g.add(box(2.6, 0.7, 0.1, PALETTE.woodDark, 0, 2.95, 2.58)); // sign board
  g.add(box(1.6, 0.18, 0.6, PALETTE.woodDark, 0, 0.09, 4.9)); // step
  return g;
}

function cabin(roof: number): Group {
  const g = new Group();
  g.add(box(3.2, 2.2, 3.0, PALETTE.wood, 0, 1.1, 0));
  g.add(gable(3.8, 1.9, 3.6, roof, 0, 2.2, 0));
  g.add(box(0.8, 1.5, 0.1, PALETTE.woodDark, 0, 0.75, 1.52));
  g.add(box(0.7, 0.6, 0.08, 0x8fd2ff, 1.0, 1.4, 1.52));
  return g;
}

function tent(color: number): Group {
  const g = new Group();
  g.add(gable(2.3, 1.75, 2.5, color, 0, 0, 0));
  const flap = new BufferGeometry();
  flap.setAttribute("position", new Float32BufferAttribute([-0.5, 0.01, 1.26, 0.5, 0.01, 1.26, 0, 1.25, 1.26], 3));
  flap.computeVertexNormals();
  g.add(mesh(flap, toon({ color: 0x3a3546 })));
  g.add(cyl(0.04, 0.04, 2.7, 5, PALETTE.woodDark, 0, 1.76, 0)).rotation.x = Math.PI / 2;
  return g;
}

function bench(): Group {
  const g = new Group();
  g.add(box(1.6, 0.1, 0.42, PALETTE.wood, 0, 0.46, 0));
  for (const x of [-0.6, 0.6]) g.add(box(0.12, 0.46, 0.4, PALETTE.woodDark, x, 0.23, 0));
  return g;
}

function lantern(): Group {
  const g = new Group();
  g.add(cyl(0.06, 0.08, 1.7, 6, PALETTE.woodDark, 0, 0.85, 0));
  const lamp = mesh(new BoxGeometry(0.3, 0.38, 0.3), toon({ color: PALETTE.lantern, emissive: PALETTE.lantern, emissiveIntensity: 1.4 }), 0, 1.85, 0);
  lamp.name = "lamp";
  g.add(lamp);
  g.add(mesh(new ConeGeometry(0.26, 0.18, 4), toon({ color: PALETTE.woodDark }), 0, 2.12, 0));
  return g;
}

function signpost(): Group {
  const g = new Group();
  g.add(cyl(0.07, 0.08, 1.5, 6, PALETTE.woodDark, 0, 0.75, 0));
  const b1 = box(0.8, 0.18, 0.06, PALETTE.wood, 0.1, 1.3, 0);
  b1.rotation.y = 0.5;
  const b2 = box(0.7, 0.18, 0.06, PALETTE.wood, -0.05, 1.05, 0);
  b2.rotation.y = -0.6;
  g.add(b1, b2);
  return g;
}

function gateArch(): Group {
  const g = new Group();
  for (const x of [-1.7, 1.7]) g.add(cyl(0.14, 0.17, 3.1, 7, PALETTE.woodDark, x, 1.55, 0));
  g.add(box(4.0, 0.26, 0.26, PALETTE.woodDark, 0, 3.05, 0));
  g.add(box(2.4, 0.75, 0.1, PALETTE.wood, 0, 2.3, 0));
  for (const x of [-1.0, 1.0]) g.add(cyl(0.02, 0.02, 0.4, 4, 0x6b5a4a, x, 2.85, 0));
  return g;
}

function picnicTable(): Group {
  const g = new Group();
  g.add(box(1.8, 0.09, 0.9, PALETTE.wood, 0, 0.78, 0));
  for (const z of [-0.7, 0.7]) g.add(box(1.8, 0.07, 0.32, PALETTE.wood, 0, 0.46, z));
  for (const x of [-0.7, 0.7]) g.add(box(0.1, 0.78, 1.4, PALETTE.woodDark, x, 0.39, 0));
  return g;
}

export interface Camp {
  group: Group;
  /** World position of the campfire (minigame target, light). */
  campfire: Vector3;
  update(t: number, dt: number): void;
}

export function createCamp(): Camp {
  const group = new Group();
  group.name = "camp";
  const add = (o: Object3D) => group.add(o);

  const L = lodge();
  placeCamp(L, 0, 8.0, -Math.PI / 2);
  add(L);

  const cabins: Array<[number, number, number]> = [[-8.8, 3.2, PALETTE.roofGreen], [8.8, 3.6, PALETTE.roof], [8.0, -6.5, PALETTE.roofGreen]];
  for (const [e, n, roof] of cabins) {
    const c = cabin(roof);
    placeCamp(c, e, n);
    add(c);
  }

  const tents: Array<[number, number]> = [[-4.8, -5.4], [4.6, -5.2], [-1.6, -8.6], [2.8, -8.8]];
  tents.forEach(([e, n], i) => {
    const t = tent(PALETTE.tent[i % PALETTE.tent.length]);
    placeCamp(t, e, n);
    add(t);
  });

  // Campfire.
  const fire = new Group();
  for (let i = 0; i < 4; i++) {
    const log = cyl(0.09, 0.11, 1.15, 6, PALETTE.woodDark, 0, 0.13, 0);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i * Math.PI) / 4;
    fire.add(log);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    fire.add(mesh(new DodecahedronGeometry(0.17, 0), toon({ color: i % 2 ? PALETTE.rock : PALETTE.rockDark }), Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8));
  }
  const flames: Mesh[] = [];
  const flameSpec: Array<[number, number, number, number]> = [[0.4, 0.9, 0.55, PALETTE.fire[2]], [0.28, 0.72, 0.6, PALETTE.fire[1]], [0.16, 0.55, 0.66, PALETTE.fire[0]]];
  for (const [r, h, y, color] of flameSpec) {
    const f = new Mesh(new ConeGeometry(r, h, 6), new MeshBasicMaterial({ color }));
    f.position.y = y;
    flames.push(f);
    fire.add(f);
  }
  const fireLight = new PointLight(0xffa14d, 22, 18, 2);
  fireLight.position.y = 1.0;
  fire.add(fireLight);
  const emberCount = 40;
  const emberPos = new Float32Array(emberCount * 3);
  for (let i = 0; i < emberCount; i++) {
    emberPos[i * 3] = (Math.random() - 0.5) * 0.5;
    emberPos[i * 3 + 1] = Math.random() * 2.2;
    emberPos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }
  const emberGeo = new BufferGeometry();
  emberGeo.setAttribute("position", new BufferAttribute(emberPos, 3));
  const embers = new Points(emberGeo, new PointsMaterial({ color: 0xffb060, size: 0.09, transparent: true, opacity: 0.9 }));
  fire.add(embers);
  placeCamp(fire, 0, 0, 0);
  add(fire);
  const campfire = fire.position.clone();

  for (const a of [0.4, 2.3, 4.3]) {
    const b = bench();
    placeCamp(b, Math.cos(a) * 2.6, Math.sin(a) * 2.6);
    add(b);
  }

  const lamps: Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const l = lantern();
    placeCamp(l, Math.cos(a) * 9.6, Math.sin(a) * 9.6);
    lamps.push(l.getObjectByName("lamp") as Mesh);
    add(l);
  }
  for (const x of [-1.9, 1.9]) {
    const l = lantern();
    placeCamp(l, x, 4.6);
    const pl = new PointLight(0xffc36b, 7, 10, 2);
    pl.position.y = 1.9;
    l.add(pl);
    lamps.push(l.getObjectByName("lamp") as Mesh);
    add(l);
  }

  for (const [e, n] of [[-10.6, 1.4], [10.6, 0.9], [1.5, -10.8]]) {
    const s = signpost();
    placeCamp(s, e, n);
    add(s);
  }

  const arch = gateArch();
  placeCamp(arch, -11.4, 0.2, Math.PI);
  add(arch);
  const arch2 = gateArch();
  placeCamp(arch2, 11.4, -0.2, 0);
  add(arch2);

  const pt = picnicTable();
  placeCamp(pt, -3.8, 4.8, 0.3);
  add(pt);

  // Flag pole + waving flag.
  const pole = new Group();
  pole.add(cyl(0.05, 0.07, 4.2, 6, 0xd9d9d9, 0, 2.1, 0));
  const flagGeo = new PlaneGeometry(1.1, 0.65, 8, 4);
  const flag = new Mesh(flagGeo, toon({ color: 0xff6b6b, side: DoubleSide }));
  flag.position.set(0.56, 3.75, 0);
  flag.castShadow = true;
  pole.add(flag);
  placeCamp(pole, 3.8, 5.6, 0);
  add(pole);
  const flagBase = (flagGeo.attributes.position as BufferAttribute).array.slice() as Float32Array;

  // Dock: from the lake shore (on the camp side) out over the water.
  let shore: V3 = REGIONS.lake;
  for (let t = 0; t <= 1; t += 0.004) {
    const p = slerp(REGIONS.lake, REGIONS.camp, t);
    if (heightAt(p) > WATER_LEVEL - 0.1) { shore = p; break; }
  }
  const toLake = normalize(cross(cross(shore, REGIONS.lake), shore)); // tangent toward the lake centre
  const f = frameAt(shore);
  const yaw = Math.atan2(toLake.x * f.north.x + toLake.y * f.north.y + toLake.z * f.north.z, toLake.x * f.east.x + toLake.y * f.east.y + toLake.z * f.east.z);
  const dock = new Group();
  for (let i = 0; i < 9; i++) dock.add(box(1.7, 0.08, 0.5, i % 2 ? PALETTE.wood : PALETTE.woodDark, 0, 0, -0.6 + i * 0.55));
  for (const z of [0.2, 2.4, 3.8]) for (const x of [-0.75, 0.75]) dock.add(cyl(0.08, 0.09, 1.6, 6, PALETTE.woodDark, x, -0.7, z));
  seat(dock, shore, yaw, 0, PLANET_RADIUS + WATER_LEVEL + 0.42);
  add(dock);
  const dockLamp = lantern();
  seat(dockLamp, shore, yaw, 0.0);
  dockLamp.position.addScaledVector(new Vector3().setFromMatrixColumn(dockLamp.matrixWorld, 0), 0);
  add(dockLamp);
  void angDist;

  const update = (t: number, dt: number) => {
    flames.forEach((fm, i) => {
      fm.scale.y = 1 + 0.18 * Math.sin(t * 17 + i * 2.1) + 0.08 * Math.sin(t * 31 + i);
      fm.scale.x = fm.scale.z = 1 + 0.1 * Math.sin(t * 13 + i * 1.7);
      fm.rotation.y += dt * (1.5 + i);
      fm.position.x = 0.05 * Math.sin(t * 9 + i);
    });
    fireLight.intensity = 20 + 4 * Math.sin(t * 19) + 2 * Math.sin(t * 43);
    const arr = emberGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < emberCount; i++) {
      arr[i * 3 + 1] += dt * (0.7 + (i % 5) * 0.15);
      arr[i * 3] += Math.sin(t * 3 + i) * dt * 0.15;
      if (arr[i * 3 + 1] > 2.4) { arr[i * 3 + 1] = 0.3; arr[i * 3] = (Math.random() - 0.5) * 0.4; arr[i * 3 + 2] = (Math.random() - 0.5) * 0.4; }
    }
    emberGeo.attributes.position.needsUpdate = true;
    const fp = flagGeo.attributes.position as BufferAttribute;
    for (let i = 0; i < fp.count; i++) {
      const x = flagBase[i * 3], y = flagBase[i * 3 + 1];
      const k = (x + 0.55) / 1.1;
      fp.setXYZ(i, x, y + Math.sin(t * 6 + k * 5) * 0.05 * k, Math.sin(t * 7 + k * 6) * 0.12 * k);
    }
    fp.needsUpdate = true;
    flagGeo.computeVertexNormals();
    for (let i = 0; i < lamps.length; i++) {
      const m = lamps[i].material as { emissiveIntensity: number };
      m.emissiveIntensity = 1.3 + 0.15 * Math.sin(t * 6 + i * 1.3);
    }
  };

  return { group, campfire, update };
}
