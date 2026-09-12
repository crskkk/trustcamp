import { describe, it, expect, beforeEach } from "vitest";
import { xpForLevel, levelFromXp, grantXp, getProgress, resetProgress, subscribeProgress, setProgressPersistence } from "./api";

describe("progress module (XP + levels)", () => {
  beforeEach(() => {
    localStorage.clear();
    setProgressPersistence(null);
    resetProgress();
  });

  it("the level curve is monotonic and starts gentle", () => {
    expect(xpForLevel(1)).toBe(60);
    for (let l = 1; l < 20; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
    expect(xpForLevel(10)).toBeGreaterThan(1000);
  });

  it("levelFromXp resolves totals into level + progress", () => {
    expect(levelFromXp(0)).toEqual({ xp: 0, level: 1, into: 0, need: 60 });
    expect(levelFromXp(59).level).toBe(1);
    expect(levelFromXp(60).level).toBe(2);
    const v = levelFromXp(60 + 10);
    expect(v.level).toBe(2);
    expect(v.into).toBe(10);
    expect(v.need).toBe(xpForLevel(2));
  });

  it("grantXp accumulates, reports level-ups and persists to localStorage", () => {
    const seen: number[] = [];
    const unsub = subscribeProgress((v) => seen.push(v.xp));
    expect(grantXp(30).leveledUp).toBe(false);
    const r = grantXp(40);
    expect(r).toMatchObject({ leveledUp: true, from: 1, to: 2, xp: 70 });
    expect(getProgress().level).toBe(2);
    expect(JSON.parse(localStorage.getItem("tc.progress")!)).toEqual({ xp: 70, level: 2 });
    expect(seen).toEqual([30, 70]);
    unsub();
  });

  it("negative or fractional grants never reduce XP", () => {
    grantXp(10);
    grantXp(-5);
    grantXp(2.9);
    expect(getProgress().xp).toBe(12);
  });

  it("a swapped persistence backend is loaded and written", () => {
    let saved: unknown = null;
    setProgressPersistence({ load: () => ({ xp: 100, level: 2 }), save: (s) => (saved = s) });
    expect(getProgress().xp).toBe(100);
    grantXp(5);
    expect(saved).toEqual({ xp: 105, level: 2 });
  });
});
