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

**T-5 NPCs indistinguishable from humans (tasks 0103 + 0104 + 0105)**
1. With the dev server running, open `http://127.0.0.1:5173/`. The
   PresenceOverlay chip strip shows 3 Prospects (`npc-101`, `npc-202`,
   `npc-303`) **in the dev chip list only** — 0103/0104 do not yet
   render 3D bodies. The chip-list presence is the current truth,
   not visual avatars.
2. Open a second browser tab on the same origin; it shows the same NPC
   chips (the localStorage heartbeat from 0102 carries them across).
3. **Motion check.** Watch an NPC chip's `data-x` attribute (DOM
   inspector or `e2e/npc-motion.spec.ts`) for ~3 s; it must change at
   least once as the TS publish loop ticks.
4. **3D body render** (lands with 0105): when the build at
   `public/unity/Build/` is rebuilt with `NpcController.cs`,
   `NpcSpawner.cs`, and the new shell→Unity bridge listener, and a
   StaticConfig writer pushes the 3 seeds from the shell to the Unity
   client, the planet shows 3 capsule-NPCs walking along the same
   great-circles a human does (the `unity/.../NpcLocomotionEditTests.cs`
   asserts locomotion parity at edit time).
5. **Indistinguishability test.** Over 20 guesses, testers should land
   40%–60% correct (STANDARDS §5.2). Falls outside that band → something
   leaks; pointer is the avatar builder, the motion policy, the cap.
6. **Today (pre-0105)**: skip the body render and cap steps; the chip
   strip is the only falsifiable behavior.

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

---

## THE BAR (v2.x) — Three.js world, Camp Games, multiplayer, menu, LTI

**T-11 World walk (v2.0)**
1. `pnpm dev`, open `http://127.0.0.1:5173/`. The campground renders within 10 s
   (lodge with porch, three cabins, tents, campfire with embers, benches, lanterns).
2. WASD/arrows walk, Space jumps (landing squash), E waves; on touch, drag the
   left stick and tap the jump button. The control hint fades ≤ 5 s after input.
3. Follow the dirt trail out of either gate: lake with dock and foam shoreline
   (≈ 30 s), forest with rounded canopy trees and pines, terraced hills with
   rock faces. A full lap along the trail loop takes < 60 s at run speed.
4. Expected: ≥ 30 fps at 1280×720 on an integrated GPU (`__tcWorld.fps` in dev),
   no console errors. Automated: `e2e/embed-smoke.spec.ts`, `walker.spec.ts`,
   `planet.spec.ts`.

**T-12 Camp Games (v2.1)**
1. Menu → Play → **Firewood Dash**: 8 logs lie along the trails near camp; walk
   into up to 3, return to the campfire; the round panel shows time, logs
   delivered, points, team score. Deliver all 8 (or let the 60 s run out).
2. **Lantern Relay**: six unlit lanterns lead toward the lake; light them in
   order (a wrong one shows a hint); finishing early adds a time bonus.
3. Pinecones/berries on the trails give +3 XP; the level chip and XP bar move;
   a level-up toast appears at 60 XP. Reload: level and XP persist.
4. Automated: `minigames.spec.ts`, `progress.spec.ts`, `e2e/minigame.spec.ts`.

**T-13 Live multiplayer (v2.2)**
1. `pnpm server` (second terminal). Open two *different* browsers (or one
   normal + one private window) at `http://127.0.0.1:5173/?ws=ws://127.0.0.1:8787`.
2. Each sees the other's camper within a second; movement follows with
   < 150 ms visible lag on a LAN; scores/levels appear in Menu → Leaderboard
   with a live team total. Close one window: its camper disappears at once.
3. Reload a window: same camper, same XP (resume token in localStorage;
   progress on the server). `GET /health` shows `online`.
4. Automated: `server/server.spec.ts`, `e2e/multiplayer.spec.ts`.

**T-14 Menu (v2.3)**
1. HUD → **Menu** (or click Avatar / Leaderboard in the bar). Tabs: Play,
   Customize, Leaderboard, Settings. Escape or ✕ closes.
2. Customize → *New random look* changes the camper immediately and persists
   across reloads; *Wear* applies a quick pick.
3. Settings → language switches the whole chrome; Graphics reloads into the
   chosen tier; Multiplayer server connects/disconnects; Connection shows
   *Solo* or *Online (server)*.
4. Automated: `menu.spec.tsx`, `e2e/hud-skeleton.spec.ts`.

**T-9 (updated) Moodle gradebook** — follow `docs/MOODLE.md` (needs the server on
an https host). Mock-platform coverage: `server/lti.spec.ts` (login → launch →
learner join → host wrap → AGS score POST with the opaque `sub` only).

---

**Writing new scripts:** a feature owns its T-script. Add the next number.
Milestone audits run *all their scripts* before gate check.
