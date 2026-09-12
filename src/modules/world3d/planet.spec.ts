import { describe, it, expect } from "vitest";
import {
  PLANET_RADIUS, WATER_LEVEL, REGIONS, heightAt, biomeAt, surfaceRadius, isWalkable,
  angDist, slerp, sphDir, trailDistance, offsetDir, normalize, frameAt, TRAIL_SAMPLES,
} from "./internal/planet";
import { simplex3, fbm3 } from "./internal/noise";

describe("world3d planet model (pure)", () => {
  it("noise is deterministic per seed and roughly in [-1, 1]", () => {
    expect(simplex3(0.3, 0.7, 1.1, 7)).toBe(simplex3(0.3, 0.7, 1.1, 7));
    expect(simplex3(0.3, 0.7, 1.1, 7)).not.toBe(simplex3(0.3, 0.7, 1.1, 8));
    let lo = 0, hi = 0;
    for (let i = 0; i < 2000; i++) {
      const v = fbm3(i * 0.173, i * 0.071, i * 0.113, 4, 7);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThan(-1.01);
    expect(hi).toBeLessThan(1.01);
    expect(hi - lo).toBeGreaterThan(0.5);
  });

  it("heightAt is deterministic", () => {
    const d = sphDir(1.234, 0.2);
    expect(heightAt(d)).toBe(heightAt({ ...d }));
  });

  it("the lake basin is below water and the camp is a flat plateau", () => {
    expect(heightAt(REGIONS.lake)).toBeLessThan(WATER_LEVEL - 0.8);
    expect(isWalkable(REGIONS.lake)).toBe(false);
    expect(biomeAt(REGIONS.lake)).toBe("lake");
    expect(heightAt(REGIONS.camp)).toBeCloseTo(0.5, 1);
    for (const [e, n] of [[6, 0], [-6, 0], [0, 6], [0, -6], [5, 5]]) {
      expect(Math.abs(heightAt(offsetDir(REGIONS.camp, e, n)) - 0.5)).toBeLessThan(0.15);
    }
    expect(biomeAt(REGIONS.camp)).toBe("camp");
  });

  it("hills rise well above the meadow and forest is a distinct biome", () => {
    expect(heightAt(REGIONS.hills)).toBeGreaterThan(1.5);
    expect(biomeAt(REGIONS.hills)).toBe("hills");
    expect(biomeAt(REGIONS.forest)).toBe("forest");
  });

  it("all four areas are reachable on foot in one lap (< 360 m at 6 m/s = 60 s)", () => {
    const order = [REGIONS.camp, REGIONS.lake, REGIONS.forest, REGIONS.hills, REGIONS.camp];
    let total = 0;
    for (let i = 0; i < order.length - 1; i++) total += angDist(order[i], order[i + 1]) * PLANET_RADIUS;
    expect(total).toBeLessThan(360);
    expect(total).toBeGreaterThan(200);
  });

  it("trails pass through every area centre and are far from the poles", () => {
    for (const r of Object.values(REGIONS)) expect(trailDistance(r)).toBeLessThan(0.02);
    expect(TRAIL_SAMPLES.length).toBeGreaterThan(100);
    expect(trailDistance(sphDir(0, 1.2))).toBeGreaterThan(0.3);
  });

  it("surfaceRadius never goes below the wading floor", () => {
    expect(surfaceRadius(REGIONS.lake)).toBeCloseTo(PLANET_RADIUS + WATER_LEVEL - 0.35, 9);
  });

  it("sphere helpers behave", () => {
    const a = sphDir(0, 0), b = sphDir(Math.PI / 2, 0);
    expect(angDist(a, b)).toBeCloseTo(Math.PI / 2, 9);
    const m = slerp(a, b, 0.5);
    expect(angDist(a, m)).toBeCloseTo(Math.PI / 4, 6);
    const f = frameAt(normalize({ x: 1, y: 0.3, z: 0.2 }));
    expect(Math.abs(f.east.x * f.up.x + f.east.y * f.up.y + f.east.z * f.up.z)).toBeLessThan(1e-9);
    expect(angDist(offsetDir(a, PLANET_RADIUS * 0.1, 0), a)).toBeCloseTo(Math.atan(0.1), 3);
  });
});
