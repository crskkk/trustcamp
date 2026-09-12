// src/modules/screensaver/api.ts — the ONLY public door to the screensaver module.
//
// Screensaver / landing mode: a shell-driven camera orbit over the planet.
// The SHELL owns the orbit angle and feeds the world3d orbit camera a yaw
// each tick, so host/admin steering can take over this same seam later
// (task 0009 — render-path proof; full host controls arrive with the HUD, T-8).
import { setOrbit, setOrbitYaw } from "../world3d/api";

const TICK_MS = 1000 / 60;
const DEFAULT_DEG_PER_SEC = 6;

interface StartOpts {
  /** Orbit speed in degrees/second. */
  degPerSec?: number;
}

let timer: ReturnType<typeof setInterval> | null = null;
let yaw = 0;
let lastTick = 0;
let speed = DEFAULT_DEG_PER_SEC;

/** Publish the current yaw on window.__tcBridge.__camera (debug sentinel the
 *  e2e reads). Non-destructive: keeps whatever the bridge already installed. */
function publishSentinel(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __tcBridge?: Record<string, unknown> };
  w.__tcBridge = w.__tcBridge ?? {};
  (w.__tcBridge as { __camera?: unknown }).__camera = { yaw };
}

function tick(): void {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  yaw += speed * dt;
  setOrbitYaw(yaw);
  publishSentinel();
}

/** Start (attach) the automated orbit. Switches the world camera to orbit
 *  mode; the shell drives the yaw from here on. Idempotent. */
export function startOrbit(opts: StartOpts = {}): void {
  stopOrbit();
  speed = opts.degPerSec ?? DEFAULT_DEG_PER_SEC;
  setOrbit(true);
  setOrbitYaw(yaw);
  lastTick = Date.now();
  publishSentinel();
  timer = setInterval(tick, TICK_MS);
}

/** Stop (detach) the orbit. The camera freezes at the current yaw — the state
 *  host steering takes over from. */
export function stopOrbit(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/** True while the shell-driven orbit is running. */
export function isOrbiting(): boolean {
  return timer !== null;
}

/** Current orbit yaw in degrees (monotonic while orbiting; frozen when stopped). */
export function getYaw(): number {
  return yaw;
}

// Dev/CLI hook: window.__tcScreensaver.{start,stop,isOrbiting} lets a host
// console (and the e2e) attach/detach the orbit without a UI.
if (typeof window !== "undefined") {
  (window as unknown as { __tcScreensaver?: unknown }).__tcScreensaver = {
    start: startOrbit,
    stop: stopOrbit,
    isOrbiting,
  };
}
