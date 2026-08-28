# Phase 2 — LinkedIn Auth & HTTP Client

Status: **Code complete, all unit tests passing.** Originally built against an assumed
single Voyager profile endpoint; reworked once Phase 1's continued research confirmed the
real mechanism is `GET /voyager/api/me` (JSON, self-view identity only) plus
`POST .../rsc-action/actions/component` (React Server Components "Flight" stream text, one
call per profile section) — see `docs/RESEARCH.md` and Phase 3's doc for the full account.
The client now needs to support both GET+JSON and POST+text response handling.

## Goal
A typed client that can make an authenticated request to LinkedIn's Voyager endpoint(s)
for a given `publicIdentifier` and return the raw JSON graph — using the findings from
Phase 1. No parsing yet; this phase stops at "raw JSON in hand."

## Prerequisites
Phase 1 partially done — auth header pattern confirmed, but the exact full-profile-data
endpoint is unconfirmed. Proceeding with the documented best-effort assumption in
`docs/RESEARCH.md` ("Working assumption for Phase 2"); code below must make this
assumption obvious and easy to correct in one place once validated live.

## Steps

1. `src/config/env.ts` — extend Zod schema with `LINKEDIN_LI_AT`, `LINKEDIN_JSESSIONID`
   (both required, no defaults, never logged).
2. `src/linkedin/auth.ts` — `LinkedInAuth` interface (`getHeaders(): Record<string,
   string>`, `getCookieHeader(): string`) and a `SessionAuth` implementation built from env
   vars. Derives `csrf-token` from `JSESSIONID` per Phase 1 findings.
3. `src/linkedin/headers.ts` — the fixed browser-like headers identified in Phase 1
   (`user-agent`, `accept`, `x-restli-protocol-version`, `x-li-lang`, etc.), merged with
   `auth.getHeaders()` per request.
4. `src/linkedin/endpoints.ts` — `LINKEDIN_ENDPOINTS` (`me`, `component`),
   `SDUI_COMPONENT_IDS` (confirmed component IDs for Experience and
   Education+Certifications), `LinkedInRequestDescriptor` (now `method: 'GET'|'POST'`,
   optional `body`, and `responseType: 'json'|'text'` since Flight-stream responses must
   not be run through `response.json()`).
5. `src/linkedin/requests/me.request.ts` — builds the `/me` GET descriptor.
   `src/linkedin/requests/component.request.ts` — builds the SDUI component POST
   descriptor: confirmed uniform JSON body (`clientArguments.payload.vanityName`,
   `screenId`), plus a per-request random `parentSpanId` tracing token (unconfirmed
   whether LinkedIn validates it server-side — generating one mimics real client
   behavior rather than risking a suspicious fixed value).
6. `src/errors/linkedin.errors.ts` — `LinkedInAuthError`, `LinkedInRateLimitError`,
   `LinkedInProfileNotFoundError`, `LinkedInUpstreamError` (base classes, no HTTP-code
   knowledge here — that mapping is Phase 6).
