# Task 0007 — LTI Scaffold (Phase C) with Privacy Defaults

**Context.** We need LTI 1.3 readiness without signing into an LMS yet. Scaffold
`src/modules/lti` with OIDC login handler, JWT validation path, and session-token
emit; the privacy checklist in `module.yaml` documents the claims we use.

**Goal.** Handle an LTI launch in unit-test simulation. No real gradebook push
yet (that's v3). Emit opaque session token to shell.

**Scope (touch only):** `src/modules/lti/**`, `.github/workflows/ci.yml` if
needed, and test fixture keys under `src/modules/lti/__fixtures__/`.

**Standards refs:** STANDARDS §10 (LTI + privacy floors; claims: `sub` only).

**Red test:**
- `lti.spec.ts` asserts `handleLaunch(args)` validates a fixture-signed JWT and
  returns an opaque-key-mapped token; rejects if claim includes `name` or
  `email` (privacy rule).

**Visual checkpoint:** Debug console overlay logs launch-ok with `sub` key.

**Merge:** squash, v0.7.
