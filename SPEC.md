# SPEC.md — Prioritized Task Index

Rules:
- The **first batch (0001–0010)** is written as full prompts under `.claude/tasks/`
  (the "Strategy Guide" Foundation: worker spine, Unity embed, planet scaffold,
  bridge api, module lint, HUD skeleton, LTI scaffold, avatar foundation,
  screensaver, scorebus skeleton).
- All later tasks are **stubs** in this index: number, name, scope, red-test sketch,
  visual checkpoint, standard refs. A stub is promoted to a full prompt file when a
  previous batch merges.
- Promotion: the promoting task appends the full prompt file and updates
  `ROADMAP.md` bumping `vX.Y`.
- A task can bundle only ONE component slice; if a ready prompt can't fit, split
  into two tasks.

---

## Batch 0001–0010 — Foundation (v0.x) FULL prompts in `.claude/tasks/`

- `0001-repo-workers.md` — Worker spine: `arch:check`, `i18n:check`,
  `system:update`, `bundle:guard` with CI wiring + failing CI smoke test.
- `0002-unity-embed.md` — Unity WebGL build harness embedded in the shell via
  `window.__tcBridge` → `src/modules/bridge/api.ts`.
- `0003-planet-scaffold.md` — Spherical terrain scaffold: four biomes visible,
  PlayerWalk area, gravity on sphere, Unity batch build script (`pnpm dev:unity`).
- `0004-bridge-api.md` — `src/modules/bridge/api.ts` with the realtime surface
  (`joinWorld/leaveWorld/sendState/onState`) and a stubbed Supabase client.
- `0005-module-lint-docs.md` — `arch:check` grows into full module-rules lint
  (api-only, module.yaml schema required).
- `0006-hud-skeleton.md` — HUD chrome skeleton (collapse button, language toggle,
  minimal layout) with i18n dictionary wiring.
- `0007-lti-scaffold.md` — LTI phase-C scaffold: `handleLaunch` returning session
  token (opaque key only), privacy checklist in `module.yaml`.
- `0008-avatar-foundation.md` — Avatar spec/seed datatype shared between TS and
  Unity (`module.yaml documents the schema`), seed→same-avatar test.
- `0009-screensaver-skeleton.md` — Screensaver tripod: a route/frame that
  auto-orbits and a CLI hook to steer; placeholder T-1 visual.
- `0010-scorebus-skeleton.md` — Scorebus module + `.test` event sink (round
  envelope schemas) to prepare gameplay pipelines.

## Stubs (v1.x Core, promote on demand)

- `0101` Camera & player controller (`unity/`, red: `MotionSmoke` edit test asserting
  a configured walk path reaches been-visited checkpoints).
- `0102` Realtime presence wireup (`src/modules/bridge` consumer, red: Playwright
  two-tab presence test).
- `0103` NPC spawner (same avatar pipeline; `Spawn` orchestrates Prospect camo).
- `0104` Roles/Skills registry (RoleDef: display name, max slots, phase tag).
- `0105` Scout funnel logic (Prospect → camp on attract touch or 1-1 game win).
- `0106` Emitter: world events → `scorebus` in-scope skeleton (realtime-safe
  queueing).

## Stubs (v2.x Play)

- `0201` Camp entry gate (visual anchor + trigger volumes threading funnel).
- `0202` Minigame Engine (event file register/unregister, lifetime 15–90 s cap).
- `0203` Onboarding task: Tent builder ("Adopter"). Assembles tent parts per NPC
  request; time limit enforced.
- `0204` Support: Cry system (CSR) — NPC triggers Cry; CSR catches; resolution
  window timed; score earned.
- `0205` HUD full: inventory, notifications, leaderboard sub-panels.
- `0206` Screensaver mode: auto-orbit camera; landing background; host-steerable.

## Stubs (v3.x Journey)

- `0301` Upgrade (Infra): glowing window; shoot→defeat→upgrade; revert on timeout;
  bigger-avatar side-effects (strict timeouts communicated by HUD).
- `0302` Offboard: health-bar drain → demand → tent destroy → despawn (with emit).
- `0303` Hacker role: special spawn item; time window; ≤5% cap; NPC impersonation.
- `0304` Scorebus: round-based scoring pipeline; round boundaries; wrap event.
- `0305` Leaderboard (scores persistence; session rollups).
- `0306` Admin panel: session start/wrap; modes; rider parameters.
- `0307` LTI Grade Sync + NRPS groups (sandbox smoke passes).

## Stubs (v4.x+ Extension)

- `0401` Balance simulator hardening.
- `0402` LTI scheduler (set dates, auto-wrap).
- `04xx` More minigames (from stubs; single-file events only).
- `05xx` Colyseus swap (bridge implementation switch).
- `06xx` Spectacle/personality/hosted-extras.

**Adding new tasks to files:** promote by writing a full prompt file and updating
this index entry from stub → full prompt link. Reordering requires ROADMAP bump.
