# Task 0005 — Module Boundary Lint (arch:check) Full Rules

**Context.** Worker `arch:check` must enforce: cross-folder imports go only through
the target folder's api file (`api.ts`, `Api.cs`, `api.py`) and every module has a
valid `module.yaml`. This task hardens the lint, with schema validation.

**Goal.** Implement the full boundary + schema lint, wired to CI.

**Scope (touch only):** `workers/arch-check/index.ts`, `workers/arch-check/schema.ts`,
`workers/arch-check/index.spec.ts`, `.github/workflows/ci.yml`, sample violating
fixtures under `workers/arch-check/__fixtures__/`.

**Standards refs:** STANDARDS §1.

**Red test:**
- `arch-check/index.spec.ts` asserts violations in a known fixture fail and a
  correct layout passes.

**Visual checkpoint:** CI passes; a deliberate cross-import in a stub branch
fails the worker.

**Merge:** squash, v0.5.
