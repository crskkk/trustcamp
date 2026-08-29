// workers/arch-check/logic.ts — module boundary + schema lint.
//
// Two passes:
//   1. Schema pass — validate every `module.yaml` (delegated to ./schema).
//   2. Boundary pass — scan every source file in `src/modules/**` and assert
//      that any import that mentions another module's folder goes through
//      that module's declared api file (`api.ts` / `Api.cs` / `api.py`).
//
// The worker reports blockers as FAIL and warnings as a soft-OK (they are
// surfaced via `details.warnings` for the panel/UI). The CI script always
// treats a `result.ok === false` as a hard fail (STANDARDS §1).
import type { Reader, WorkerResult, ModuleEntry } from "../shared/reader";
import { validateModule, type SchemaIssue } from "./schema";

export interface RunOpts {
  reader: Reader;
}

export interface RunDetails {
  issues: SchemaIssue[];
  boundary: BoundaryViolation[];
  warnings: string[];
}

export interface BoundaryViolation {
  /** File that holds the offending import. */
  fromFile: string;
  /** Module that owns the source file. */
  fromModule: string;
  /** Imported module's folder. */
  targetModule: string;
  /** The non-api path the source file imported. */
  targetPath: string;
  /** The exact import line. */
  importLine: string;
}

/** Regex for the kind of imports we care about. We intentionally do not try
 * to parse full TS/JS; we look for a quoted import specifier that contains
 * a path-style reference to another module folder. */
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+[^;]*?from\s+["']([^"']+)["']/g;

/** Resolve `./foo` / `../b/api` style specifiers to a path on disk, given
 * the directory of the file the import lives in. */
