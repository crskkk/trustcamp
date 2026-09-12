// src/modules/world3d/internal/sky.ts — gradient sky dome, sun disc, clouds.
// The dome follows the camera and shades by the player's local "up", so the
// zenith is always overhead no matter where you stand on the sphere.
import {
  BackSide, CircleGeometry, Color, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  Quaternion, ShaderMaterial, SphereGeometry, Vector3,
} from "three";
import { PALETTE } from "./palette";
import { toon } from "./lighting";
import { seededRandom } from "./noise";
import { PLANET_RADIUS } from "./planet";

const DOME_R = 320;

const VERT = `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = normalize(wp.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FRAG = `
uniform vec3 uUp;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float t = dot(d, normalize(uUp));
  float k = smoothstep(-0.12, 0.55, t);
  vec3 c = mix(uHorizon, uZenith, k);
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  c += vec3(1.0, 0.93, 0.78) * pow(s, 24.0) * 0.35;
  gl_FragColor = vec4(c, 1.0);
}`;

export interface Sky {
  group: Group;
  update(camPos: Vector3, up: Vector3, sunDir: Vector3, dt: number): void;
}

export function createSky(): Sky {
  const group = new Group();
  group.name = "sky";

  const domeMat = new ShaderMaterial({
    uniforms: {
      uUp: { value: new Vector3(0, 1, 0) },
      uZenith: { value: new Color(PALETTE.skyZenith) },
      uHorizon: { value: new Color(PALETTE.skyHorizon) },
      uSunDir: { value: new Vector3(0, 1, 0) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  const dome = new Mesh(new SphereGeometry(DOME_R, 32, 18), domeMat);
  dome.frustumCulled = false;
  dome.renderOrder = -20;
  group.add(dome);

  const sun = new Mesh(new CircleGeometry(11, 28), new MeshBasicMaterial({ color: PALETTE.sun, fog: false, depthWrite: false }));
  sun.renderOrder = -19;
  const glow = new Mesh(new CircleGeometry(24, 28), new MeshBasicMaterial({ color: 0xfff4d6, fog: false, depthWrite: false, transparent: true, opacity: 0.22 }));
  glow.renderOrder = -19;
  group.add(sun, glow);

  // Clouds: 4 blob parts x N instances, drifting slowly around the planet.
  const cloudGroup = new Group();
  const N = 46;
  const rnd = seededRandom(99);
  const blobs: Array<[number, number, number, number]> = [[0, 0, 0, 1], [1.15, 0.12, 0.25, 0.72], [-1.05, 0.08, -0.15, 0.78], [0.3, 0.32, -0.7, 0.6], [-0.2, 0.28, 0.75, 0.55]];
  const geo = new IcosahedronGeometry(1, 1);
  const mat = toon({ color: PALETTE.cloud });
  const m = new Matrix4(), q = new Quaternion(), pos = new Vector3(), sc = new Vector3();
  const centers: Array<{ d: Vector3; s: number; yaw: number }> = [];
  for (let i = 0; i < N; i++) {
    const z = rnd() * 2 - 1, phi = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    centers.push({ d: new Vector3(r * Math.cos(phi), z, r * Math.sin(phi)), s: 1.7 + rnd() * 1.9, yaw: rnd() * Math.PI * 2 });
  }
  const up = new Vector3(), x = new Vector3(), zz = new Vector3(), basis = new Matrix4();
  for (const [ox, oy, oz, bs] of blobs) {
    const im = new InstancedMesh(geo, mat, N);
    im.castShadow = false;
    for (let i = 0; i < N; i++) {
      const c = centers[i];
      up.copy(c.d);
      const ref = Math.abs(up.y) > 0.95 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
      x.crossVectors(ref, up).normalize();
      zz.crossVectors(up, x).normalize();
      basis.makeBasis(x, up, zz);
      q.setFromRotationMatrix(basis);
      const rot = new Quaternion().setFromAxisAngle(up, c.yaw);
      q.premultiply(rot);
      const alt = PLANET_RADIUS + 40;
      const local = new Vector3(ox, oy, oz).multiplyScalar(c.s).applyQuaternion(q);
      pos.copy(up).multiplyScalar(alt).add(local);
      sc.set(c.s * bs, c.s * bs * 0.55, c.s * bs);
      m.compose(pos, q, sc);
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
    cloudGroup.add(im);
  }
  group.add(cloudGroup);
  const driftAxis = new Vector3(0.25, 1, 0.15).normalize();

  const sunPos = new Vector3();
  return {
    group,
    update(camPos, upv, sunDir, dt) {
      dome.position.copy(camPos);
      domeMat.uniforms.uUp.value.copy(upv);
      domeMat.uniforms.uSunDir.value.copy(sunDir);
      sunPos.copy(camPos).addScaledVector(sunDir, DOME_R * 0.9);
      sun.position.copy(sunPos);
      glow.position.copy(sunPos).addScaledVector(sunDir, -0.5);
      sun.lookAt(camPos);
      glow.lookAt(camPos);
      cloudGroup.rotateOnAxis(driftAxis, dt * 0.008);
    },
  };
}
