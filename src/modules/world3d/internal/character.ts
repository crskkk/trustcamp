// src/modules/world3d/internal/character.ts — the procedural camper.
// Animal-Crossing proportions: ~2.4 heads tall, big round head, tiny body,
// stubby limbs, large simple eyes, cheeks, a small smile. Built from
// primitives + toon materials from an AvatarSpec (seed -> same camper on every
// client). Players and NPCs use this identical builder (AGENTS §9).
import {
  BoxGeometry, CapsuleGeometry, CircleGeometry, ConeGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3,
} from "three";
import type { AvatarSpec } from "../../avatar/api";
import { EYES, HAIR, OUTFIT, OUTFIT_BOTTOM, SHOE, SKIN } from "./palette";
import { toon } from "./lighting";

export interface CharacterRig {
  group: Group;
  body: Group;
  head: Group;
  armL: Group;
  armR: Group;
  legL: Group;
  legR: Group;
  phase: number;
}

export interface Pose {
  /** 0..1 locomotion intensity. */
  speed01: number;
  airborne: boolean;
  /** 0..1 landing squash. */
  squash: number;
  /** seconds left of the wave emote (0 = none). */
  emoteT: number;
}

function part(geo: Parameters<typeof Mesh>[0], color: number, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(geo, toon({ color }));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

const HEAD_R = 0.245;
const HEAD_Y = 0.76;

function hair(style: number, color: number): Group {
  const g = new Group();
  const cap = part(new SphereGeometry(HEAD_R * 1.06, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), color, 0, 0.03, 0);
  cap.scale.set(1, 0.95, 1);
  g.add(cap);
  switch (style % 5) {
    case 0: // bob: fuller sides + bang
      g.add(part(new BoxGeometry(0.42, 0.1, 0.12, 1, 1, 1), color, 0, 0.13, 0.2));
      for (const x of [-0.24, 0.24]) g.add(part(new CapsuleGeometry(0.06, 0.16, 4, 8), color, x, -0.02, 0.02));
      break;
    case 1: // spiky
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const s = part(new ConeGeometry(0.07, 0.2, 5), color, Math.cos(a) * 0.12, 0.22, Math.sin(a) * 0.12);
        s.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        g.add(s);
      }
      break;
    case 2: // long
      for (const x of [-0.2, 0.2]) g.add(part(new CapsuleGeometry(0.075, 0.34, 4, 8), color, x, -0.14, -0.06));
      g.add(part(new BoxGeometry(0.4, 0.09, 0.1), color, 0, 0.14, 0.21));
      break;
    case 3: // pigtails
      for (const x of [-0.29, 0.29]) g.add(part(new SphereGeometry(0.1, 10, 8), color, x, -0.04, -0.02));
      break;
    default: // bun
      g.add(part(new SphereGeometry(0.11, 10, 8), color, 0, 0.3, -0.05));
      break;
  }
  return g;
}

