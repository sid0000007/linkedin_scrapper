# Phase 5 — Fastify API Layer

Status: **Done**, verified both via injected tests and a manual live-server smoke test.

## Goal
Wire everything built so far behind a real public endpoint: `POST /v1/profile`, protected
by an API key, with input validation and inbound rate limiting.

## Prerequisites
Phase 4 done (normalizer produces the final `Profile` shape).

## Steps

1. `src/utils/url.util.ts` — `extractPublicIdentifier(url: string): string`:
   - Accepts `linkedin.com/in/<id>`, `www.linkedin.com/in/<id>/`, with/without query
     params, with/without trailing slash.
   - Rejects (throws a typed `InvalidLinkedInUrlError`) non-`/in/` paths — `/company/`,
     `/jobs/`, `/posts/`, `/school/`, and non-`linkedin.com` domains entirely.
2. `src/config/env.ts` — add `API_KEY` (required), `RATE_LIMIT_MAX`,
   `RATE_LIMIT_WINDOW_MS` (with sane defaults, e.g. 100/min).
3. `src/middleware/api-key-auth.ts` — Fastify `onRequest` hook: reads `x-api-key` header,
   compares against `env.API_KEY` (constant-time compare), 401s if missing/wrong.
4. `src/middleware/rate-limit.ts` — register `@fastify/rate-limit` globally, keyed by IP,
   using `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`. This is the **inbound** limit (client →
   our API) — distinct from the outbound throttle already in `LinkedInClient` (Phase 2).
5. `src/services/linkedin.service.ts` — thin wrapper delegating to `LinkedInClient`
   (keeps `profile.service.ts` decoupled from the LinkedIn client's concrete shape). Fires
   the `/me` call and both SDUI component POSTs concurrently via `Promise.all` (still
   bounded by the client's own outbound semaphore from Phase 2), returning all three raw
   sources together.
6. `src/services/profile.service.ts` — orchestrator (reworked once Phase 3's real data
   source changed — see that phase's doc):
   ```ts
   class ProfileService {
     async getProfile(url: string): Promise<Profile> {
       const publicIdentifier = extractPublicIdentifier(url);
       const sources = await linkedinService.getProfileSources(publicIdentifier);
       const experienceTree = parseFlightResponse(sources.experience);
       const eduCertTree = parseFlightResponse(sources.educationAndCertifications);
       const parsed = { /* run all Phase 3 parsers against sources.me / *Tree */ };
       return normalizeProfile(parsed, url);
     }
   }
   ```
7. `src/controllers/profile.controller.ts` — thin handler: parse/validate body with Zod
   (`{ url: string }`), call `profileService.getProfile(url)`, `reply.send(profile)`. No
   LinkedIn-specific logic here.
8. `src/routes/profile.route.ts` — registers `POST /v1/profile` with the controller, Zod
   body schema attached for Fastify's schema validation (auto 400 on bad body shape).
9. `src/routes/health.route.ts` — already exists from Phase 0; confirm it still works
   unauthenticated (health checks shouldn't require the API key).
10. `src/app.ts` — register rate-limit plugin, api-key-auth hook (scoped to `/v1/*`, not
    `/healzhz`), and the profile route.

## Files touched
`src/utils/url.util.ts`, `src/middleware/{api-key-auth,rate-limit}.ts`,
`src/services/{linkedin,profile}.service.ts`, `src/controllers/profile.controller.ts`,
`src/routes/profile.route.ts`, `src/app.ts`, `src/config/env.ts`.

## Acceptance criteria
- [x] `POST /v1/profile` with a valid `x-api-key` and a real profile URL returns 200 +
      the `Profile` JSON shape. (verified with a mocked data source in tests, and with a
      real running server against a fabricated LinkedIn-shaped payload — real LinkedIn
      data still pending Phase 1/2 live validation.)
- [x] Missing/wrong API key → 401, before any LinkedIn call is made.
- [x] Malformed body (missing `url`, wrong type) → 400 via Zod validation.
- [x] Non-profile LinkedIn URL (e.g. `/company/...`) → 400 with a clear message.
- [x] Exceeding the configured rate limit → 429.
- [x] `/healthz` still works with no API key.

## Tests
- [x] `tests/unit/utils/url.util.test.ts` (10 tests) — table of valid/invalid LinkedIn
      URLs, including trailing sub-paths like `/in/<id>/details/experience/`.
- [x] `tests/integration/profile.route.test.ts` (8 tests) — using Fastify's `inject()`
      with a mocked `ProfileDataSource` injected into `ProfileService` (constructor
      injection, no `vi.mock` needed), so no live LinkedIn calls happen. Covers: happy
      path, missing API key, wrong API key, malformed body, bad URL, upstream
      not-found → 404, rate-limit trip → 429, and `/healthz` staying open.
- [x] Manual live-server smoke test via `curl` against `pnpm dev` (not part of the
      automated suite) — this is what actually caught the Phase 2 auth-error bug below;
      injected tests alone hadn't exercised the real header-construction path.

All 64 project tests pass as of this phase.

## Notes / decisions log
- Implemented the **full error-status mapping table** (`src/middleware/error-handler.ts`)
  now rather than waiting for Phase 6, since Phase 5's own acceptance criteria need
  working 400/404/429/502 responses to be testable end-to-end. Phase 6 will build on this
  file for logging/redaction rather than starting it from scratch — see that phase's doc.
- Scoped both `@fastify/rate-limit` and the `apiKeyAuth` hook to a `/v1` prefix plugin
  context (Fastify encapsulation) so `/healthz` stays outside both — confirmed by test.
- API key comparison uses `crypto.timingSafeEqual` (length-checked first, since it throws
  on mismatched buffer lengths) rather than `===`, to avoid a timing side-channel.
- Dependency-injected `ProfileService`'s data source (`ProfileDataSource` interface,
  implemented by `LinkedInService`) specifically so integration tests can substitute a
  fake without any live network access or `vi.mock` module trickery.
- **Found and fixed a real bug via the manual live smoke test**: see
  [phase-2-linkedin-client.md](phase-2-linkedin-client.md)'s notes — `LinkedInClient`'s retry logic was masking
  `LinkedInAuthError` (missing-cookie config error) as a generic `LinkedInUpstreamError`.
  This is a good example of why the manual smoke-test step in the phase docs matters even
  when injected/mocked tests are green — the mocks had never exercised the real
  header-construction failure path.
