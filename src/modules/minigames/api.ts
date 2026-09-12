// src/modules/minigames/api.ts — the ONLY public door to the minigames module.
//
// Registry + round runner. Event files (events/*.ts) are pure game logic
// against a MinigameContext; the runner supplies the live context from the
// world3d api (or a headless one in tests / before the world mounts).

import type { Lang } from "../i18n/api";
import { getWorld, onFrame, angDist, PLANET_RADIUS, normalize, type V3, type PickupKind, type PickupOpts } from "../world3d/api";
import { createSink, type RoundEnvelope, type ScoreSink } from "../scorebus/api";
import { createFirewoodDash } from "./events/firewood-dash";
import { createLanternRelay } from "./events/lantern-relay";
import { createForaging } from "./events/foraging";

export type LangText = Record<Lang, string>;

export interface MinigameMeta {
  slug: string;
  title: LangText;
  /** Simultaneous inputs used (<= 2, STANDARDS §9). */
  inputs: string[];
  solo: boolean;
  versus: boolean;
  /** Round length in seconds (0 = passive, no timer). */
  durationSec: number;
  maxPoints: number;
  passive?: boolean;
}

export interface MinigameContext {
  now(): number;
  playerPos(): V3 | null;
  /** Surface distance (m) from the player to a world position. */
  distanceToPlayer(pos: V3): number;
  spawn(id: string, kind: PickupKind, pos: V3, opts?: PickupOpts): void;
  setPickup(id: string, opts: PickupOpts): void;
  despawn(id: string): void;
  clear(): void;
  campfire(): V3;
  /** Seconds left in the active round (0 for passive events). */
  timeLeft(): number;
  award(points: number, why?: LangText): void;
  progress(current: number, total: number, label?: LangText): void;
  toast(text: LangText): void;
  end(): void;
}

export interface MinigameEvent {
  meta: MinigameMeta;
  activate(ctx: MinigameContext): void;
  tick?(ctx: MinigameContext, dt: number): void;
  deactivate(ctx: MinigameContext): void;
}

export interface RoundState {
  slug: string;
  meta: MinigameMeta;
  startedAt: number;
  endsAt: number;
  points: number;
  timeLeft: number;
  progress: { current: number; total: number; label?: LangText };
}

export type RoundEndReason = "complete" | "timeout" | "stopped";

export type RoundEvent =
  | { kind: "start"; state: RoundState }
  | { kind: "tick"; state: RoundState }
  | { kind: "progress"; state: RoundState }
  | { kind: "award"; points: number; why?: LangText; state: RoundState | null; passive: boolean }
  | { kind: "toast"; text: LangText }
  | { kind: "end"; state: RoundState; envelope: RoundEnvelope | null; reason: RoundEndReason };

export interface StartOptions {
  context?: Partial<Pick<MinigameContext, "now" | "playerPos" | "distanceToPlayer" | "spawn" | "setPickup" | "despawn" | "clear" | "campfire">>;
  sessionId?: string;
  playerId?: string;
  role?: string;
}

const registry = new Map<string, MinigameEvent>();
const listeners = new Set<(e: RoundEvent) => void>();
const sink: ScoreSink = createSink();

interface Runner {
  event: MinigameEvent;
  ctx: MinigameContext;
  state: RoundState | null; // null for passive
  pendingEnd: RoundEndReason | null;
  ids: Set<string>;
  opts: StartOptions;
}

let active: Runner | null = null;
let passive: Runner | null = null;
let frameUnsub: (() => void) | null = null;

function emit(e: RoundEvent): void {
  for (const cb of listeners) cb(e);
}

