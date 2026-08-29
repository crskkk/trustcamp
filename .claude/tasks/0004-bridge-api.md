# Task 0004 — Bridge Realtime API (Sourced by Supabase Now)

**Context.** All realtime traffic hides behind `src/modules/bridge/api.ts`; the
Supabase client is the current implementation but swap-safe.

**Goal.** Define and implement the bridge api: `joinWorld`, `leaveWorld`,
`sendState`, `onState`, `listRooms`, plus session token mapping. Stub Supabase
client wiring.

**Scope (touch only):** `src/modules/bridge/api.ts`, `src/modules/bridge/module.yaml`,
`src/modules/bridge/internal/*`, `workers/arch-check/index.ts` (to whitelist the
module), `pnpm test` unit tests.

**Standards refs:** STANDARDS §1 (module boundaries), §4 (transport isolation),
§13 AGENTS (swap).

**Red test:**
- `bridge.spec.ts` asserts the exported surface is exactly the allowed names and
  returns the documented envelope; no Supabase client import outside `internal/`.

**Visual checkpoint:** bridge debug page (temporary console overlay) logs world
join/leave/state events.

**Merge:** squash, v0.4.
