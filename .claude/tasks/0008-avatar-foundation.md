# Task 0008 — Avatar Foundation (Seed Schema)

**Context.** Avatar generator lives on both sides (TS spec datatype + Unity
renderer). Same schema → deterministic seed → bit-identical avatar (test).

**Goal.** In TS (`src/modules/avatar`): an `AvatarSpec` schema + `generate(seed)`
that returns a deterministic spec object, plus JSON round-trip. Unity: a shared
`AvatarSpec.cs` mirror that renders the minimum viable humanoid (body+face bits).

**Scope (touch only):** `src/modules/avatar/**`, the Unity mirror path
`unity/Assets/Avatar/**`, the pair of specs.

**Standards refs:** STANDARDS §3 (Avatar generator; bit-match; round-trip; ≤4
draw calls is asserted in a later task).

**Red test:**
- `avatar.spec.ts` asserts same-seed bit-match and round-trip; matches the
  Unity-side spec schema.

**Visual checkpoint:** For 4 fixed seeds the same avatar renders in an in-app
debug panel; no human imagination needed.

**Merge:** squash, v0.8.
