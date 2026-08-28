# LinkedIn Profile API

A hosted HTTPS API that accepts a LinkedIn profile URL and returns structured JSON
(name, headline, experience, education, certifications, profile images) by talking
directly to LinkedIn's internal endpoints with an authenticated session — no headless
browser at request time.

**Live API:** _pending deployment — see [Known limitations](#known-limitations)_
**Source:** _pending public GitHub repo_

> ⚠️ **Read this before anything else**: LinkedIn's web client doesn't use the classic
> Voyager JSON API for profile data anymore — it uses a proprietary "SDUI" React Server
> Components streaming format, plus (for top-card fields specifically) plain
> server-rendered HTML. Both were fully reverse-engineered and confirmed via live,
> byte-level decoded captures (see [Approach](#approach)). One real gap remains: Skills has
> no confirmed source yet. See [Known limitations](#known-limitations) and
> [`docs/RESEARCH.md`](docs/RESEARCH.md) for the full, honest account of what's confirmed
> vs. assumed, and why.

## Table of contents
- [Setup](#setup)
- [Getting LinkedIn session cookies](#getting-linkedin-session-cookies)
- [API documentation](#api-documentation)
- [Approach](#approach)
- [Testing](#testing)
- [Known limitations](#known-limitations)

## Setup

Requires Node.js 20+ (`.nvmrc` pins `24.18.0`, the version this was built/tested against)
and [pnpm](https://pnpm.io) (`corepack enable && corepack prepare pnpm@latest --activate`
if you don't have it).

```bash
git clone <this-repo-url>
cd linkedin-profile-api
pnpm install
cp .env.example .env
# edit .env — see "Getting LinkedIn session cookies" below
pnpm dev
```

The server starts on `http://localhost:3000` (configurable via `PORT`).

```bash
curl http://localhost:3000/healthz
# {"status":"ok"}
```

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `3000` | HTTP port |
| `NODE_ENV` | no | `development` | `development` enables pretty-printed logs |
| `LOG_LEVEL` | no | `info` | Pino log level |
| `LINKEDIN_LI_AT` | for `/v1/profile` to work | — | LinkedIn session cookie |
| `LINKEDIN_JSESSIONID` | for `/v1/profile` to work | — | LinkedIn session cookie, also used to derive `csrf-token` |
| `API_KEY` | for `/v1/profile` to work | — | Shared secret clients must send as `x-api-key` |
| `RATE_LIMIT_MAX` | no | `100` | Max requests per window, per IP, on `/v1/*` |
| `RATE_LIMIT_WINDOW_MS` | no | `60000` | Rate-limit window in ms |

`/healthz` works with none of the LinkedIn/API key variables set. `/v1/profile` needs all
three of `LINKEDIN_LI_AT`, `LINKEDIN_JSESSIONID`, and `API_KEY` — without them you'll get
a clean `401`/`502` rather than a crash (see [API documentation](#api-documentation)).

### Docker

```bash
docker build -t linkedin-profile-api .
docker run --env-file .env -p 3000:3000 linkedin-profile-api
```

### Build & production start (without Docker)

```bash
pnpm build
pnpm start
```

## Getting LinkedIn session cookies

This API authenticates to LinkedIn using **your own account's session cookies** —
extracted manually from a real browser login, not an automated login script:

1. Log into [linkedin.com](https://www.linkedin.com) in a normal browser, with the
   account you want this API to use.
2. Open DevTools → **Application** (Chrome) / **Storage** (Firefox) tab → Cookies →
   `https://www.linkedin.com`.
3. Copy the value of the `li_at` cookie → `LINKEDIN_LI_AT` in your `.env`.
4. Copy the value of the `JSESSIONID` cookie (including the surrounding quotes, e.g.
   `"ajax:1234567890"`) → `LINKEDIN_JSESSIONID` in your `.env`.
5. Pick any secret string for `API_KEY` (e.g. `openssl rand -hex 32`).

**Never commit `.env` or paste real cookie values anywhere they might be logged or
shared** (chat, issue trackers, commit messages). These cookies are equivalent to your
LinkedIn password — treat them the same way. They also expire/rotate periodically, so
expect to repeat this process occasionally; a `401`/`502` from LinkedIn on a
previously-working setup is the first thing to check.

## API documentation

### `POST /v1/profile`

**Headers**
| Header | Required | Value |
|---|---|---|
| `Content-Type` | yes | `application/json` |
| `x-api-key` | yes | Your configured `API_KEY` |

**Body**
```json
{ "url": "https://www.linkedin.com/in/<public-identifier>/" }
```

Only `linkedin.com/in/<identifier>` URLs are accepted (trailing paths like
`/details/experience/` are tolerated and ignored). `/company/`, `/jobs/`, `/posts/`,
`/school/`, and non-LinkedIn URLs are rejected with `400`.

**Example response** (`200`, shape from `tests/integration/__snapshots__/pipeline.test.ts.snap`;
field availability depends on what the target profile has public/filled in, and on the
known gaps below):
```json
{
  "url": "https://www.linkedin.com/in/jordan-rivera-example/",
  "publicIdentifier": "jordan-rivera-example",
  "name": { "firstName": "Jordan", "lastName": "Rivera", "fullName": "Jordan Rivera" },
  "headline": "Senior Software Engineer at Example Corp",
  "location": { "raw": "San Francisco, California, United States", "city": "San Francisco", "country": "United States" },
  "image": { "url": "https://media.licdn.com/dms/image/v2/.../profile-displayphoto-..." },
  "backgroundImage": { "url": "https://media.licdn.com/dms/image/v2/.../profile-displaybackgroundimage-..." },
  "experience": [
    {
      "title": "Staff Engineer",
      "company": "Acme Corp · Full-time",
      "location": "Remote",
      "description": "Shipped the widget platform.",
      "startDate": "Jan 2023",
      "endDate": null
    }
  ],
  "education": [
    { "school": "State University", "degree": "B.S. Computer Science" }
  ],
  "skills": [],
  "certifications": [
    { "name": "Cloud Practitioner", "issuingOrganization": "Amazon Web Services", "issueDate": "Jan 2023" }
  ],
  "languages": [
    { "name": "English", "proficiency": "Native or bilingual proficiency" }
  ]
}
```

Fields LinkedIn doesn't expose for a given profile (privacy settings, empty section) are
omitted/`undefined` rather than fabricated — as is `about`, which has no confirmed source
at all yet, and `skills`, which has no confirmed componentId yet (see
[Known limitations](#known-limitations)). Dates are LinkedIn's own display text
(`"Jan 2023"`), not strict ISO — see [Known limitations](#known-limitations).

### Error responses

All errors share the shape `{ "error": { "code", "message", "requestId" } }`.

| Status | Code | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed body, or not a `linkedin.com/in/...` URL |
| 401 | `UNAUTHORIZED` | Missing/wrong `x-api-key` |
| 404 | `PROFILE_NOT_FOUND` | LinkedIn reported no such profile (or it's not visible to this account) |
| 429 | `RATE_LIMITED` | Either **your** requests to this API, or LinkedIn's own throttling of this API's outbound requests, tripped a limit. `Retry-After` header set when known. |
| 502 | `LINKEDIN_AUTH_ERROR` | This API's LinkedIn session is missing/expired/rejected — an operator problem, not the caller's |
| 502 | `UPSTREAM_ERROR` | LinkedIn returned something unexpected |
| 500 | `INTERNAL_ERROR` | Bug — message intentionally generic, details are server-side logs only |

### `GET /healthz`

No API key required. Returns `{ "status": "ok" }`.

## Approach

No headless browser at request time — but this isn't a plain REST client either, because
LinkedIn's own web client isn't one. Pipeline:

```
Route → Controller → ProfileService
                          │
                          ▼
                  LinkedInClient (auth/headers/retry/timeout)
                          │
      ┌───────────┬───────┴───────────┬──────────────────────┐
      ▼           ▼                   ▼                      ▼
GET /voyager  GET /in/<id>/    POST .../rsc-action/actions/component (× N sections)
/api/me       (server-rendered (React Server Components "Flight" stream)
(JSON, self   HTML)
only)              │                   │
      │            ▼                   ▼
      │   parseHtmlTopCard    flight-parser.ts: chunk split → $L reference resolution
      │   (regex over a                │
      │   stable componentkey          ▼
      │   anchor — no Flight  Domain parsers walk the resolved tree for
      │   parsing needed)     entity-collection-item-* nodes / named sections,
      │            │          pulling text out of <p> and Text-primitive nodes
      └──────┬─────┘                   │
             ▼                         ▼
                  Normalizer → public, Zod-validated Profile schema
```

Each layer only knows about the layer directly below it, and the public schema
(`src/models/profile.types.ts`) is deliberately decoupled from LinkedIn's internal field
names — see `docs/PLAN.md` and the per-phase docs in `docs/phases/` for the full design
rationale and a phase-by-phase build log (this project was built docs-first: a plan doc
per phase, each with explicit acceptance criteria, checked off as it was verified).

**How the reverse-engineering was actually done.** Using a real logged-in browser session
and DevTools' Network tab. The obvious approach — filter for `voyager` requests and look
for a full-profile call — dead-ended: live capture only ever caught `/voyager/api/me` (an
identity-check call fired on every page load, self-view only, no way to target another
profile) plus one unrelated call. Reading the profile page's raw HTML source explained
why: LinkedIn's current web client ships a proprietary **Server-Driven UI (SDUI)**
framework built on React Server Components. The page embeds a serialized RSC "Flight"
stream (`window.__como_rehydration__`) instead of either server-rendered HTML or a JSON
data blob, and each below-the-fold section (Experience, Education, etc.) is fetched
lazily as **another Flight stream**, not a Voyager JSON call.

The real mechanism, confirmed by decoding actual captured response bytes
(`base64 -d` + byte-level string verification, not screenshot-inference — see
`docs/RESEARCH.md` for the full log including a couple of self-corrections along the way):
- `POST /flagship-web/rsc-action/actions/component?componentId=<id>&sduiid=<id>` — one
  generic dispatcher for every section, parameterized by `componentId`. Confirmed
  component IDs: `profileCardsExperienceOnly` (Experience),
  `profileCardsBelowActivityPart1WithoutExp` (Education + Certifications), and
  `profileCardsBelowActivityPart4` (Languages + Organizations).
- The response is a newline-separated chunk stream (`<chunkId>:<payload>`), where string
  values shaped `"$L<chunkId>"` are lazy references resolved recursively, and the actual
  rendered text lives in `children` of `<p>` elements or `textProps.children` of a
  Text-primitive wrapper component — `src/flight/flight-parser.ts` implements exactly
  this: chunk splitting, reference resolution (memoized, cycle-safe), and tree-walking
  helpers the domain parsers use to find sections/entries and pull out their text.
- Two independent real captures were decoded and byte-verified this way (Experience:
  title/company/dates/location for one real position; Education: school + degree). Both
  captures turned out to be **partially truncated** — one cut off cleanly at the end
  (later entries' chunks never arrived), the other has a corrupted bracket partway through
  a chunk — most likely from copy-pasting very large response bodies through chat, not a
  flaw in the format itself. This is documented transparently in `docs/RESEARCH.md`
  rather than papered over, including one instance where an earlier note about
  Certifications field values (`"Sparkathon"`/`"Walmart"`) turned out to not be
  substantiated by the actual bytes and was corrected.

A second, unrelated discovery closed the general top-card gap: the profile page's raw HTML
(`GET /in/<publicIdentifier>/`, byte-verified against a real capture) server-renders
name/headline/location as plain, directly-readable text at a stable position — no Flight
parsing needed for these fields at all, and it works for **any** public identifier, unlike
`/me`. `/voyager/api/me` is still used alongside it, but only for
firstName/lastName-split and sized profile/background images, which remain self-view-only
— see [Known limitations](#known-limitations) for exactly what's still missing (Skills;
`about`).

## Testing

```bash
pnpm test
```

98 tests across 19 files: the Flight-stream parser (chunk splitting, reference resolution,
cycle/missing-chunk handling, tree-walking — including tests run directly against the
real, byte-captured fixtures in `tests/fixtures/flight/`), the HTML top-card extractor
(against a real captured profile page fixture), every domain parser, the normalizer,
URL/date utilities, the LinkedIn client's retry/timeout/error-mapping logic (mocked
`fetch`, no real network calls), the central error handler, the manual-test dashboard
route, and the full HTTP route (Fastify's `inject()`, with the LinkedIn data source
mocked) — plus a snapshot test of the entire sources → Flight parser/HTML extraction →
domain parsers → normalizer → schema pipeline in one place. No test in this suite makes a
live call to linkedin.com or requires real credentials.

`pnpm typecheck` runs a strict `tsc --noEmit` pass separately from the test suite.

## Known limitations

- ~~Top-card fields are only reliable for the account's own profile~~ — **fixed
  (2026-08-29): `fullName`/`headline`/`location` are now server-rendered directly in the
  public profile page's HTML** (`GET /in/<publicIdentifier>/`, confirmed real, byte-decoded
  from a live capture — see `docs/RESEARCH.md`), which works for **any** public
  identifier, not just the configured account's own profile. `firstName`/`lastName` (split)
  and sized `image`/`backgroundImage` still come from `/voyager/api/me` and remain
  self-view-only — for a different profile, `name.fullName` will be populated but
  `name.firstName`/`name.lastName`/`image`/`backgroundImage` will be empty. `about` still
  has no confirmed source.
- **Skills is always an empty array.** No SDUI `componentId` for this section has been
  captured yet. **Languages now has a confirmed componentId** (`profileCardsBelowActivityPart4`,
  combined with Organizations) and a real implementation, but the one real capture
  available has no languages listed on that profile, so the exact field order is a
  structural inference by analogy (same pattern as Experience/Education), not
  byte-verified — see `docs/RESEARCH.md`.
- ~~Certifications field order is a structural inference, not byte-verified~~ — **confirmed
  correct by a live end-to-end smoke test** (2026-08-28, developer's own profile via the
  dashboard): real values (`Sparkathon · Walmart · Sep 2024`) came back correctly. The
  positional pattern was inferred by analogy before this; it's now verified against a real
  running server, just not against raw decoded bytes the way Experience/Education are.
- **Dates are LinkedIn's own display text, not strict ISO.** SDUI responses give a single
  pre-formatted string (e.g. `"Feb 2025 - Jun 2026 · 1 yr 5 mos"`) rather than structured
  `{month, year}` fields. `startDate`/`endDate` are the split display text
  (`"Feb 2025"`/`"Jun 2026"`) rather than `"2025-02"` — converting further would require a
  month-name lookup table with no real edge-case data to validate it against.
- **Only tested against the configured account's own profile.** A full live smoke test
  (real server, real cookies, real profile) confirmed top-card, Experience (4 entries),
  Education (2 entries), and Certifications all work correctly end-to-end — but only for
  the account's own profile. The Experience/Education POST requests are parameterized by a
  `vanityName` field that structurally should generalize to any public profile, but this
  hasn't been verified against a different one yet.
- **ToS risk.** This uses a personal LinkedIn account's session cookie server-side to
  access profile data programmatically, which is against LinkedIn's Terms of Service.
  Heavy or public use risks that account being rate-limited, challenged, or restricted.
  This project includes inbound rate limiting and outbound request throttling/backoff as
  mitigations, not guarantees.
- **Cookies expire and rotate.** `LINKEDIN_LI_AT`/`LINKEDIN_JSESSIONID` will periodically
  need to be re-extracted by hand (see [Getting LinkedIn session cookies](#getting-linkedin-session-cookies)).
  A previously-working deployment suddenly returning `502 LINKEDIN_AUTH_ERROR` is the
  first thing to check.
- **LinkedIn-layer logs aren't correlated with the HTTP request ID.** `LinkedInClient`
  logs through a standalone Pino instance (it has no Fastify request context); its logs
  can be cross-referenced with the HTTP-layer logs by timestamp and the profile's public
  identifier, but not by `reqId`.
- **No caching layer.** Every request re-fetches from LinkedIn; Redis caching was
  explicitly scoped as optional/stretch and wasn't built. Repeated requests for the same
  profile in quick succession will each hit LinkedIn (three calls: `/me` + two component
  POSTs).
- **Some sections may be incomplete depending on the target profile's privacy settings**
  — hidden connections-only content, etc. will come back `undefined`/empty rather than
  erroring, per this project's "never fabricate values" design choice, but that also means
  the API can't distinguish "this section doesn't exist" from "this section exists but
  isn't visible to this account."
- **`parentSpanId` (a per-request tracing token in the component POST) is generated
  client-side and not confirmed to matter.** Unknown whether LinkedIn validates it
  server-side; a fresh random value is sent per request to mimic real browser behavior.
- **Deployment cold-start behavior on Render's free/starter tier** (if used) hasn't been
  characterized yet — to be filled in once actually deployed.
# linkedin_scrapper
