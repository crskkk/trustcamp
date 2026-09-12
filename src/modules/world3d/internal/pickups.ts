// src/modules/world3d/internal/pickups.ts — collectible props for minigames.
// Small bobbing/spinning items on a soft ground ring: logs, lanterns (lit or
// unlit), pinecones and berries. Minigames add/remove them by id through the
// World; they never touch Three.js.
import {
  BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshToonMaterial,
  Quaternion, SphereGeometry,
} from "three";
import { PALETTE } from "./palette";
import { toon } from "./lighting";
import { surfaceQuaternion } from "./props";
import { normalize, surfaceRadius, type V3 } from "./planet";

export type PickupKind = "log" | "lantern" | "pinecone" | "berry";
export interface PickupOpts { lit?: boolean }

interface Entry {
  id: string;
  kind: PickupKind;
  root: Group;
  inner: Group;
  ring: Mesh;
  lamp: Mesh | null;
  phase: number;
}

const _q = new Quaternion();
const ringGeo = new CircleGeometry(0.5, 20);

function mesh(geo: Mesh["geometry"], mat: Mesh["material"], x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function buildInner(kind: PickupKind, lit: boolean): { inner: Group; lamp: Mesh | null } {
  const inner = new Group();
  let lamp: Mesh | null = null;
  switch (kind) {
    case "log": {
      const l = mesh(new CylinderGeometry(0.13, 0.15, 0.72, 7), toon({ color: PALETTE.woodDark }), 0, 0.15, 0);
      l.rotation.z = Math.PI / 2;
      inner.add(l);
      for (const x of [-0.36, 0.36]) inner.add(mesh(new CylinderGeometry(0.13, 0.13, 0.02, 7), toon({ color: 0xd9b27a }), x, 0.15, 0)).rotation.z = Math.PI / 2;
      break;
    }
    case "lantern": {
      inner.add(mesh(new CylinderGeometry(0.16, 0.2, 0.08, 8), toon({ color: PALETTE.woodDark }), 0, 0.04, 0));
      lamp = mesh(new BoxGeometry(0.28, 0.36, 0.28), toon({ color: lit ? PALETTE.lantern : 0x8d8a7f, emissive: lit ? PALETTE.lantern : 0x000000, emissiveIntensity: 1.7 }), 0, 0.28, 0);
      inner.add(lamp);
      inner.add(mesh(new ConeGeometry(0.24, 0.16, 4), toon({ color: PALETTE.woodDark }), 0, 0.54, 0));
      break;
    }
    case "pinecone": {
      inner.add(mesh(new ConeGeometry(0.13, 0.3, 6), toon({ color: 0x7a5230 }), 0, 0.15, 0));
      inner.add(mesh(new ConeGeometry(0.16, 0.16, 6), toon({ color: 0x8f6238 }), 0, 0.09, 0));
      break;
    }
    case "berry": {
      for (const [x, y, z] of [[0, 0.12, 0], [0.09, 0.08, 0.05], [-0.07, 0.09, 0.07]]) inner.add(mesh(new SphereGeometry(0.075, 8, 6), toon({ color: 0xe0434f }), x, y, z));
      const leaf = mesh(new BoxGeometry(0.16, 0.02, 0.09), toon({ color: 0x5fb64d }), 0.02, 0.2, -0.04);
      leaf.rotation.y = 0.6;
      inner.add(leaf);
      break;
    }
  }
  return { inner, lamp };
}

export class PickupLayer {
  readonly group = new Group();
  private readonly entries = new Map<string, Entry>();

  constructor() {
    this.group.name = "pickups";
  }

  add(id: string, kind: PickupKind, pos: V3, opts: PickupOpts = {}): void {
    if (this.entries.has(id)) this.remove(id);
    const d = normalize(pos);
    const r = surfaceRadius(d);
    const root = new Group();
    root.position.set(d.x * r, d.y * r, d.z * r);
    root.quaternion.copy(surfaceQuaternion(d, (id.length * 1.7) % 6.28, _q));
    const ring = new Mesh(ringGeo, new MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.35, depthWrite: false, side: DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const { inner, lamp } = buildInner(kind, !!opts.lit);
    root.add(ring, inner);
    this.group.add(root);
    this.entries.set(id, { id, kind, root, inner, ring, lamp, phase: Math.random() * 6.28 });
  }

  set(id: string, opts: PickupOpts): void {
    const e = this.entries.get(id);
    if (!e || !e.lamp) return;
    const m = e.lamp.material as MeshToonMaterial;
    m.color.setHex(opts.lit ? PALETTE.lantern : 0x8d8a7f);
    m.emissive.setHex(opts.lit ? PALETTE.lantern : 0x000000);
    (e.ring.material as MeshBasicMaterial).opacity = opts.lit ? 0.12 : 0.35;
  }

  remove(id: string): void {
    const e = this.entries.get(id);
    if (!e) return;
    this.group.remove(e.root);
    this.entries.delete(id);
  }

  clear(prefix?: string): void {
    for (const id of [...this.entries.keys()]) if (!prefix || id.startsWith(prefix)) this.remove(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  update(t: number, dt: number): void {
    for (const e of this.entries.values()) {
      e.inner.position.y = 0.16 + Math.sin(t * 2.6 + e.phase) * 0.06;
      e.inner.rotation.y += dt * 1.1;
      const s = 1 + Math.sin(t * 3 + e.phase) * 0.08;
      e.ring.scale.set(s, s, 1);
    }
  }
}
