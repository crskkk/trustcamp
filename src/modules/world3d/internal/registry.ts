// src/modules/world3d/internal/registry.ts — the live World singleton.
// WorldCanvas registers the world it mounts; the api reads it. Keeps React and
// the imperative surface decoupled.
import type { World } from "./world";

let current: World | null = null;
const frameListeners = new Set<(dt: number, t: number) => void>();

export function setCurrentWorld(w: World | null): void {
  current = w;
}
export function getCurrentWorld(): World | null {
  return current;
}
export function addFrameListener(cb: (dt: number, t: number) => void): () => void {
  frameListeners.add(cb);
  return () => {
    frameListeners.delete(cb);
  };
}
export function emitFrame(dt: number, t: number): void {
  for (const cb of frameListeners) cb(dt, t);
}
