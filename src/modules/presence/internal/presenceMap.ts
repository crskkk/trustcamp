// src/modules/presence/internal/presenceMap.ts — the pure state container.
// Private to the presence module (api.ts is the only public door).

export interface RemoteState {
  playerId: string;
  x: number;
  y: number;
  z: number;
  role: string;
  ts: number;
}

export interface PresenceMapOptions {
  ttlMs?: number;          // default 3000 (matches "disconnect → ghost gone within ~2s" feel)
  maxLookAheadMs?: number; // default 50
  speedMps?: number;       // default 4
}

export type ShapeChangeListener = (ids: ReadonlyArray<string>) => void;

interface Entry {
  state: RemoteState;
  lastSeen: number;
}

const DEFAULTS = {
  ttlMs: 3000,
  maxLookAheadMs: 50,
  speedMps: 4,
};

export class PresenceMap {
  private readonly opts: Required<PresenceMapOptions>;
  private readonly entries = new Map<string, Entry>();
  private readonly shapeListeners = new Set<ShapeChangeListener>();

  constructor(opts: PresenceMapOptions = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  /** Apply a remote state update. Newer `ts` wins; older `ts` is dropped silently. */
  merge(state: RemoteState): void {
    const existing = this.entries.get(state.playerId);
    const prevIds = new Set(this.entries.keys());

    if (existing) {
      if (state.ts < existing.state.ts) return; // stale
      existing.state = state;
      existing.lastSeen = state.ts;
    } else {
      this.entries.set(state.playerId, { state, lastSeen: state.ts });
    }

    // Fire shape change only if the *set of ids* changed (a new player appeared
    // or an existing one disappeared). Pure position updates stay silent.
    const newIds = this.entries.keys();
    if (new Set(newIds).size !== prevIds.size) {
      this.emitShape();
      return;
    }
    for (const id of newIds) {
      if (!prevIds.has(id)) {
        this.emitShape();
        return;
      }
    }
  }

  /** Drop entries whose lastSeen is older than ttlMs relative to `nowMs`. */
  prune(nowMs: number): void {
    const ttl = this.opts.ttlMs;
    const prevIds = new Set(this.entries.keys());
    for (const [id, entry] of this.entries) {
      if (nowMs - entry.lastSeen > ttl) this.entries.delete(id);
    }
    if (this.entries.size !== prevIds.size) this.emitShape();
  }

  /** Remove every entry; fires shape change if the map was non-empty. */
  clear(): void {
    if (this.entries.size === 0) return;
    this.entries.clear();
    this.emitShape();
  }

  /**
   * Extrapolate the position of a player at `nowMs`, capped to `maxLookAheadMs`.
   * With a single sample, defaults to a unit-magnitude +x travel at `speedMps`
   * (a safe overestimate; capped by the small look-ahead window).
   */
  interpolate(
    playerId: string,
    nowMs: number,
  ): { x: number; y: number; z: number; role: string } | null {
    const entry = this.entries.get(playerId);
    if (!entry) return null;
    const dt = Math.max(0, Math.min(this.opts.maxLookAheadMs, nowMs - entry.state.ts));
    const v = this.opts.speedMps * (dt / 1000);
    return {
      x: entry.state.x + v,
      y: entry.state.y,
      z: entry.state.z,
      role: entry.state.role,
    };
  }

  get(playerId: string): RemoteState | undefined {
    return this.entries.get(playerId)?.state;
  }

  has(playerId: string): boolean {
    return this.entries.has(playerId);
  }

  size(): number {
    return this.entries.size;
  }

  ids(): ReadonlyArray<string> {
    return Array.from(this.entries.keys());
  }

  onShapeChange(cb: ShapeChangeListener): () => void {
    this.shapeListeners.add(cb);
    return () => this.shapeListeners.delete(cb);
  }

  private emitShape(): void {
    const ids = this.ids();
    for (const cb of this.shapeListeners) cb(ids);
  }
}
