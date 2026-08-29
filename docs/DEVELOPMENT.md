# DEVELOPMENT.md — Architecture, Commands, and Event Authoring

## Architecture (the only valid picture)

Three deployables, one repo:

1. **React/Lovable shell** (`src/`) — HUD, admin panel, landing/screensaver, LTI
   launch endpoint, and the iframe that hosts the Unity WebGL build.
2. **Unity WebGL build** (`unity/`, built to `public/unity/Build/`) — the 3D world:
   planet terrain, avatars, NPCs, minigames visuals, camera. The shell wraps it and
   routes real-time traffic through `src/modules/bridge/api.ts`.
3. **Supabase backend** — Postgres (scores, teams, sessions, opaque LTI keys),
   Realtime channels (presence/positions/events). Realtime access surface is exactly
   `src/modules/bridge/api.ts` so Colyseus can be swapped in later (AGENTS §13).

### Module layout

```
src/
  modules/
    hud/        api.ts  module.yaml
    admin/      api.ts  module.yaml
    bridge/     api.ts  module.yaml   (the realtime door; Unity talks through this)
    lti/        api.ts  module.yaml
    avatar/     api.ts  module.yaml   (spec/seed datatypes; Unity renders, both use same schema)
    minigames/  api.ts  module.yaml   (event file registry)
    scorebus/   api.ts  module.yaml
    ...
workers/
  system-update/  i18n-check/  arch-check/  bundle-guard/  balance-sim/
unity/
  <Unity project> → builds to public/unity/Build
```

**Module boundary rule (§2 AGENTS):** only the named `api` file of a module is
visible to other modules. `workers/arch-check/index.ts` enforces this and must pass
CI. New folders must add a `module.yaml` with `name`, `description`, `version`,
`api` (path), `depends_on` (list), `privacy` defaults if LTI-facing.

**Unity side mirrors this:** Unity C# folders expose `Api.cs`; the Build output
communicates with the shell through a small JS interface (`window.__tcBridge`) that
delegates to `src/modules/bridge/api.ts`.

### Dev commands

```bash
pnpm dev                 # vite dev server (shell)
pnpm dev:unity           # build Unity WebGL (Unity CLI batch) into public/unity/Build
pnpm test                # vitest unit tests
pnpm test:e2e            # playwright
pnpm arch:check          # module boundary lint (workers/arch-check)
pnpm i18n:check          # localization coverage (workers/i18n-check)
pnpm system:update       # regenerate SYSTEM.md (workers/system-update)
pnpm bundle:guard        # enforce JS bundle budget
pnpm balance:sim         # headless economy micro-sim (workers/balance-sim)
```

CI runs: `test`, `test:e2e`, all workers. Merges to `main` trigger the same matrix.

### Event (minigame) authoring — single-file rule

A game mode = ONE file in `src/modules/minigames/events/<slug>.ts` exporting:

```ts
export const meta = {
  slug: 'tag-sprint',
  title: { en: 'Tag Sprint', es: 'Toca y Corre', pt: 'Toque e Corra' },
  inputs: ['move'],                 // ≤ 2 simultaneous
  solo: true, versus: true,
  durationSec: 45,
};
export function activate(ctx: MinigameContext) { ... }
export function deactivate(ctx: MinigameContext) { ... }
```

Register in `src/modules/minigames/api.ts` (`register(meta)`). Touch NO other
module. If Unity visuals are needed they hang off events the api emits; the event
file stays self-contained and remains readable end-to-end.

### Embed contract (Shell ↔ Unity)

- Shell hosts `/public/unity/Build/index.html` inside an iframe sized to the
  container.
- Messages pass through `window.__tcBridge` → `src/modules/bridge/api.ts`
  (`joinWorld`, `sendState`, `onState`, …).
- The Unity build target is a fixed layout WebGL build; shell controls sizing
  (responsive window) and sends resize events.

### LTI scaffold (Phase C quick-start)

`src/modules/lti/api.ts` exposes:

```ts
export function handleLaunch(args: LaunchArgs): SessionToken // OIDC + JWT validation
export function pushGrade(sessionId: string, score: number): Promise<void> // AGS
export function getGroups(sessionId: string): Promise<TeamGroup[]>         // NRPS
```

Defaults: no PII claims requested, minimum scopes (`lineitem`, `result`,
`membership`), opaque `sub` key mapping. Privacy checklist lives in
`src/modules/lti/module.yaml` and is versioned.
