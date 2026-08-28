# Phase 3 — Flight-Stream Parser & Domain Parsers

Status: **Reworked against real, byte-verified captures.** Originally built against a
synthetic Voyager-shaped fixture (see git history / `docs/COMMIT_PLAN.md`'s original
Commit 4 description); superseded once Phase 1's continued research (see
`docs/RESEARCH.md`) proved the assumed Voyager profile endpoint doesn't exist — LinkedIn's
web client uses a proprietary SDUI/"Flight stream" format instead. This doc now describes
the reworked, real implementation.

## Goal
Turn LinkedIn's raw responses into structured, LinkedIn-shaped (but no longer
graph/stream-shaped) objects per section: profile top card, experience, education,
certifications, languages (skills: documented gap, see below). Still in LinkedIn's
vocabulary at this point — translation to *our* public schema is Phase 4.

**Update (2026-08-29):** general (non-self) top-card data and a real Languages
componentId were both confirmed live after this phase's initial rework — see the
dedicated section below and `docs/RESEARCH.md`.

## What changed from the original plan
The original plan assumed one Voyager JSON response with a `data`/`included[]` URN graph,
resolved by a generic `EntityResolver`. Real capture disproved this for anything besides
`/voyager/api/me`:
- `/voyager/api/me` **is** classic Voyager-shaped and still used, but only for the
  account's own top-card fields (no vanityName parameter — see README's known
  limitations).
- Experience and Education/Certifications come from `POST
  .../rsc-action/actions/component?componentId=<id>` — a React Server Components "Flight"
  stream, not JSON. `EntityResolver` (URN → Map) doesn't apply here at all; it's been
  deleted and replaced with `src/flight/flight-parser.ts`.

## Prerequisites
Phase 2 done (client can fetch both `/me` JSON and Flight-stream component text),
`docs/RESEARCH.md`'s wire-format spec available for reference.

## Steps

1. `src/flight/flight-parser.ts` — the Flight-stream parser, replacing `EntityResolver`:
   - `parseFlightChunks(body)`: splits a response into a `Map<chunkId, payload>`, skipping
     unparseable lines rather than throwing.
   - `resolveFlightNode(node, chunks)`: recursively replaces `"$L<chunkId>"` references
     with their resolved value. Memoized (a chunk always resolves the same way everywhere
     it's referenced) and cycle-safe (tracks in-progress chunks, bails out rather than
     hanging on a malformed/adversarial response).
   - `parseFlightResponse(body)`: the above two, starting from confirmed-root chunk `"0"`.
   - `findComponentsByComponentKey(node, predicate)` / `findSectionByKeySuffix(tree, suffix)`:
     tree-walking helpers to locate `entity-collection-item-*` entries or named section
     roots (`...EducationTopLevelSection`, matched by suffix since the prefix is a
     per-profile URN hash).
   - `collectParagraphTexts(node)`: DFS collecting text from the two confirmed
     text-bearing shapes — literal `<p>` elements and Text-primitive wrapper components
     (`props.textProps.children`) — in document order.
2. `src/models/linkedin.types.ts` — reduced to just the `/me` Voyager shapes
   (`LinkedInVectorImage`/`LinkedInVectorArtifact`/`LinkedInMiniProfileEntity`/
   `LinkedInMeResponse`). The Flight-stream side works against `unknown` resolved trees
   rather than a static interface, since its shape is walked structurally, not typed.
3. `src/parsers/profile.parser.ts` — resolves `/me`'s `data['*miniProfile']` pointer
   against `included[]` by `entityUrn` (a small inline lookup — no longer needs a general
   `EntityResolver` since this is the only remaining URN resolution in the codebase).
4. `src/parsers/experience.parser.ts` — finds `entity-collection-item-*` nodes anywhere in
   the resolved Experience tree, takes each one's paragraph texts in the confirmed
   positional order (title → company/employment-type → date range → location → bullets).
5. `src/parsers/education.parser.ts` — finds the `...EducationTopLevelSection` root, then
   either its `entity-collection-item-*` children (multi-entry) or falls back to treating
   the whole section as one entry (confirmed real-world case: a single education entry
   gets no item wrapper at all).
6. `src/parsers/certifications.parser.ts` — same pattern via `...CertificationTopLevel`.
   Positional order (name → issuer → issued-date) was inferred by analogy (the one real
   byte-decoded capture is truncated before any certification entries are defined) and
   shipped flagged as unverified — **since confirmed correct by a live end-to-end smoke
   test** (real server, real profile, real `Sparkathon · Walmart · Sep 2024` came back
   correctly). See `docs/RESEARCH.md`.
7. `src/parsers/skills.parser.ts` — returns `[]`. No SDUI `componentId` for this section
   has been captured; returning empty rather than guessing at an unconfirmed shape.
8. `src/parsers/languages.parser.ts` — confirmed componentId
   (`profileCardsBelowActivityPart4`, combined with Organizations in the same response;
   see "Update (2026-08-29)" below), implemented via the same
   `findSectionByKeySuffix`/`entity-collection-item-*` pattern as Education. Positional
   field order (name → proficiency) is inferred by analogy, not byte-verified — the one
   real capture available has no languages listed on that profile.
