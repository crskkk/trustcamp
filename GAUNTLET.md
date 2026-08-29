# GAUNTLET.md — The Gauntlet Loop Protocol

Every component is built by a **Builder agent** and judged by an independent
**Evaluator agent** against `STANDARDS.md`. The evaluator returns a **gap list**;
the builder closes the gaps; the loop repeats until the evaluator signs off. Only
then does the branch merge to `main` and die.

This protocol is binding for human-driven loops, multi-agent loops, and CI.

---

## Roles

### Builder agent
- Gets exactly one task file from `.claude/tasks/` (one self-contained prompt).
- Works only on the branch `task/NNNN-slug` created from the task number.
- Must not modify any file outside the task's declared **Scope** section.
- Workflow per attempt:
  1. Read `AGENTS.md`, `STANDARDS.md`, and the relevant module's `module.yaml`.
  2. Write the failing automated test (commit: `test(NNNN): red tests for …`).
  3. Implement until tests pass (commit: `feat(NNNN): …`).
  4. Update/satisfy the task's Visual Checkpoint.
  5. Run workers (`system:update`, `i18n:check`, `arch:check`) and commit.

### Evaluator agent (never the builder)
- Input: the task file + the diff range on the branch + `STANDARDS.md`.
- Never trusts the builder's self-report; reads the code and runs the tests.
- Emits a **gap list** (schema below) and a verdict.

### Human referee (the owner)
- Approves merge; only the referee may close a task as done.

---

## Gap list schema

```yaml
task: NNNN
verdict: REJECT | ACCEPT
gaps:
  - id: G1
    standard: "6.2"          # section + numbered criterion in STANDARDS.md
    severity: blocker | major | minor
    finding: "Control tips never fade; idle timer not wired."
    evidence: "hud/HudRoot.tsx:88" # file:line or failing test name
    required: "Wire useIdle(5000) to the tips group and add Playwright assertion."
  - id: G2
    ...
```

Rules:
- `verdict: ACCEPT` requires an empty `gaps` list or only `minor` findings with a
  follow-up task number assigned.
- A `blocker` gap reopens the loop. Maximum 5 loop rounds per task; on the 6th,
  escalate to the human referee with the full gap history.

## Loop outcomes checklist (ALL required, every task)

1. **Visual outcome** — there is something visible in the world/app (backend
   components get a *temporary* visual artifact: debug panel, console overlay,
   SPI-style in-world marker) until a definitive component consumes them.
2. **TDD** — red-then-green automated tests committed in order.
3. **Architecture** — module boundaries respected; api file is the only door.
4. **YAML controls** — module folders touched have updated `module.yaml`.
5. **Workers** — `system:update`, `i18n:check`, `arch:check` run and pass; their
   outputs are committed.
6. **Localization** — no untranslated UI strings in touched UI code.
7. **Human checkpoint** — `TESTING.md` script for the milestone passes.
8. **Branch lifecycle** — merge via squash to `main`, then **delete the branch**.
   Bump the dot-version in `ROADMAP.md`.

## Prompt hygiene for low-cost LLMs

- One task = one component (or one thin slice of it). If a prompt can't fit what to
  build and how to verify it on a few screens, split it into two tasks.
- Every task prompt contains: Context, Goal, Scope (allowed paths), Standard
  references, Red-test definition, Visual checkpoint, Merge policy.
- Never hand a builder two tasks at once.
