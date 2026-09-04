# Task 0103 — NPC Spawner (Core v1)

**Context.** Tasks `0101` (locomotion + camera) and `0102` (presence) are
merged; the bridge pipe carries every player's state. The world still has no
non-player characters. Core's next deliverable is a spawner that introduces
NPCs into the same presence layer players already see, *using the same
avatar generator* (AGENTS §9). No visual flags, no `isNpc` branch in the
avatar pipeline — every avatar is a `generate(seed)` result; the only
distinction is the `role` field on the bridge state.

**Goal.** A new `npc` module that exposes `spawnNpc(opts?)`, `clearNpcs()`,
`listNpcs()`, and `setNpcCap(n)`. NPCs are added to the presence layer as
remote players with `role: "prospect"` (or the override from `opts.role`)
and an opaque `playerId` of the form `npc-<seed>`. They render in the
dev `PresenceOverlay` chip strip just like real players, with no visual
distinction. The cap (default 8) prevents runaway spawns.

**Scope (touch only):**
- `src/modules/npc/**` (new)
- `src/modules/i18n/dictionaries/{en,es,pt}.json` (`npc.role.prospect` key)
- `src/App.tsx` (mount the spawner behind `import.meta.env.DEV` so dev
  has a default population; the production path is empty until 0104)
- `e2e/npc-spawner.spec.ts` (new)
- `TESTING.md`, `SYSTEM.md` (regenerated), `ROADMAP.md`, `TASK_LOG.md`,
  this file, and the SPEC.md stub → full-prompt link update.

**Must NOT touch:**
- `src/modules/bridge/**` (no contract change; NPCs are published through
  `presence.absorbPeerHeartbeat` + the bridge's `sendState` seam only
  for cross-tab visibility — but locally we route through presence).
- `src/modules/avatar/**` (we *consume* the generator; we don't edit it).
- `unity/**` (Unity-side spawn visuals land in 0104).
- `src/modules/scorebus/**`, `lti/**`, `screensaver/**`, `admin/**`,
  `minigames/**`.

**Standards refs:** STANDARDS §1 (one door per module, public-only api),
§3 (avatar NPCs use the same generator — no `isNpc` visual branch),
§5 (NPC motion and avatar match players), §8 (TDD), §11 (workers regen
SYSTEM.md). NPCs must use a different `playerId` namespace (`npc-…`) so the
player self-filter in `presence` doesn't accidentally treat them as self.

---

## Slice plan (commit order)

1. **`test(0103): red tests for the spawner`** — `src/modules/npc/api.spec.ts`:
   - `spawnNpc()` returns a stable `npc-<seed>` id, idempotent on the same
     seed (no duplicates).
   - `listNpcs()` reflects spawns and clears.
   - `setNpcCap(0)` makes the spawner a no-op; `setNpcCap(8)` allows 8.
   - Each NPC entry exposes the `AvatarSpec` from `avatar.generate(seed)`
     (same pipeline, per AGENTS §9).
   - `clearNpcs()` removes every NPC from the presence map and emits
     `leave` events.

2. **`feat(0103): spawner + presence integration`** — implements the api.
   - Wraps `avatar.generate(seed)` (no fork, no copy).
   - On spawn: ensures the presence map is started, pushes a `RemoteState`
     with `role: "prospect"`, and emits a `join` event.
   - On clear: emits `leave` for every NPC id, then `presence.clearPresence()`
     would clobber the map; so we just call a new `presence.removePeer(id)`
     that the spawner adds (a small targeted addition to the presence
     module's public api; not the broadcast-channel seam).

3. **`test(0103): red e2e`** — `e2e/npc-spawner.spec.ts`:
   - Open the page; assert the dev spawner populates the dev chip strip
     with at least one `npc-*` chip within 1 s of mount.
   - Click a "Clear NPCs" dev hook (exposed via `window.__tcNpcTest.clear()`
     in dev) and assert the chips vanish.

4. **`feat(0103): e2e seam + dev hook in App.tsx`** — adds a tiny dev
   button next to the status panel that calls `clearNpcs()` for the
   T-script. The hook is tree-shaken in production.

5. **i18n + system + roadmap + log** — add `npc.role.prospect` to all
   three dictionaries; bump `npc` version 0.1.0 → 0.2.0; `system:update`
   regenerates; bump `ROADMAP.md` to v1.3; append a row to `TASK_LOG.md`.

6. **TESTING.md T-5 update** — replace the T-5 "human-or-AI spot-check"
   script with a small Playwright + manual hybrid (dev "are these NPCs?"
   prompt). Real indistinguishability validation lands in 0104 when the
   Unity visuals and locomotion path are wired.

---

## Acceptance / merge gate

- `pnpm arch:check`, `pnpm i18n:check`, `pnpm system:update`,
  `pnpm bundle:guard` all exit 0.
- `pnpm test` green; new `npc` spec runs.
- `pnpm test:e2e` green; new `npc-spawner.spec.ts` passes.
- `TESTING.md` T-5 step 1 (Playwright) passes.
- squash-merge to `main`, **v1.3**, delete branch `task/0103-npc-spawner`.

---

## Out of scope (deliberate)

- No Unity-side spawn visuals (0104).
- No roles/slots beyond `prospect` (0104).
- No locomotion for NPCs (0104).
- No real-time NPC AI (0104+).
- No Hacker role (0303).
