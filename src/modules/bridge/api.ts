// src/modules/bridge/api.ts — the ONLY public door to the bridge module.
// The realtime transport the world talks through. Surface is stable; the
// backing transport is one of:
//   - ws       server/ over WebSocket (configureWs) — multiplayer + persistence
//   - supabase Supabase Realtime (initSupabase) — kept as an alternate
//   - memory   in-process emitter — solo mode (GitHub Pages, tests)
// Game code references only these symbols (AGENTS §13).
import { Emitter } from "./internal/emitter";
import { isConfigured as isSupabaseConfigured, joinChannel, leaveChannel, broadcastState, onState as supabaseOnState } from "./internal/supabase";
import * as wsT from "./internal/ws";
import type { RoundEnvelopeLike } from "../../../server/protocol";

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
  /** Persisted progress from the server (ws transport only). */
  progress?: { xp: number; level: number };
}

export type Transport = "ws" | "supabase" | "memory";
export type Unsubscribe = () => void;
export type { Welcome } from "./internal/ws";

const stateBus = new Emitter<WorldState>();
const leaveBus = new Emitter<string>();
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

/** Point the bridge at a THE BAR server (ws://host:8787). Null = solo/memory. */
export function configureWs(url: string | null): void {
  wsT.configure(url);
}

export function getTransport(): Transport {
  if (wsT.isConfigured()) return "ws";
  if (isSupabaseConfigured()) return "supabase";
  return "memory";
}

/** Check if a networked transport is configured. */
export function isConfigured(): boolean {
  return getTransport() !== "memory";
}

/** Join the shared world. Resolves with an opaque session id (the server-assigned player id on ws). */
export async function joinWorld(opts: { seed?: number; nick?: string; room?: string } = {}): Promise<JoinResult> {
  const transport = getTransport();
  if (transport === "ws") {
    try {
      const w = await wsT.connect({ seed: opts.seed ?? 0, nick: opts.nick, room: opts.room });
      session = w.playerId;
      console.log("[bridge] joinWorld ok (ws)", session);
      return { ok: true, sessionId: session, progress: w.progress };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "superseded") {
        // A newer joinWorld() (React StrictMode remount, deliberate reconnect)
        // took over this connection; leave the transport alone.
        return { ok: false, sessionId: "" };
      }
      const late = wsT.getWelcome();
      if (late) {
        // The welcome arrived after all (main thread was busy); keep the socket.
        session = late.playerId;
        console.log("[bridge] joinWorld ok (ws, late)", session);
        return { ok: true, sessionId: session, progress: late.progress };
      }
      console.warn("[bridge] ws join failed, falling back to memory:", msg);
      wsT.configure(null);
    }
  }
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
  if (wsT.isConfigured()) wsT.disconnect();
  if (isSupabaseConfigured()) leaveChannel();
  session = null;
}

/**
 * Push local state into the world. Only the local player's own state goes
 * over the network; anything else (dev NPCs) stays on the local bus so the
 * server never relays a client speaking for someone else.
 */
export async function sendState(state: WorldState): Promise<void> {
  if (wsT.isConfigured() && state.playerId === session) {
    wsT.sendState(state);
    return;
  }
  if (isSupabaseConfigured()) {
    broadcastState(state);
    return;
  }
  stateBus.emit(state);
}

/** Subscribe to world state updates (all transports feed the same callback). */
export function onState(cb: (state: WorldState) => void): Unsubscribe {
  const offs: Unsubscribe[] = [stateBus.subscribe(cb), wsT.onState(cb)];
  if (isSupabaseConfigured()) offs.push(supabaseOnState(cb));
  return () => offs.forEach((o) => o());
}

/** A remote player left (ws transport; memory/supabase rely on presence TTL). */
export function onLeave(cb: (playerId: string) => void): Unsubscribe {
  const offs = [leaveBus.subscribe(cb), wsT.onLeave(cb)];
  return () => offs.forEach((o) => o());
}

/** Persist a finished round (ws transport; no-op otherwise). */
export function sendRound(envelope: RoundEnvelopeLike): void {
  wsT.sendRound(envelope);
}

/** Persist total XP (ws transport; no-op otherwise). */
export function sendProgress(xp: number): void {
  wsT.sendProgress(xp);
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
