# Task 0102 — Realtime Presence Wireup (Core v1)

**Context.** Foundation (0001–0010) is merged and M1 passes. Task `0101`
shipped the locomotion + camera spine on the Unity side. Core makes the world
*playable* across multiple browsers. Today `bridge/api.ts` exposes a
`joinWorld/leaveWorld/sendState/onState` pub/sub with an in-memory fallback
and a Supabase Realtime path, but **no consumer in the shell subscribes to
`onState` and renders anything from it**. The two-tab test from `TESTING.md`
T-4 is irreducibly blocked on this task.

**Goal.** A `presence` module that owns the "who is where from this client's
view" abstraction: subscribes to the bridge, normalizes per-player state,
prunes stale entries, and exposes a small React hook + an event bus.
A dev-only HUD strip (`PresenceOverlay`) renders one chip per remote player
to make T-4 falsifiable end-to-end.

**Scope (touch only):**
- `src/modules/presence/**` (new)
- `src/modules/i18n/dictionaries/{en,es,pt}.json` (presence role keys only)
- `src/App.tsx` (mount `PresenceOverlay` behind dev-only guard)
- `e2e/presence-two-tab.spec.ts` (new)
- `TESTING.md`, `SYSTEM.md` (regenerated), `ROADMAP.md`, this file

**Must NOT touch:**
- `src/modules/bridge/**` (no contract change this round; bridge stays at 0.4.0)
- `unity/**`, `world/**` (Unity-side multi-avatar render belongs to 0103)
- anything in `scorebus/`, `lti/`, `screensaver/`, `admin/`, `minigames/`

**Standards refs:** STANDARDS §1 (architecture — api file is the only door),
§4 (multiplayer sync: < 150 ms feel, ≤ 2 KB/s/player, no ghost avatars),
§7 (localization — every new user-facing string in dictionaries),
§8 (TDD — red then green), §11 (workers regenerate SYSTEM.md).

---

## Slice plan (commit order)

1. **`test(0102): red tests for PresenceMap merge/drop/ttl/interpolate`**
   - `src/modules/presence/api.spec.ts` — pure unit tests for the public
     `PresenceMap` (idempotent merge, newer-wins, prune, interpolate, onChange
     only fires on shape changes).
2. **`feat(0102): PresenceMap + bridge consumer`** — implements the api; owns
   a lazy, idempotent `startPresence()` that wires `bridge.onState` →
   `PresenceMap` and re-emits `PresenceEvent`s.
3. **`test(0102): red PresenceOverlay renders chip per remote player`**
   - `src/modules/presence/PresenceOverlay.test.tsx` — RTL render with seeded
     presence events; expect one chip per remote player, none for self.
4. **`feat(0102): PresenceOverlay (dev HUD strip)`** — minimal dev-only chip
   strip; collapses cleanly when no remotes; uses `t(...)` for role labels.
5. **`test(0102): red two-tab Playwright presence e2e test`**
   - `e2e/presence-two-tab.spec.ts` — two `BrowserContext`s, drive tab A via
     the dev seam, assert tab B's chip strip shows A within 500 ms; assert
     graceful drop after 3 s of silence.
6. **`feat(0102): dev-only test seam`** — `window.__tcPresenceTest` exposes
   `pushRemote(state)` and `clear()`, guarded by `import.meta.env.DEV` AND
   the feature flag string `"__presence_test__"` (so prod tree-shakes the
   branch). **The seam is a hook, not a separate transport.**
7. **i18n + workers + bump** — add `presence.role.scout` / `presence.role.camp`
   / `presence.title` to all three dictionaries; bump `presence` version
   0.1.0 → 0.2.0; `pnpm system:update` regenerates SYSTEM.md; bump
   `ROADMAP.md` v1.1 → v1.2.
8. **`TESTING.md` T-4 update** — Step 1: open two tabs, drive A via the
   seam, verify < 150 ms feel; Step 2 (real Supabase/LTI) deferred to v3.

---

## Acceptance / merge gate

- `pnpm arch:check` exit 0
- `pnpm i18n:check` exit 0
- `pnpm system:update` exit 0 (no hand edits to SYSTEM.md)
- `pnpm bundle:guard` exit 0
- `pnpm test` green (unit)
- `pnpm test:e2e` green (Playwright two-tab)
- `TESTING.md` T-4 step 1 passes for a human
- squash-merge to `main`, **v1.2**, delete branch `task/0102-realtime-presence`

---

## Out of scope (deliberate)

- No NPC avatars — task 0103
- No roles/slots — 0104
- No real Supabase CI test (deferred to v3 — LTI session token required)
- No Unity-side multi-avatar render — 0103
- No HUD integration beyond dev chip strip — 0205
