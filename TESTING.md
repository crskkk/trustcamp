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
1. Open two browser tabs (or two browsers) and join the world on both (no LTI).
2. Move in one, watch the other.
3. Expected: visible motion on the watcher's screen with < 150 ms feel on local
   network. Disconnect one tab — the avatar must vanish within ~2 s.

**T-5 Human-or-AI spot-check (NPC indistinguishability)**
1. Join a world with ≥ 3 NPCs and ≥ 1 other human.
2. Play 20 guesses (via a two-player helper sheet or the spawn-menu helper).
3. Expected: testers land 40%–60% correct. Outside that band → something leaks.

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
