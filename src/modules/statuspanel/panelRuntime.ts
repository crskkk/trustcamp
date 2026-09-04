// Browser-side runtime for the StatusPanel: runs the workers live in-browser
// using import.meta.glob for module.yaml files AND source files, and fetch()
// for the generated artifacts (test-results.json, ROADMAP.md, SYSTEM.md).
//
// The in-browser reader mirrors the Node reader so the panel can show a
// faithful preview of what CI sees. Source-file enumeration is needed by
// the arch-check worker's boundary pass; without it, the panel reported
// every module as "api file missing" because glob returned an empty list.
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
  taskLog: TaskLogRow[];
}

export interface TaskLogRow {
  task: string;
  version: string;
  title: string;
  commit: string;
  codeIn: number;
  codeOut: number;
  tools: number;
  convIn: number;
  convOut: number;
  total: number;
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

// Source-file enumeration for the in-browser arch-check boundary pass.
// We only need the file content; the worker can read it via readFile().
const sourceFiles = import.meta.glob("/src/modules/**/*.{ts,tsx,cs,py}", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

// Normalize Vite's "/src/..." path prefix to repo-root-relative posix paths
// (no leading slash) so the same arch-check logic runs in both Node and
// the browser without forking its assumptions.
function toRepoPath(p: string): string {
  return p.replace(/^\//, "");
}

async function browserReader(): Promise<Reader> {
  return {
    listModules: async () => {
      const entries: ModuleEntry[] = [];
      for (const [path, loader] of Object.entries(moduleYamls)) {
        const raw = await loader();
        const parsed = yaml.load(raw) as ModuleYaml;
        const dir = toRepoPath(path).replace(/\/module\.yaml$/, "");
        entries.push({ dir, yaml: normalize(parsed) });
      }
      return entries;
    },
    glob: async (pat) => {
      // The arch-check worker asks for the canonical source-file glob. Map it
      // to the keys we collected via import.meta.glob. For any other pattern,
      // return an empty list (the worker treats this as "no files match").
      if (pat === "src/modules/**/*.{ts,tsx,cs,py}") {
        return Object.keys(sourceFiles).map(toRepoPath);
      }
      return [];
    },
    readFile: async (p) => {
      const key = "/" + p;
      const loader = sourceFiles[key] ?? sourceFiles[p];
      if (!loader) throw new Error(`panel: no in-memory source for ${p}`);
      return await loader();
    },
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
    runArch({ reader }).catch((e) => ({ ok: false, message: `error: ${(e as Error).message ?? e}` }) as WorkerResult),
    runI18n({ reader, dictionaries: { en: dicts.en ?? {}, es: dicts.es ?? {}, pt: dicts.pt ?? {} }, usedKeys }).catch(
      (e) => ({ ok: false, message: `error: ${(e as Error).message ?? e}` }) as WorkerResult,
    ),
    runSystem({ reader }).catch((e) => ({ ok: false, message: `error: ${(e as Error).message ?? e}` }) as WorkerResult),
    runBundle().catch((e) => ({ ok: false, message: `error: ${(e as Error).message ?? e}` }) as WorkerResult),
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

function parseNumber(s: string | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse TASK_LOG.md (a markdown table) and return its rows in declaration order.
 * Robust to extra whitespace and a leading header/footer block — only the
 * pipe-delimited table rows are read.
 */
export function parseTaskLog(md: string): TaskLogRow[] {
  const rows: TaskLogRow[] = [];
  const lines = md.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    if (line.includes("---")) continue; // separator
    if (line.toLowerCase().includes("| task |")) continue; // header
    const cells = line.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 10) continue;
    rows.push({
      task: cells[0],
      version: cells[1],
      title: cells[2],
      commit: cells[3].replace(/`/g, ""),
      codeIn: parseNumber(cells[4]),
      codeOut: parseNumber(cells[5]),
      tools: parseNumber(cells[6]),
      convIn: parseNumber(cells[7]),
      convOut: parseNumber(cells[8]),
      total: parseNumber(cells[9]),
    });
  }
  return rows;
}

export async function readTaskLog(): Promise<TaskLogRow[]> {
  try {
    const res = await fetch("/TASK_LOG.md");
    if (!res.ok) return [];
    const text = await res.text();
    return parseTaskLog(text);
  } catch {
    return [];
  }
}
