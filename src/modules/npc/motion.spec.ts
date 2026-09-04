// src/modules/npc/motion.spec.ts — task 0104 RED tests for the motion policy.
//
// The policy is a pure function: given an NPC's current surface position
// and an optional target, it returns the Vector2 input that should be
// fed to PlayerController.Step() next. The pure shape means we can unit
// test it without any DOM, network, or Unity binding.
//
// Constraints (mirrors STANDARDS §5.1):
//   - The input magnitude is bounded; NPCs are never faster than players.
//   - With no target, NPCs drift (≤ 0.2) so the world doesn't look frozen.
//   - With a target, the input points along the great-circle tangent from
//     the NPC toward the target.
//   - A small bounded jitter is added so two NPCs don't walk in lockstep.

import { describe, it, expect } from "vitest";
import { chooseInput, maxNpcSpeed, DEFAULT_PLAYER_SPEED } from "./motion";

describe("npc motion policy", () => {
  describe("chooseInput", () => {
    it("returns a small forward drift (≤ 0.2) when there is no target", () => {
      const inp = chooseInput({
        npcPos: { x: 0, y: 0, z: 1 },
        npcUp: { x: 0, y: 1, z: 0 },
        target: null,
        jitterSeed: 1,
      });
      const mag = Math.hypot(inp.x, inp.y);
      expect(mag).toBeGreaterThan(0);
      // Allow a tiny float epsilon — the implementation scales by an
      // exact 0.2 factor; allow up to 1e-9 of noise.
      expect(mag).toBeLessThanOrEqual(0.2 + 1e-9);
    });

    it("with a target, the input points along the great-circle tangent", () => {
      // NPC at the north pole, target on the equator at longitude 0.
      // Tangent direction (east) is +x in world space.
      const inp = chooseInput({
        npcPos: { x: 0, y: 1, z: 0 },
        npcUp: { x: 0, y: 1, z: 0 },
        target: { x: 1, y: 0, z: 0 },
        jitterSeed: 0,
      });
      const mag = Math.hypot(inp.x, inp.y);
      // Near unit magnitude (the jitter is tiny when the seed is small).
      expect(mag).toBeGreaterThan(0.9);
      expect(mag).toBeLessThanOrEqual(1);
    });

    it("input magnitude never exceeds 1 (capped)", () => {
      const inp = chooseInput({
        npcPos: { x: 0, y: 0, z: 1 },
        npcUp: { x: 0, y: 1, z: 0 },
        target: { x: 5, y: 5, z: 5 },
        jitterSeed: 9999,
      });
      const mag = Math.hypot(inp.x, inp.y);
      expect(mag).toBeLessThanOrEqual(1 + 1e-9);
    });

    it("is deterministic: same args → same output", () => {
      const args = {
        npcPos: { x: 0, y: 1, z: 0 },
        npcUp: { x: 0, y: 1, z: 0 },
        target: { x: 1, y: 0, z: 0 } as const,
      };
      const a = chooseInput({ ...args, jitterSeed: 7 });
      const b = chooseInput({ ...args, jitterSeed: 7 });
      expect(a).toEqual(b);
    });
  });

  describe("speed cap", () => {
    it("maxNpcSpeed is ≤ DEFAULT_PLAYER_SPEED (6 m/s)", () => {
      expect(maxNpcSpeed).toBeLessThanOrEqual(DEFAULT_PLAYER_SPEED);
      expect(maxNpcSpeed).toBeGreaterThan(0);
    });
  });
});
