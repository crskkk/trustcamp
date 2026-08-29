# Task 0009 — Screensaver Skeleton (Render Path Proof)

**Context.** The world must have a screensaver/landing mode with auto-orbiting
camera and host steering. This task proves the render path end-to-end with the
scaffold planet from 0003 (biomes still evolving is fine).

**Goal.** A `/screensaver` route (or a landing background flag) that runs an
automated camera orbit over the embedded Unity build; a CLI/dev hook to attach
detach the auto-orbit (so admin steering can land later).

**Scope (touch only):** `src/modules/screensaver/**` (new), `src/App/**` (route
mount), `unity/` camera-path script, `test:e2e` playwright file.

**Standards refs:** STANDARDS §2 (render), §6 (HUD: lens-level UI; only a minimal
chrome is allowed).

**Red test:**
- `screensaver.spec.ts` asserts route starts a camera path that moves the camera
  `window.__tcBridge` debug sentinel. Stop/start via the hook works.

**Visual checkpoint:** Visit `/screensaver`; the planet orbits automatically; the
hook pause works (T-1 for render; later T-8 for full HUD).

**Merge:** squash, v0.9.
