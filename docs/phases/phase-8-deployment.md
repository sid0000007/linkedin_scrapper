# Phase 8 — Dockerization & Deployment (Render)

Status: **Partially done** — everything I can verify locally is done and passing. Steps
4–9 need you directly (your GitHub account, your Render account, your real LinkedIn
cookies) — see Notes for exactly what's left and why I can't do it for you.

## Goal
The API is reachable over public HTTPS at a stable URL, running from the production
Dockerfile, with real (the developer's own) LinkedIn cookies and a real API key set as
Render environment variables — never in the repo.

## Prerequisites
Phase 7 done (tests passing gives confidence before deploying), Phase 0's Dockerfile
skeleton exists.

## Steps

1. Finalize `Dockerfile`:
   - Multi-stage: `deps` (install with pnpm, cached layer) → `build` (`pnpm build`) →
     `runtime` (slim Node image, copy only `dist/` + `node_modules` production deps +
     `package.json`), non-root user, `EXPOSE $PORT`, `CMD ["node", "dist/server.js"]`.
2. `.dockerignore` — exclude `node_modules`, `.env`, `docs/`, `tests/`, `.git`.
3. Local production-parity check: `docker build -t linkedin-profile-api .` then
   `docker run --env-file .env -p 3000:3000 linkedin-profile-api`, confirm `/healthz` and
   a real `/v1/profile` call both work from the container.
4. Push the repo to a **public** GitHub repository (per submission requirements) —
   double-check `.env` was never committed in any prior commit (`git log --all
   --full-history -- .env`); if it was, that history needs scrubbing before making the
   repo public.
5. Create a Render Web Service from the GitHub repo, Docker runtime.
6. Set Render environment variables: `LINKEDIN_LI_AT`, `LINKEDIN_JSESSIONID`, `API_KEY`,
   `PORT` (Render sets this automatically — confirm `server.ts` reads `process.env.PORT`),
   `LOG_LEVEL`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`. Never in a committed file.
7. Deploy, confirm Render's auto-provisioned HTTPS URL serves `/healthz`.
8. Run a real end-to-end call against the deployed URL: `POST /v1/profile` with the API
   key header and a real profile URL, confirm a full structured JSON response.
9. Sanity-check Render's free/starter tier cold-start behavior — note in README if the
   first request after idle is slow, so a reviewer isn't confused.

## Files touched
`Dockerfile` (finalized), `.dockerignore`, no application code changes expected unless a
deployment-only bug surfaces (e.g. PORT binding).

## Acceptance criteria
- [x] `docker build` succeeds; `docker run` serves `/healthz` (200).
- [x] Containerized `/v1/profile` correctly enforces the API key (401 without it).
- [x] Containerized `/v1/profile` correctly surfaces `LinkedInAuthError` as 502 when no
      LinkedIn cookies are configured (proves the full stack — Fastify, error handler,
      LinkedIn client, logging/redaction — works identically inside the container as it
      does under `pnpm dev`/Vitest).
- [ ] **Needs you**: Public HTTPS URL responds to `GET /healthz` with 200.
- [ ] **Needs you**: Public HTTPS URL responds to `POST /v1/profile` (with correct API
      key and real LinkedIn cookies) with a full, correct `Profile` JSON for a real
      profile.
- [ ] **Needs you**: Requests without the API key are rejected (401) on the live
      deployment too.
- [ ] **Needs you**: No secret values appear anywhere in the GitHub repo, including git
      history. (Locally confirmed: `.env` was never committed — `git status`/`git log`
      show no `.env` in this repo's history so far, and `.gitignore` has excluded it from
      commit #1.)
- [ ] **Needs you**: GitHub repo is public.

## Tests
No new automated tests — this phase is verified by manual `curl` calls, both locally
against the Docker container (done, see below) and against the live URL once deployed
(pending).

## Notes / decisions log
- **Local production-parity check — done and passing.** Built `linkedin-profile-api`
  from the finalized `Dockerfile`, ran it with `PORT=3000`, `API_KEY=<test>`,
  `NODE_ENV=production`, no LinkedIn cookies set, and confirmed:
  - `GET /healthz` → 200
  - `POST /v1/profile` without `x-api-key` → 401
  - `POST /v1/profile` with a valid key but no LinkedIn cookies configured → 502
    `LINKEDIN_AUTH_ERROR`, with clean structured logs (request ID present, no secrets,
    matches Phase 6's redaction design) — confirms the whole stack behaves identically
    in the container as it does locally.
- Had to add `pnpm-workspace.yaml` to the Dockerfile's `COPY` lines in both the `deps` and
  `runtime` stages (alongside `package.json`/`pnpm-lock.yaml*`) — pnpm's
  `onlyBuiltDependencies`/`allowBuilds` config (needed for `esbuild`'s postinstall, a
  transitive `vitest` dependency) lives in that file; without copying it, `pnpm install
  --frozen-lockfile` fails inside the image the same way it did locally before that file
  existed (see Phase 0's notes for the full story).
- **What's left, and why it needs you specifically, not me:**
  - *Pushing to a public GitHub repo* — requires your GitHub account/authentication. I can
    run `git` commands and even `gh repo create`/`gh push` if you want, but creating a
    **public** repo and pushing code is a visible, hard-to-fully-reverse action I should
    not take without you explicitly asking me to, in this conversation.
  - *Creating the Render Web Service and setting real environment variables* — requires
    your Render account, billing/plan decisions, and pasting your real, freshly-rotated
    `LINKEDIN_LI_AT`/`LINKEDIN_JSESSIONID` directly into Render's dashboard (never into
    this chat, per the credential-hygiene incident in Phase 1).
  - *The actual live end-to-end verification with a real profile* — needs both of the
    above plus real LinkedIn cookies, so it's downstream of them.
