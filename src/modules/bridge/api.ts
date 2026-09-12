// src/modules/bridge/api.ts — the ONLY public door to the bridge module.
// The realtime transport Unity talks through. Surface is stable; the backing
// transport is Supabase Realtime (task 0004) with in-memory fallback —
// without changing this api or any caller (AGENTS §13).
import { Emitter } from "./internal/emitter";
import { isConfigured as isSupabaseConfigured, joinChannel, leaveChannel, broadcastState, onState as supabaseOnState, initSupabase as initSupabaseImpl } from "./internal/supabase";

export interface WorldState {
  playerId: string;
  x: number;
  y: number;
  z: number;
  role: string;
  /** Optional extras that ride along with position (leaderboard, avatar). */
  score?: number;
  level?: number;
  seed?: number;
  nick?: string;
}

export interface JoinResult {
  ok: boolean;
  sessionId: string;
}

export type Unsubscribe = () => void;

const stateBus = new Emitter<WorldState>();
let session: string | null = null;

function newSessionId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return "sess-" + Math.random().toString(36).slice(2, 12);
}

/** Initialize Supabase Realtime. Call once at app startup if VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set. */
export async function initSupabase(url: string, anonKey: string): Promise<void> {
  const { initSupabase: impl } = await import("./internal/supabase");
  impl(url, anonKey);
}

/** Check if Supabase Realtime is configured and ready. */
export function isConfigured(): boolean {
  return isSupabaseConfigured();
}

/** Join the shared world. Resolves with an opaque session id. */
export async function joinWorld(): Promise<JoinResult> {
  session = newSessionId();
  if (isSupabaseConfigured()) {
    await joinChannel(session);
    console.log("[bridge] joinWorld ok (supabase)", session);
  } else {
    console.log("[bridge] joinWorld ok (memory)", session);
  }
  return { ok: true, sessionId: session };
}

/** Leave the world. */
export async function leaveWorld(): Promise<void> {
  if (isSupabaseConfigured()) {
    leaveChannel();
  }
  session = null;
}

/** Push local state into the world (broadcast to subscribers). */
export async function sendState(state: WorldState): Promise<void> {
  if (isSupabaseConfigured()) {
    broadcastState(state);
  } else {
    stateBus.emit(state);
  }
}

/** Subscribe to world state updates. Returns an unsubscribe fn. */
export function onState(cb: (state: WorldState) => void): Unsubscribe {
  if (isSupabaseConfigured()) {
    return supabaseOnState(cb);
  }
  return stateBus.subscribe(cb);
}

/**
 * Install the bridge on a window object as `__tcBridge` (a debug / host
 * console seam; the screensaver also parks its camera sentinel here).
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