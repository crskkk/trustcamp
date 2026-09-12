// src/modules/world3d/internal/lighting.ts — toon ramp, sun + sky light.
// The sun rides along with the player so every area is lit like a fixed-camera
// diorama (the Animal Crossing look) instead of half the planet being night.
import {
  DataTexture, DirectionalLight, HemisphereLight, MeshToonMaterial, NearestFilter, RedFormat, Vector3,
  type MeshToonMaterialParameters,
} from "three";

let gradient: DataTexture | null = null;

/** A 3-step luminance ramp shared by every toon material. */
export function gradientMap(): DataTexture {
  if (!gradient) {
    const data = new Uint8Array([140, 196, 255]); // lighter shadow step: soft, not black
    gradient = new DataTexture(data, 3, 1, RedFormat);
    gradient.minFilter = NearestFilter;
    gradient.magFilter = NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export function toon(params: MeshToonMaterialParameters = {}): MeshToonMaterial {
  return new MeshToonMaterial({ gradientMap: gradientMap(), ...params });
}

export interface Lights {
  hemi: HemisphereLight;
  sun: DirectionalLight;
}

export function createLights(shadowSize: number): Lights {
  const hemi = new HemisphereLight(0xd6ecff, 0xc7a880, 1.3);
  const sun = new DirectionalLight(0xfff1d6, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const c = sun.shadow.camera;
  c.left = -34;
  c.right = 34;
  c.top = 34;
  c.bottom = -34;
  c.near = 1;
  c.far = 120;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 7;
  return { hemi, sun };
}

const _p = new Vector3();

/** Re-aim the sun so it sits high and to the side of the player, wherever they are on the sphere. */
export function updateSun(l: Lights, playerPos: Vector3, up: Vector3, east: Vector3, north: Vector3): void {
  _p.copy(playerPos).addScaledVector(up, 44).addScaledVector(east, 28).addScaledVector(north, -18);
  l.sun.position.copy(_p);
  l.sun.target.position.copy(playerPos);
  l.sun.target.updateMatrixWorld();
  l.hemi.position.copy(up); // hemisphere "sky" direction follows local up
}
