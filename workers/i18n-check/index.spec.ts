import { describe, it, expect } from "vitest";
import { run } from "./logic";
import type { Reader } from "../shared/reader";

describe("i18n-check worker", () => {
  it("passes when all keys exist in all three dictionaries", async () => {
    const dict = { "app.title": "x" };
    const reader: Reader = {
      listModules: async () => [],
      readFile: async () => "",
      glob: async () => [],
    };
    const res = await run({
      reader,
      dictionaries: { en: dict, es: dict, pt: dict },
      usedKeys: ["app.title"],
    });
    expect(res.ok).toBe(true);
  });

  it("fails when a key used in code is missing from a dictionary", async () => {
    const reader: Reader = {
      listModules: async () => [],
      readFile: async () => "",
      glob: async () => [],
    };
    const res = await run({
      reader,
      dictionaries: { en: { "app.title": "x" }, es: {}, pt: { "app.title": "x" } },
      usedKeys: ["app.title"],
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/es/);
  });

  it("surfaces hardcoded strings as warnings, not blockers", async () => {
    const reader: Reader = {
      listModules: async () => [],
      readFile: async () => "",
      glob: async () => [],
    };
    const res = await run({
      reader,
      dictionaries: { en: { "app.title": "x" }, es: { "app.title": "x" }, pt: { "app.title": "x" } },
      usedKeys: ["app.title"],
      hardcoded: [{ file: "src/App.tsx", line: 1, text: "Hello", rule: "jsx-text" }],
    });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/1 hardcoded string/);
    expect((res.details?.hardcoded as unknown as Array<{ text: string }>).map((h) => h.text)).toEqual(["Hello"]);
  });
});
