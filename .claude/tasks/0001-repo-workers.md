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

**Visual checkpoint:** `pnpm dev` renders a dev-only **System Status panel**
(bottom-right overlay) showing: four worker status lights (arch:check,
i18n:check, system:update, bundle:guard), a `N / M tests passing` line read
from `test-results.json`, a SYSTEM.md preview, and the `v0.1` version chip read
from `ROADMAP.md`. Playwright `e2e/status-panel.spec.ts` asserts all four are
visible. This panel is the temporary visual artifact from GAUNTLET.md §1 for a
backend component; it is absorbed by the real HUD (task 0006) / Admin (0306).

**Merge:** squash `main`, delete branch `task/0001-repo-workers`, ROADMAP bumps
to v0.1, commit regenerated `SYSTEM.md`.
