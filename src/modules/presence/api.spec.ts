// src/modules/presence/api.spec.ts — task 0102 RED tests for PresenceMap.
// These tests describe the public surface of the presence module:
//   - createPresenceMap(): pure state container with merge/prune/interpolate
//   - startPresence(): wires bridge.onState into a shared map; idempotent
//   - subscribePresence(cb): bus of PresenceEvents
//   - clearPresence(): tears down the wiring and resets the map
//
// They run first as RED (the module is a stub), then GREEN in the next commit.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("presence module", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetModules();
  });

  describe("createPresenceMap (pure state)", () => {
    it("merge is idempotent for the same (playerId, ts)", async () => {
      const { createPresenceMap } = await import("./api");
      const map = createPresenceMap();
      map.merge({ playerId: "p1", x: 1, y: 2, z: 3, role: "scout", ts: 1000 });
      map.merge({ playerId: "p1", x: 1, y: 2, z: 3, role: "scout", ts: 1000 });
      expect(map.size()).toBe(1);
      expect(map.get("p1")?.x).toBe(1);
    });

    it("newer ts wins; older ts is dropped silently", async () => {
      const { createPresenceMap } = await import("./api");
      const map = createPresenceMap();
      map.merge({ playerId: "p1", x: 1, y: 2, z: 3, role: "scout", ts: 1000 });
      map.merge({ playerId: "p1", x: 9, y: 9, z: 9, role: "scout", ts: 2000 });
      map.merge({ playerId: "p1", x: 1, y: 1, z: 1, role: "scout", ts: 1500 });
      expect(map.get("p1")?.ts).toBe(2000);
      expect(map.get("p1")?.x).toBe(9);
    });

    it("prune drops entries whose lastSeen is older than ttlMs", async () => {
      const { createPresenceMap } = await import("./api");
      const map = createPresenceMap({ ttlMs: 1000 });
      map.merge({ playerId: "p1", x: 0, y: 0, z: 0, role: "scout", ts: 1000 });
      map.merge({ playerId: "p2", x: 0, y: 0, z: 0, role: "camp", ts: 5500 });
      map.prune(5500);
      expect(map.has("p1")).toBe(false);
      expect(map.has("p2")).toBe(true);
    });

    it("interpolate extrapolates position up to a small look-ahead cap", async () => {
      const { createPresenceMap } = await import("./api");
      const map = createPresenceMap({ maxLookAheadMs: 50, speedMps: 4 });
      map.merge({ playerId: "p1", x: 0, y: 0, z: 0, role: "scout", ts: 1000 });
      // 100ms of wall clock; cap is 50ms so we only travel 0.2m on x.
      const pos = map.interpolate("p1", 1100);
      expect(pos).not.toBeNull();
      expect(pos!.x).toBeCloseTo(0.2, 5);
    });

    it("interpolate returns null for an unknown player", async () => {
      const { createPresenceMap } = await import("./api");
      const map = createPresenceMap();
      expect(map.interpolate("ghost", 1000)).toBeNull();
    });

    it("onShapeChange fires when player count or ids change, not on every merge", async () => {
      const { createPresenceMap } = await import("./api");
      const map = createPresenceMap();
      const cb = vi.fn();
      const off = map.onShapeChange(cb);
      map.merge({ playerId: "p1", x: 0, y: 0, z: 0, role: "scout", ts: 1 }); // +1 → fires
      map.merge({ playerId: "p1", x: 1, y: 0, z: 0, role: "scout", ts: 2 }); // same shape → no fire
      map.merge({ playerId: "p2", x: 0, y: 0, z: 0, role: "camp", ts: 1 }); // +1 → fires
      map.prune(2); // 1ms after the latest ts; nothing is older than ttlMs
      map.merge({ playerId: "p2", x: 1, y: 0, z: 0, role: "camp", ts: 2 }); // no fire
      off();
      map.merge({ playerId: "p3", x: 0, y: 0, z: 0, role: "camp", ts: 1 }); // unsubscribed
      expect(cb).toHaveBeenCalledTimes(2);
    });
  });

  describe("startPresence / subscribePresence (bridge wiring)", () => {
    it("startPresence subscribes to bridge.onState and re-emits join/move/leave events", async () => {
      // Stub the bridge module before importing the api.
      const handlers: Array<(s: unknown) => void> = [];
      const onState = vi.fn((cb: (s: unknown) => void) => {
        handlers.push(cb);
        return () => {
          const i = handlers.indexOf(cb);
          if (i >= 0) handlers.splice(i, 1);
        };
      });
      vi.doMock("../bridge/api", () => ({ onState }));

      const { startPresence, subscribePresence, clearPresence } = await import("./api");
      startPresence({ selfId: "self" });
      const seen: string[] = [];
      const unsub = subscribePresence((e) => seen.push(`${e.kind}:${e.playerId}`));

      // Drive a fake state through the stubbed bridge.
      handlers[0]?.({ playerId: "p1", x: 0, y: 0, z: 0, role: "scout" });
      handlers[0]?.({ playerId: "p1", x: 1, y: 0, z: 0, role: "scout" });
      handlers[0]?.({ playerId: "self", x: 9, y: 9, z: 9, role: "scout" }); // ignored (self)

      expect(seen).toEqual(["join:p1", "move:p1"]);

      unsub();
      clearPresence();
    });

    it("startPresence is idempotent: a second call does not add a second bridge subscription", async () => {
      const onState = vi.fn(() => () => {});
      vi.doMock("../bridge/api", () => ({ onState }));
      const { startPresence, clearPresence } = await import("./api");
      startPresence();
      startPresence();
      startPresence();
      expect(onState).toHaveBeenCalledTimes(1);
      clearPresence();
    });

    it("clearPresence unsubscribes from the bridge and resets the map", async () => {
      const handlers: Array<(s: unknown) => void> = [];
      const onState = vi.fn((cb: (s: unknown) => void) => {
        handlers.push(cb);
        return () => {};
      });
      vi.doMock("../bridge/api", () => ({ onState }));
      const first = await import("./api");
      first.startPresence();
      const firstHandler = handlers[handlers.length - 1];
      firstHandler({ playerId: "p1", x: 0, y: 0, z: 0, role: "scout" });
      expect(first.getPresenceMap().size()).toBe(1);
      first.clearPresence();
      // After clear, fresh start should reattach to the bridge.
      // Note: vi.resetModules() is called in beforeEach; we just keep using this
      // module instance here so the mock remains bound.
      first.startPresence();
      const secondHandler = handlers[handlers.length - 1];
      secondHandler({ playerId: "p2", x: 0, y: 0, z: 0, role: "camp" });
      expect(first.getPresenceMap().size()).toBe(1);
      expect(first.getPresenceMap().has("p2")).toBe(true);
      first.clearPresence();
    });
  });
});
