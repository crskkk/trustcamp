// src/modules/world3d/internal/walker.ts — sphere-walk locomotion (pure).
//
// Port of the Unity PlayerController.Step great-circle math. "Down" is toward
// the planet centre; the body stays on the surface and faces its travel
// direction. Players, NPCs and remote replicas all step through here
// (AGENTS §9 / STANDARDS §5.1: one locomotion path).

import { Quaternion, Vector3 } from "three";

export interface WalkerState {
  /** Unit direction from the planet centre (the position on the sphere). */
  dir: Vector3;
  /** Unit tangent the body faces. */
  fwd: Vector3;
}

const _axis = new Vector3();
const _q = new Quaternion();
const _tmp = new Vector3();

/** Project `hint` onto the tangent plane at `up`; falls back sanely at the poles. */
export function tangentOf(hint: Vector3, up: Vector3, out = new Vector3()): Vector3 {
  out.copy(hint).addScaledVector(up, -hint.dot(up));
  if (out.lengthSq() < 1e-8) out.set(0, 0, 1).addScaledVector(up, -up.z);
  if (out.lengthSq() < 1e-8) out.set(1, 0, 0).addScaledVector(up, -up.x);
  return out.normalize();
}

export function createWalker(dir: Vector3, fwdHint = new Vector3(0, 0, 1)): WalkerState {
  const d = dir.clone().normalize();
  return { dir: d, fwd: tangentOf(fwdHint, d) };
}

/**
 * Advance one step. `move` is a world-space vector (any length; it is
 * projected onto the tangent plane and clamped to length 1). Returns the
 * surface distance travelled. Mutates `s` in place.
 */
export function stepWalker(s: WalkerState, move: Vector3, dt: number, speed: number, radius: number): number {
  if (dt <= 0) return 0;
  const up = s.dir;
  tangentOf(move, up, _tmp).multiplyScalar(Math.min(1, move.length()));
  const mag = _tmp.length();
  if (mag < 1e-4) {
    tangentOf(s.fwd, up, s.fwd);
    return 0;
  }
  const dist = speed * dt * mag;
  const angle = dist / radius;
  _tmp.multiplyScalar(1 / mag);
  _axis.crossVectors(up, _tmp).normalize();
  _q.setFromAxisAngle(_axis, angle);
  s.dir.applyQuaternion(_q).normalize();
  s.fwd.copy(_tmp).applyQuaternion(_q);
  tangentOf(s.fwd, s.dir, s.fwd);
  return dist;
}

/** Smoothly turn `s.fwd` toward `target` (any vector) by at most `maxRad`. */
export function turnToward(s: WalkerState, target: Vector3, maxRad: number): void {
  tangentOf(target, s.dir, _tmp);
  if (_tmp.lengthSq() < 1e-8) return;
  const angle = s.fwd.angleTo(_tmp);
  if (angle < 1e-4) return;
  const step = Math.min(angle, maxRad);
  _axis.crossVectors(s.fwd, _tmp);
  const sign = _axis.dot(s.dir) >= 0 ? 1 : -1;
  _q.setFromAxisAngle(s.dir, sign * step);
  s.fwd.applyQuaternion(_q);
  tangentOf(s.fwd, s.dir, s.fwd);
}
