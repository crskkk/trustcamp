// src/modules/npc/bridge.ts — publish loop.
//
// Schedules a `bridge.sendState` tick for each live NPC. The loop is
// decoupled from `presence` (presence already has the heartbeats for
// cross-tab visibility) — this loop drives the *outbound* state that
// Unity reads via the parent window's `__tcBridge.onState`.
//
// The policy (`motion.ts`) decides the next input; here we just publish
// the cached position. Real per-frame locomotion happens in Unity
// (NpcController) — this is the rate-limited shell→bridge publish.

import type { WorldState } from "../bridge/api";
import { chooseInput, type Vec3 } from "./motion";
import { listNpcs, updateNpcPosition } from "./api";

export interface StartNpcMotionOptions {
  /** Tick interval in ms. Default 2000 (matches the Bootstrap cadence). */
  tickMs?: number;
  /**
   * Optional world-space target the NPCs will head toward (e.g., the
   * local player's last published position). When omitted, NPCs drift.
   */
  target?: Vec3 | null;
  /**
   * Optional per-NPC position transformer. Lets a test inject a fake
   * step function. Default: keep the position (no actual locomotion in
   * the shell — Unity is the locomotion authority).
   */
  stepPosition?: (npc: { id: string; position: Vec3 }, dt: number) => Vec3;
  /** Player speed cap for the shell's synthetic step. */
  speedMps?: number;
  /** Bridge-like object (only `sendState` is used). */
  bridge: { sendState: (s: WorldState) => Promise<void> | void };
}

const DEFAULT_TICK_MS = 2000;
const DEFAULT_SPEED_MPS = 4;

let timer: ReturnType<typeof setInterval> | null = null;
let lastTickAt = 0;

function defaultStepPosition(npc: { position: Vec3 }, dt: number): Vec3 {
  // Default shell-side step: small orbit around the spawn point so the
  // chip strip shows non-static positions in the dev panel. Real
  // locomotion happens in Unity (NpcController + PlayerController.Step).
  const t = Date.now() / 1000;
  const speedMps = DEFAULT_SPEED_MPS;
  const r = 0.4;
  return {
    x: npc.position.x + Math.cos(t * 0.5 + (npc.position.x || 1)) * speedMps * dt * r,
    y: npc.position.y,
    z: npc.position.z + Math.sin(t * 0.5 + (npc.position.z || 1)) * speedMps * dt * r,
  };
}

export function startNpcMotion(opts: StartNpcMotionOptions): void {
  if (timer) return; // idempotent
  const tickMs = opts.tickMs ?? DEFAULT_TICK_MS;
  const stepPosition = opts.stepPosition ?? defaultStepPosition;
  const speedMps = opts.speedMps ?? DEFAULT_SPEED_MPS;
  let target: Vec3 | null = opts.target ?? null;

  const tick = () => {
    const now = Date.now();
    const dt = lastTickAt ? Math.min(0.5, (now - lastTickAt) / 1000) : tickMs / 1000;
    lastTickAt = now;
    for (const n of listNpcs()) {
      // Compute a small synthetic step in the shell so the chip strip
      // shows motion in dev. The *real* per-frame NPC motion happens in
      // Unity (PlayerController.Step), driven by the policy.
      const input = chooseInput({
        npcPos: n.position,
        npcUp: { x: 0, y: 1, z: 0 }, // shell doesn't know the planet normal; Unity fills it
        target,
        jitterSeed: n.seed,
      });
      void input; // input is consumed by the Unity NpcController, not the shell
      const next = stepPosition({ id: n.id, position: n.position }, dt * speedMps);
      updateNpcPosition(n.id, next);
      void opts.bridge.sendState({
        playerId: n.id,
        x: next.x,
        y: next.y,
        z: next.z,
        role: n.role,
      });
    }
  };

  lastTickAt = 0;
  timer = setInterval(tick, tickMs);
  // Kick once immediately so the e2e test doesn't have to wait a full
  // tick to see the first call.
  void tick();
  void target;
}

export function stopNpcMotion(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  lastTickAt = 0;
}

export function isNpcMotionRunning(): boolean {
  return timer !== null;
}
