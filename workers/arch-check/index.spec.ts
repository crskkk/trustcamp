import { describe, it, expect } from "vitest";
import { run } from "./logic";
import type { Reader, ModuleEntry } from "../shared/reader";

function mk(modules: ModuleEntry[], files: Map<string, string>): Reader {
  return {
    listModules: async () => modules,
    readFile: async (p) => {
      const v = files.get(p);
      if (v === undefined) throw new Error(`no file: ${p}`);
      return v;
    },
    glob: async (pat) =>
      pat === "src/modules/**/module.yaml"
        ? modules.map((m) => `${m.dir}/module.yaml`)
        : [],
  };
}

function yaml(y: ModuleEntry["yaml"]): string {
  return `name: ${y.name}\ndescription: ${y.description}\nversion: ${y.version}\napi: ${y.api}\ndepends_on: [${y.depends_on.join(", ")}]`;
}

describe("arch-check worker", () => {
  it("passes on a well-formed module", async () => {
    const files = new Map<string, string>([
      ["src/modules/i18n/module.yaml", yaml({ name: "i18n", description: "d", version: "0.1.0", api: "src/modules/i18n/api.ts", depends_on: [] })],
    ]);
    const res = await run({ reader: mk([{ dir: "src/modules/i18n", yaml: { name: "i18n", description: "d", version: "0.1.0", api: "src/modules/i18n/api.ts", depends_on: [] } }], files) });
    expect(res.ok).toBe(true);
  });

  it("fails when a module.yaml is missing required fields", async () => {
    const bad: ModuleEntry = {
      dir: "src/modules/bad",
      yaml: { name: "", description: "d", version: "0.1.0", api: "", depends_on: [] },
    };
    const files = new Map<string, string>([
      ["src/modules/bad/module.yaml", yaml(bad.yaml)],
    ]);
    const res = await run({ reader: mk([bad], files) });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/module.yaml/i);
  });
});
