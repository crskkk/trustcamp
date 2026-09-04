// src/modules/npc/bridge.spec.ts — task 0104 RED tests for the publish loop.
//
// Public surface (to be implemented in step 4):
//   - startNpcMotion(bridge, opts): schedules a tick that calls
//     bridge.sendState for each live NPC with the right playerId and
//     a position derived from a synthetic step of the npc.
//   - stopNpcMotion(): clears the timer.
//   - The loop must call sendState with a playerId matching the npc
//     entry's id (npc-<seed>), and must skip ids that are no longer
//     in the live list (after clearNpcs / despawn).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("npc bridge publish loop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("startNpcMotion calls bridge.sendState with the right playerId on each tick", async () => {
    const sendState = vi.fn();
    const bridge = { sendState };
    const npc = await import("./api");
    const bridgeLoop = await import("./bridge");
    const entry = npc.spawnNpc({ seed: 99 });
    expect(entry).not.toBeNull();
    bridgeLoop.startNpcMotion({ bridge, tickMs: 100 });
    await vi.advanceTimersByTimeAsync(350);
    const ids = sendState.mock.calls.map((c) => c[0].playerId);
    expect(ids).toContain("npc-99");
    bridgeLoop.stopNpcMotion();
    npc.clearNpcs();
  });

  it("stops calling sendState after stopNpcMotion", async () => {
    const sendState = vi.fn();
    const bridge = { sendState };
    const npc = await import("./api");
    const bridgeLoop = await import("./bridge");
    npc.spawnNpc({ seed: 1 });
    npc.spawnNpc({ seed: 2 });
    bridgeLoop.startNpcMotion({ bridge, tickMs: 100 });
    await vi.advanceTimersByTimeAsync(250);
    const callsBefore = sendState.mock.calls.length;
    expect(callsBefore).toBeGreaterThan(0);
    bridgeLoop.stopNpcMotion();
    await vi.advanceTimersByTimeAsync(500);
    const callsAfter = sendState.mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
    npc.clearNpcs();
  });

  it("skips ids that are no longer in the spawner list", async () => {
    const sendState = vi.fn();
    const bridge = { sendState };
    const npc = await import("./api");
    const bridgeLoop = await import("./bridge");
    const a = npc.spawnNpc({ seed: 10 });
    npc.spawnNpc({ seed: 20 });
    bridgeLoop.startNpcMotion({ bridge, tickMs: 100 });
    await vi.advanceTimersByTimeAsync(150);
    npc.removeNpcById("npc-10"); // remove one
    sendState.mockClear();
    await vi.advanceTimersByTimeAsync(150);
    const ids = sendState.mock.calls.map((c) => c[0].playerId);
    expect(ids).not.toContain("npc-10");
    expect(ids).toContain("npc-20");
    bridgeLoop.stopNpcMotion();
    void a;
    npc.clearNpcs();
  });
});
