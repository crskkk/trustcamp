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

**Visual checkpoint:** Dev run shows an empty-ish but rendered scene in the embed
and the bridge console shows one `joinWorld` success message.

**Merge:** squash, version bump v0.2.
