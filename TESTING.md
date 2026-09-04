# TESTING.md — Human Test Scripts (one per milestone)

Run the script for the milestone being merged. A task merges only after its script
passes. Scripts are plain language on purpose — any human must be able to execute.

Format: **T-<num>** step-by-step. Each ends with expected result and what to do if
it fails.

---

## M1 — Foundation (v0.x)

**T-1 Dev run & planet**
1. Run `pnpm dev:unity` once to build the Unity WebGL planet into `public/unity/Build/`
   (first build takes several minutes; needs Unity 6 LTS + WebGL module installed).
2. `pnpm dev` and open the printed URL.
3. The embed loads the real planet: a spherical mini-planet whose four biomes
   (forest, lake, camp, mountains) are visible; an orbit camera auto-rotates so
   all four pass into view within ~60 s (drag to rotate manually).
4. The browser console logs `[bridge] joinWorld ok <sessionId>`.
5. Without the build (e.g. CI, or before `dev:unity`), the embed falls back to
   the placeholder sphere at `/unity/placeholder.html` — no black screen.
6. Expected: no black screen, no loader hang, no console errors.
   If fail: don't merge; fix scope.

**T-2 Workers green (v0.x gate)**
1. Run: `pnpm arch:check`, `pnpm i18n:check`, `pnpm system:update`,
   `pnpm bundle:guard`.
2. Expected: all exit 0; `SYSTEM.md` updated; no manual edits to it.

**T-3 Localization smoke**
1. Set browser language to `es` then `pt`; reload each time.
2. Expected: full chrome localized (no missing-key placeholders), English fallback
   works.

---

## M2 — Core (v1.x)

**T-4 Two players see each other**
1. With the dev server running, open two browser tabs (or two windows) and
   navigate to `http://127.0.0.1:5173/` on both. (For incognito, use a
   second normal tab on the same profile — incognito lives in a different
   browsing context group, so the localStorage heartbeat cannot reach it
   today. The real Supabase channel in v3 will reach incognito.)
2. Wait ~1 second for both overlays to mount.
3. Tab A's "Other players" dev strip will already show a chip for tab B's
   session id, and vice versa. The transport is the localStorage heartbeat
   published by each tab's `Bootstrap` (see `src/App.tsx`) and absorbed by
   the other tab's `storage` event listener.
4. No console commands are needed. The same behavior is asserted in
   `e2e/presence-two-tab.spec.ts` (gated to skip in CI; the heartbeat is
   dev-only and the spec is local).
5. Real cross-network T-4 (Supabase channel + LTI session tokens) is deferred
   to v3 (task 0304/0307). The localStorage heartbeat stands in for the
   transport and exercises the < 150 ms feel budget end-to-end on one
   machine.

**T-5 NPCs indistinguishable from humans (tasks 0103 + 0104)**
1. With the dev server running and `unity/Assets/Scripts/NpcSpawner.cs`
   compiled into a local Unity build (run `pnpm dev:unity` once)
   open `http://127.0.0.1:5173/?npcs`. (Without the ?npcs URL param the
   shell still seeds 3 Prospects; they show as chips. Unity bodies land
   when the build is loaded with the param.)
2. The PresenceOverlay chip strip shows 3 Prospects (`npc-101`,
   `npc-202`, `npc-303`) plus the local player's session id.
3. Open a second browser tab. It joins the world and shows the same 3
   NPC chips in its own strip, plus the other tab's session id.
4. **Motion check.** Watch an NPC chip's `data-x` attribute (DOM inspector
   or `e2e/npc-motion.spec.ts`) for ~3 s; it must change at least once as
   the publish loop ticks. Also, in the Unity scene, the NPC capsules
   walk the planet along the same great circle a human player would,
   because they use the same `PlayerController.Step()` path
   (`unity/Assets/Tests/EditMode/NpcLocomotionEditTests.cs` enforces
   the parity at edit time).
5. **Indistinguishability test.** Over 20 guesses, testers should
   land 40%–60% correct (STANDARDS §5.2). A perfect or zero score
   means something leaks — most commonly an `isNpc` visual branch,
   a faster speed cap, or a different motion pattern. The fix path
   is to look at the avatar builder + the motion policy + the cap.
6. Bash visual: `npm run dev:unity` once before this script so the
   Unity bodies are alive; the chip-strip behavior is dev-only and
   skips in CI.

---

## M3 — Play (v2.x)

**T-6 Scout funnel playable**
1. Join, find a Prospect (NPC), engage in the simple 1–1 game OR collect an
   attractor item.
2. Bring them through the Camp gate → they become a Camper (visible via the
   funnel/Sankey screens).
3. Expected: one Scout can complete the funnel in < 5 minutes solo; the Sankey
   screens update live.

**T-7 Minigame round pacing**
1. Play 3+ rounds of the active minigame solo, then with a second player.
2. Expected: rounds are 15–90 s, readable in one look, win/lose outcome visible.

**T-8 HUD full usability**
1. From the world, with HUD expanded: check score/role/level/items/notifications,
   toggle language, open avatar menu + leaderboard.
2. Collapse HUD to one button in one click; expand again.
3. Expected: every element reachable in ≤ 2 clicks/taps; idle-tips fade ≤ 5 s.

---

## M4 — Journey complete (v3.x)

**T-9 Session lifecycle to gradebook**
1. Host starts a Live Event session on a sandbox Moodle launch.
2. Play through Upgrade + Offboard flows (Health bar, Cry, Infra, tent destroy).
3. Host wraps the session.
4. Expected: gradebook receives the score for the session's players; groups/teams
   match NRPS rows; no PII in the push.

**T-10 Hacker role caps**
1. Attempt to spawn a Hacker when 5% of the room already has the role.
2. Expected: rejection (no slot) with clear localized message; Hackers vanish when
   their time window ends.

---

**Writing new scripts:** a feature owns its T-script. Add the next number.
Milestone audits run *all their scripts* before gate check.
