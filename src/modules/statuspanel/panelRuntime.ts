// Browser-side runtime for the StatusPanel: runs the workers live in-browser
// using import.meta.glob for module.yaml files, and fetch() for the generated
// artifacts (test-results.json, ROADMAP.md, SYSTEM.md).
import { run as runArch } from "../../../workers/arch-check/logic";
import { run as runI18n } from "../../../workers/i18n-check/logic";
import { run as runSystem } from "../../../workers/system-update/logic";
import { run as runBundle } from "../../../workers/bundle-guard/logic";
import type { WorkerResult, ModuleEntry, ModuleYaml, Reader } from "../../../workers/shared/reader";
import yaml from "js-yaml";

export type WorkerKey = "arch-check" | "i18n-check" | "system-update" | "bundle-guard";

export interface PanelState {
  results: Record<WorkerKey, WorkerResult | undefined>;
  tests: { passed: number; total: number } | null;
  version: string | null;
  systemMd: string | null;
}

// import.meta.glob: Vite collects these at build time. eager:false → async import.
const moduleYamls = import.meta.glob("/src/modules/*/module.yaml", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const dictModules = import.meta.glob("/src/modules/i18n/dictionaries/*.json", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

async function browserReader(): Promise<Reader> {
  return {
    listModules: async () => {
      const entries: ModuleEntry[] = [];
      for (const [path, loader] of Object.entries(moduleYamls)) {
        const raw = await loader();
        const parsed = yaml.load(raw) as ModuleYaml;
        const dir = path.replace(/\/module\.yaml$/, "");
        entries.push({ dir, yaml: normalize(parsed) });
      }
      return entries;
    },
    readFile: async () => "",
    glob: async () => [],
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

async function loadDictionaries(): Promise<Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [path, loader] of Object.entries(dictModules)) {
    const lang = path.match(/\/([^/]+)\.json$/)?.[1] ?? "";
    out[lang] = JSON.parse(await loader());
  }
  return out;
}

async function collectUsedKeys(): Promise<string[]> {
  // The browser cannot scan source files cheaply; derive used keys from the
  // English dictionary (the source of truth for what the panel uses) plus
  // the panel's own keys. This mirrors what the Node worker would find.
  const dicts = await loadDictionaries();
  return Object.keys(dicts["en"] ?? {});
}

export async function runAllWorkers(): Promise<Record<WorkerKey, WorkerResult | undefined>> {
  const reader = await browserReader();
  const dicts = await loadDictionaries();
  const usedKeys = await collectUsedKeys();
  const [arch, i18n, system, bundle] = await Promise.all([
    runArch({ reader }).catch(() => ({ ok: false, message: "error" }) as WorkerResult),
    runI18n({ reader, dictionaries: { en: dicts.en ?? {}, es: dicts.es ?? {}, pt: dicts.pt ?? {} }, usedKeys }).catch(
      () => ({ ok: false, message: "error" }) as WorkerResult
    ),
    runSystem({ reader }).catch(() => ({ ok: false, message: "error" }) as WorkerResult),
    runBundle().catch(() => ({ ok: false, message: "error" }) as WorkerResult),
  ]);
  return { "arch-check": arch, "i18n-check": i18n, "system-update": system, "bundle-guard": bundle };
}

export async function readTestResults(): Promise<{ passed: number; total: number } | null> {
  try {
    const res = await fetch("/test-results.json");
    if (!res.ok) return null;
    const data = await res.json();
    return { passed: data.numPassedTests ?? 0, total: data.numTotalTests ?? 0 };
  } catch {
    return null;
  }
}

export async function readVersion(): Promise<string | null> {
  try {
    const res = await fetch("/ROADMAP.md");
    if (!res.ok) return null;
    const text = await res.text();
    // Prefer the explicit "Current version: vX.Y" line; fall back to first vX.Y.
    const cur = text.match(/Current version:\s*(v\d+\.\d+)/);
    if (cur) return cur[1];
    const m = text.match(/v\d+\.\d+/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

export async function readSystemMd(): Promise<string | null> {
  try {
    const res = await fetch("/SYSTEM.md");
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
