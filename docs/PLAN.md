# LinkedIn Profile API — Master Plan

Reverse-engineered, hosted LinkedIn Profile API. Accepts a LinkedIn profile URL, returns
structured JSON (name, headline, location, about, experience, education, skills,
certifications, languages, images) via direct HTTP calls to LinkedIn's internal
Voyager/GraphQL endpoints — no browser/DOM at request time.

## Locked-in decisions

| Area | Decision |
|---|---|
| Runtime / Lang | Node.js + TypeScript |
| Framework | Fastify |
| HTTP client | native `fetch` / undici |
| Validation | Zod |
| Testing | Vitest |
| Logging | Pino |
| Package manager | pnpm |
| Deployment | Docker → Render |
| LinkedIn auth | Manual browser login → `li_at` + `JSESSIONID` cookies pasted into `.env` |
| API protection | Required `x-api-key` header + per-IP rate limiting |
| Cache | Redis — optional/stretch, not required for core submission |

## How to use this plan

Each phase has its own doc in `docs/phases/`. Work happens phase by phase, in order
(phase 1 depends on phase 0's scaffold, phase 3 depends on phase 2's raw client output,
etc). When a phase is complete:

1. Check its acceptance criteria in the phase doc, tick the boxes there.
2. Tick the matching row below.
3. Move to the next phase.

`docs/RESEARCH.md` is a living document — it's written during Phase 1 and referenced by
every later phase that touches LinkedIn's raw response shape.

## Phases

`[x]` done · `[~]` partial/deferred (see phase doc for what's outstanding) · `[ ]` not started

- [x] **Phase 0 — Scaffold & Tooling** — [phase-0-scaffold.md](phases/phase-0-scaffold.md)
      Repo structure, TS/pnpm/Vitest config, Fastify server boots, health check, Docker skeleton.
- [~] **Phase 1 — Reverse-Engineering Research** — [phase-1-research.md](phases/phase-1-research.md)
      Capture real requests for a profile page, document endpoints/headers/response shape in `docs/RESEARCH.md`, save real fixtures. LinkedIn's actual mechanism (an SDUI/React-Flight-stream system, not classic Voyager) fully identified and byte-verified via two real, decoded captures. **Partial**: both real captures turned out truncated (documented, not hidden); Skills/Languages componentIds and non-self-profile behavior remain unconfirmed (see doc).
- [x] **Phase 2 — LinkedIn Auth & HTTP Client** — [phase-2-linkedin-client.md](phases/phase-2-linkedin-client.md)
      `linkedin/{client,endpoints,headers,auth}.ts` — authenticated calls to `/voyager/api/me` (JSON) and the SDUI component POST dispatcher (Flight-stream text), retry/timeout/backoff, typed error classes. Code + tests done; live validation deferred to developer.
- [x] **Phase 3 — Flight-Stream Parser & Domain Parsers** — [phase-3-resolver-parsers.md](phases/phase-3-resolver-parsers.md)
      `src/flight/flight-parser.ts` (replaces the originally-planned Voyager `EntityResolver`, which turned out not to apply) resolves LinkedIn's React Server Components "Flight" stream responses; per-section parsers (profile/experience/education/certifications) walk the resolved tree. Byte-verified against two real captures (both partially truncated — see doc); Skills/Languages remain a documented gap (no componentId captured).
- [x] **Phase 4 — Normalizer & Public Schema** — [phase-4-normalizer-schema.md](phases/phase-4-normalizer-schema.md)
      LinkedIn-shaped data → clean `Profile` domain model, Zod-validated, decoupled from LinkedIn's internal schema.
- [x] **Phase 5 — Fastify API Layer** — [phase-5-api-layer.md](phases/phase-5-api-layer.md)
      Route → controller → service wiring, `POST /v1/profile`, URL validation, API-key auth middleware, inbound rate limiting. Also includes the full error-status mapping (pulled forward from Phase 6).
- [x] **Phase 6 — Error Handling & Observability** — [phase-6-observability-hardening.md](phases/phase-6-observability-hardening.md)
      Status-code mapping done in Phase 5. Pino structured logging, redact config, and standalone logger for the LinkedIn client layer done here — one documented simplification (LinkedIn-layer logs aren't correlated with the HTTP request ID).
- [x] **Phase 7 — Testing** — [phase-7-testing.md](phases/phase-7-testing.md)
      76 tests across 18 files, verified from a clean install with no LinkedIn credentials. Full pipeline snapshot test added. No live LinkedIn calls anywhere in the suite.
- [~] **Phase 8 — Dockerization & Deployment** — [phase-8-deployment.md](phases/phase-8-deployment.md)
      Production Dockerfile done + locally verified end-to-end in a container. GitHub push, Render service creation, real env vars, and live verification all need the developer directly — see doc.
- [~] **Phase 9 — README & Submission Polish** — [phase-9-readme.md](phases/phase-9-readme.md)
      README, API docs, approach write-up, known limitations, and secrets/dead-code audit all done. Only the live URL (blocked on Phase 8) is outstanding.

## Known constraints to keep visible throughout

- This uses the developer's personal LinkedIn session cookie server-side. LinkedIn's ToS
  prohibits this style of access; cookies expire/rotate and need periodic manual
  re-extraction; heavy/public use risks the account being rate-limited or restricted.
- No secrets (`.env`, cookies, API keys) ever get committed — enforced via `.gitignore`
  from Phase 0 onward and a final audit in Phase 9.
- CI/tests never make live calls to LinkedIn — everything after Phase 1 is fixture-driven.
