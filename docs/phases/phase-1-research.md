# Phase 1 — Reverse-Engineering Research

Status: **Partially done — deferred, revisit before/during Phase 2's live smoke test**

Confirmed: auth header pattern (`csrf-token` = unquoted `JSESSIONID`, required header
set, normalized graph response format via `/voyager/api/me`). Not yet confirmed: the
actual full-profile-data endpoint. Phase 2 proceeds with a documented best-effort
assumption (see `docs/RESEARCH.md`) rather than blocking on this. See
`docs/RESEARCH.md` for full details.

## Goal
Understand exactly what LinkedIn's own web client sends when it renders a profile page,
so Phase 2 can replicate it in code. Output is a document (`docs/RESEARCH.md`) plus a
sanitized JSON fixture — no production code yet.

This phase is manual (browser DevTools), not scripted, by design (matches the "manual
browser login" decision — same session doubles as the research session).

## Prerequisites
Phase 0 done (repo exists, so findings land in the right place). Requires the developer's
own LinkedIn account, logged in via a normal browser.

## Steps

1. Log into linkedin.com in a normal browser (Chrome/Firefox) with the account that will
   back this API.
2. Open DevTools → Network tab, filter by `voyager`, visit a profile page
   (`/in/<public-identifier>/`).
3. Identify the specific requests the client fires to populate:
   - Top card (name, headline, location, about, profile photo, background image)
   - Experience section
   - Education section
   - Skills section
   - Certifications/licenses
   - Languages
   - (Note: LinkedIn may split these across multiple `voyager/api/graphql` persisted
     queries rather than one big REST call — record each one separately.)
4. For each relevant request, record in `docs/RESEARCH.md`:
   - Full URL + query params (note any `queryId`/persisted-query hash for GraphQL calls)
   - Method
   - Required headers (`csrf-token`, `x-restli-protocol-version`, `x-li-lang`,
     `x-li-track`, `user-agent`, `accept`, etc.)
   - Required cookies (`li_at`, `JSESSIONID`, others actually necessary vs noise)
   - Response shape: is it a REST `elements`/`included` shape or a GraphQL `data`/
     `included` shape? Sample the top-level keys.
5. Save one full **sanitized** response body (strip/replace the real profile's PII with
   placeholders, or use a test/throwaway profile) to
   `tests/fixtures/voyager-profile-sample.json` — this becomes the fixture every later
   parser test is written against.
6. Note what `csrf-token` actually needs to equal (commonly: the unquoted `JSESSIONID`
   cookie value) — verify this empirically rather than assuming.
7. Note rate-limit / anti-bot behavior observed: does LinkedIn ever return a checkpoint/
   challenge page, 999 status, or CAPTCHA under normal single-profile browsing? Record it
   so Phase 2's retry logic and Phase 9's "known limitations" can be honest about it.
8. Confirm which URL shapes map to a person profile vs company/job/post, so Phase 5's
   input validation can reject the latter with a clear 400.

## Files touched
`docs/RESEARCH.md` (new), `tests/fixtures/voyager-profile-sample.json` (new, sanitized).

## Acceptance criteria
- [ ] `docs/RESEARCH.md` documents at least: the profile endpoint(s) used, required
      headers, required cookies, and the raw response's top-level shape.
- [ ] A sanitized fixture file exists and contains real (but scrubbed) structure — not a
      hand-typed guess — so later parser tests reflect reality.
- [ ] Rate-limit/anti-bot observations are written down, however minimal.
- [ ] No real cookie values, tokens, or un-scrubbed personal data committed anywhere in
      the repo (fixture must be manually reviewed for leakage before it's saved).

## Tests
None — this phase produces research artifacts, not code. The fixture saved here is what
Phase 3/7 write tests against.

## Notes / decisions log
_(fill in during implementation: actual endpoint(s) found, any surprises vs the assumed
`/voyager/api/identity/dash/profiles` / `/voyager/api/graphql` endpoints)_
