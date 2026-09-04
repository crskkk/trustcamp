// src/modules/npc/api.spec.ts — task 0103 RED tests for the NPC spawner.
//
// Public surface (to be implemented in step 2):
//   - spawnNpc(opts?): creates an NPC, returns its stable id ("npc-<seed>")
//   - listNpcs(): returns the current array of NPC summaries
//   - clearNpcs(): removes every NPC from the presence layer
//   - setNpcCap(n): change the cap; spawnNpc is a no-op when at cap
//
// Each NPC entry is { id, seed, role, spec, position } where spec is the
// AvatarSpec produced by the avatar generator (same pipeline as players —
// AGENTS §9).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("npc module", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.resetModules();
  });

  describe("spawnNpc (basic)", () => {
    it("returns a stable 'npc-<seed>' id, idempotent on the same seed", async () => {
      // Stub presence so the spawner has somewhere to land.
      const absorb = vi.fn();
      const remove = vi.fn();
      vi.doMock("../presence/api", () => ({
        startPresence: vi.fn(() => ({ ids: () => [], has: () => false, get: () => undefined, merge: () => {}, clear: () => {}, prune: () => {}, size: () => 0, onShapeChange: () => () => {} })),
        getPresenceMap: vi.fn(() => ({ ids: () => [], has: () => false, get: () => undefined, merge: () => {}, clear: () => {}, prune: () => {}, size: () => 0, onShapeChange: () => () => {} })),
        absorbPeerHeartbeat: absorb,
        removePeer: remove,
        subscribePresence: vi.fn(() => () => {}),
      }));
      const { spawnNpc, clearNpcs, listNpcs } = await import("./api");
      const a = spawnNpc({ seed: 42 });
      const b = spawnNpc({ seed: 42 });
      expect(a.id).toBe("npc-42");
      expect(b.id).toBe("npc-42");
      expect(listNpcs()).toHaveLength(1);
      expect(absorb).toHaveBeenCalledTimes(1);
      clearNpcs();
    });

    it("uses the avatar generator for the NPC's appearance (same pipeline as players)", async () => {
      vi.doMock("../presence/api", () => ({
        startPresence: vi.fn(() => ({ ids: () => [], has: () => false, get: () => undefined, merge: () => {}, clear: () => {}, prune: () => {}, size: () => 0, onShapeChange: () => () => {} })),
        getPresenceMap: vi.fn(() => ({ ids: () => [], has: () => false, get: () => undefined, merge: () => {}, clear: () => {}, prune: () => {}, size: () => 0, onShapeChange: () => () => {} })),
        absorbPeerHeartbeat: vi.fn(),
        removePeer: vi.fn(),
        subscribePresence: vi.fn(() => () => {}),
      }));
      const npc = await import("./api");
      const avatar = await import("../avatar/api");
      const result = npc.spawnNpc({ seed: 12345 });
      // The spec is exactly what avatar.generate(12345) returns.
      expect(result.spec).toEqual(avatar.generate(12345));
      npc.clearNpcs();
    });

    it("absorbs a peer heartbeat for the new NPC with role 'prospect' by default", async () => {
      const absorb = vi.fn();
      vi.doMock("../presence/api", () => ({
        startPresence: vi.fn(() => ({ ids: () => [], has: () => false, get: () => undefined, merge: () => {}, clear: () => {}, prune: () => {}, size: () => 0, onShapeChange: () => () => {} })),
        getPresenceMap: vi.fn(() => ({ ids: () => [], has: () => false, get: () => undefined, merge: () => {}, clear: () => {}, prune: () => {}, size: () => 0, onShapeChange: () => () => {} })),
        absorbPeerHeartbeat: absorb,
        removePeer: vi.fn(),
        subscribePresence: vi.fn(() => () => {}),
      }));
      const { spawnNpc, clearNpcs } = await import("./api");
      spawnNpc({ seed: 7 });
      const call = absorb.mock.calls[0]?.[0];
      expect(call).toBeDefined();
      expect(call.selfId).toBe("npc-7");
      expect(call.role).toBe("prospect");
      expect(typeof call.x).toBe("number");
      expect(typeof call.y).toBe("number");
      expect(typeof call.z).toBe("number");
      expect(typeof call.ts).toBe("number");
      clearNpcs();
    });
  });

  describe("cap", () => {
    it("setNpcCap(0) makes spawnNpc a no-op", async () => {
      const absorb = vi.fn();
      vi.doMock("../presence/api", () => ({
        startPresence: vi.fn(() => ({ ids: () => [], has: () => false, get: () => undefined, merge: () => {}, clear: () => {}, prune: () => {}, size: () => 0, onShapeChange: () => () => {} })),
        getPresenceMap: vi.fn(() => ({ ids: () => [], has: () => false, get: () => undefined, merge: () => {}, clear: () => {}, prune: () => {}, size: () => 0, onShapeChange: () => {} })),
        absorbPeerHeartbeat: absorb,
        removePeer: vi.fn(),
        subscribePresence: vi.fn(() => () => {}),
      }));
      const { spawnNpc, setNpcCap, listNpcs } = await import("./api");
      setNpcCap(0);
      const r = spawnNpc({ seed: 1 });
      expect(r).toBeNull();
      expect(listNpcs()).toHaveLength(0);
      expect(absorb).not.toHaveBeenCalled();
    });

    it("setNpcCap(2) caps at 2 NPCs; the third spawnNpc is a no-op", async () => {
      const absorb = vi.fn();
      vi.doMock("../presence/api", () => ({
        startPresence: vi.fn(() => ({ ids: () => [], has: () => false, get: () => undefined, merge: () => {}, clear: () => {}, prune: () => {}, size: () => 0, onShapeChange: () => {} })),
        getPresenceMap: vi.fn(() => ({ ids: () => [], has: () => false, get: () => undefined, merge: () => {}, clear: () => {}, prune: () => {}, size: () => 0, onShapeChange: () => {} })),
        absorbPeerHeartbeat: absorb,
        removePeer: vi.fn(),
        subscribePresence: vi.fn(() => () => {}),
      }));
      const { spawnNpc, setNpcCap, listNpcs, clearNpcs } = await import("./api");
      setNpcCap(2);
      expect(spawnNpc({ seed: 1 })?.id).toBe("npc-1");
      expect(spawnNpc({ seed: 2 })?.id).toBe("npc-2");
      expect(spawnNpc({ seed: 3 })).toBeNull();
      expect(listNpcs()).toHaveLength(2);
      clearNpcs();
    });
  });

  describe("clearNpcs", () => {
    it("removes every NPC from the presence layer", async () => {
      const remove = vi.fn();
      vi.doMock("../presence/api", () => ({
        startPresence: vi.fn(() => ({ ids: () => [], has: () => false, get: () => undefined, merge: () => {}, clear: () => {}, prune: () => {}, size: () => 0, onShapeChange: () => {} })),
        getPresenceMap: vi.fn(() => ({ ids: () => [], has: () => false, get: () => undefined, merge: () => {}, clear: () => {}, prune: () => {}, size: () => 0, onShapeChange: () => {} })),
        absorbPeerHeartbeat: vi.fn(),
        removePeer: remove,
        subscribePresence: vi.fn(() => () => {}),
      }));
      const { spawnNpc, clearNpcs, listNpcs } = await import("./api");
      spawnNpc({ seed: 1 });
      spawnNpc({ seed: 2 });
      clearNpcs();
      expect(remove).toHaveBeenCalledWith("npc-1");
      expect(remove).toHaveBeenCalledWith("npc-2");
      expect(listNpcs()).toHaveLength(0);
    });
  });
});
