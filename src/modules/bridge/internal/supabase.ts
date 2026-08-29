// src/modules/bridge/internal/supabase.ts — Supabase Realtime implementation
// This is the ONLY place where @supabase/supabase-js is imported.
// The public api.ts delegates to this module; swap-safe per AGENTS §13.

import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import type { WorldState, Unsubscribe } from "../api";

let supabase: ReturnType<typeof createClient> | null = null;
let channel: RealtimeChannel | null = null;
const stateCallbacks = new Set<(state: WorldState) => void>();

/** Initialize the Supabase client. Call once at app startup if VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set. */
export function initSupabase(url: string, anonKey: string): void {
  if (supabase) return; // already initialized
  supabase = createClient(url, anonKey, {
    realtime: { params: { eventsPerSecond: 20 } },
  });
}

function getChannel(): RealtimeChannel {
  if (!channel && supabase) {
    channel = supabase.channel("world-state", {
      config: { presence: { key: "sessionId" } },
    });
    channel.on("broadcast", { event: "state" }, ({ payload }) => {
      stateCallbacks.forEach((cb) => cb(payload));
    });
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") {
        console.warn("[bridge] Supabase channel status:", status);
      }
    });
  }
  if (!channel) throw new Error("Supabase not initialized");
  return channel;
}

/** Check if Supabase is initialized and ready. */
export function isConfigured(): boolean {
  return !!supabase;
}

/** Join the world channel, register presence. */
export async function joinChannel(sessionId: string): Promise<void> {
  const ch = getChannel();
  await ch.track({ sessionId, joinedAt: Date.now() });
}

/** Leave the world channel, clean up presence. */
export function leaveChannel(): void {
  channel?.untrack();
  channel?.unsubscribe();
  channel = null;
}

/** Broadcast local state to all participants via Supabase broadcast. */
export function broadcastState(state: WorldState): void {
  channel?.send({
    type: "broadcast",
    event: "state",
    payload: state,
  });
}

/** Subscribe to world state updates from Supabase broadcasts. */
export function onState(cb: (state: WorldState) => void): Unsubscribe {
  stateCallbacks.add(cb);
  return () => stateCallbacks.delete(cb);
}