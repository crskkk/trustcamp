import { describe, it, expect, beforeEach } from "vitest";
import { nickFor, setSelf, addSelfScore, setSelfLevel, absorbRemote, getRows, getTeamScore, selfPublish, resetLeaderboard, subscribeLeaderboard } from "./api";

describe("leaderboard module", () => {
  beforeEach(() => resetLeaderboard());

  it("nicknames are deterministic, PII-free and varied", () => {
    expect(nickFor(101)).toBe(nickFor(101));
    const set = new Set<string>();
    for (let s = 0; s < 400; s++) set.add(nickFor(s));
    expect(set.size).toBeGreaterThan(150);
    expect(nickFor(7)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("ranks the local player against remotes by score and prunes stale rows", () => {
    setSelf({ playerId: "me", seed: 5 });
    addSelfScore(40);
    setSelfLevel(2);
    const t0 = 1_000_000;
    absorbRemote({ playerId: "a", x: 0, y: 0, z: 0, role: "scout", score: 90, level: 3, seed: 9 }, t0);
    absorbRemote({ playerId: "b", x: 0, y: 0, z: 0, role: "scout", score: 10, level: 1, seed: 2, nick: "Custom" }, t0);
    absorbRemote({ playerId: "c", x: 0, y: 0, z: 0, role: "scout" }, t0); // no score -> ignored
    const rows = getRows(t0 + 100);
    expect(rows.map((r) => r.playerId)).toEqual(["a", "me", "b"]);
    expect(rows[2].nick).toBe("Custom");
    expect(rows[1].self).toBe(true);
    expect(getTeamScore(t0 + 100)).toBe(140);
    expect(getRows(t0 + 20_000).map((r) => r.playerId)).toEqual(["me"]);
  });

  it("ignores its own echoed state and publishes score/level/seed/nick", () => {
    setSelf({ playerId: "me", seed: 42 });
    absorbRemote({ playerId: "me", x: 0, y: 0, z: 0, role: "scout", score: 999 });
    expect(getRows()[0].score).toBe(0);
    expect(selfPublish()).toEqual({ score: 0, level: 1, seed: 42, nick: nickFor(42) });
  });

  it("notifies subscribers on every change", () => {
    let n = 0;
    subscribeLeaderboard(() => n++);
    setSelf({ playerId: "me", seed: 1 });
    addSelfScore(5);
    absorbRemote({ playerId: "z", x: 0, y: 0, z: 0, role: "scout", score: 1 });
    expect(n).toBe(3);
  });
});
