# Task 0104 — NPC Camo + Locomotion (Core v1)

**Context.** Tasks `0101` (locomotion), `0102` (presence), and `0103` (spawner)
are merged. The world can now have up to 8 NPC prospects listed in the dev
chip strip, but they don't move and have no bodies in the world. Core's next
deliverable makes them *look and walk* like players — fulfilling the
"indistinguishable from a human" promise of STANDARDS §3 and §5 and getting
the project ready for the T-5 human-or-AI spot-check.

**Goal.** NPCs walk the planet surface using **the same `PlayerController.Step()`
locomotion path** as human players (no navmesh-only cheat — STANDARDS §5.1),
rendered with the same `AvatarProceduralBuilder` and the same
`AvatarSpec = avatar.generate(seed)` so they look human (STANDARDS §3.3),
and publish their position back through the same `bridge.sendState` pipe
players use, on a 2 s cadence. No `isNpc` branch anywhere in the avatar
or locomotion code.

**Scope (touch only):**
- `src/modules/npc/motion.ts` (new — pure policy: per-NPC input vector)
- `src/modules/npc/bridge.ts` (new — publish loop)
- `src/modules/npc/api.ts` (extend: `startNpcMotion(opts)`, `stopNpcMotion()`)
- `src/modules/npc/api.spec.ts` (extend red→green)
- `src/App.tsx` (wire the motion loop in the Bootstrap, behind dev)
- `unity/Assets/Scripts/NpcController.cs` (new — wraps PlayerController.Step
  for an NPC body; same path as `PlayerDemoWalk` but driven by a policy)
- `unity/Assets/Scripts/NpcSpawner.cs` (new — opt-in spawner; gated by
  `?npcs` URL param like `PlayerSpawner` uses `?player`)
- `unity/Assets/Tests/EditMode/NpcLocomotionEditTests.cs` (new — red→green:
  NpcController can drive a PlayerController to a target surface point
  without leaving the surface)
- `e2e/npc-motion.spec.ts` (new — TS-side motion policy e2e in browser)
- `src/modules/i18n/dictionaries/{en,es,pt}.json` (one new key per lang)
- `TESTING.md` (T-5 update), `ROADMAP.md` (v1.3 → v1.4), `TASK_LOG.md` (row),
  this file, `SPEC.md` (stub → full-prompt link).

