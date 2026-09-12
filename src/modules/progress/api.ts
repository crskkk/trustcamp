// src/modules/progress/api.ts — the ONLY public door to the progress module.
//
// XP + levels. The curve is gentle at the start (a first-time player levels
// up inside their first round) and widens so level 10 takes a full session.

export interface ProgressState {
  xp: number;
  level: number;
}

export interface ProgressView extends ProgressState {
  /** XP earned inside the current level. */
  into: number;
  /** XP needed to finish the current level. */
  need: number;
}

export interface GrantResult {
  leveledUp: boolean;
  from: number;
  to: number;
  xp: number;
}

export interface ProgressPersistence {
  load(): ProgressState | null;
  save(state: ProgressState): void;
}

const STORAGE_KEY = "tc.progress";

/** XP required to advance FROM `level` to `level + 1`. L1→2 = 60, L5→6 ≈ 620. */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return Math.round(60 * Math.pow(l, 1.45));
}

/** Resolve a total XP into a level plus progress inside that level. */
export function levelFromXp(totalXp: number): ProgressView {
  let xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let need = xpForLevel(level);
  while (xp >= need) {
    xp -= need;
    level++;
    need = xpForLevel(level);
  }
  return { xp: Math.max(0, Math.floor(totalXp)), level, into: xp, need };
}

const localPersistence: ProgressPersistence = {
  load() {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return null;
      const p = JSON.parse(raw) as Partial<ProgressState>;
      if (typeof p.xp !== "number" || !Number.isFinite(p.xp)) return null;
      return { xp: p.xp, level: levelFromXp(p.xp).level };
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
  },
};

let persistence: ProgressPersistence = localPersistence;
let state: ProgressState | null = null;
const listeners = new Set<(view: ProgressView, grant?: GrantResult) => void>();

function current(): ProgressState {
  if (!state) state = persistence.load() ?? { xp: 0, level: 1 };
  return state;
}

function emit(grant?: GrantResult): void {
  const view = getProgress();
  for (const cb of listeners) cb(view, grant);
}

/** Swap the persistence backend (server store in multiplayer). Reloads state. */
export function setProgressPersistence(p: ProgressPersistence | null): void {
  persistence = p ?? localPersistence;
  state = null;
  emit();
}

export function getProgress(): ProgressView {
  return levelFromXp(current().xp);
}

/** Add XP. Returns whether a level boundary was crossed. Persists. */
export function grantXp(amount: number): GrantResult {
  const s = current();
  const from = levelFromXp(s.xp).level;
  s.xp = Math.max(0, s.xp + Math.max(0, Math.floor(amount)));
  const to = levelFromXp(s.xp).level;
  s.level = to;
  persistence.save({ xp: s.xp, level: s.level });
  const result = { leveledUp: to > from, from, to, xp: s.xp };
  emit(result);
  return result;
}

export function resetProgress(): void {
  state = { xp: 0, level: 1 };
  persistence.save(state);
  emit();
}

export function subscribeProgress(cb: (view: ProgressView, grant?: GrantResult) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