function resolveImport(fromFile: string, spec: string): string {
  // Drop any leading "./" — node-style posix already.
  const fromDir = fromFile.replace(/[^/]+$/, "");
  if (!spec.startsWith(".")) {
    // Bare specifier (npm package or vite alias). The arch-check rule
    // doesn't apply to those — only to *file* imports that walk into
    // another module folder.
    return spec;
  }
  const parts = spec.split("/");
  const stack = fromDir.split("/").filter(Boolean);
  for (const p of parts) {
    if (p === ".") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return stack.join("/");
}

/** "src/modules/foo/bar.ts" → "src/modules/foo". */
function moduleOf(file: string, modules: ModuleEntry[]): string | null {
  for (const m of modules) {
    if (file === m.dir || file.startsWith(`${m.dir}/`)) return m.dir;
  }
  return null;
}

/** Given a resolved import path, return the target module folder if any.
 *  This is the part of the lint that enforces "you only cross folders
 *  through the target's api file." */
function targetModuleOf(resolved: string, modules: ModuleEntry[]): string | null {
  for (const m of modules) {
    if (resolved === m.dir || resolved.startsWith(`${m.dir}/`)) return m.dir;
  }
  return null;
}

/** The api file a module declares. We strip the file extension because TS
 *  source imports usually omit it (e.g. `from "../bridge/api"`). */
function moduleApiPath(m: ModuleEntry): string {
  return (m.yaml.api || "").replace(/\.(ts|tsx|cs|py)$/, "");
}

/** True when the resolved import path lands on the target module's
 *  declared api file (with or without extension). */
function resolvesToApiOf(resolved: string, target: ModuleEntry | undefined): boolean {
  if (!target) return false;
  const declared = moduleApiPath(target);
  if (!declared) return false;
  // Accept the import as-is, with extension appended, or with the leading
  // dir stripped (already done by `resolveImport`).
  if (resolved === declared) return true;
  if (resolved === `${declared}.ts`) return true;
  if (resolved === `${declared}.tsx`) return true;
  if (resolved === `${declared}.cs`) return true;
  if (resolved === `${declared}.py`) return true;
  return false;
}

/** A very small "is this line an import of the form `from 'x/y/z'`". We
 *  don't try to be clever about dynamic imports or re-exports — those
 *  fail closed (treated as plain imports). */
function findImports(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(IMPORT_RE)) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

export async function run({ reader }: RunOpts): Promise<WorkerResult> {
  const modules = await reader.listModules();
  const issues: SchemaIssue[] = [];
  const warnings: string[] = [];
  const knownModules = new Map<string, string>();
  for (const m of modules) {
    if (m.yaml.name) knownModules.set(m.yaml.name, m.dir);
  }
  // Pre-resolve the set of files we know about so the schema check can
  // confirm that every module's `api:` path actually exists on disk.
  const allSrc = await reader.glob("src/modules/**/*.{ts,tsx,cs,py}");
  const allSrcSet = new Set(allSrc);
  // Also accept the same path with the extension swapped (.ts ↔ .tsx) —
  // a module may declare `api: .../api.ts` while the file is `api.tsx`.
  const allSrcLoose = new Set<string>();
  for (const p of allSrcSet) {
    allSrcLoose.add(p);
    allSrcLoose.add(p.replace(/\.ts$/, ".tsx"));
    allSrcLoose.add(p.replace(/\.tsx$/, ".ts"));
  }
  const apiFileExists = (api: string) => {
    if (!api) return false;
    if (allSrcLoose.has(api)) return true;
    return false;
  };
  for (const m of modules) {
    issues.push(...validateModule(m.dir, m.yaml, { knownModules, apiFileExists }));
  }

  // Pass 2 — boundary lint. Collect every source file under any module folder.
  const srcFiles = await reader.glob("src/modules/**/*.{ts,tsx,cs,py}");
  const boundary: BoundaryViolation[] = [];
  for (const file of srcFiles) {
    const from = moduleOf(file, modules);
    if (!from) continue;
    let source: string;
    try {
      source = await reader.readFile(file);
    } catch {
      continue;
    }
    const specifiers = findImports(source);
    for (const spec of specifiers) {
      const resolved = resolveImport(file, spec);
      const targetDir = targetModuleOf(resolved, modules);
      if (!targetDir) continue;
      if (targetDir === from) continue; // self imports are always fine
      const target = modules.find((m) => m.dir === targetDir);
      if (resolvesToApiOf(resolved, target)) continue; // going through the public door — OK
      // The import is reaching into another module through a non-api file.
      // Flag the line that contains the import for fast debugging.
      const importLine = source
        .split(/\r?\n/)
        .find((l) => l.includes(`from "${spec}"`) || l.includes(`from '${spec}'`)) ?? `from "${spec}"`;
      boundary.push({
        fromFile: file,
        fromModule: from,
        targetModule: targetDir,
        targetPath: resolved,
        importLine: importLine.trim(),
      });
    }
  }

  const blockers = issues.filter((i) => i.severity === "blocker");
  for (const w of issues) if (w.severity === "warning") warnings.push(`${w.dir}: ${w.message} (${w.rule})`);

  if (blockers.length > 0 || boundary.length > 0) {
    const parts: string[] = [];
    if (blockers.length > 0) {
      parts.push(`module.yaml violations (${blockers.length}):`);
      for (const b of blockers) parts.push(`  - [${b.rule}] ${b.dir}: ${b.message}`);
    }
    if (boundary.length > 0) {
      parts.push(`boundary violations (${boundary.length}):`);
      for (const v of boundary) {
        const target = modules.find((m) => m.dir === v.targetModule);
        const expectedApi = target ? `${target.dir}/${(target.yaml.api || `${target.dir}/api.ts`).split("/").pop() || "api.ts"}` : `${v.targetModule}/api.ts`;
        parts.push(
          `  - ${v.fromFile} → ${v.targetPath} (target ${v.targetModule} must be imported via its api file "${expectedApi}", not "${v.importLine}")`,
        );
      }
    }
    return {
      ok: false,
      message: parts.join("\n"),
      details: { issues, boundary, warnings } satisfies RunDetails,
    };
  }

  return {
    ok: true,
    message: `${modules.length} module(s) valid; ${boundary.length} boundary issue(s) checked; ${warnings.length} warning(s)`,
    details: { issues, boundary, warnings } satisfies RunDetails,
  };
}
