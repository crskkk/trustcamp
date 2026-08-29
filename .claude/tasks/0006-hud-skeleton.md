# Task 0006 — HUD Skeleton (Shell) with Collapse + i18n

**Context.** The persistent HUD will hold score/role/items/notifications/language
toggle and avatar personalization. Initially: chrome skeleton + collapse to one
button + language toggle.

**Goal.** `src/modules/hud` with `api.ts` exporting the HUD root, a toggleable
expanded/collapsed layout, all strings through `src/modules/i18n` dictionaries.
Language defaults to browser and falls back to English.

**Scope (touch only):** `src/modules/hud/**`, `src/modules/i18n/**`,
`src/App**` (to mount the skeleton), `public/**` if assets needed, `pnpm test`
unit tests and playwright `hud-skeleton.spec.ts`.

**Standards refs:** STANDARDS §6 (collapse, idle tips not due yet), §7
(localization), §1 (module rules).

**Red test:**
- `hud.spec.ts` asserts clicking the collapse button hides panels but shows the
  single button; expanding returns panels (via Playwright test).

**Visual checkpoint:** HUD chrome mounts; collapse and language toggle visible;
playwright test passes in es and pt emulation.

**Merge:** squash, v0.6.
