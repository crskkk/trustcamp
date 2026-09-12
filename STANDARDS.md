# STANDARDS.md — TrustCamp Quality Bar

**Every component in this project has (1) a standard, (2) a real-world best-in-class
reference, and (3) falsifiable acceptance criteria.** The Gauntlet evaluator agent
(see `GAUNTLET.md`) judges every merge against this file. Do not mark a gap list
closed unless every criterion here passes.

> Stack decisions locked with the owner: **Unity WebGL embedded inside a
> React/Lovable shell** for the 3D world; **Supabase Realtime behind
> `bridge/api.ts`** so Colyseus remains swappable. All standards assume this.

---

## 1. Architecture & Module Boundaries

- **Standard:** Hexagonal/clean architecture. Folders (modules) may only import each
  other through that folder's single public interface file: `api.ts` (TypeScript),
  `Api.cs` (Unity C#), `api.py` (Python services, if ever needed). Everything else in
  the folder is private to the module. Each folder has a valid `module.yaml`.
- **Best-in-class reference:** The " Clean Architecture" (Robert C. Martin) and the
  `barrel-file` discipline used by large monorepos (e.g., Nx-enforced module
  boundaries); on the Unity side, assembly-definition style isolation like the
  **VContainer/UniTask ecosystem** conventions.
- **Falsifiable criteria:**
  1. `pnpm arch:check` (or CI script) reports zero cross-folder imports that bypass
     the folder's api file.
  2. Every module folder contains a `module.yaml` with `name`, `description`,
     `version`, `api`, `depends_on`. YAML parses and passes the schema check.
  3. A new module can be added by copying one existing folder and only editing its
     `module.yaml` + api file.

## 2. 3D World Rendering (Three.js, in-browser)

- **Standard:** A spherical mini-planet that is readable at a glance: distinct
  areas (campground with large structures, lake, forest with trails, hills)
  visible from any vantage; stable performance in the browser; art direction is
  low-poly Animal-Crossing-like: rounded silhouettes, 3-step toon shading, warm
  sun, soft shadows, pastel-but-saturated palette, dense ground detail.
- **Best-in-class references:** **Animal Crossing: New Horizons** for character
  proportion (≈2.5 heads), scale (tree ≈ 3 characters, cabin ≈ 2.5), palette and
  "nothing is empty" density; **Outer Wilds** for spherical traversal and
  landmark-first composition.
- **Falsifiable criteria:**
  1. Playwright smoke test: the canvas renders non-black frames within 10 s of
     page load (`e2e/embed-smoke.spec.ts` via `World.probeFrame()`).
  2. ≥ 30 fps at 1280×720 on an integrated GPU at the "high" tier; the "low" and
     "software" tiers keep the page responsive on weak/software GL (`__tcWorld.fps`).
  3. All four areas reachable on foot within 60 s (`planet.spec.ts` bounds the trail
     loop < 360 m at 6 m/s); the chase camera never enters terrain.

## 3. Avatar System ("business kawaii")

- **Standard:** Procedurally generated human avatars from a seed; customization is a
  serializable data object; players and NPCs use the identical pipeline.
- **Best-in-class references:** **Ready Player Me** (data-driven procedural avatars),
  **Animal Crossing villagers** (expressive minimal faces), **Wii Miis** (instant
  readability, vast variety from few parameters).
- **Falsifiable criteria:**
  1. Same seed → bit-identical avatar (unit test).
  2. Customization object round-trips through JSON without loss (unit test).
  3. NPCs and players render through the same generator (no `isNpc` visual branch);
     a human tester cannot distinguish them by model.
  4. ≤ 4 draw calls per avatar (checked in a benchmark scene).

## 4. Multiplayer Sync

- **Standard:** One open world; presence + position sync with interpolation; the
  transport is abstracted behind `bridge/api.ts` (Supabase Realtime now, Colyseus
  swappable later without touching game code).
- **Best-in-class references:** **slither.io / Krunker.io** (snapshot + interpolation
  discipline), **Colyreus schema patterns** for packet design.
- **Falsifiable criteria:**
  1. Two browser tabs in the same world: each sees the other's avatar move with
     < 150 ms end-to-end visible latency on local network (human test script T-3).
  2. Bandwidth per player ≤ 2 KB/s sustained at 10 Hz updates (logged by a dev hook).
  3. Disconnect/reconnect leaves no ghost avatars (Playwright test).

## 5. NPC Believability ("human or AI?")

- **Standard:** NPCs move with the same physics, wear the same avatar generator, and
  have neutral names/tags. Figuring out who is human is a designed part of play.
- **Best-in-class references:** **"Human or Not" (AI21)** — the whole game is the
  Turing test; **.io-game bots** (unnamed-ish, human-like motion budgets).
- **Falsifiable criteria:**
  1. NPC movement uses the same locomotion code path as player avatars (no navmesh-
     only cheat unless players can also use it).
  2. Human test T-4: over 20 guesses, testers identify NPCs vs humans in 40%–60%
     accuracy band (not 0%, not 100%).
  3. NPC cap and spawn policy documented in `module.yaml` of the NPC module.

## 6. HUD & UX

- **Standard:** Minimal persistent HUD (score, role, level, items, notifications,
  language toggle, avatar menu, leaderboard); collapses to one button in one click;
  control hints fade after N seconds of idle.
- **Best-in-class references:** **Among Us** (one-screen minimal HUD),
  **Fall Guys** (readable from across the room).
- **Falsifiable criteria:**
  1. Every HUD element reachable in ≤ 2 clicks/taps (Playwright traversal test).
  2. Control tips visible on spawn and gone ≤ 5 s after last input (Playwright).
  3. HUD collapse/expand works with mouse and touch (Playwright emulation).

## 7. Localization

- **Standard:** English, Spanish, Portuguese. Browser/system detection; English
  fallback. Zero hardcoded user-facing strings.
- **Best-in-class reference:** **i18next/react-i18next** ecosystem discipline
  (namespaced dictionaries, coverage linted in CI).
- **Falsifiable criteria:**
  1. `pnpm i18n:check` worker exits 0 = every key exists in all 3 locales, no
     string literals in JSX/C# UI paths outside dictionaries.
  2. Playwright sets `navigator.language` to `es`/`pt` and asserts full HUD renders
     localized without missing-key placeholders.

## 8. Testing (TDD)

- **Standard:** Every public function on any module api has an automated, falsifiable
  test written **before** the implementation (red → green). Every task adds a human
  script entry in `TESTING.md`.
- **Best-in-class references:** **Vitest + Playwright** (web), **Unity Test
  Framework** (edit-mode tests run in batchmode CI).
- **Falsifiable criteria:**
  1. CI contains the failing-first-then-passing test evidence (commit the red, then
     the green; the task prompt requires both commits).
  2. `TESTING.md` has a numbered script for the current milestone; every script
     passes on a human run before merge.

## 9. Minigame Design

- **Standard:** Fast-paced, 15–90 second rounds; playable solo and scales to
  many players; uses ≤ 2 simultaneous inputs; readable in one look; authored as a
  **single self-contained event file** registered in the Minigames module.
- **Best-in-class references:** **WarioWare microgames** (single-look readability),
  **Fall Guys rounds** (party-scale chaos), **Mario Party** (versus variants of solo
  mechanics).
- **Falsifiable criteria:**
  1. Median round length measured in a balance-sim worker run falls inside 15–90 s.
  2. Human test: a first-time player wins/loses meaningfully inside 3 attempts.
  3. Event file registers via the Minigames api without edits to any other module.

## 10. LTI 1.3 & Privacy

- **Standard:** LTI 1.3 launch with OIDC login + JWT validation; grade sync via AGS;
  groups/teams via NRPS. **No PII claims are ever requested**; user mapped to an
  opaque key; minimum scopes only.
- **Best-in-class references:** **IMS/1EdTech LTI 1.3 spec + reference tool**,
  **ltijs** (community reference implementation), Moodle Sandbox as test platform.
- **Falsifiable criteria:**
  1. Launch succeeds against a Moodle sandbox with the tool registered to request
     only `lineitem`, `result`, `membership` scopes (no name/email claims).
  2. Privacy checklist in the LTI module `module.yaml` lists exactly the claims
     used; any new claim requires STANDARDS revision.
  3. Grade push fires only on host "wrap session" action (never silently).

## 11. Workers (background automation)

- **Standard:** Repo health is maintained by runnable workers, not human memory.
  Workers run server-optimally (Node scripts / CI; no in-app timers).
- **Current workers:**
  - `system:update` → regenerates `SYSTEM.md` (methods, utilities, features index).
  - `i18n:check` → localization coverage.
  - `arch:check` → module boundary lint.
  - `balance:sim` → headless economic sim (cry-rate vs CSR capacity, upgrade pacing).
  - `bundle:guard` → JS bundle size budget.
- **Falsifiable criteria:**
  1. `SYSTEM.md` is machine-regenerated on every merge to main; humans must not
     hand-edit (CI enforces).
  2. Every worker is invoked in CI; new modules register themselves in SYSTEM.md
     without human edits.

---

*Revision policy: a STANDARDS change is itself a task (bump version, note in
ROADMAP). Components never ship "below the bar to be fixed later".*
