# Phase 9 — README & Submission Polish

Status: **Mostly done.** README written and secrets/dead-code audit complete. What's left
(live URL, GitHub-public confirmation, final commit/tag) is downstream of Phase 8's
remaining developer-only steps.

## Goal
A README that lets a reviewer set up, run, and understand the project without any other
context, plus a final pass confirming every submission requirement is met.

## Prerequisites
Phase 8 done (need a live URL and real deploy experience to document accurately).

## Steps

1. Write `README.md`:
   - **Overview** — one paragraph on what it does.
   - **Live API** — the public HTTPS base URL, and that requests need `x-api-key`.
   - **Setup instructions** — clone, `pnpm install`, copy `.env.example` → `.env`, how to
     obtain `LINKEDIN_LI_AT`/`LINKEDIN_JSESSIONID` (step-by-step DevTools instructions),
     `pnpm dev`, `pnpm test`, `docker build`/`docker run`.
   - **API documentation** — `POST /v1/profile`, headers, request body, full example
     response JSON (from a real or sanitized real call), error response shapes and codes.
   - **Approach** — summarize the architecture (link to `docs/PLAN.md` and
     `docs/RESEARCH.md` for depth): reverse-engineering method, why no browser/DOM
     dependency, resolver/parser/normalizer pipeline, why the public schema is decoupled
     from LinkedIn's internal shape.
   - **Known limitations** — pull directly from `docs/RESEARCH.md` and this plan's
     "Known constraints" section: ToS risk, cookie expiry requiring manual re-extraction,
     fields that are sometimes missing depending on profile privacy settings, rate limits
     (both LinkedIn's and this API's own), Render cold-start latency if observed.
   - **Testing** — how to run `pnpm test`, what's covered (fixture-based, no live calls).
2. Final secrets audit: re-run `git log --all --full-history --source -- .env` and grep
   the full history for any pasted cookie/API-key values that might have made it into a
   commit message or code comment during development.
3. Confirm `.env.example` lists every env var actually used, with placeholder values only.
4. Trim dead code/unused deps accumulated across phases (`pnpm depcheck` or manual review).
5. Final read-through of every phase doc — confirm all checkboxes in `docs/PLAN.md` are
   ticked, or explicitly note anything intentionally deferred and why.
6. Tag a release / final commit, confirm the GitHub repo is public and the README renders
   correctly on GitHub.

## Files touched
`README.md` (new/finalized), possibly `.env.example` corrections, minor cleanup diffs
across the codebase.

## Acceptance criteria
- [x] A reviewer with no prior context can clone the repo and get it running locally from
      the README alone (setup, env vars, cookie-extraction steps, Docker, and test
      instructions are all in `README.md`).
- [ ] **Needs Phase 8**: README documents the live HTTPS URL and exact `curl` example to
      call it (currently a placeholder — `curl` examples for local/Docker use are there
      now, the live one slots in once deployed).
- [x] README explicitly lists known limitations (ToS/risk, cookie expiry, the unconfirmed
      profile endpoint, the location-parsing heuristic, missing request-ID correlation in
      LinkedIn-layer logs, no caching, field availability variance, cold-start caveat).
- [x] No secrets anywhere in the repo or its history — audited via `git log --all
      --full-history -- .env` (empty) and a full-history grep for `li_at=`/`JSESSIONID=`
      patterns (empty, aside from the env var *names* which are fine to reference).
- [x] `docs/PLAN.md` fully reflects final status of every phase, including the `[~]`
      partial ones and why.

## Tests
None new — this is documentation and audit only.

## Notes / decisions log
- Secrets audit found nothing to scrub: this repo has **zero commits** as of this phase
  (everything is still untracked/uncommitted by design — commits are made only when
  explicitly requested), so there was no history that could contain a leaked secret in
  the first place. Worth re-running this same audit after the first real commit and
  before making the repo public, as a habit rather than a one-time check.
- Dependency audit: every declared `dependencies`/`devDependencies` entry in
  `package.json` is actually imported/used somewhere in `src/` (`fastify`, `zod`, `pino`,
  `@fastify/rate-limit`) or used as build/dev tooling (`pino-pretty` referenced as a
  transport target string, `tsx`, `typescript`, `vitest`, `@types/node`) — nothing to trim.
- README's example response JSON is taken directly from the committed test snapshot
  (`tests/integration/__snapshots__/pipeline.test.ts.snap`), not hand-typed, so it can't
  drift from what the code actually produces without the snapshot test also failing.
- What's left for you specifically: finish Phase 8's remaining steps (GitHub push, Render
  deploy, real cookies), then come back and fill in the README's "Live API" line and this
  phase's live-URL acceptance box.
