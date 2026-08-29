# arch-check fixtures

This folder holds sample inputs for the `arch-check` worker's spec.

- `violating-ok-layout/` — a pair of fixture modules: `a` reaches into
  `b/internal/foo` (a cross-folder import that bypasses `b/api`). The
  spec reads these via a `Reader` mock, so the files are not under
  `src/modules/` and are not picked up by the real worker.
- `well-formed/` — a single module with a valid `module.yaml` and a
  matching api file.

The `index.spec.ts` reads these to assert the worker correctly accepts
or rejects each layout. CI never runs them through the live node
reader; they're reference shapes for the test cases.
