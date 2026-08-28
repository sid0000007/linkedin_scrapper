# Phase 7 — Testing (Consolidation Pass)

Status: **Done**

## Goal
Most tests are already written incrementally in Phases 0–6 (this project follows
test-alongside-each-phase, not tests-at-the-end). This phase is a consolidation and
gap-filling pass: coverage review, CI-safety check, and any integration tests that only
make sense once the whole pipeline is wired together.

## Prerequisites
Phases 0–6 done.

## Steps

1. Audit test coverage against each phase's "Tests" section — confirm nothing was skipped
   under time pressure.
2. Add a full end-to-end pipeline test: fixture raw JSON → resolver → parsers →
   normalizer → schema validation, in one test, asserting the final `Profile` object
   matches an expected snapshot. This is the test most likely to catch integration bugs
   between phases that unit tests miss.
3. Add negative/edge-case fixtures if not already covered: a minimal profile (only name +
   headline, everything else empty/missing), and confirm the pipeline doesn't throw.
4. Confirm **zero tests make live network calls** — grep for `fetch(` outside of
   `linkedin/client.ts` and confirm all client tests mock `fetch`.
5. Add `pnpm test` (or `vitest run --coverage` if coverage reporting is wanted) to a
   simple CI step description in the README (actual CI setup is optional — a documented
   `pnpm test` command that a reviewer can run is the hard requirement).
6. Confirm test run time is reasonable (no accidental real timeouts/retries executing in
   the LinkedIn client's unit tests).

## Files touched
Possibly new: `tests/integration/pipeline.test.ts`, additional fixtures in
`tests/fixtures/`. Mostly a review pass over existing test files.

## Acceptance criteria
- [x] `pnpm test` passes fully from a clean clone (`rm -rf node_modules && pnpm install
      && pnpm test`, actually run — not just asserted), with no `LINKEDIN_*`/`API_KEY` env
      vars present. 76/76 tests pass.
- [x] End-to-end fixture-to-`Profile` pipeline test exists and passes —
      `tests/integration/pipeline.test.ts`, snapshot-asserted.
- [x] A minimal/sparse profile fixture is tested through the full pipeline without errors
      (same file, second test case).
- [x] No test performs a real network call to `linkedin.com` — confirmed by grep: `fetch(`
      only appears in `src/linkedin/client.ts` itself (as `fetchImpl`), and every test
      constructing a `LinkedInClient` passes an explicit mock `fetchImpl`.

## Tests
This phase *is* the tests — see Steps above. Added in this phase:
- [x] `tests/integration/pipeline.test.ts` (2 tests, snapshot-based) — the full
  resolver → parsers → normalizer → schema pipeline in one place, run against both
  fixtures. Snapshots committed to `tests/integration/__snapshots__/`.

Final count: **76 tests across 18 files**, ~1.5s total run time (the two client-retry
tests each take ~500ms from real `setTimeout` backoff delays — deliberate, not a
regression; everything else is sub-10ms).

## Notes / decisions log
- Did **not** add a formal coverage-percentage gate (`vitest run --coverage` with
  thresholds) — felt like more ceremony than this project's scope needed. Test coverage
  is broad by construction (every parser, the resolver, the normalizer, the URL/date
  utils, the LinkedIn client's retry/error paths, the error handler, and the full route
  are all directly tested), but nothing enforces a numeric percentage in CI.
- The `pnpm test` README documentation and any CI-step description are deferred to
  Phase 9 (README doesn't exist yet at this point in the plan) — tracked there, not
  forgotten.
- Confirmed once more, explicitly for this phase, that the real known gap remains
  Phase 1/2's live LinkedIn validation (see those phases' docs) — all 76 tests here run
  against synthetic fixtures, not a captured real response. That's the single most
  important "known limitation" to carry into the README.
