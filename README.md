# TrustCamp

A Unity-WebGL mini-planet camping world with LTI 1.3, built component-by-component through the **Gauntlet Loop** (builder → evaluator → gap list → merge). See `STANDARDS.md`, `GAUNTLET.md`, `AGENTS.md`, `ROADMAP.md`, `SPEC.md`, and `docs/DEVELOPMENT.md`.

## Quick start

```bash
pnpm install
pnpm dev:unity    # build the Unity WebGL planet (once; needs Unity 6 LTS + WebGL module)
pnpm dev          # http://localhost:5173 — app + embedded planet + dev System Status panel
pnpm test         # unit tests (vitest), writes test-results.json
pnpm test:e2e     # playwright visual-checkpoint (planet-smoke is local-only)
pnpm arch:check && pnpm i18n:check && pnpm system:update && pnpm bundle:guard
```

> Without `pnpm dev:unity`, the embed shows a placeholder sphere (no Unity needed) — useful in CI and fresh clones. Run `dev:unity` once to see the real planet.

The dev-only **System Status panel** (bottom-right) shows live worker status lights, the test pass %, a SYSTEM.md preview, and the current version chip — the visible artifact of task 0001. It is absorbed by the real HUD (task 0006) / Admin (task 0306) later.

## Layout

- `src/modules/**` — feature modules (each with an `api.ts` + `module.yaml`; only the api is public).
- `workers/**` — repo-health workers (arch:check, i18n:check, system:update, bundle:guard).
- `e2e/**` — Playwright visual checkpoints.
- `.claude/tasks/**` — one self-contained builder prompt per task.
- `unity/` — (later) the embedded Unity WebGL build.

## Status

- **Current version: v1.4** — NPC camo + locomotion (motion policy + bridge publish loop + Unity NpcController reusing PlayerController.Step).