7. `src/linkedin/client.ts` — `LinkedInClient` class:
   - `request(descriptor)`: fetch with headers/cookies attached, timeout (e.g. 10s via
     `AbortController`), retry with backoff on network errors/5xx (not on 4xx), maps
     LinkedIn status codes to the typed errors above (401/403 → auth error, 404 → not
     found, 429 or LinkedIn's checkpoint/challenge response → rate limit error). Reads the
     response as `.text()` or `.json()` based on `descriptor.responseType`.
   - `getMe()`: JSON identity response.
   - `getComponent(componentId, publicIdentifier)`: raw Flight-stream text for one section.
8. Basic outbound throttling: a minimal in-process limiter (even a simple queue/semaphore)
   so concurrent inbound API requests don't fan out into a burst of simultaneous LinkedIn
   calls.
9. Manual smoke test (not in CI): a throwaway script or REPL call to `getMe()`/
   `getComponent()` against a real profile, confirming the responses come back and match
   the confirmed shapes in `docs/RESEARCH.md`.

## Files touched
`src/config/env.ts`, `src/linkedin/{client,endpoints,headers,auth}.ts`,
`src/linkedin/requests/{me,component}.request.ts`, `src/errors/linkedin.errors.ts`.

## Acceptance criteria
- [ ] **Deferred to the developer, locally** — `LinkedInClient.getMe()`/`.getComponent(...)`
      return data matching the shapes recorded in `docs/RESEARCH.md`, against a real,
      freshly-rotated `LINKEDIN_LI_AT`/`LINKEDIN_JSESSIONID` in a local `.env` — never run
      from/pasted into this chat. Live capture so far has only exercised the account's own
      profile; this is also how "does this work for an arbitrary profile" gets confirmed.
- [x] Missing/expired cookies produce a `LinkedInAuthError`, not an unhandled exception.
      (`SessionAuth.getHeaders()` throws when `LINKEDIN_LI_AT`/`LINKEDIN_JSESSIONID` are
      unset; `LinkedInClient` maps upstream 401/403 to the same error type.)
- [x] A request to a nonexistent profile produces `LinkedInProfileNotFoundError`. (mapped
      from upstream 404; will be re-verified live once the real endpoint is confirmed.)
- [x] Network timeout is enforced via `AbortController` (doesn't hang indefinitely).
- [x] No cookie/token values ever appear in logs or thrown error messages (error messages
      only reference status codes and context, never header/cookie contents).

## Tests
- [x] Unit tests for `endpoints.ts`/`requests/*.ts` builders (pure functions — given an
      identifier, assert correct URL/params). `tests/unit/linkedin/endpoints.test.ts`.
- [x] Unit tests for `auth.ts` — missing-cookie throw, csrf-token derivation from
      JSESSIONID. `tests/unit/linkedin/auth.test.ts`.
- [x] Unit tests for `client.ts` request/retry/error-mapping logic using a mocked
      `fetchImpl` injected via constructor options (no `vi.stubGlobal` needed since
      `fetch` is injectable) — covers success, 401, 404, 429 (+ retry-after), 5xx retry
      exhaustion, network-error retry exhaustion, no-retry-on-4xx (all via `getMe()`), plus
      dedicated `getComponent()` tests for the POST/text-response path (query params, JSON
      body shape, content-type header). `tests/unit/linkedin/client.test.ts` (10 tests).
- [x] No test in this phase depends on real LinkedIn credentials being present — confirmed
      by running `pnpm test` with no `LINKEDIN_*` env vars set.

## Notes / decisions log
- `LinkedInAuth` and `fetch` are both constructor-injectable on `LinkedInClient`
  specifically to make retry/error-mapping logic testable without mocking Node's global
  `fetch` or requiring real env vars.
- Retry policy: network errors and 5xx get exponential-backoff retries (base 500ms,
  doubling, `maxRetries` default 2); 4xx never retries (client mistakes/auth/not-found
  won't fix themselves on retry).
- Treated LinkedIn's historically-observed `999` status (bot-detection block) the same as
  `429` — both map to `LinkedInRateLimitError`. Unconfirmed empirically yet; safe
  default regardless.
- `parentSpanId` is generated fresh per request (`crypto.randomBytes(9).toString('base64')`)
  rather than a fixed placeholder — unconfirmed whether LinkedIn validates it, but this
  mimics real client behavior at negligible cost.
- Outbound concurrency to LinkedIn is capped at 2 simultaneous requests via an in-process
  semaphore in `client.ts`, independent of Phase 5's inbound rate limiting.
- **Bug found during the developer's own live smoke test (2026-08-28), fixed in
  `package.json`:** `.env` was never actually loaded into `process.env` — no `dotenv`
  import, no `--env-file` flag anywhere. `PORT`/`LOG_LEVEL` etc. silently fell back to
  their Zod defaults masking it, but `API_KEY`/`LINKEDIN_LI_AT`/`LINKEDIN_JSESSIONID` (all
  optional-with-no-default) were always `undefined` regardless of `.env`'s contents,
  making every request 401 (or later, once past that, `LinkedInAuthError`). Fixed by
  adding `--env-file-if-exists=.env` (Node ≥20.12 native, zero new dependency) to the
  `dev`/`start` scripts — the `-if-exists` variant doesn't crash when `.env` is absent, so
  Docker/Render (which inject real env vars directly, no `.env` file in the container) are
  unaffected; `Dockerfile`'s `CMD` calls `node dist/server.js` directly, bypassing the
  npm script entirely, so it was never affected either way. **Since confirmed working** by
  a full live smoke test: the developer's own profile fetched correctly end-to-end through
  the dashboard, top-card through Certifications.
- **Bug found during Phase 5's live smoke test, fixed here:** `requestWithRetry`'s catch
  block originally treated *any* thrown error the same as a network failure — including
  `LinkedInAuthError` thrown synchronously by `SessionAuth.getHeaders()` when cookies
  aren't configured, which happens before any network call. That meant a missing-cookie
  config error got silently retried and then re-wrapped as a generic
  `LinkedInUpstreamError`, hiding the real cause. Fixed by re-throwing any `LinkedInError`
  subclass immediately, unretried and unwrapped — only genuine unknown/network errors
  fall through to the retry-then-wrap path. Caught by manually curling a live dev server
  with no `LINKEDIN_LI_AT`/`LINKEDIN_JSESSIONID` set, not by the unit tests (which had
  been mocking `fetchImpl` directly and never exercised header-construction failures) —
  added `tests/unit/linkedin/client.test.ts`'s "propagates LinkedInAuthError thrown while
  building headers" case to cover it going forward.
