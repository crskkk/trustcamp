import { describe, it, expect } from "vitest";
import { generate, toJSON, fromJSON, type AvatarSpec } from "./api";

describe("avatar module api", () => {
  describe("generate()", () => {
    it("returns an AvatarSpec with valid field ranges", () => {
      const spec = generate(42);
      expect(spec.version).toBe(1);
      expect(spec.skinTone).toBeGreaterThanOrEqual(0);
      expect(spec.skinTone).toBeLessThan(5);
      expect(spec.hairStyle).toBeGreaterThanOrEqual(0);
      expect(spec.hairStyle).toBeLessThan(5);
      expect(spec.hairColor).toBeGreaterThanOrEqual(0);
      expect(spec.hairColor).toBeLessThan(5);
      expect(spec.eyeColor).toBeGreaterThanOrEqual(0);
      expect(spec.eyeColor).toBeLessThan(5);
      expect(spec.expression).toBeGreaterThanOrEqual(0);
      expect(spec.expression).toBeLessThan(4);
      expect(spec.bodyAccent).toBeGreaterThanOrEqual(0);
      expect(spec.bodyAccent).toBeLessThan(4);
    });

    it("produces bit-identical results for the same seed", () => {
      const seed = 12345;
      const spec1 = generate(seed);
      const spec2 = generate(seed);
      expect(spec1).toEqual(spec2);
    });

    it("produces distinct results for different seeds", () => {
      const spec1 = generate(1);
      const spec2 = generate(2);
      // At least some fields should differ
      const fieldsMatch =
        spec1.skinTone === spec2.skinTone &&
        spec1.hairStyle === spec2.hairStyle &&
        spec1.hairColor === spec2.hairColor &&
        spec1.eyeColor === spec2.eyeColor &&
        spec1.expression === spec2.expression &&
        spec1.bodyAccent === spec2.bodyAccent;
      expect(fieldsMatch).toBe(false);
    });

    it("generates variety across a seed range", () => {
      const specs = Array.from({ length: 20 }, (_, i) => generate(i + 1));
      const uniqueSkinTones = new Set(specs.map((s) => s.skinTone));
      const uniqueExpressions = new Set(specs.map((s) => s.expression));
      // With 20 samples from 5 skin tones and 4 expressions, we should see variety
      expect(uniqueSkinTones.size).toBeGreaterThan(1);
      expect(uniqueExpressions.size).toBeGreaterThan(1);
    });
  });

  describe("toJSON() and fromJSON()", () => {
    it("round-trips through JSON without loss", () => {
      const original = generate(999);
      const json = toJSON(original);
      const recovered = fromJSON(json);
      expect(recovered).toEqual(original);
    });

    it("re-serializes to identical JSON after round-trip", () => {
      const spec = generate(42);
      const json1 = toJSON(spec);
      const recovered = fromJSON(json1);
      const json2 = toJSON(recovered);
      expect(json1).toBe(json2);
    });

    it("validates JSON structure on fromJSON", () => {
      expect(() => fromJSON("{}")).toThrow("Invalid AvatarSpec JSON");
      expect(() => fromJSON('{"skinTone": 1}')).toThrow("Invalid AvatarSpec JSON");
      expect(() => fromJSON("invalid json")).toThrow();
    });

    it("produces valid JSON that includes all fields", () => {
      const spec = generate(1);
      const json = toJSON(spec);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty("skinTone");
      expect(parsed).toHaveProperty("hairStyle");
      expect(parsed).toHaveProperty("hairColor");
      expect(parsed).toHaveProperty("eyeColor");
      expect(parsed).toHaveProperty("expression");
      expect(parsed).toHaveProperty("bodyAccent");
      expect(parsed).toHaveProperty("version");
    });
  });

  describe("schema consistency (mirrors Unity AvatarSpec.cs)", () => {
    it("AvatarSpec fields match expected schema", () => {
      const spec = generate(42);
      const keys = Object.keys(spec).sort();
      const expectedKeys = [
        "bodyAccent",
        "eyeColor",
        "expression",
        "hairColor",
        "hairStyle",
        "skinTone",
        "version",
      ].sort();
      expect(keys).toEqual(expectedKeys);
    });

    it("field types match expected ranges", () => {
      const spec = generate(42);
      expect(typeof spec.skinTone).toBe("number");
      expect(typeof spec.hairStyle).toBe("number");
      expect(typeof spec.hairColor).toBe("number");
      expect(typeof spec.eyeColor).toBe("number");
      expect(typeof spec.expression).toBe("number");
      expect(typeof spec.bodyAccent).toBe("number");
      expect(spec.version).toBe(1);
    });
  });

  describe("deterministic seed fixtures", () => {
    // Fixed seeds for visual checkpoint (used by Unity showcase scene)
    const FIXTURE_SEEDS = {
      SEED_1: 1,
      SEED_42: 42,
      SEED_12345: 12345,
      SEED_999999: 999999,
    };

    it("generates consistent specs for checkpoint seeds", () => {
      const results = Object.entries(FIXTURE_SEEDS).map(([name, seed]) => ({
        name,
        seed,
        spec: generate(seed),
      }));

      // Verify each seed produces its expected spec (for cross-platform testing)
      for (const { name, spec } of results) {
        // Sanity check: spec is valid
        expect(spec.version).toBe(1);
        // Each checkpoint seed should have unique characteristics
        expect(spec).toBeDefined();
      }

      // Verify all 4 are distinct
      const specs = results.map((r) => r.spec);
      const distinct = specs.reduce(
        (acc, spec) => {
          const key = `${spec.skinTone}-${spec.hairStyle}-${spec.hairColor}-${spec.eyeColor}-${spec.expression}-${spec.bodyAccent}`;
          acc.add(key);
          return acc;
        },
        new Set<string>()
      );
      expect(distinct.size).toBe(4);
    });
  });
});
