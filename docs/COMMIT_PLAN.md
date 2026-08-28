# Commit Plan

This repo currently has **zero commits** — everything below is untracked. This doc lays
out a suggested commit sequence that mirrors how the project was actually built
(phase by phase, docs alongside code), so the git history reads as a clear build log
instead of one giant initial commit.

Nothing has been committed on your behalf — this is a plan for you to execute (or adapt)
whenever you're ready. Each commit is additive; run them in order top to bottom.

`docs/PLAN.md` and each `docs/phases/phase-N-*.md` file were edited repeatedly across the
real build (checkboxes ticked off as work completed) — for every commit below, stage
those doc files **as they currently exist**, not some historical snapshot. Since this is
a fresh repo, `git add <file>` always picks up its current on-disk content regardless of
how many times it changed before now, so this just works.

---

## Commit 1 — `docs: add phase-by-phase project plan`

The planning artifacts, written before any implementation, per the docs-first workflow.

```
docs/PLAN.md
docs/RESEARCH.md
docs/phases/phase-0-scaffold.md
docs/phases/phase-1-research.md
docs/phases/phase-2-linkedin-client.md
docs/phases/phase-3-resolver-parsers.md
docs/phases/phase-4-normalizer-schema.md
docs/phases/phase-5-api-layer.md
docs/phases/phase-6-observability-hardening.md
docs/phases/phase-7-testing.md
docs/phases/phase-8-deployment.md
docs/phases/phase-9-readme.md
docs/COMMIT_PLAN.md
```

## Commit 2 — `chore: scaffold project (Phase 0)`

Tooling, config, and the minimal Fastify server with a health check. Everything needed
for `pnpm install && pnpm dev` and `docker build` to work.

```
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig.json
vitest.config.ts
.gitignore
.dockerignore
.env.example
.nvmrc
Dockerfile
src/app.ts
src/server.ts
src/config/env.ts
src/routes/health.route.ts
tests/integration/health.test.ts
```

## Commit 3 — `feat: LinkedIn auth and HTTP client (Phase 2)`

The client layer that talks to LinkedIn — auth, headers, endpoints, retry/timeout, typed
errors. (Phase 1 produced no code — it's research captured entirely in `docs/RESEARCH.md`
from Commit 1 — so there's no separate Phase 1 commit here.)

```
src/errors/linkedin.errors.ts
src/linkedin/auth.ts
src/linkedin/headers.ts
src/linkedin/endpoints.ts
src/linkedin/client.ts
src/linkedin/requests/me.request.ts
src/linkedin/requests/component.request.ts
tests/unit/linkedin/auth.test.ts
tests/unit/linkedin/endpoints.test.ts
tests/unit/linkedin/client.test.ts
```

Note: `src/config/env.ts` already exists from Commit 2 — this commit modifies it to add
`LINKEDIN_LI_AT`/`LINKEDIN_JSESSIONID`. `git add src/config/env.ts` again here is correct;
it just stages the diff.

```
src/config/env.ts   (modified: + LINKEDIN_LI_AT, LINKEDIN_JSESSIONID)
```

## Commit 4 — `feat: Flight-stream parser and domain parsers (Phase 3)`

Parses LinkedIn's SDUI React-Flight-stream responses plus one parser per profile section.
Byte-verified against two real, decoded captures (both partially truncated — see
`docs/RESEARCH.md`); multi-entry/full-field coverage also exercised via generated,
clearly-labeled synthetic fixtures.

```
src/models/linkedin.types.ts
src/flight/flight-parser.ts
src/parsers/image.parser.ts
src/parsers/profile.parser.ts
src/parsers/experience.parser.ts
src/parsers/education.parser.ts
src/parsers/skills.parser.ts
src/parsers/certifications.parser.ts
src/parsers/languages.parser.ts
tests/fixtures/me-response.sample.json
tests/fixtures/me-response.minimal.json
tests/fixtures/flight/experience-response.real.txt
tests/fixtures/flight/experience-response.synthetic.txt
tests/fixtures/flight/education-certifications-response.real.txt
tests/fixtures/flight/education-certifications-response.synthetic.txt
tests/unit/flight/flight-parser.test.ts
tests/unit/parsers/image.parser.test.ts
tests/unit/parsers/profile.parser.test.ts
tests/unit/parsers/experience.parser.test.ts
tests/unit/parsers/education.parser.test.ts
tests/unit/parsers/skills.parser.test.ts
tests/unit/parsers/certifications.parser.test.ts
tests/unit/parsers/languages.parser.test.ts
```

## Commit 5 — `feat: normalizer and public Profile schema (Phase 4)`

Translates LinkedIn's own vocabulary into the public, Zod-validated API schema.

```
src/models/profile.types.ts
src/utils/date.util.ts
src/normalizer/profile.normalizer.ts
tests/unit/utils/date.util.test.ts
tests/unit/normalizer/profile.normalizer.test.ts
```

## Commit 6 — `feat: Fastify API layer with API-key auth and rate limiting (Phase 5)`

Wires everything behind `POST /v1/profile`. Includes the error-status-mapping handler —
built here rather than Phase 6 because Phase 5's own tests needed working error responses
(documented in that phase's doc).

```
src/utils/url.util.ts
src/middleware/api-key-auth.ts
src/middleware/error-handler.ts
src/services/linkedin.service.ts
src/services/profile.service.ts
src/controllers/profile.controller.ts
src/routes/profile.route.ts
tests/unit/utils/url.util.test.ts
tests/integration/profile.route.test.ts
```

Modified from earlier commits:
```
src/app.ts          (modified: register rate-limit + api-key hook + profile routes + error handler)
src/config/env.ts   (modified: + API_KEY, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
.env.example        (modified: document the new vars)
```

## Commit 7 — `feat: structured logging and secret redaction (Phase 6)`

Standalone logger for the LinkedIn-client layer (outside Fastify's request context),
shared redact config, and a dedicated error-handler test.

```
src/logger.ts
tests/unit/middleware/error-handler.test.ts
```

Modified from earlier commits:
```
src/app.ts             (modified: use shared REDACT_PATHS in Fastify's logger config)
src/linkedin/client.ts (modified: inject logger, log attempt/success/retry/error at each branch)
```

## Commit 8 — `test: full pipeline snapshot test (Phase 7)`

Consolidation pass — one test exercising the entire fixture → resolver → parsers →
normalizer → schema pipeline in one place, snapshot-asserted.

```
tests/integration/pipeline.test.ts
tests/integration/__snapshots__/pipeline.test.ts.snap
```

## Commit 9 — `docs: README with setup, API docs, approach, and known limitations`

No source changes — this is Phase 8 (Docker verified locally, no code changes needed
beyond what Commit 2 already had) and Phase 9 (README) landing together, since Phase 8
produced no additional diffs of its own.

```
README.md
```

---

## After these 9 commits

At this point `docs/PLAN.md` and every `docs/phases/*.md` file will have been staged
multiple times across commits 1–9, each time picking up its latest on-disk state — so by
Commit 9 they already reflect final status (Phases 0/2/4/5/6/7 done, Phases 1/3/8/9
partial, per `docs/PLAN.md`'s own legend). No separate "update docs" commit is needed
unless you edit them again after Commit 9.

**Still outside this plan, on purpose:** pushing to GitHub, creating the Render service,
and setting real environment variables there. Those are yours to do directly — see
`docs/phases/phase-8-deployment.md` for the remaining steps and why they need your
accounts/credentials rather than mine.
