# Task 0010 — Scorebus Skeleton (Round-Envelope Ingest)

**Context.** Later v3 all scoring flows through `scorebus`. This task only lays
down the module boundary and the round envelope schema with a `.test` in-memory
sink.

**Goal.** `src/modules/scorebus` with `api.ts` exporting schema, ingest in-memory
sink validated by tests, and the round-envelope types shared with Unity mirror
(`unity/Assets/Scorebus/**`).

**Scope (touch only):** `src/modules/scorebus/**`, `unity/Assets/Scorebus/**`,
the spec test files.

**Standards refs:** STANDARDS §1 (module rules), §8 (TDD).

**Red test:**
- Assert envelope shape validation works; the in-memory sink accepts rejects
  based on schema.

**Visual checkpoint:** Debug overlay shows one ticked event entering the sink.

**Merge:** squash, v0.10.
