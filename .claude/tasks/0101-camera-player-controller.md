# Task 0101 — Camera & Player Controller (Core v1 opener)

**Context.** Foundation (0001–0010) is merged and M1 passes. Core makes the
world *playable*. This task lays the locomotion + camera spine every later Core
task (presence, NPC spawner, scout funnel) reuses. NPCs will drive the *same*
controller (AGENTS §9), so the motion math must live in a plain, testable method
— not buried in `Update()`.

**Goal.** A `PlayerController` that walks on the sphere surface (gravity toward
planet centre, stays at surface radius, faces travel direction) via a pure
`Step(Vector2 input, float dt)`, and a `PlayerCamera` that chases it. Opt-in
spawn so `/` and `/screensaver` are unchanged by default.

**Scope (touch only):** `unity/Assets/Scripts/**`, `unity/Assets/Tests/EditMode/**`.
Do **not** edit `Planet.unity`, the bridge, or any web module.

**Standards refs:** STANDARDS §2 (camera can orbit/follow; biomes reachable on
foot within 60 s), §5/§9 (NPCs share the locomotion path — no player-only
movement privileges), §8 (TDD).

**Red test** (`MotionSmokeEditTests.cs`, EditMode):
- Given a `PlayerController` seated on a planet of radius R and a list of surface
  checkpoints, feeding the matching `Step()` inputs over N frames visits every
  checkpoint within a tolerance, and the controller never leaves the surface
  (|pos| stays within R ± ε each frame).
- `Step()` with zero input does not move the player.

**Visual checkpoint:** load the Planet scene with `PlayerController.autoSpawn`
on (or `?player` — implementer's choice); a capsule/avatar walks the surface
with WASD, staying on the ground, and `PlayerCamera` follows from behind. The
existing auto-orbit is suppressed only while the player is active.

**Merge:** squash, **v1.1**. Promote this stub in `SPEC.md` (stub → link) and
bump `ROADMAP.md` in the same squash.
