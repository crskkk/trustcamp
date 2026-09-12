import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { createWalker, stepWalker, tangentOf, turnToward } from "./internal/walker";

describe("world3d walker (sphere locomotion)", () => {
  it("stays on the unit sphere and faces its travel direction after a step", () => {
    const s = createWalker(new Vector3(0, 0, 1), new Vector3(1, 0, 0));
    const before = s.dir.clone();
    const moved = stepWalker(s, new Vector3(1, 0, 0), 0.5, 6, 48);
    expect(moved).toBeCloseTo(3, 6);
    expect(s.dir.length()).toBeCloseTo(1, 9);
    expect(Math.abs(s.dir.dot(s.fwd))).toBeLessThan(1e-6); // fwd is tangent
    expect(s.dir.angleTo(before)).toBeCloseTo(3 / 48, 6); // rolled by dist / R
    expect(s.fwd.x).toBeGreaterThan(0.99); // still heading +x
  });

  it("does not translate on zero input but keeps fwd tangent", () => {
    const s = createWalker(new Vector3(0, 1, 0), new Vector3(0, 0, 1));
    const before = s.dir.clone();
    const moved = stepWalker(s, new Vector3(0, 0, 0), 0.1, 6, 48);
    expect(moved).toBe(0);
    expect(s.dir.distanceTo(before)).toBe(0);
    expect(Math.abs(s.dir.dot(s.fwd))).toBeLessThan(1e-9);
  });

  it("walking a full circumference returns to the start", () => {
    const s = createWalker(new Vector3(1, 0, 0), new Vector3(0, 0, 1));
    const start = s.dir.clone();
    const R = 48, speed = 6, dt = 1 / 60;
    const total = 2 * Math.PI * R;
    let acc = 0;
    while (acc < total - 1e-9) {
      const step = Math.min(dt, (total - acc) / speed);
      acc += stepWalker(s, s.fwd.clone(), step, speed, R);
    }
    expect(s.dir.distanceTo(start)).toBeLessThan(1e-3);
  });

  it("clamps the move magnitude at 1 and scales speed below 1", () => {
    const a = createWalker(new Vector3(0, 0, 1), new Vector3(1, 0, 0));
    const b = createWalker(new Vector3(0, 0, 1), new Vector3(1, 0, 0));
    expect(stepWalker(a, new Vector3(5, 0, 0), 1, 6, 48)).toBeCloseTo(6, 9);
    expect(stepWalker(b, new Vector3(0.5, 0, 0), 1, 6, 48)).toBeCloseTo(3, 9);
  });

  it("tangentOf falls back to a sane tangent at the poles", () => {
    const t = tangentOf(new Vector3(0, 1, 0), new Vector3(0, 1, 0));
    expect(t.length()).toBeCloseTo(1, 9);
    expect(Math.abs(t.y)).toBeLessThan(1e-9);
  });

  it("turnToward rotates fwd by at most maxRad per call", () => {
    const s = createWalker(new Vector3(0, 0, 1), new Vector3(1, 0, 0));
    turnToward(s, new Vector3(0, 1, 0), 0.1);
    expect(s.fwd.angleTo(new Vector3(1, 0, 0))).toBeCloseTo(0.1, 2);
    turnToward(s, new Vector3(0, 1, 0), 10);
    expect(s.fwd.angleTo(new Vector3(0, 1, 0))).toBeLessThan(1e-6);
  });
});
