// src/modules/world3d/internal/camera.ts — chase camera + screensaver orbit.
import { PerspectiveCamera, Vector3 } from "three";
import { PLANET_RADIUS, surfaceRadius } from "./planet";

export type CameraMode = "chase" | "orbit";

const _desired = new Vector3();
const _look = new Vector3();
const _dir = new Vector3();

export class ChaseCamera {
  readonly camera: PerspectiveCamera;
  mode: CameraMode = "chase";
  orbitYawDeg = 0;
  private readonly pos = new Vector3();
  private initialised = false;

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(50, aspect, 0.1, 700);
  }

  /** Snap to the desired position on the next update (after a teleport). */
  reset(): void {
    this.initialised = false;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** `feet` is the player's world position; `up` / `fwd` the player's frame. */
  update(feet: Vector3, up: Vector3, fwd: Vector3, dt: number): void {
    if (this.mode === "orbit") {
      const yaw = (this.orbitYawDeg * Math.PI) / 180;
      const R = PLANET_RADIUS * 2.15;
      this.pos.set(Math.cos(yaw) * R, PLANET_RADIUS * 0.95, Math.sin(yaw) * R);
      this.camera.position.copy(this.pos);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(0, 0, 0);
      this.initialised = false;
      return;
    }
    _desired.copy(feet).addScaledVector(up, 3.4).addScaledVector(fwd, -6.0); // 3/4 diorama angle
    if (!this.initialised) {
      this.pos.copy(_desired);
      this.initialised = true;
    } else {
      this.pos.lerp(_desired, 1 - Math.exp(-5.5 * dt));
    }
    // Never let the camera sink into the terrain.
    _dir.copy(this.pos).normalize();
    const minR = surfaceRadius({ x: _dir.x, y: _dir.y, z: _dir.z }) + 0.8;
    if (this.pos.length() < minR) this.pos.setLength(minR);
    this.camera.position.copy(this.pos);
    this.camera.up.copy(up);
    _look.copy(feet).addScaledVector(up, 0.8);
    this.camera.lookAt(_look);
  }
}