export function buildCharacter(spec: AvatarSpec): CharacterRig {
  const group = new Group();
  group.name = "camper";
  const skin = SKIN[spec.skinTone % SKIN.length];
  const shirt = OUTFIT[spec.bodyAccent % OUTFIT.length];
  const pants = OUTFIT_BOTTOM[(spec.bodyAccent + spec.hairColor) % OUTFIT_BOTTOM.length];
  const eye = EYES[spec.eyeColor % EYES.length];
  const hairColor = HAIR[spec.hairColor % HAIR.length];

  const body = new Group();
  body.position.y = 0;
  const torso = part(new CapsuleGeometry(0.17, 0.2, 4, 12), shirt, 0, 0.36, 0);
  body.add(torso);

  const mkLeg = (x: number) => {
    const leg = new Group();
    leg.position.set(x, 0.2, 0);
    leg.add(part(new CapsuleGeometry(0.065, 0.1, 3, 8), pants, 0, -0.07, 0));
    const foot = part(new SphereGeometry(0.09, 10, 8), SHOE, 0, -0.16, 0.03);
    foot.scale.set(1, 0.55, 1.35);
    leg.add(foot);
    return leg;
  };
  const legL = mkLeg(-0.085), legR = mkLeg(0.085);
  group.add(legL, legR);

  const mkArm = (x: number) => {
    const arm = new Group();
    arm.position.set(x, 0.52, 0);
    arm.add(part(new CapsuleGeometry(0.055, 0.14, 3, 8), shirt, 0, -0.1, 0));
    arm.add(part(new SphereGeometry(0.06, 10, 8), skin, 0, -0.22, 0));
    arm.rotation.z = x < 0 ? 0.18 : -0.18;
    return arm;
  };
  const armL = mkArm(-0.21), armR = mkArm(0.21);
  body.add(armL, armR);

  const head = new Group();
  head.position.y = HEAD_Y;
  const skull = part(new SphereGeometry(HEAD_R, 22, 16), skin, 0, 0, 0);
  skull.scale.set(1, 0.94, 0.97);
  head.add(skull);

  const eyeScale = spec.expression === 3 ? 1.3 : 1;
  for (const x of [-0.095, 0.095]) {
    const e = part(new SphereGeometry(0.05, 10, 8), eye, x, 0.0, 0.21);
    e.scale.set(0.9 * eyeScale, 1.35 * eyeScale, 0.5);
    if (spec.expression === 2) e.rotation.z = x < 0 ? -0.3 : 0.3;
    const pupil = part(new SphereGeometry(0.03, 8, 6), 0x1e1a24, 0, -0.005, 0.03);
    pupil.scale.set(0.9, 1.2, 0.6);
    e.add(pupil);
    const hi = part(new SphereGeometry(0.013, 6, 6), 0xffffff, 0.014, 0.022, 0.05);
    e.add(hi);
    head.add(e);
  }
  for (const x of [-0.165, 0.165]) {
    const cheek = new Mesh(new CircleGeometry(0.036, 10), toon({ color: 0xffa3b3, transparent: true, opacity: 0.7 }));
    cheek.position.set(x, -0.055, 0.185);
    cheek.lookAt(new Vector3(x * 4, -0.2, 1));
    head.add(cheek);
  }
  const smile = spec.expression === 2 ? 0.02 : spec.expression === 0 ? 0.045 : 0.034;
  const mouth = part(new TorusGeometry(smile, 0.008, 6, 10, Math.PI), 0x8b3a4a, 0, -0.095, 0.225);
  mouth.rotation.z = spec.expression === 2 ? 0 : Math.PI;
  head.add(mouth);
  head.add(hair(spec.hairStyle, hairColor));
  body.add(head);
  group.add(body);

  return { group, body, head, armL, armR, legL, legR, phase: 0 };
}

/** Procedural animation: idle bob, bouncy walk, jump tuck, landing squash, wave. */
export function animateCharacter(rig: CharacterRig, pose: Pose, dt: number, t: number): void {
  const s = pose.speed01;
  rig.phase += dt * (5 + 6 * s) * (s > 0.02 ? 1 : 0);
  const p = rig.phase;
  const swing = Math.sin(p) * 0.85 * s;
  rig.legL.rotation.x = swing;
  rig.legR.rotation.x = -swing;
  rig.armL.rotation.x = -swing * 0.7;
  rig.armR.rotation.x = swing * 0.7;
  rig.body.position.y = Math.abs(Math.sin(p)) * 0.045 * s + Math.sin(t * 2.2) * 0.008 * (1 - s);
  rig.body.rotation.x = 0.07 * s;
  rig.body.rotation.z = Math.sin(p) * 0.03 * s;
  rig.head.rotation.y = Math.sin(t * 0.7) * 0.08 * (1 - s);
  rig.head.rotation.z = Math.sin(p * 0.5) * 0.04 * s;
  if (pose.airborne) {
    rig.legL.rotation.x = rig.legR.rotation.x = -0.6;
    rig.armL.rotation.z = 0.9;
    rig.armR.rotation.z = -0.9;
  } else {
    rig.armL.rotation.z = 0.18;
    rig.armR.rotation.z = -0.18;
  }
  if (pose.emoteT > 0) {
    rig.armR.rotation.z = -2.6;
    rig.armR.rotation.x = Math.sin(t * 14) * 0.5;
  }
  const sq = pose.squash;
  rig.group.scale.set(1 + 0.18 * sq, 1 - 0.22 * sq, 1 + 0.18 * sq);
}
