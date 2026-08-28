# Phase 0 — Scaffold & Tooling

Status: **Done**

## Goal
A running Fastify + TypeScript server with a health check, proper tooling (pnpm, tsconfig,
eslint/prettier optional, vitest wired), Docker skeleton, and a `.gitignore` that keeps
secrets out from commit #1.

## Prerequisites
None — this is the first phase.

## Steps

1. `pnpm init`, set `"type": "module"`, add `.nvmrc`/`engines` for Node version.
2. Install deps:
   - runtime: `fastify`, `zod`, `pino`, `pino-pretty` (dev), `@fastify/rate-limit`
   - dev: `typescript`, `tsx` (dev run), `vitest`, `@types/node`, `tsc-alias` or path-friendly build setup
3. `tsconfig.json` — strict mode on, ES2022 target, `moduleResolution: bundler` or `NodeNext`.
4. Create folder skeleton (empty barrel files where useful):
   ```
   src/
     app.ts            # builds and returns the Fastify instance (no .listen())
     server.ts         # imports app.ts, calls .listen(), reads PORT
     config/env.ts      # Zod-validated env schema
     routes/
     controllers/
     services/
     linkedin/
       requests/
     resolver/
     parsers/
     models/
     utils/
     errors/
     middleware/
   tests/
     unit/
     integration/
     fixtures/
   ```
5. `src/config/env.ts` — Zod schema for env vars (even if most are added in later phases,
   stub: `PORT`, `LOG_LEVEL`, `NODE_ENV`). Fail fast with a clear error if required vars
   are missing.
6. `src/app.ts` — Fastify instance with Pino logger wired, a `GET /healthz` route returning
   `{ status: "ok" }`.
7. `src/server.ts` — starts the app on `PORT` (default 3000).
8. `package.json` scripts: `dev` (tsx watch), `build` (tsc), `start` (node dist/server.js),
   `test` (vitest run), `test:watch`.
9. `.env.example` — documents every env var that will ever be needed (populated
   incrementally in later phases; today just `PORT`, `LOG_LEVEL`).
10. `.gitignore` — `node_modules`, `dist`, `.env`, `.env.*.local`, coverage output, `.DS_Store`.
11. `Dockerfile` skeleton (multi-stage: build → slim runtime), `.dockerignore`. Doesn't need
    to be production-final yet — that's Phase 8 — but should build and run `/healthz` today.
12. Initialize git repo, first commit.

## Files touched
`package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `Dockerfile`,
`.dockerignore`, `src/app.ts`, `src/server.ts`, `src/config/env.ts`, empty directories for
the rest of `src/`.

## Acceptance criteria
- [x] `pnpm install && pnpm dev` boots the server locally.
- [x] `curl localhost:3000/healthz` returns `200 { "status": "ok" }`. (verified on an
      alternate port locally — port 3000 was occupied by an unrelated process on the dev
      machine)
- [x] `pnpm build && pnpm start` works from compiled output.
- [x] `docker build . && docker run -p 3000:3000 <image>` serves `/healthz`.
- [x] `git status` shows no `.env`, `node_modules`, or `dist` tracked.
- [x] `pnpm test` runs (even with zero tests) without error. (1 test — health smoke test
      — passes)

## Tests
- Smoke test: `tests/integration/health.test.ts` — boots `app.ts` via Fastify's `inject()`,
  asserts `/healthz` returns 200. This is the first real test and proves the test harness
  works before any LinkedIn logic exists.

## Notes / decisions log
- Used **CommonJS** (`module: CommonJS`, `moduleResolution: Node`) instead of native ESM
  to avoid Node's mandatory `.js` extension requirement on relative imports under
  NodeNext — simpler and less error-prone for a project this size.
- Node version pinned via `.nvmrc` to `24.18.0` (only Node versions available locally
  were `17.9.1` and `24.18.0` via nvm; `24.18.0` was chosen for modern tooling
  compatibility).
- pnpm (11.24.0, via corepack) requires an explicit `pnpm-workspace.yaml` with
  `allowBuilds.esbuild: true` / `onlyBuiltDependencies: [esbuild]` — pnpm blocks
  dependency postinstall scripts by default (esbuild's postinstall fetches its native
  binary, needed transitively by vitest). Without this, `pnpm install --frozen-lockfile`
  fails in CI/Docker with `ERR_PNPM_IGNORED_BUILDS`. `pnpm-workspace.yaml` must also be
  copied into every Docker stage that runs `pnpm install`.
- Local port 3000 was already occupied by an unrelated process on the dev machine;
  verified the server via `PORT=3050`/`3051` instead. No code impact — `PORT` is already
  configurable via env.
