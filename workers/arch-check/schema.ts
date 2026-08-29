// workers/arch-check/schema.ts — declarative module.yaml schema.
//
// The code that enforces it lives in logic.ts. Result types and field
// declarations here are the schema of truth; logic.ts simply walks them.
//
// AGENTS §1 / STANDARDS §1: every module folder MUST contain a module.yaml
// declaring name, description, version, api, depends_on. Folder `api` path
// must resolve to an existing file inside that module. depends_on entries
// must match the names of other visible modules (warning otherwise).

import type { ModuleYaml } from "../shared/reader";

/** A single rule produced by schema validation. */
export interface SchemaIssue {
  /** Stable id of the failing rule. */
  rule: string;
  /** The module folder flagged (relative to repo root). */
  dir: string;
  /** Human-readable message. */
  message: string;
  /** Severity — a `blocker` must be fixed before merge; a `warning` is advisory. */
  severity: "blocker" | "warning";
}

/** All currently-enforced schema rules and their option bundles. */
export interface SchemaOpts {
  /** Modules visible to depends_on checks (Map keyed by `name`). */
  knownModules: ReadonlyMap<string, string>;
  /** A function that lets us confirm the `api` path exists on disk. */
  apiFileExists: (apiPath: string) => boolean;
}

const SEMVER = /^\d+\.\d+\.\d+$/;

/**
 * Validate one parsed module.yaml. Returns an empty array on success.
 *
 * The rules enforced here mirror STANDARDS §1 falsifiable criteria and the
 * arch-check worker README. The order of checks is stable so test output is
 * reproducible.
 */
export function validateModule(
  dir: string,
  yaml: Partial<ModuleYaml>,
  opts: SchemaOpts,
): SchemaIssue[] {
  const out: SchemaIssue[] = [];
  const tag = (rule: string, msg: string, sev: SchemaIssue["severity"] = "blocker"): void => {
    out.push({ rule, dir, message: msg, severity: sev });
  };

  // Rule S1 — required fields present and non-empty.
  if (!yaml.name || typeof yaml.name !== "string") tag("S1.name", "module.yaml missing `name`");
  if (!yaml.description || typeof yaml.description !== "string") tag("S1.description", "module.yaml missing `description`");
  if (!yaml.version || typeof yaml.version !== "string") tag("S1.version", "module.yaml missing `version`");
  if (!yaml.api || typeof yaml.api !== "string") tag("S1.api", "module.yaml missing `api`");
  if (!Array.isArray(yaml.depends_on)) tag("S1.depends_on", "module.yaml `depends_on` must be a list");

  // Rule S2 — semver version.
  if (yaml.version && typeof yaml.version === "string" && !SEMVER.test(yaml.version)) {
    tag("S2.version", `module.yaml \`version\` is not semver (X.Y.Z): "${yaml.version}"`);
  }

  // Rule S3 — api path points to an existing file in the module.
  if (yaml.api && typeof yaml.api === "string") {
    const dirN = dir.replace(/\\/g, "/");
    const apiN = yaml.api.replace(/\\/g, "/");
    if (!apiN.startsWith(`${dirN}/`) && apiN !== dirN) {
      tag("S3.api.path", `module.yaml \`api\` ("${yaml.api}") must live inside its module folder ("${dir}/")`);
    } else if (!opts.apiFileExists(yaml.api)) {
      tag("S3.api.missing", `module.yaml \`api\` file does not exist: ${yaml.api}`);
    }
  }

  // Rule S4 — depends_on entries resolve to a known module name (warning, not blocker).
  if (Array.isArray(yaml.depends_on)) {
    for (const dep of yaml.depends_on) {
      if (typeof dep !== "string" || !dep) {
        tag("S4.depends_on.entry", "module.yaml `depends_on` entries must be non-empty strings");
        continue;
      }
      if (!opts.knownModules.has(dep)) {
        tag(
          "S4.depends_on.unknown",
          `module.yaml \`depends_on\` references unknown module "${dep}"`,
          "warning",
        );
      }
    }
  }

  // Rule S5 — module names are unique.
  if (yaml.name && yaml.name.length > 0) {
    const owner = opts.knownModules.get(yaml.name);
    if (owner && owner !== dir) {
      tag("S5.name.unique", `module name "${yaml.name}" is already used by ${owner}; module names must be unique`);
    }
  }

  return out;
}
