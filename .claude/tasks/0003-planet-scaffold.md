# Task 0003 — Spherical Planet Scaffold with Biomes

**Context.** The world IS a spherical mini-planet. This task shapes terrain,
biomes (forest/lake/camp/mountains) and walkable area.

**Goal.** In-Unity scene with procedural or sculpted spherical terrain that
visually distinguishes the four biomes; PlayerWalk area tested; `pnpm dev:unity`
builds the WebGL bundle reproducibly.

**Scope (touch only):**
- `unity/` (scene, terrain scripts), `package.json` (`dev:unity` script),
  `workers/system-update/index.ts` run output registration (so UNITY is visible
  in SYSTEM.md).

**Standards refs:** STANDARDS §2 (biomes+fps), §11 (workers gather
Unity-visible methods).

**Red test:**
- Unity edit-mode test `unity/Assets/Tests/EditMode/PlanetScaffoldEditTests.cs`
  asserts the four named biome regions (Forest/Lake/Camp/Mountains) exist on the
  generated planet, plus a generated mesh. Run via `Unity.exe -batchmode -runTests
  -testPlatform EditMode`. Red first (fake-null GetComponent bug), then green.

**Visual checkpoint:** `pnpm dev:unity` builds the real Unity WebGL planet into
`public/unity/Build/`; `pnpm dev` renders it in the embedded iframe — a spherical
mini-planet with four distinguishable biomes; an auto-rotating orbit camera brings
all four into view within ~60 s (drag to rotate). `e2e/planet-smoke.spec.ts`
asserts a non-black WebGL canvas (local-only; skipped in CI where no build exists).
Without the build, `WorldEmbed` falls back to `public/unity/placeholder.html` so CI
and fresh clones still show a non-black embed (the 0002 placeholder sphere).

**Merge:** squash to `main`, delete branch `task/0003-planet-scaffold`, bump to v0.3.
