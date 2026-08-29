// src/modules/bridge/api.ts — the ONLY public door to the bridge module.
// The realtime transport Unity talks through. Surface is stable; the backing
// transport is an in-memory stub now (task 0002) and becomes Supabase Realtime
// in task 0004 — without changing this api or any caller (AGENTS §13).
import { Emitter } from "./internal/emitter";

export interface WorldState {
  playerId: string;
  x: number;
  y: number;
  z: number;
  role: string;
}

export interface JoinResult {
  ok: boolean;
  sessionId: string;
}

export type Unsubscribe = () => void;

const stateBus = new Emitter<WorldState>();
let session: string | null = null;

function newSessionId(): string {
  // Opaque, non-PII. crypto.randomUUID when available, else a fallback.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return "sess-" + Math.random().toString(36).slice(2, 12);
}

/** Join the shared world. Resolves with an opaque session id. */
export async function joinWorld(): Promise<JoinResult> {
  session = newSessionId();
  // eslint-disable-next-line no-console
  console.log("[bridge] joinWorld ok", session);
  return { ok: true, sessionId: session };
}

/** Leave the world. */
export async function leaveWorld(): Promise<void> {
  session = null;
}

/** Push local state into the world (broadcast to subscribers). */
export async function sendState(state: WorldState): Promise<void> {
  stateBus.emit(state);
}

/** Subscribe to world state updates. Returns an unsubscribe fn. */
export function onState(cb: (state: WorldState) => void): Unsubscribe {
  return stateBus.subscribe(cb);
}

/**
 * Install the Unity-facing bridge on a window object. The embedded Unity build
 * calls `parent.__tcBridge.joinWorld()` / `.sendState(...)` / `.onState(cb)`,
 * which delegate here. Shell→Unity pushes go through the iframe's
 * `UnityGame.SendMessage`.
 */
export function mountBridge(
  target: Window & typeof globalThis
): void {
  (target as unknown as { __tcBridge?: unknown }).__tcBridge = {
    joinWorld,
    leaveWorld,
    sendState,
    onState,
  };
}

/** Send a message into the embedded Unity build (shell → Unity). */
export function sendToUnity(
  frame: HTMLIFrameElement | null,
  gameObject: string,
  method: string,
  arg: string
): void {
  const w = frame?.contentWindow as unknown as
    | { UnityGame?: { SendMessage?: (go: string, m: string, a: string) => void } }
    | undefined;
  w?.UnityGame?.SendMessage?.(gameObject, method, arg);
}
