// workers/arch-check/logic.ts — module.yaml schema + basic boundary lint (first-cut).
// The comprehensive cross-folder import lint lands in task 0005.
import type { Reader, WorkerResult, ModuleYaml } from "../shared/reader";

export interface RunOpts {
  reader: Reader;
}

const REQUIRED: (keyof ModuleYaml)[] = ["name", "description", "version", "api", "depends_on"];

export async function run({ reader }: RunOpts): Promise<WorkerResult> {
  const modules = await reader.listModules();
  const violations: string[] = [];

  for (const m of modules) {
    for (const key of REQUIRED) {
      const v = m.yaml[key];
      if (v === undefined || v === null || v === "") {
        violations.push(`${m.dir}/module.yaml missing required field "${String(key)}"`);
      }
    }
    if (Array.isArray(m.yaml.depends_on) === false) {
      violations.push(`${m.dir}/module.yaml depends_on must be a list`);
    }
  }

  if (violations.length > 0) {
    return { ok: false, message: `module.yaml violations:\n${violations.join("\n")}`, details: { violations } };
  }
  return { ok: true, message: `${modules.length} module(s) valid`, details: { violations: [] } };
}
