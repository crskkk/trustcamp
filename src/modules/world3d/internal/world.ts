// src/modules/world3d/internal/world.ts — the render loop and entity glue.
// Owns the renderer, scene, player, remote replicas (other players and NPCs),
// camera, lights and the animated bits (fire, flag, water, clouds).
import {
  ACESFilmicToneMapping, Color, Fog, PCFShadowMap, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
} from "three";
import { generate } from "../../avatar/api";
import { PALETTE } from "./palette";
import { createLights, updateSun, type Lights } from "./lighting";
import { buildTerrain } from "./terrain";
import { createProps } from "./props";
import { createCamp, type Camp } from "./camp";
import { createWater, type Water } from "./water";
import { createSky, type Sky } from "./sky";
import { buildCharacter, animateCharacter, type CharacterRig } from "./character";
import { ChaseCamera, type CameraMode } from "./camera";
import { InputState } from "./input";
import { createWalker, stepWalker, tangentOf, turnToward, type WalkerState } from "./walker";
import { PLANET_RADIUS, REGIONS, offsetDir, surfaceRadius, isWalkable, frameAt, angDist, type V3 } from "./planet";
import { emitFrame } from "./registry";
import { PickupLayer, type PickupKind, type PickupOpts } from "./pickups";

/** high: full; low: weak GPUs (no shadows, 0.6x, 30 fps); software: SwiftShader/CI (0.4x, 12 fps, coarse terrain). */
export type Quality = "high" | "low" | "software";

const TIER = {
  high: { ratio: 2, cap: 0, detail: 80, shadow: 2048 },
  low: { ratio: 0.6, cap: 30, detail: 48, shadow: 1024 },
  software: { ratio: 0.3, cap: 80, detail: 28, shadow: 512 },
} as const;

export interface WorldOptions {
  seed: number;
  quality?: Quality;
  joystick?: HTMLElement | null;
  knob?: HTMLElement | null;
  jumpButton?: HTMLElement | null;
  onInput?: () => void;
}

export interface PlayerSnapshot {
  x: number; y: number; z: number;
  dir: V3; fwd: V3;
  moving: boolean;
  seed: number;
}

export interface RemoteInput {
  x: number; y: number; z: number;
  seed?: number;
  role?: string;
}

interface Remote {
  rig: CharacterRig;
  walker: WalkerState;
  target: Vector3;
  speed01: number;
  seed: number;
}

const RUN_SPEED = 6;
const _move = new Vector3(), _camFwd = new Vector3(), _camRight = new Vector3(), _up = new Vector3();
const _east = new Vector3(), _north = new Vector3(), _pos = new Vector3(), _prevDir = new Vector3(), _prevFwd = new Vector3();
const _x = new Vector3(), _sunDir = new Vector3();

/** Stable seed from an opaque id: "npc-101" -> 101; anything else hashed. */
export function seedFromId(id: string): number {
  const m = /^npc-(\d+)$/.exec(id);
  if (m) return Number(m[1]);
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % 1000003;
}

