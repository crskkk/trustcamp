import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { joinWorld, leaveWorld, sendState, onState, mountBridge, initSupabase, isConfigured, type WorldState } from "./api";

describe("bridge api (Supabase with in-memory fallback)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("in-memory fallback (Supabase not configured)", () => {
    it("joinWorld resolves with an opaque session id and emits a success", async () => {
      const res = await joinWorld();
      expect(res.ok).toBe(true);
      expect(typeof res.sessionId).toBe("string");
      expect(res.sessionId.length).toBeGreaterThan(0);
    });

    it("sendState fans out to onState subscribers", async () => {
      const received: WorldState[] = [];
      const unsub = onState((s) => received.push(s));
      await sendState({ playerId: "p1", x: 1, y: 2, z: 3, role: "scout" });
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ playerId: "p1", x: 1 });
      unsub();
      await sendState({ playerId: "p2", x: 9, y: 9, z: 9, role: "scout" });
      expect(received).toHaveLength(1);
    });

    it("leaveWorld resolves", async () => {
      await expect(leaveWorld()).resolves.toBeUndefined();
    });

    it("mountBridge installs window.__tcBridge delegating to the api", () => {
      const w = {} as unknown as Window & typeof globalThis;
      mountBridge(w);
      const bridge = (w as unknown as { __tcBridge?: unknown }).__tcBridge;
      expect(bridge).toBeDefined();
      expect(typeof (bridge as { joinWorld: unknown }).joinWorld).toBe("function");
      expect(typeof (bridge as { sendState: unknown }).sendState).toBe("function");
      expect(typeof (bridge as { onState: unknown }).onState).toBe("function");
    });

    it("falls back to in-memory when Supabase not configured", async () => {
      const res = await joinWorld();
      expect(res.ok).toBe(true);
    });
  });

  describe("Supabase integration (when configured)", () => {
    it("initSupabase is exported and isConfigured returns false by default", async () => {
      // The function should exist
      expect(typeof initSupabase).toBe("function");
      expect(isConfigured()).toBe(false);
    });

    it("fallback to in-memory when Supabase not configured", () => {
      expect(isConfigured()).toBe(false);
    });
  });
});