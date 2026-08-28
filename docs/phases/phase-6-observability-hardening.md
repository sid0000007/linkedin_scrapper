# Phase 6 — Error Handling & Observability

Status: **Done**, with one documented, deliberate simplification (see Notes).

## Goal
Every failure mode maps to a sensible HTTP status with a clean error body, every request
is traceable via logs, and secrets never leak into logs or error responses.

## Prerequisites
Phase 5 done (routes exist to attach the error handler to).

## Steps

1. `src/middleware/error-handler.ts` — Fastify `setErrorHandler`:
   | Error | HTTP |
   |---|---|
   | `InvalidLinkedInUrlError` (Phase 5) | 400 |
   | Zod validation error | 400 |
   | Missing/invalid API key | 401 |
   | `LinkedInAuthError` (our session expired) | 502 (it's *our* auth that's broken, not
   the client's — don't say 401, that implies the caller's fault) |
   | `LinkedInProfileNotFoundError` | 404 |
   | `LinkedInRateLimitError` | 429 (with `Retry-After` if known) |
   | `LinkedInUpstreamError` / unexpected upstream shape | 502 |
   | Anything else (parser crash, bug) | 500, generic message, full detail server-side
   only |
   Response body shape: `{ error: { code, message, requestId } }` — no stack traces, no
   internal error messages leaked for 5xx.
2. Request ID: use Fastify's built-in `request.id` (or configure a generator), include in
   every log line and in the error response body.
3. Pino config: redact known-sensitive paths explicitly (`req.headers.cookie`,
   `req.headers["x-api-key"]`, anything holding `LINKEDIN_LI_AT`/`LINKEDIN_JSESSIONID`) —
   use Pino's `redact` option rather than trusting manual discipline.
4. Log at each layer: inbound request (method/path/id), LinkedIn client call
   (identifier + endpoint, not headers/cookies), parser/normalizer failures (section that
   failed, not full payload), final response (status + latency).
5. Sanity check: grep the codebase for anywhere `env.LINKEDIN_LI_AT`,
   `env.LINKEDIN_JSESSIONID`, or `env.API_KEY` could reach a `log.info`/`console.log` call
   — there should be zero.

## Files touched
`src/middleware/error-handler.ts`, `src/app.ts` (Pino redact config, error handler
registration), possibly small edits to `src/linkedin/client.ts` for consistent logging.

## Acceptance criteria
- [x] Each error class from Phases 2/5 maps to the correct HTTP status (verified by
      test — see `error-handler.test.ts` below). Status-code table matches what's above
      exactly, and was actually implemented already in Phase 5 (see that phase's notes).
- [x] Error response bodies never contain a stack trace or raw LinkedIn error text for
      5xx-class failures (`LinkedInAuthError`/`LinkedInUpstreamError` messages are logged
      server-side via `request.log.error`, but the client only ever gets a fixed generic
      message + code).
- [x] Every **HTTP-layer** log line includes a request ID (Fastify's `request.log` is a
      child logger that auto-includes `reqId`; confirmed in manual smoke-test output).
      See Notes for the one place this doesn't extend to.
- [x] Manually triggered each error path locally (`curl` against `pnpm dev`, see Phase 5's
      notes) and confirmed cookies/API key never appear in stdout.

## Tests
- [x] `tests/unit/middleware/error-handler.test.ts` (10 tests) — direct unit calls with
      mock `FastifyRequest`/`FastifyReply` objects (no full Fastify boot needed), covering
      every error class, the retry-after header behavior, a generic Fastify 4xx error, and
      an unrecognized error confirming its message is never leaked (only "Something went
      wrong." reaches the client).
- [x] Phase 5's `tests/integration/profile.route.test.ts` already covers the error paths
      reachable through the real route (401, 400, 404, 429).

All 74 project tests pass as of this phase.

## Notes / decisions log
- Status-code mapping table was implemented in Phase 5 already (see that phase's notes
  for why) — this phase's real remaining work was logging/redaction, listed below.
- Added `src/logger.ts`: a standalone Pino instance (with the same `redact` config as
  Fastify's own logger in `app.ts`) for use outside of Fastify's request lifecycle —
  specifically by `LinkedInClient`, which has no access to `request.log`. Wired debug/warn
  /info/error logs into `LinkedInClient.requestWithRetry` (attempt started, retrying,
  success, each classified error, final failure) — logs only ever include `context`
  (the public identifier), `status`, `attempt`, and error `message`/`stack` — never the
  request headers, so cookies/csrf-token can't leak even without the redact config; the
  redact config is defense-in-depth for if headers ever get logged by a future change.
- **Known, deliberate simplification**: logs emitted from `LinkedInClient` (via the
  standalone `src/logger.ts`) are **not** correlated with the originating HTTP request's
  `reqId` — that would require threading a per-request child logger down through
  `ProfileService` → `LinkedInService` → `LinkedInClient` on every call, which felt like
  more plumbing than this project's scope justified. Cross-referencing an HTTP-layer log
  line with the LinkedIn-layer logs it triggered currently has to be done by timestamp +
  `context` (public identifier), not `reqId`. Noted here rather than silently doing it.
- Confirmed via `grep` that `env.LINKEDIN_LI_AT`, `env.LINKEDIN_JSESSIONID`, and
  `env.API_KEY` are only ever read to build request headers / compare the API key — never
  passed to any log call anywhere in `src/`.
