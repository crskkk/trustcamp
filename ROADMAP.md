# ROADMAP.md — Versioned Priorities & Integration Strategy

**Current version: v2.3** (StatusPanel reads this line to render the version chip.)

Versions use **dot-versioning** `vX.Y`: X = milestone (phase of the world), Y = task
merged within that phase. Every merged task bumps Y. Milestone gates (M1–M4 below)
must ALL pass before X increments. Current version moves forward one merge at a time;
see git history for the up-to-date value.

## Merged
- `v2.3` — **THE BAR** menu + LTI: collapsible side drawer (Play / Customize / Leaderboard /
  Settings) opened from the HUD; camper re-roll + quick picks; language, graphics tier,
  multiplayer server settings; LTI 1.3 tool on the server (OIDC login, launch, JWKS, AGS
  grade push on host "wrap"), `docs/MOODLE.md`. **M4 gate partially met:** grade push is
  verified against a mock platform in `server/lti.spec.ts`; the live Moodle run (T-9) needs
  the server on an https host.
- `v2.2` — **THE BAR** multiplayer + persistence: `server/` WebSocket relay (rooms, 15 Hz
  fan-out, rate limits) + SQLite (players/resume tokens, progress, rounds, sessions);
  `bridge` ws transport behind the same api; server-backed XP; two-context Playwright test.
  **M2 gate met on the real transport** (two browsers see each other move).
- `v2.1` — **THE BAR** Camp Games: `minigames` engine + Firewood Dash / Lantern Relay /
  passive foraging event files, `progress` (XP + levels), `leaderboard` (live rows, team
  score), HUD round panel + toasts. **M3 gate met** (two fleshed-out minigames, solo or
  with live teammates).
- `v2.0` — **THE BAR** world in Three.js (replaces the Unity WebGL embed): `world3d` module —
  sphere planet with campground (lodge, cabins, tents, campfire, dock), lake, forest trails,
  terraced hills; instanced props; toon lighting; procedural Animal-Crossing-style camper;
  sphere-walk + chase camera; quality tiers. Unity project retired to git history.
- `v1.4` — 0104 NPC camo + locomotion (TS-only delivery: `npc/motion.ts` pure `chooseInput` policy, `npc/bridge.ts` per-tick `bridge.sendState` publisher, motion parity asserted at mock level and through the chip `data-x` ticking e2e). **No Unity bodies in this round** — the shell→Unity glue, the `StaticConfig` writer, and the cross-process broadcast transport all land in 0105. The build at `public/unity/Build/` predates `NpcController.cs` and `NpcSpawner.cs`.
- `v1.3` — 0103 NPC spawner (new `npc` module: spawnNpc/clearNpcs/listNpcs/setNpcCap, avatar.generate() reuse per AGENTS §9, `presence.removePeer` + `PresenceMap.remove` for despawn, dev seed of 3 Prospects in the Bootstrap, i18n keys `npc.role.prospect` + `npc.dev.*`). Core NPC camo/locomotion land in 0104.
- `v1.2` — 0102 Realtime presence wireup (new `presence` module: PresenceMap merge/prune/clear/interpolate, bridge consumer, dev-only PresenceOverlay HUD strip, BroadcastChannel test seam, Playwright two-tab e2e, i18n keys for `presence.title` + `presence.role.{scout,camp,hacker}`). **T-4 step 1 falsifiable end-to-end locally; real Supabase/LTI cross-network test deferred to v3.**
- `v1.1` — 0101 Camera & player controller (sphere-walk `PlayerController.Step()`, chase `PlayerCamera`, opt-in `PlayerSpawner`; MotionSmoke edit tests). **Core (v1) begins — M1 gate passed.**
- `v0.10` — 0010 Scorebus skeleton (round-envelope schema + validator + in-memory ingest sink; TS↔Unity mirror). Foundation complete.
- `v0.9` — 0009 Screensaver skeleton (shell-driven camera orbit over the planet, `/screensaver` route, detach hook for host steering).
- `v0.8` — 0008 Avatar Foundation (seed schema, deterministic generation, cute low-poly renderer).
- `v0.7` — 0007 LTI scaffold (JWT validation, privacy-first, opaque session token).
- `v0.6` — 0006 HUD skeleton (chrome, collapse-to-one-button, language toggle).
- `v0.5` — 0005 full arch:check lint (module.yaml schema + cross-folder boundary).
- `v0.4` — 0004 Supabase Realtime bridge transport (with in-memory fallback).
- `v0.3` — 0003 spherical planet scaffold (real Unity project + procedural biomes + WebGL build).
- `v0.2` — 0002 Unity WebGL embed harness + bridge api stub + placeholder build.
- `v0.1` — 0001 worker spine + repo bootstrap + dev-only System Status panel.

## Integration strategy (how components come together)

1. **Foundation (v0.x)** — the spine every later component plugs into: repo +
   workers + i18n + docs pipeline, module rules, the 3D world embedded in the
   React shell (Unity WebGL until v1.4; Three.js from v2.0), spherical terrain
   scaffold, Supabase bridge api, HUD skeleton, LTI scaffold with privacy
   defaults, avatar generator foundation.
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
