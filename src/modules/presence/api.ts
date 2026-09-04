// src/modules/presence/api.ts — the ONLY public door to the presence module.
//
// Public surface:
//   - createPresenceMap(opts?): pure state container (unit-testable).
//   - startPresence(opts?): lazily subscribes to bridge.onState and feeds the
//     shared map. Idempotent. Also installs the dev-only window.__tcPresenceTest
//     seam in `import.meta.env.DEV` (tree-shaken in prod).
//   - subscribePresence(cb): returns PresenceEvents as the world changes
//     ({ kind: "join"|"move"|"leave", playerId, state? }).
//   - getPresenceMap(): the shared map (read-only by convention).
//   - clearPresence(): tears down the wiring and clears the map.
//
// No PII. The only identifier is the bridge's opaque sessionId.

import { onState, type WorldState } from "../bridge/api";
import { PresenceMap, type PresenceMapOptions, type RemoteState } from "./internal/presenceMap";

export type { RemoteState, PresenceMapOptions } from "./internal/presenceMap";
export { PresenceMap } from "./internal/presenceMap";
export { PresenceOverlay, type PresenceOverlayProps } from "./PresenceOverlay";

export interface PresenceEvent {
  kind: "join" | "move" | "leave";
  playerId: string;
  state?: RemoteState;
}

export type PresenceListener = (event: PresenceEvent) => void;

export interface StartPresenceOptions extends PresenceMapOptions {
  /** The local player's id; updates for this id are ignored. */
  selfId?: string;
  /** Test/dev hook: override how raw bridge states feed into the map. */
  inject?: (state: WorldState) => RemoteState | null;
}

// ---------- module-level singleton state ----------

let sharedMap: PresenceMap | null = null;
let bridgeUnsub: (() => void) | null = null;
const listeners = new Set<PresenceListener>();
const TEST_FLAG = "__presence_test__";

function ensureMap(opts: PresenceMapOptions = {}): PresenceMap {
  if (!sharedMap) sharedMap = new PresenceMap(opts);
  return sharedMap;
}

function defaultInject(state: WorldState): RemoteState | null {
  if (!state || typeof state.playerId !== "string") return null;
  return {
    playerId: state.playerId,
    x: Number(state.x) || 0,
    y: Number(state.y) || 0,
    z: Number(state.z) || 0,
    role: String(state.role || "scout"),
    ts: Date.now(),
  };
}

function emit(event: PresenceEvent): void {
  for (const cb of listeners) cb(event);
}

// ---------- public surface ----------

export function createPresenceMap(opts?: PresenceMapOptions): PresenceMap {
  return new PresenceMap(opts);
}

export function getPresenceMap(): PresenceMap {
  return ensureMap();
}

export function startPresence(opts: StartPresenceOptions = {}): PresenceMap {
  if (bridgeUnsub) return ensureMap(opts); // idempotent
  const map = ensureMap(opts);
  const selfId = opts.selfId;
  const inject = opts.inject ?? defaultInject;

  bridgeUnsub = onState((raw: WorldState) => {
    if (selfId && raw.playerId === selfId) return;
    const remote = inject(raw);
    if (!remote) return;
    const had = map.has(remote.playerId);
    map.merge(remote);
    emit({ kind: had ? "move" : "join", playerId: remote.playerId, state: remote });
  });

  // Dev-only test seam. tree-shaken by Vite because `import.meta.env.DEV` is a
  // compile-time constant false in production builds.
  if (import.meta.env.DEV) {
    installTestSeam(map);
  }

  return map;
}

export function subscribePresence(cb: PresenceListener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function clearPresence(): void {
  if (bridgeUnsub) {
    bridgeUnsub();
    bridgeUnsub = null;
  }
  if (sharedMap) {
    // Clear the map first (fires shape-change for any listener with a
    // closed-over map ref), then drop the reference, then emit "leave"
    // events for downstream consumers that only listen on the bus.
    const ids = sharedMap.ids();
    sharedMap.clear();
    sharedMap = null;
    for (const id of ids) emit({ kind: "leave", playerId: id });
  }
  listeners.clear();
}

// ---------- dev-only test seam ----------

/**
 * Dev-only: a cross-tab fan-out for the test seam, so two local browser tabs
 * can demonstrate T-4 without a real Supabase server. Tree-shaken by Vite in
 * production builds because `import.meta.env.DEV` is a compile-time constant.
 */
type SeamMsg =
  | { kind: "remote"; state: RemoteState }
  | { kind: "clear" };

function installTestSeam(initialMap: PresenceMap): void {
  const w = window as unknown as Record<string, unknown> & { __tcPresenceTest?: unknown };
  const channel: BroadcastChannel | null =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("__tcPresenceTest__") : null;

  // The seam always reads the *current* shared map (which may be replaced by
  // a clear()). Reading it through the helper each time avoids stale closures.
  const liveMap = (): PresenceMap => ensureMap();

  if (channel) {
    channel.onmessage = (evt: MessageEvent<SeamMsg>) => {
      const msg = evt.data;
      if (!msg) return;
      if (msg.kind === "remote") {
        const m = liveMap();
        const had = m.has(msg.state.playerId);
        m.merge(msg.state);
        emit({ kind: had ? "move" : "join", playerId: msg.state.playerId, state: msg.state });
      } else if (msg.kind === "clear") {
        const m = liveMap();
        const ids = m.ids();
        m.clear();
        sharedMap = null;
        for (const id of ids) emit({ kind: "leave", playerId: id });
      }
    };
  }

  w.__tcPresenceTest = {
    [TEST_FLAG]: true,
    pushRemote(state: WorldState): void {
      const remote = defaultInject(state);
      if (!remote) return;
      const m = liveMap();
      const had = m.has(remote.playerId);
      m.merge(remote);
      emit({ kind: had ? "move" : "join", playerId: remote.playerId, state: remote });
      channel?.postMessage({ kind: "remote", state: remote } satisfies SeamMsg);
    },
    clear(): void {
      const m = liveMap();
      const ids = m.ids();
      m.clear();
      sharedMap = null;
      for (const id of ids) emit({ kind: "leave", playerId: id });
      channel?.postMessage({ kind: "clear" } satisfies SeamMsg);
    },
    get map(): PresenceMap { return liveMap(); },
    channel,
  };
}
