# Task 0001 — Worker Spine: arch:check, i18n:check, system:update, bundle:guard

**Context.** First task of the repo. All modules obey `AGENTS.md` and
`GAUNTLET.md`; this starter spine makes workers able to enforce rules in CI.

**Goal.** Create the worker scripts and wire them into CI + a `pnpm test` smoke
test that exercises one of them.

**Scope (touch only these paths):**
- `package.json` (scripts), `workers/arch-check/index.ts`,
  `workers/i18n-check/index.ts`, `workers/system-update/index.ts`,
  `workers/bundle-guard/index.ts`, `vitest.config.ts`, `.github/workflows/ci.yml`

**Standards refs:** STANDARDS §7 (Localization), §8 (Testing), §11 (Workers).

**Red test:**
- `workers/system-update/index.spec.ts` asserts `SYSTEM.md` includes header
  sections after running the worker on a fixture module tree.

**Visual checkpoint:** CI passes and `SYSTEM.md` is regenerated; run
`pnpm system:update` and `pnpm i18n:check` and they exit 0.

**Merge:** squash `main`, delete branch, ROADMAP bumps v0.1.
