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
- Batch build script test: `unity.Test/PlanetScaffoldEditTests.cs` asserts the
  four named biome regions exist in the scene graph.

**Visual checkpoint:** Followed camera from any vantage can distinguish
forest/lake/camp/mountain within 60 s of spawn (human run of T-1).

**Merge:** squash, version bump v0.3.
