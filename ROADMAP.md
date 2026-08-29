# ROADMAP.md — Versioned Priorities & Integration Strategy

**Current version: v0.5** (StatusPanel reads this line to render the version chip.)

Versions use **dot-versioning** `vX.Y`: X = milestone (phase of the world), Y = task
merged within that phase. Every merged task bumps Y. Milestone gates (M1–M4 below)
must ALL pass before X increments. Current version moves forward one merge at a time;
see git history for the up-to-date value.

## Merged
- `v0.5` — 0005 full arch:check lint (module.yaml schema + cross-folder boundary).
- `v0.4` — 0004 Supabase Realtime bridge transport (with in-memory fallback).
- `v0.3` — 0003 spherical planet scaffold (real Unity project + procedural biomes + WebGL build).
- `v0.2` — 0002 Unity WebGL embed harness + bridge api stub + placeholder build.
- `v0.1` — 0001 worker spine + repo bootstrap + dev-only System Status panel.

## Integration strategy (how components come together)

1. **Foundation (v0.x)** — the spine every later component plugs into: repo +
   workers + i18n + docs pipeline, module rules, Unity harness embedded in the
   React shell, spherical terrain scaffold, Supabase bridge api, HUD skeleton,
   LTI scaffold with privacy defaults, avatar generator foundation.
2. **Core (v1.x)** — camera, avatar semantics, realtime presence, NPC spawner,
   roles & slots, scout funnel (become playable).
3. **Play (v2.x)** — entry gate, minigame engine, Scouting task, Onboarding tent
   builder, Support cry system, HUD full, screensaver mode.
4. **Journey complete (v3.x)** — Upgrade (Infra shoot/revert), Offboard (tent
   destroy), Hacker role (≤5% cap), scorebus, leaderboard, admin panel, LTI grade
   + groups sync.
5. **Extension (v4.4+)** — more biomes/minigames, balance sim, event scheduler,
   Colyseus swap, spectacle/personality expansions.

Milestone gates (all must pass; checked by human referee):

- **M1 (end of v0):** dev run serves the app; Unity WebGL renders a planet;
  `arch:check`, `i18n:check`, `system:update`, `bundle:guard` all green.
- **M2 (end of v1):** two live players see each other in the world as generated
  avatars; an evaluator-driven NPC is indistinguishable in sight-tests.
- **M3 (end of v2):** the Scouting funnel is playable end-to-end (scout → camper)
  with at least one fleshed-out minigame.
- **M4 (end of v3):** a session can start and be wrapped by a host; the score is
  pushed to a Moodle sandbox gradebook; Hacker treats are capped at 5%.

---

## Milestone map of all currently-planned versions

(The task index lives in `SPEC.md`; individual prompts live in `.claude/tasks/`.)

- **v0.1–v0.10 — Foundation tasks 0001–0010:** repo/workers/i18n/module lint,
  Unity embed, planet scaffold, bridge api, HUD skeleton, LTI scaffold,
  avatar foundation.
- **v1.1+ — Core:** camera & player controller (2 commit-counted batches), avatar
  semantics (generator→data), realtime presence via bridge, NPC spawner,
  Roles/Skills registry, Scout funnel logic.
- **v2.1+ — Play:** camp entry gate (visual anchor), Minigame Engine (add/remove
  event files), Onboarding tent builder, Support cry system, HUD full
  (inventory/notifications/leaderboard slices), screensaver mode with host controls.
- **v3.1+ — Journey:** Upgrading (glow + shoot + revert), Offboarding (demand +
  tent destroy), Hacker role (special spawn + ≤5% cap + impersonation window),
  Scorebus (round-based scoring pipeline), Leaderboard, Admin panel (host session
  start/wrap), LTI Grade Sync + NRPS Groups.
- **v4.4+ — Extension:** balance simulator hardening, LTI scheduler, extra
  minigames from stubs, Colyseus swap, personality/arena expansions.

Add to the bottom only. Never insert mid-list; reordering is a ROADMAP revision
task with a bump of the current version.
