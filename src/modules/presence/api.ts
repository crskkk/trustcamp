// src/modules/presence/api.ts — the ONLY public door to the presence module.
//
// Public surface:
//   - createPresenceMap(opts?): pure state container (unit-testable).
//   - startPresence(opts?): lazily subscribes to bridge.onState and feeds the
//     shared map. Idempotent. Also writes a localStorage heartbeat so other
//     tabs on the same origin (incl. incognito on the same profile in modern
//     browsers) learn about this tab and learn when it goes away.
//   - subscribePresence(cb): returns PresenceEvents as the world changes
//     ({ kind: "join"|"move"|"leave", playerId, state? }).
//   - getPresenceMap(): the shared map (read-only by convention).
//   - clearPresence(): tears down the wiring and clears the map.
//   - absorbPeerHeartbeat(peer): public so the storage-event listener and the
//     dev seam can route peer updates through the same merge path.
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

/** A peer's heartbeat record, serialized as JSON in localStorage. */
export interface PeerHeartbeat {
  selfId: string;
  role: string;
  x: number;
  y: number;
  z: number;
  ts: number;
}

export interface StartPresenceOptions extends PresenceMapOptions {
  /** The local player's id; updates for this id are ignored. */
  selfId?: string;
  /** Test/dev hook: override how raw bridge states feed into the map. */
  inject?: (state: WorldState) => RemoteState | null;
  /** localStorage key used for the cross-tab heartbeat. */
  heartbeatKey?: string;
  /** How often to refresh our heartbeat (ms). Default 1500. */
  heartbeatMs?: number;
  /** Peer heartbeats older than this are dropped (ms). Default 5000. */
  peerTtlMs?: number;
  /** Role to advertise in our own heartbeat. */
  role?: string;
  /** Current x/y/z to advertise in our own heartbeat. */
  position?: { x: number; y: number; z: number };
}

const DEFAULT_HEARTBEAT_KEY = "__tc_presence_hb__";
const DEFAULT_HEARTBEAT_MS = 1500;
const DEFAULT_PEER_TTL_MS = 5000;

// ---------- module-level singleton state ----------

let sharedMap: PresenceMap | null = null;
let bridgeUnsub: (() => void) | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let storageHandler: ((evt: StorageEvent) => void) | null = null;
let currentOpts: StartPresenceOptions | null = null;
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

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

// ---------- public surface ----------

export function createPresenceMap(opts?: PresenceMapOptions): PresenceMap {
  return new PresenceMap(opts);
}

export function getPresenceMap(): PresenceMap {
  return ensureMap();
}

/**
 * Absorb a peer heartbeat into the local map. Public so the storage-event
 * listener and the dev seam can route peer updates through the same merge
 * path. Heartbeats older than peerTtlMs (from currentOpts) are dropped.
 */
export function absorbPeerHeartbeat(peer: PeerHeartbeat, now: number = Date.now()): void {
  const map = ensureMap();
  const ttl = currentOpts?.peerTtlMs ?? DEFAULT_PEER_TTL_MS;
  if (now - peer.ts > ttl) return;
  if (currentOpts?.selfId && peer.selfId === currentOpts.selfId) return;
  const remote: RemoteState = {
    playerId: peer.selfId,
    x: peer.x,
    y: peer.y,
    z: peer.z,
    role: peer.role,
    ts: peer.ts,
  };
  const had = map.has(remote.playerId);
  map.merge(remote);
  emit({ kind: had ? "move" : "join", playerId: remote.playerId, state: remote });
}

function writeHeartbeat(opts: StartPresenceOptions): void {
  const s = safeStorage();
  if (!s || !opts.selfId) return;
  const key = opts.heartbeatKey ?? DEFAULT_HEARTBEAT_KEY;
  const pos = opts.position ?? { x: 0, y: 0, z: 0 };
  const role = opts.role ?? "scout";
  const hb: PeerHeartbeat = {
    selfId: opts.selfId,
    role,
    x: pos.x,
    y: pos.y,
    z: pos.z,
    ts: Date.now(),
  };
  try {
    s.setItem(key, JSON.stringify(hb));
  } catch {
    /* storage full or disabled; ignore */
  }
}