**Must NOT touch:**
- `src/modules/avatar/**` (we *consume* the generator; we don't fork it).
- `src/modules/bridge/**` (NPCs publish through the existing `sendState`;
  no new contract).
- `src/modules/presence/**` (presence has `removePeer` from 0103; the
  motion loop uses it on `clearNpcs()`).
- `unity/Assets/Scripts/PlayerController.cs` (NPCs reuse it; no edit).
- `unity/Assets/Avatar/AvatarProceduralBuilder.cs` (NPCs reuse it; no edit).

**Standards refs:** STANDARDS §1 (one door per module), §3 (avatar reuse,
≤ 4 draw calls — verified in benchmark scene in a follow-up), §5 (NPC
locomotion uses the same path; 40–60% Turing band — covered by T-5),
§8 (TDD), §11 (workers regen SYSTEM.md).

---

## Slice plan (commit order)

1. **`test(0104): red TS unit tests for the motion policy`**
   `src/modules/npc/motion.spec.ts`:
   - `chooseInput({pos, target, jitterSeed, dt})` returns a unit `Vector2`
     pointing from the NPC toward the target along the great-circle tangent,
     with a small bounded jitter so the motion is not robotic.
   - When no target is set, returns a small forward drift (≤ 0.2 magnitude)
     so the NPC never stops dead (would visually freeze in the benchmark).
   - `chooseSpeedCap()` returns a value ≤ player's `moveSpeed` (6 m/s)
     so NPCs are never faster than humans.
   - The policy is pure (no DOM, no network) and unit-testable.

2. **`feat(0104): motion policy (green)`** — `src/modules/npc/motion.ts`
   implements the red tests.

3. **`test(0104): red bridge-publish tests`**
   `src/modules/npc/bridge.spec.ts`:
   - `startNpcMotion(bridge, entries)` schedules a `sendState` tick on
     `bridge.sendState` with the right `playerId` ("npc-<seed>") and a
     position derived from a synthetic PlayerController-step.
   - `stopNpcMotion()` clears the timer and the running flag.
   - The loop skips NPCs that have been removed from the spawner list
     (e.g., via `clearNpcs`).

4. **`feat(0104): bridge publish loop`** — `src/modules/npc/bridge.ts`
   implements step 3.

5. **`test(0104): red Unity C# edit-mode tests for NpcController`**
   `unity/Assets/Tests/EditMode/NpcLocomotionEditTests.cs`:
   - `NpcController_StepDrivenByPolicy_WalksTowardTarget_StaysOnSurface` —
     place NPC on surface, run NpcController with a constant forward
     input for 5 simulated seconds, assert position advanced along the
     great circle and |pos| stays within R ± 0.05.
   - `NpcController_RotatesToFaceTravelDirection` — after a non-zero step,
     the body faces the move direction within 5°.

6. **`feat(0104): NpcController + NpcSpawner (green)`**
   - `NpcController` wraps a `PlayerController` and runs `Step(policy.input, dt)`
     in `Update()`. Pure mechanical glue — no policy here.
   - `NpcSpawner` is a `RuntimeInitializeOnLoadMethod` opt-in like
     `PlayerSpawner`. URL param `?npcs` enables it. On boot it reads a
     static list of `(seed, role)` pairs (the shell can populate via a
     static setter before the build runs) and spawns one body per pair
     using `AvatarProceduralBuilder.BuildAvatar(AvatarShowcase.SpecForSeed(seed))`
     and `PlayerController.Configure(...)`.
   - A doc note explains how the shell→Unity glue lands in 0105
     (real Supabase channel → Unity; not gated here).

7. **Wire TS Bootstrap** — call `startNpcMotion(...)` after the seed spawns
   in `src/App.tsx`; `clearNpcs` already tears down via `presence.removePeer`
   and the loop checks the spawner list each tick.

8. **i18n + system + roadmap + log** — add `npc.motion.label` to en/es/pt
   (used by the dev "Move NPCs" button); bump `npc` 0.2.0 → 0.3.0;
   `system:update` regenerates; bump `ROADMAP.md` v1.3 → v1.4; append
   `TASK_LOG.md` row.

9. **TESTING.md T-5 update** — full human-or-AI spot-check:
   - Two human tabs join; 3 NPC prospects are visible in both tab chips.
   - Tester A drives the human; tester B (or a second dev tool) tries
     to identify which of the chips are humans. Expected: 40–60% correct
     per STANDARDS §5.2.

---

## Acceptance / merge gate

- `pnpm arch:check`, `pnpm i18n:check`, `pnpm system:update`,
  `pnpm bundle:guard` all exit 0.
- `pnpm test` green; new `npc/motion.spec.ts` + `npc/bridge.spec.ts` pass.
- Unity edit-mode suite (`unity/TestResults/`) records NpcLocomotion
  green. (No CI runner for Unity today; this is a local gate — same
  policy as `MotionSmokeEditTests` from 0101.)
- `pnpm test:e2e` green; new `npc-motion.spec.ts` asserts the dev
  "Move NPCs" button drives state updates.
- `TESTING.md` T-5 step 1 (Playwright) passes.
- squash-merge to `main`, **v1.4**, delete branch `task/0104-npc-camo-locomotion`.

---

## Out of scope (deliberate)

- No real Supabase → Unity transport glue (0105).
- No Scout funnel logic (0105).
- No Hacker role (0303).
- No draw-call benchmark scene (best-effort follow-up).
- No runtime AI (it's a deterministic follow-loop, not a planner).