9. `src/parsers/image.parser.ts` — unchanged; still valid for `/me`'s `picture`/
   `backgroundImage` (same `rootUrl` + `artifacts[]` shape confirmed live).
10. Every parser must **degrade gracefully**: missing/unreachable data (including a chunk
    that's absent from a truncated capture) produces an empty array/`undefined`, never a
    thrown exception.

## Update (2026-08-29): general top-card HTML source + Languages componentId

Two follow-up captures closed real gaps left open by the initial rework:

- **`src/parsers/profile.parser.ts`'s `parseHtmlTopCard(html)`** — the profile page's raw
  HTML (`GET /in/<publicIdentifier>/`) server-renders `fullName`/`headline`/`location`
  directly as plain text, byte-verified against a real capture
  (`tests/fixtures/topcard-page.real.html`). No Flight-stream parsing needed for these
  fields at all — a simple regex anchored on `componentkey="...Topcard"` finds the `<h2>`
  (name) and the first three `<p>` tags (headline, company/school summary — unused,
  location) in document order. This works for **any** public identifier, unlike `/me`.
  `src/services/profile.service.ts` merges this with `/me`'s output: firstName/lastName
  split and sized images stay `/me`-sourced (self-view only); `fullName`/`headline`
  (preferred)/`location` come from the HTML.
- **`SDUI_COMPONENT_IDS.languagesAndOrganizations`** confirmed:
  `profileCardsBelowActivityPart4` returns Languages and Organizations combined (mirroring
  how `profileCardsBelowActivityPart1WithoutExp` combines Education + Certifications).
  Section suffix confirmed as `LanguageTopLevel` (no trailing `Section`, unlike
  `EducationTopLevelSection`). The real capture
  (`tests/fixtures/flight/languages-organizations-response.real.txt`) is genuinely
  complete and well-formed, but both sections are empty for that profile — confirms the
  componentId/suffix, not the field order for a populated entry.
- Still not found: a Skills componentId (likely `Part2` or `Part7`, neither captured with
  a real request/response pair), and an "About" source.

## Files touched
`src/flight/flight-parser.ts` (new), `src/models/linkedin.types.ts`, `src/parsers/*.ts`
(all rewritten except `image.parser.ts`), `src/resolver/entity-resolver.ts` (deleted),
`src/linkedin/requests/profile-page.request.ts` (new), `src/linkedin/client.ts` (+
`getProfilePage`), `src/services/linkedin.service.ts` (+ `profilePage`/
`languagesAndOrganizations` sources), `src/services/profile.service.ts` (merges `/me` +
HTML top-card).

## Acceptance criteria
- [x] `findComponentsByComponentKey`/`collectParagraphTexts` extract the real, byte-verified
      Cybership experience entry (title/company/dates/location) exactly from the real
      captured response — not a synthetic fixture.
- [x] Multi-entry and single-entry (no item-wrapper) cases both produce correct results
      against a structurally-faithful synthetic fixture.
- [x] Running parsers against an empty/malformed tree doesn't throw — returns empty
      array/`undefined`.
- [x] `resolveFlightNode` doesn't hang on a self-referencing cycle, and doesn't crash on a
      reference to a chunk that's missing from a truncated capture.

## Tests
- [x] `tests/unit/flight/flight-parser.test.ts` — chunk parsing, reference resolution
      (including cycle and missing-chunk cases), tree-walking helpers, and dedicated tests
      run directly against the real fixtures in `tests/fixtures/flight/` (17 tests).
- [x] `tests/unit/parsers/*.test.ts` — one file per parser, each against a synthetic
      structurally-faithful fixture and (experience/education/languages) the real captured
      fixture.
- [x] `tests/unit/parsers/profile.parser.test.ts`'s `parseHtmlTopCard` suite — against the
      real captured `tests/fixtures/topcard-page.real.html`.
- [x] `tests/integration/pipeline.test.ts` — full pipeline including the real HTML
      top-card fixture merged with the synthetic `/me` fixture, proving the merge-override
      behavior (HTML wins for `fullName`/`headline`/`location`).

## Notes / decisions log
- **Real, byte-verified fixtures exist but are partial.**
  `tests/fixtures/flight/experience-response.real.txt` and
  `education-certifications-response.real.txt` are genuine captured LinkedIn response
  bodies (`base64 -d`'d and grepped for expected real strings, not inferred from a
  screenshot). Both turned out to be truncated — see `docs/RESEARCH.md` for the full
  account, including a correction where an earlier claim about Certification field values
  wasn't actually substantiated by the bytes and was removed. For full end-to-end
  multi-entry test coverage, `tests/fixtures/flight/*.synthetic.txt` fixtures were
  generated (via a small script, not hand-typed, to avoid the exact kind of bracket
  corruption found in one of the real captures) — clearly labeled synthetic, structurally
  modeled on the confirmed real shape.
- Deliberately kept parser output in **LinkedIn's own vocabulary** — that translation is
  Phase 4's job (Normalizer).
- `parseImage` unchanged from the original Phase 3 build — its logic (largest-`width`
  artifact, `rootUrl + fileIdentifyingUrlPathSegment`) turned out to still be exactly
  right for `/me`'s confirmed real shape.
