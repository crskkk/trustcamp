# TrustCamp — THE BAR

A low-poly mini-planet camp you can walk around, play short cooperative rounds
in, and level up — solo or with live teammates — with a Moodle (LTI 1.3)
gradebook sync. React/TypeScript shell, **Three.js** world, Node WebSocket +
SQLite server. Built component-by-component (see `STANDARDS.md`, `GAUNTLET.md`,
`AGENTS.md`, `ROADMAP.md`, `SPEC.md`, `docs/DEVELOPMENT.md`, `docs/MOODLE.md`).

**Play it:** https://crskkk.github.io/trustcamp/ (single-player; add
`?ws=wss://your-server` to join a server).

## Quick start

```bash
pnpm install
pnpm dev          # http://127.0.0.1:5173 — the world + HUD + dev panels (solo mode)
pnpm server       # ws://127.0.0.1:8787 — multiplayer + persistence (optional)
                  # then open http://127.0.0.1:5173/?ws=ws://127.0.0.1:8787
pnpm test         # unit tests (vitest) incl. server/ specs
pnpm test:e2e     # playwright (boots dev + server; ~4 min, serial by design)
pnpm arch:check && pnpm i18n:check && pnpm system:update && pnpm bundle:guard
node scripts/shots.mjs   # 1280x720 reference screenshots into e2e/shots/
```

Controls: WASD/arrows walk, Space jump, E wave; touch: left stick + jump button.
**Menu** (top right): Camp Games rounds, jump/wave, walk to an area, camper
customization, live leaderboard, language / graphics / server settings.

## Layout

- `src/modules/**` — feature modules (each with an `api.ts` + `module.yaml`; only the api is public).
  `world3d` (Three.js world), `minigames` (event files), `progress`, `leaderboard`,
  `menu`, `hud`, `presence`, `npc`, `avatar`, `bridge` (transports), `lti`, `i18n`, `scorebus`.
- `server/` — WebSocket relay + SQLite persistence + LTI 1.3 endpoints (`Dockerfile`, `fly.toml`).
- `workers/**` — repo-health workers (arch:check, i18n:check, system:update, bundle:guard).
- `e2e/**` — Playwright checks (world smoke, rounds, two-context multiplayer, HUD, screensaver).
- `.claude/tasks/**` — one self-contained builder prompt per task (v0–v1 history).

## Status

- **Current version: v2.3** — THE BAR: Three.js world, Camp Games, multiplayer +
  persistence, menu, LTI 1.3 launch + gradebook wrap. See `ROADMAP.md`.
