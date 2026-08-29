import { describe, it, expect } from "vitest";
import { run } from "./logic";
import type { Reader, ModuleEntry } from "../shared/reader";
import { validateModule } from "./schema";

function mk(modules: ModuleEntry[], files: Map<string, string>, srcFiles: string[] = []): Reader {
  return {
    listModules: async () => modules,
    readFile: async (p) => {
      const v = files.get(p);
      if (v === undefined) throw new Error(`no file: ${p}`);
      return v;
    },
    glob: async (pat) => {
      if (pat === "src/modules/**/module.yaml") return modules.map((m) => `${m.dir}/module.yaml`);
      if (pat === "src/modules/**/*.{ts,tsx,cs,py}") return srcFiles;
      if (pat === "**/__fixtures__/**") return srcFiles.filter((f) => f.includes("__fixtures__"));
      return [];
    },
  };
}

function yaml(y: ModuleEntry["yaml"]): string {
  return `name: ${y.name}\ndescription: ${y.description}\nversion: ${y.version}\napi: ${y.api}\ndepends_on: [${y.depends_on.join(", ")}]`;
}

describe("arch-check worker — schema (module.yaml)", () => {
  it("passes on a well-formed module", async () => {
    const files = new Map<string, string>([
      [
        "src/modules/i18n/module.yaml",
        yaml({ name: "i18n", description: "d", version: "0.1.0", api: "src/modules/i18n/api.ts", depends_on: [] }),
      ],
      ["src/modules/i18n/api.ts", "// exists"],
    ]);
    const res = await run({
      reader: mk(
        [{ dir: "src/modules/i18n", yaml: { name: "i18n", description: "d", version: "0.1.0", api: "src/modules/i18n/api.ts", depends_on: [] } }],
        files,
        ["src/modules/i18n/api.ts"],
      ),
    });
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

  it("S2 — flags non-semver version", () => {
    const issues = validateModule(
      "src/modules/m",
      { name: "m", description: "d", version: "v1", api: "src/modules/m/api.ts", depends_on: [] },
      { knownModules: new Map(), apiFileExists: () => true },
    );
    expect(issues.some((i) => i.rule === "S2.version")).toBe(true);
  });

  it("S3 — flags an api path that does not point at an existing file", async () => {
    const m: ModuleEntry = {
      dir: "src/modules/brokenspec",
      yaml: {
        name: "brokenspec",
        description: "d",
        version: "0.1.0",
        api: "src/modules/brokenspec/api.ts",
        depends_on: [],
      },
    };
    const files = new Map<string, string>([[`${m.dir}/module.yaml`, yaml(m.yaml)]]);
    const res = await run({ reader: mk([m], files, [`${m.dir}/module.yaml`]) });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/api.*does not exist/i);
  });

  it("S4 — flags depends_on referring to an unknown module only as a warning", async () => {
    const m: ModuleEntry = {
      dir: "src/modules/x",
      yaml: {
        name: "x",
        description: "d",
        version: "0.1.0",
        api: "src/modules/x/api.ts",
        depends_on: ["unknownmod"],
      },
    };
    const files = new Map<string, string>([
      [`${m.dir}/module.yaml`, yaml(m.yaml)],
      [`${m.dir}/api.ts`, "// exists"],
    ]);
    const res = await run({ reader: mk([m], files, [`${m.dir}/api.ts`]) });
    // Warnings alone do not flip a run to FAIL.
    expect(res.ok).toBe(true);
    const details = (res.details?.issues ?? []) as Array<{ rule: string; severity: string }>;
    expect(details.some((i) => i.rule === "S4.depends_on.unknown" && i.severity === "warning")).toBe(true);
  });

  it("S5 — blocks two modules with the same name", async () => {
    const a: ModuleEntry = {
      dir: "src/modules/a",
      yaml: { name: "dup", description: "A", version: "0.1.0", api: "src/modules/a/api.ts", depends_on: [] },
    };
    const b: ModuleEntry = {
      dir: "src/modules/b",
      yaml: { name: "dup", description: "B", version: "0.1.0", api: "src/modules/b/api.ts", depends_on: [] },
    };
    const files = new Map<string, string>([
      [`${a.dir}/module.yaml`, yaml(a.yaml)],
      [`${b.dir}/module.yaml`, yaml(b.yaml)],
      [`${a.dir}/api.ts`, "// a"],
      [`${b.dir}/api.ts`, "// b"],
    ]);
    const res = await run({
      reader: mk([a, b], files, [`${a.dir}/api.ts`, `${b.dir}/api.ts`]),
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/already used/i);
  });
});

describe("arch-check worker — boundary (cross-folder imports)", () => {
  it("flags a cross-folder import that does NOT go through the target module's api file", async () => {
    const a: ModuleEntry = {
      dir: "src/modules/a",
      yaml: { name: "a", description: "A", version: "0.1.0", api: "src/modules/a/api.ts", depends_on: [] },
    };
    const b: ModuleEntry = {
      dir: "src/modules/b",
      yaml: { name: "b", description: "B", version: "0.1.0", api: "src/modules/b/api.ts", depends_on: [] },
    };
    // `a/Inside.tsx` reaches into `b/internal/foo.ts` instead of `b/api.ts`.
    const srcFiles = [
      `${a.dir}/Inside.tsx`,
      `${a.dir}/api.ts`,
      `${b.dir}/internal/foo.ts`,
      `${b.dir}/api.ts`,
    ];
    const files = new Map<string, string>([
      [`${a.dir}/module.yaml`, yaml(a.yaml)],
      [`${b.dir}/module.yaml`, yaml(b.yaml)],
      [`${a.dir}/api.ts`, "// a api"],
      [`${b.dir}/api.ts`, "// b api"],
      [`${b.dir}/internal/foo.ts`, "// b internal, must not be imported cross-folder"],
    ]);
    // We have to synthetically include an `import` line via the readFile interface.
    files.set(
      `${a.dir}/Inside.tsx`,
      `import { something } from "../b/internal/foo";\nexport const x = something;\n`,
    );

    const res = await run({ reader: mk([a, b], files, srcFiles) });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/boundary/i);
    expect(res.message).toMatch(/b[\/]api\.ts|b\/api\.ts/);
  });

  it("accepts a cross-folder import that goes through the target's api file", async () => {
    const a: ModuleEntry = {
      dir: "src/modules/a",
      yaml: { name: "a", description: "A", version: "0.1.0", api: "src/modules/a/api.ts", depends_on: [] },
    };
    const b: ModuleEntry = {
      dir: "src/modules/b",
      yaml: { name: "b", description: "B", version: "0.1.0", api: "src/modules/b/api.ts", depends_on: [] },
    };
    const srcFiles = [`${a.dir}/Inside.tsx`, `${a.dir}/api.ts`, `${b.dir}/api.ts`];
    const files = new Map<string, string>([
      [`${a.dir}/module.yaml`, yaml(a.yaml)],
      [`${b.dir}/module.yaml`, yaml(b.yaml)],
      [`${a.dir}/api.ts`, "// a api"],
      [`${b.dir}/api.ts`, "// b api"],
      [`${a.dir}/Inside.tsx`, `import { ok } from "../b/api";\nexport const x = ok;\n`],
    ]);
    const res = await run({ reader: mk([a, b], files, srcFiles) });
    expect(res.ok).toBe(true);
  });

  it("flags the on-disk fixture layout that contains a cross-folder violation", async () => {
    // The fixture mirrors the canonical "a reaches into b/internal" layout
    // committed under workers/arch-check/__fixtures__/violating-ok-layout/.
    const aDir = "workers/arch-check/__fixtures__/violating-ok-layout/a";
    const bDir = "workers/arch-check/__fixtures__/violating-ok-layout/b";
    const a: ModuleEntry = {
      dir: aDir,
      yaml: { name: "a", description: "A", version: "0.0.1", api: `${aDir}/api.ts`, depends_on: ["b"] },
    };
    const b: ModuleEntry = {
      dir: bDir,
      yaml: { name: "b", description: "B", version: "0.0.1", api: `${bDir}/api.ts`, depends_on: [] },
    };
    const srcFiles = [`${aDir}/api.ts`, `${aDir}/inside.ts`, `${bDir}/api.ts`, `${bDir}/internal/foo.ts`];
    const files = new Map<string, string>();
    for (const f of srcFiles) {
      files.set(f, `// placeholder for ${f}`);
    }
    // Replace the violating file with the real import.
    files.set(`${aDir}/inside.ts`, `import { bSecret } from "../b/internal/foo";\nexport const leak = bSecret;\n`);

    const res = await run({ reader: mk([a, b], files, srcFiles) });
    expect(res.ok).toBe(false);
    const boundary = (res.details?.boundary ?? []) as Array<{ targetPath: string }>;
    expect(boundary.length).toBeGreaterThan(0);
    expect(boundary[0].targetPath).toContain("b/internal/foo");
  });
});
