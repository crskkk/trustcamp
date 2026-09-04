# TASK_LOG.md — Token-cost ledger of merged tasks

> Per-task I/O ledger. Rows are appended at merge time. Token numbers are
> **estimates**, not provider-truthful counters (we don't have access to the
> model's token meter). The split is:
>
> - `code_in` / `code_out` — `git diff` size converted to tokens (~1.25 tok/line,
>   code-heavy; assumes bidirectional diff). These are reproducible.
> - `tools` — number of tool calls the agent drove for the task, multiplied
>   by an avg ~400 tokens/tool-call (call JSON + response). Reproducible from
>   the conversation log.
> - `conv_in` / `conv_out` — the agent's best estimate of its own input/output
>   tokens (system + user messages + assistant tokens) for the task. **The
>   agent overwrites these on paste** with values it can roughly track.
> - `total` — sum. Treat ±20% as honest noise.
>
> Use `node scripts/log-task.mjs HEAD` from a task branch to get a fresh
> code/tools estimate; fill in the conv numbers from your own run.
>
> The StatusPanel renders the last 5 rows so the cost-per-feature trend is
> visible in dev.
>
> **Honesty notes:**
> - **0104** shipped the *TS* motion policy + per-tick `bridge.sendState`
>   publishing only. The Unity bodies were not wired in this round (no
>   shell→Unity glue, no `StaticConfig` writer, and the build at
>   `public/unity/Build/` predates `NpcController.cs` / `NpcSpawner.cs`).
>   Manifest: NPCs show up in the dev chip strip (presence list) but not
>   in the 3D world. The cross-process glue lands in task 0105.

| task | version | title | commit | code_in | code_out | tools | conv_in | conv_out | total |
|------|---------|-------|--------|---------|----------|-------|---------|----------|-------|
| 0001 | v0.1 | repo workers + StatusPanel | `d046763` | 0 | 480 | 8 | 18 000 | 6 000 | 24 488 |
| 0002 | v0.2 | Unity WebGL embed + bridge stub | `ff79dee` | 320 | 220 | 6 | 14 000 | 5 000 | 19 546 |
| 0003 | v0.3 | spherical planet scaffold | `594c182` | 480 | 160 | 6 | 16 000 | 5 000 | 21 646 |
| 0004 | v0.4 | Supabase Realtime bridge + in-mem | `8c6ae6b` | 280 | 180 | 5 | 12 000 | 4 000 | 16 465 |
| 0005 | v0.5 | full arch:check lint | `c6ed6e2` | 220 | 140 | 4 | 10 000 | 3 500 | 13 864 |
| 0006 | v0.6 | HUD skeleton | `5398b4f` | 380 | 260 | 7 | 14 000 | 4 500 | 19 145 |
| 0007 | v0.7 | LTI scaffold | `07a7c83` | 240 | 160 | 5 | 12 000 | 4 000 | 16 403 |
| 0008 | v0.8 | avatar foundation | `3e6b4e9` | 220 | 140 | 6 | 13 000 | 4 200 | 17 562 |
| 0009 | v0.9 | screensaver skeleton | `742903a` | 180 | 120 | 4 | 10 000 | 3 500 | 13 801 |
| 0010 | v0.10 | scorebus skeleton | `51f59ef` | 200 | 140 | 5 | 11 000 | 3 800 | 15 144 |
| 0101 | v1.1 | camera + player controller | `625fc79` | 360 | 220 | 6 | 13 000 | 4 200 | 17 786 |
| 0102 | v1.2 | realtime presence wireup | `deaf6e3` | 760 | 480 | 14 | 28 000 | 9 000 | 38 264 |
| 0102-fix | v1.2 | heartbeat + bridge pipe (no-devtools fix) | `6dd5af8` | 320 | 240 | 9 | 16 000 | 5 500 | 22 072 |
| scaffold | v1.2 | TASK_LOG.md + StatusPanel task-cost table | `a2ba7c1` | 240 | 100 | 6 | 11 000 | 3 800 | 15 146 |
| 0103 | v1.3 | NPC spawner (avatar reuse, presence integration) | `1418ec9` | 380 | 1 | 15 | 18 000 | 6 000 | 30 378 |
| 0104 | v1.4 | NPC camo + locomotion (TS motion policy + bridge tick) | `3eef3af` | 892 | 34 | 26 | 48 000 | 16 000 | 73 957 |
