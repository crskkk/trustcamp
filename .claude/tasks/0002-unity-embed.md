# Task 0002 — Unity WebGL Embed Harness

**Context.** The shell hosts the 3D world. Unity WebGL build is embedded via an
iframe with a bridge API; we don't yet need the full planet, just the harness.

**Goal.** Shell knows how to embed a Unity WebGL build at `public/unity/Build`,
routing bridge calls (`joinWorld`, `sendState`, `onState`) through
`src/modules/bridge/api.ts`. A placeholder Unity scene (shaded sphere) proves the
pipe.

**Scope (touch only these paths):**
- `src/modules/bridge/api.ts`, `src/modules/bridge/module.yaml`, the shell embed
  component path (chosen at implementation time but must land inside the scope),
  `public/unity/` build target config, the Unity folder harness.

**Standards refs:** STANDARDS §2 (Rendering smoke), §13 AGENTS (bridge swapability).

**Red test:**
- Playwright test `embed-smoke.spec.ts` asserts the iframe becomes non-empty and
  the bridge namespace resolves (no black screen).

**Visual checkpoint:** `pnpm dev` embeds `public/unity/Build/index.html` — a
hand-written **placeholder** build (CSS shaded sphere, no Unity Editor needed)
that proves the Unity↔shell pipe: the iframe is non-empty (sphere visible, no
black screen), `window.__tcBridge` resolves on the parent, and the bridge logs a
`joinWorld` success. `e2e/embed-smoke.spec.ts` asserts all three. The real Unity
WebGL build + `unity/` project + `pnpm dev:unity` batch build land in task 0003
(which overwrites this placeholder); the Supabase transport behind the bridge
api lands in task 0004 (the in-memory stub here keeps the api surface stable).

**Merge:** squash to `main`, delete branch `task/0002-unity-embed`, bump to v0.2.