export function register(event: MinigameEvent): void {
  registry.set(event.meta.slug, event);
}
export function list(): MinigameMeta[] {
  return [...registry.values()].map((e) => e.meta);
}
export function getEvent(slug: string): MinigameEvent | undefined {
  return registry.get(slug);
}
export function subscribe(cb: (e: RoundEvent) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getSink(): ScoreSink {
  return sink;
}
export function getActive(): RoundState | null {
  return active?.state ?? null;
}

function surfaceDistance(a: V3, b: V3): number {
  return angDist(normalize(a), normalize(b)) * PLANET_RADIUS;
}

function buildContext(runner: () => Runner, slug: string, overrides: StartOptions["context"] = {}): MinigameContext {
  const world = () => getWorld();
  const key = (id: string) => `${slug}:${id}`;
  const base: MinigameContext = {
    now: () => Date.now(),
    playerPos: () => {
      const s = world()?.getPlayerSnapshot();
      return s ? { x: s.x, y: s.y, z: s.z } : null;
    },
    distanceToPlayer: (pos) => {
      const w = world();
      if (w) return w.distanceToPlayer(pos);
      const p = base.playerPos();
      return p ? surfaceDistance(p, pos) : Infinity;
    },
    spawn: (id, kind, pos, opts) => {
      runner().ids.add(key(id));
      world()?.addPickup(key(id), kind, pos, opts);
    },
    setPickup: (id, opts) => world()?.setPickup(key(id), opts),
    despawn: (id) => {
      runner().ids.delete(key(id));
      world()?.removePickup(key(id));
    },
    clear: () => {
      for (const id of runner().ids) world()?.removePickup(id);
      runner().ids.clear();
    },
    campfire: () => world()?.campfirePosition() ?? { x: PLANET_RADIUS, y: 0, z: 0 },
    timeLeft: () => runner().state?.timeLeft ?? 0,
    award: (points, why) => {
      const r = runner();
      const p = Math.max(0, Math.round(points));
      if (r.state) r.state.points = Math.min(r.state.meta.maxPoints || Infinity, r.state.points + p);
      emit({ kind: "award", points: p, why, state: r.state, passive: !r.state });
    },
    progress: (current, total, label) => {
      const r = runner();
      if (!r.state) return;
      r.state.progress = { current, total, label };
      emit({ kind: "progress", state: r.state });
    },
    toast: (text) => emit({ kind: "toast", text }),
    end: () => {
      const r = runner();
      if (r.state && !r.pendingEnd) r.pendingEnd = "complete";
    },
  };
  // Overrides wrap the world-facing primitives (tests, headless).
  const o = overrides;
  if (o.now) base.now = o.now;
  if (o.playerPos) base.playerPos = o.playerPos;
  if (o.distanceToPlayer) base.distanceToPlayer = o.distanceToPlayer;
  if (o.spawn) base.spawn = (id, kind, pos, opts) => { runner().ids.add(key(id)); o.spawn!(id, kind, pos, opts); };
  if (o.setPickup) base.setPickup = o.setPickup;
  if (o.despawn) base.despawn = (id) => { runner().ids.delete(key(id)); o.despawn!(id); };
  if (o.clear) base.clear = () => { runner().ids.clear(); o.clear!(); };
  if (o.campfire) base.campfire = o.campfire;
  return base;
}

/** Start a timed round. Ends any running round first. Returns false if unknown or passive. */
export function startRound(slug: string, opts: StartOptions = {}): boolean {
  const event = registry.get(slug);
  if (!event || event.meta.passive || event.meta.durationSec <= 0) return false;
  if (active) endRound("stopped");
  const runner: Runner = { event, ctx: null as unknown as MinigameContext, state: null, pendingEnd: null, ids: new Set(), opts };
  runner.ctx = buildContext(() => runner, slug, opts.context);
  const now = runner.ctx.now();
  runner.state = {
    slug, meta: event.meta, startedAt: now, endsAt: now + event.meta.durationSec * 1000, points: 0,
    timeLeft: event.meta.durationSec, progress: { current: 0, total: 0 },
  };
  active = runner;
  event.activate(runner.ctx);
  emit({ kind: "start", state: runner.state });
  return true;
}

/** Start (or restart) a passive event: no timer, awards emit directly. */
export function startPassive(slug: string, opts: StartOptions = {}): boolean {
  const event = registry.get(slug);
  if (!event || !event.meta.passive) return false;
  stopPassive();
  const runner: Runner = { event, ctx: null as unknown as MinigameContext, state: null, pendingEnd: null, ids: new Set(), opts };
  runner.ctx = buildContext(() => runner, slug, opts.context);
  passive = runner;
  event.activate(runner.ctx);
  return true;
}
export function stopPassive(): void {
  if (!passive) return;
  const r = passive;
  passive = null;
  r.event.deactivate(r.ctx);
  r.ctx.clear();
}

function finish(reason: RoundEndReason): void {
  if (!active) return;
  const r = active;
  active = null;
  const s = r.state!;
  r.event.deactivate(r.ctx);
  r.ctx.clear();
  const endedAt = Math.max(s.startedAt + 1, r.ctx.now());
  let envelope: RoundEnvelope | null = null;
  if (reason !== "stopped") {
    const candidate: RoundEnvelope = {
      version: 1, roundId: `${s.slug}-${s.startedAt}`, sessionId: r.opts.sessionId ?? "solo", minigame: s.slug,
      playerId: r.opts.playerId ?? "local", role: r.opts.role ?? "scout", points: s.points, maxPoints: s.meta.maxPoints,
      startedAt: s.startedAt, endedAt,
    };
    if (sink.ingest(candidate).accepted) envelope = candidate;
  }
  s.timeLeft = 0;
  emit({ kind: "end", state: s, envelope, reason });
}

export function endRound(reason: RoundEndReason = "stopped"): void {
  finish(reason);
}

/** Advance the active round (and passive event) by `dt` seconds. */
export function tickRound(dt: number): void {
  if (passive) passive.event.tick?.(passive.ctx, dt);
  if (!active) return;
  const r = active;
  const s = r.state!;
  s.timeLeft = Math.max(0, (s.endsAt - r.ctx.now()) / 1000);
  r.event.tick?.(r.ctx, dt);
  if (r.pendingEnd) return finish(r.pendingEnd);
  if (s.timeLeft <= 0) return finish("timeout");
  emit({ kind: "tick", state: s });
}

/** Drive tickRound from the world's frame loop. Idempotent. */
export function attachFrameDriver(): () => void {
  if (frameUnsub) return frameUnsub;
  frameUnsub = onFrame((dt) => tickRound(dt));
  return () => {
    frameUnsub?.();
    frameUnsub = null;
  };
}

/** Register the built-in event files (Firewood Dash, Lantern Relay, foraging). */
export function registerDefaults(): void {
  register(createFirewoodDash());
  register(createLanternRelay());
  register(createForaging());
}

/** Test helper: forget every registered event and stop everything. */
export function resetMinigames(): void {
  if (active) finish("stopped");
  stopPassive();
  registry.clear();
  listeners.clear();
  sink.drain();
}