export class World {
  readonly scene = new Scene();
  readonly renderer: WebGLRenderer;
  readonly chase: ChaseCamera;
  readonly input = new InputState();
  readonly lights: Lights;
  readonly camp: Camp;
  readonly water: Water;
  readonly sky: Sky;
  readonly remotes = new Map<string, Remote>();
  readonly pickups = new PickupLayer();
  readonly quality: Quality;
  propCount = 0;
  fps = 60;
  private player: { rig: CharacterRig; walker: WalkerState; jumpY: number; jumpVel: number; grounded: boolean; speed01: number; squash: number; emoteT: number; seed: number };
  private raf = 0;
  private last = 0;
  private t = 0;
  private running = false;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, opts: WorldOptions) {
    this.canvas = canvas;
    const quality = opts.quality ?? "high";
    this.quality = quality;
    const tier = TIER[quality];
    this.renderer = new WebGLRenderer({ canvas, antialias: quality === "high", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(quality === "high" ? Math.min(window.devicePixelRatio || 1, tier.ratio) : tier.ratio);
    this.renderer.shadowMap.enabled = quality === "high";
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = SRGBColorSpace;

    this.scene.background = new Color(PALETTE.skyHorizon);
    this.scene.fog = new Fog(PALETTE.fog, 42, 160);

    this.lights = createLights(tier.shadow);
    this.scene.add(this.lights.hemi, this.lights.sun, this.lights.sun.target);

    this.scene.add(buildTerrain(tier.detail));
    const props = createProps();
    this.propCount = props.total;
    this.scene.add(props.group);
    this.camp = createCamp();
    this.scene.add(this.camp.group);
    this.water = createWater();
    this.scene.add(this.water.mesh);
    this.sky = createSky();
    this.scene.add(this.sky.group);
    this.scene.add(this.pickups.group);

    const spawn = offsetDir(REGIONS.camp, 0.5, -3.2);
    const rig = buildCharacter(generate(opts.seed));
    this.scene.add(rig.group);
    const f = frameAt(spawn);
    this.player = {
      rig,
      walker: createWalker(new Vector3(spawn.x, spawn.y, spawn.z), new Vector3(f.north.x, f.north.y, f.north.z)),
      jumpY: 0, jumpVel: 0, grounded: true, speed01: 0, squash: 0, emoteT: 0, seed: opts.seed,
    };

    this.chase = new ChaseCamera(canvas.clientWidth / Math.max(1, canvas.clientHeight));
    this.input.attach(canvas, { joystick: opts.joystick, knob: opts.knob, jumpButton: opts.jumpButton, onAny: opts.onInput });
    this.resize();
    this.frame(performance.now(), true);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const cap = TIER[this.quality].cap;
      if (cap && now - this.last < cap) {
        this.raf = requestAnimationFrame(loop); // frame cap keeps the main thread free on weak/software GL
        return;
      }
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.renderer.dispose();
  }

  /**
   * Render one frame and read it back: how many of a 32x32 sample grid are
   * brighter than near-black. Used by the e2e "non-black canvas" check
   * (a WebGL buffer cannot be read after present, so we render + read here).
   */
  probeFrame(): { bright: number; total: number; frame: number; triangles: number } {
    this.renderer.render(this.scene, this.chase.camera);
    const gl = this.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let bright = 0;
    const N = 32;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = Math.floor(((i + 0.5) / N) * w), y = Math.floor(((j + 0.5) / N) * h);
        const k = (y * w + x) * 4;
        if (px[k] + px[k + 1] + px[k + 2] > 60) bright++;
      }
    }
    return { bright, total: N * N, frame: this.renderer.info.render.frame, triangles: this.renderer.info.render.triangles };
  }

  resize(): void {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.chase.resize(w / h);
  }

  setCameraMode(mode: CameraMode): void {
    this.chase.mode = mode;
  }
  setOrbitYaw(deg: number): void {
    this.chase.orbitYawDeg = deg;
  }

  // ---- pickups (minigame collectibles) ----
  addPickup(id: string, kind: PickupKind, pos: V3, opts?: PickupOpts): void {
    this.pickups.add(id, kind, pos, opts);
  }
  setPickup(id: string, opts: PickupOpts): void {
    this.pickups.set(id, opts);
  }
  removePickup(id: string): void {
    this.pickups.remove(id);
  }
  clearPickups(prefix?: string): void {
    this.pickups.clear(prefix);
  }
  /** World position of the campfire (delivery point). */
  campfirePosition(): V3 {
    const c = this.camp.campfire;
    return { x: c.x, y: c.y, z: c.z };
  }
  /** Surface distance (m) from the player's feet to a world position. */
  distanceToPlayer(pos: V3): number {
    const d = this.player.walker.dir;
    const m = Math.hypot(pos.x, pos.y, pos.z) || 1;
    return angDist({ x: d.x, y: d.y, z: d.z }, { x: pos.x / m, y: pos.y / m, z: pos.z / m }) * PLANET_RADIUS;
  }

  /** Trigger a jump / wave from UI (same effect as the keys). */
  jump(): void {
    this.input.inject(null);
    this.pendingJump = true;
  }
  wave(): void {
    this.player.emoteT = 1.6;
  }
  private pendingJump = false;

  /** Move the player to a unit direction (spawn points, dev/e2e vantage checks). */
  teleport(d: V3, facing?: V3): void {
    const w = this.player.walker;
    w.dir.set(d.x, d.y, d.z).normalize();
    const f = frameAt({ x: w.dir.x, y: w.dir.y, z: w.dir.z });
    const hint = facing ? new Vector3(facing.x, facing.y, facing.z) : new Vector3(f.north.x, f.north.y, f.north.z);
    tangentOf(hint, w.dir, w.fwd);
    this.player.jumpY = 0;
    this.player.grounded = true;
    this.chase.reset();
  }

  /** Swap the player's look (customisation). */
  setSeed(seed: number): void {
    this.scene.remove(this.player.rig.group);
    this.player.rig = buildCharacter(generate(seed));
    this.player.seed = seed;
    this.scene.add(this.player.rig.group);
  }

  getPlayerSnapshot(): PlayerSnapshot {
    const p = this.player;
    const d = p.walker.dir;
    const r = surfaceRadius({ x: d.x, y: d.y, z: d.z }) + p.jumpY;
    return {
      x: d.x * r, y: d.y * r, z: d.z * r,
      dir: { x: d.x, y: d.y, z: d.z }, fwd: { x: p.walker.fwd.x, y: p.walker.fwd.y, z: p.walker.fwd.z },
      moving: p.speed01 > 0.05, seed: p.seed,
    };
  }

  /** World position of the player's feet (for minigames / distance checks). */
  playerPosition(out = new Vector3()): Vector3 {
    const s = this.getPlayerSnapshot();
    return out.set(s.x, s.y, s.z);
  }

  setRemote(id: string, s: RemoteInput): void {
    const target = new Vector3(s.x, s.y, s.z);
    if (target.lengthSq() < 1) return; // origin = "not placed yet"
    target.normalize();
    let r = this.remotes.get(id);
    if (!r) {
      const seed = s.seed ?? seedFromId(id);
      const rig = buildCharacter(generate(seed));
      this.scene.add(rig.group);
      r = { rig, walker: createWalker(target), target, speed01: 0, seed };
      this.remotes.set(id, r);
      this.placeRig(rig, r.walker, 0);
      return;
    }
    r.target.copy(target);
  }

  removeRemote(id: string): void {
    const r = this.remotes.get(id);
    if (!r) return;
    this.scene.remove(r.rig.group);
    this.remotes.delete(id);
  }

  private placeRig(rig: CharacterRig, w: WalkerState, extraUp: number): void {
    const d = w.dir;
    const r = surfaceRadius({ x: d.x, y: d.y, z: d.z }) + extraUp;
    rig.group.position.set(d.x * r, d.y * r, d.z * r);
    _x.crossVectors(d, w.fwd).normalize(); // right = up x forward
    rig.group.matrix.makeBasis(_x, d, w.fwd);
    rig.group.quaternion.setFromRotationMatrix(rig.group.matrix);
  }

  private frame(now: number, first = false): void {
    // Clamp at 100 ms so a slow frame (software GL, background tab) never
    // teleports, while the low tiers' 12-30 fps still move in real time.
    const raw = first ? 0 : (now - this.last) / 1000;
    const dt = Math.min(0.1, raw);
    this.last = now;
    this.t += dt;
    if (raw > 0) this.fps += ((1 / raw) - this.fps) * 0.05; // real frame rate, not the clamped dt
    const p = this.player;
    const w = p.walker;
    _up.copy(w.dir);

    // --- player input -> movement (camera-relative) ---
    const mv = this.input.getMove();
    this.chase.camera.getWorldDirection(_camFwd);
    tangentOf(_camFwd, _up, _camFwd);
    _camRight.crossVectors(_camFwd, _up).normalize();
    _move.copy(_camRight).multiplyScalar(mv.x).addScaledVector(_camFwd, mv.y);
    const mag = Math.min(1, _move.length());
    if (mag > 0.02 && this.chase.mode === "chase") {
      _prevDir.copy(w.dir);
      _prevFwd.copy(w.fwd);
      stepWalker(w, _move, dt, RUN_SPEED, PLANET_RADIUS);
      if (!isWalkable({ x: w.dir.x, y: w.dir.y, z: w.dir.z })) {
        w.dir.copy(_prevDir);
        w.fwd.copy(_prevFwd);
      }
      turnToward(w, _move, 14 * dt);
      p.speed01 += (mag - p.speed01) * Math.min(1, 12 * dt);
    } else {
      p.speed01 += (0 - p.speed01) * Math.min(1, 10 * dt);
    }
    const jumpNow = this.input.consumeJump() || this.pendingJump;
    this.pendingJump = false;
    if (jumpNow && p.grounded) {
      p.jumpVel = 6.2;
      p.grounded = false;
    }
    if (!p.grounded) {
      p.jumpY += p.jumpVel * dt;
      p.jumpVel -= 18 * dt;
      if (p.jumpY <= 0) {
        p.jumpY = 0;
        p.grounded = true;
        p.squash = 1;
      }
    }
    p.squash = Math.max(0, p.squash - dt * 4.5);
    if (this.input.consumeEmote()) p.emoteT = 1.6;
    p.emoteT = Math.max(0, p.emoteT - dt);
    this.placeRig(p.rig, w, p.jumpY);
    animateCharacter(p.rig, { speed01: p.speed01, airborne: !p.grounded, squash: p.squash, emoteT: p.emoteT }, dt, this.t);

    // --- remote replicas walk toward their latest target ---
    for (const r of this.remotes.values()) {
      const d = angDist({ x: r.walker.dir.x, y: r.walker.dir.y, z: r.walker.dir.z }, { x: r.target.x, y: r.target.y, z: r.target.z }) * PLANET_RADIUS;
      if (d > 0.04) {
        _move.copy(r.target).sub(r.walker.dir);
        const speed = Math.min(7.5, Math.max(1.5, d / 0.25));
        stepWalker(r.walker, _move, Math.min(dt, d / speed), speed, PLANET_RADIUS);
        turnToward(r.walker, _move, 10 * dt);
        r.speed01 += (Math.min(1, speed / RUN_SPEED) - r.speed01) * Math.min(1, 8 * dt);
      } else {
        r.speed01 += (0 - r.speed01) * Math.min(1, 8 * dt);
      }
      this.placeRig(r.rig, r.walker, 0);
      animateCharacter(r.rig, { speed01: r.speed01, airborne: false, squash: 0, emoteT: 0 }, dt, this.t + r.seed);
    }

    // --- camera, sun, sky, animated props ---
    this.playerPosition(_pos);
    this.chase.update(_pos, _up, w.fwd, dt);
    const fr = frameAt({ x: _up.x, y: _up.y, z: _up.z });
    _east.set(fr.east.x, fr.east.y, fr.east.z);
    _north.set(fr.north.x, fr.north.y, fr.north.z);
    updateSun(this.lights, _pos, _up, _east, _north);
    _sunDir.copy(this.lights.sun.position).sub(_pos).normalize();
    this.sky.update(this.chase.camera.position, _up, _sunDir, dt);
    this.water.update(this.t);
    this.camp.update(this.t, dt);
    this.pickups.update(this.t, dt);

    emitFrame(dt, this.t);
    this.renderer.render(this.scene, this.chase.camera);
  }
}
