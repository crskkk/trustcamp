import { describe, it, expect } from "vitest";
import { run } from "./logic";
import type { Reader, ModuleEntry } from "../shared/reader";

// A fake in-memory reader pointing at the fixture demo module.
function fakeReader(modules: ModuleEntry[]): Reader {
  const files = new Map<string, string>();
  for (const m of modules) {
    files.set(`${m.dir}/module.yaml`, yamlString(m.yaml));
    files.set(m.yaml.api, `export const x = 1;\nexport function useFoo() {}\n`);
  }
  return {
    listModules: async () => modules,
    readFile: async (p) => {
      const v = files.get(p);
      if (v === undefined) throw new Error(`no file: ${p}`);
      return v;
    },
    glob: async (pat) => (pat === "**/api.ts" ? [...files.keys()].filter((k) => k.endsWith("api.ts")) : []),
  };
}

function yamlString(y: ModuleEntry["yaml"]): string {
  return [
    `name: ${y.name}`,
    `description: ${y.description}`,
    `version: ${y.version}`,
    `api: ${y.api}`,
    `depends_on: [${y.depends_on.join(", ")}]`,
  ].join("\n");
}

describe("system-update worker", () => {
  it("emits a SYSTEM.md with header sections for an empty tree", async () => {
    const res = await run({ reader: fakeReader([]) });
    expect(res.ok).toBe(true);
    expect(res.details?.markdown).toContain("# SYSTEM.md");
    expect(res.details?.markdown).toContain("## Modules");
  });

  it("indexes a fixture module with its api path", async () => {
    const demo: ModuleEntry = {
      dir: "src/modules/demo",
      yaml: {
        name: "demo",
        description: "fixture",
        version: "0.1.0",
        api: "src/modules/demo/api.ts",
        depends_on: [],
      },
    };
    const res = await run({ reader: fakeReader([demo]) });
    expect(res.ok).toBe(true);
    const md = res.details?.markdown as string;
    expect(md).toContain("## Modules");
    expect(md).toContain("demo");
    expect(md).toContain("src/modules/demo/api.ts");
  });
});
