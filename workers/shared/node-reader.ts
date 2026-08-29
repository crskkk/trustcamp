// Node reader: real fs/glob backing for the worker run() functions in CI.
import { readFileSync } from "node:fs";
import { glob } from "glob";
import yaml from "js-yaml";
import type { Reader, ModuleEntry, ModuleYaml } from "./reader";

/** Normalize a path to posix separators. On Windows, glob returns
 *  backslashes; our worker logic is written against forward slashes
 *  (the worker is browser-shared, so we want one canonical form). */
function posix(p: string): string {
  return p.replace(/\\/g, "/");
}

export async function nodeReader(): Promise<Reader> {
  return {
    listModules: async () => {
      const paths = await glob("src/modules/**/module.yaml");
      const entries: ModuleEntry[] = [];
      for (const p of paths) {
        const raw = readFileSync(p, "utf8");
        const parsed = yaml.load(raw) as ModuleYaml;
        const dir = posix(p).replace(/\/module\.yaml$/, "");
        entries.push({ dir, yaml: normalize(parsed) });
      }
      return entries;
    },
    readFile: async (p) => readFileSync(p, "utf8"),
    glob: async (pat) => (await glob(pat)).map(posix),
  };
}

function normalize(y: Partial<ModuleYaml>): ModuleYaml {
  return {
    name: y.name ?? "",
    description: y.description ?? "",
    version: y.version ?? "",
    api: y.api ?? "",
    depends_on: Array.isArray(y.depends_on) ? y.depends_on : [],
  };
}