function readPeerHeartbeat(key: string): PeerHeartbeat | null {
  const s = safeStorage();
  if (!s) return null;
  const raw = s.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PeerHeartbeat;
    if (typeof parsed.selfId !== "string" || typeof parsed.ts !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function pruneStalePeers(_opts: StartPresenceOptions, _now: number): void {
  // Reserved for future use. Today the per-tab TTL is enforced in
  // absorbPeerHeartbeat before the entry ever lands in the map.
}

export function startPresence(opts: StartPresenceOptions = {}): PresenceMap {
  if (bridgeUnsub) {
    currentOpts = { ...currentOpts, ...opts };
    if (currentOpts.selfId) writeHeartbeat(currentOpts);
    return ensureMap(opts);
  }
  const map = ensureMap(opts);
  currentOpts = { ...opts };
  const selfId = opts.selfId;
  const inject = opts.inject ?? defaultInject;
  const key = opts.heartbeatKey ?? DEFAULT_HEARTBEAT_KEY;

  // 1) Subscribe to the bridge — the real source of truth when Supabase is
  //    configured; in-memory fallback otherwise (single-tab; harmless).
  bridgeUnsub = onState((raw: WorldState) => {
    if (selfId && raw.playerId === selfId) return;
    const remote = inject(raw);
    if (!remote) return;
    const had = map.has(remote.playerId);
    map.merge(remote);
    emit({ kind: had ? "move" : "join", playerId: remote.playerId, state: remote });
    // Update our own heartbeat so the peer slot reflects latest known pos.
    if (currentOpts?.selfId) {
      currentOpts = { ...currentOpts, role: remote.role, position: { x: remote.x, y: remote.y, z: remote.z } };
      writeHeartbeat(currentOpts);
    }
  });

  // 2) Cross-tab heartbeat: write our own + read peers via the storage event.
  if (selfId) writeHeartbeat(currentOpts);
  if (typeof window !== "undefined") {
    storageHandler = (evt: StorageEvent) => {
      if (evt.key !== key) return;
      if (evt.newValue === null) {
        // A peer removed their heartbeat → "leave"
        // We don't know who from the key alone; emit for every non-self.
        if (sharedMap) {
          for (const id of sharedMap.ids()) {
            if (id !== currentOpts?.selfId) emit({ kind: "leave", playerId: id });
          }
          sharedMap.clear();
          sharedMap = null;
        }
        return;
      }
      const peer = readPeerHeartbeat(key);
      if (peer) absorbPeerHeartbeat(peer);
    };
    window.addEventListener("storage", storageHandler);

    // Bootstrap from the existing heartbeat (handles reload of a sibling tab
    // before its first write).
    const existing = readPeerHeartbeat(key);
    if (existing && existing.selfId !== selfId) absorbPeerHeartbeat(existing);
  }
  heartbeatTimer = setInterval(() => {
    if (currentOpts?.selfId) writeHeartbeat(currentOpts);
  }, opts.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);

  // 3) Dev-only test seam for in-app synthetic pushes. Tree-shaken in prod.
  if (import.meta.env.DEV) {
    installTestSeam();
  }

  return map;
}

export function subscribePresence(cb: PresenceListener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Remove a peer from the shared map and emit a "leave" event. Used by the
 * npc spawner to despawn. Idempotent: removing a non-existent peer is a no-op.
 */
export function removePeer(playerId: string): void {
  const map = ensureMap();
  const removed = map.remove(playerId);
  if (removed) emit({ kind: "leave", playerId });
}

export function clearPresence(): void {
  if (bridgeUnsub) {
    bridgeUnsub();
    bridgeUnsub = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (storageHandler && typeof window !== "undefined") {
    window.removeEventListener("storage", storageHandler);
    storageHandler = null;
  }
  if (currentOpts?.selfId && currentOpts.heartbeatKey) {
    const s = safeStorage();
    try { s?.removeItem(currentOpts.heartbeatKey ?? DEFAULT_HEARTBEAT_KEY); } catch { /* ignore */ }
  } else if (currentOpts?.selfId) {
    const s = safeStorage();
    try { s?.removeItem(DEFAULT_HEARTBEAT_KEY); } catch { /* ignore */ }
  }
  if (sharedMap) {
    const ids = sharedMap.ids();
    sharedMap.clear();
    sharedMap = null;
    for (const id of ids) emit({ kind: "leave", playerId: id });
  }
  currentOpts = null;
  listeners.clear();
}

// ---------- dev-only test seam ----------

type SeamMsg =
  | { kind: "remote"; state: RemoteState }
  | { kind: "clear" };

function installTestSeam(): void {
  const w = window as unknown as Record<string, unknown> & { __tcPresenceTest?: unknown };
  const channel: BroadcastChannel | null =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("__tcPresenceTest__") : null;

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
    absorbPeerHeartbeat,
  };
}
