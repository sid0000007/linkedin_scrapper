# Phase 4 — Normalizer & Public Schema

Status: **Done, reworked once Phase 3's real data source changed.** The public
`Profile`/`Experience`/`Education`/etc. Zod schemas below turned out to need almost no
changes — see Phase 3's doc for why the *source* of this data changed completely (SDUI
Flight streams instead of Voyager JSON). What did change is `date.util.ts` (LinkedIn gives
pre-formatted display strings now, not `{year, month}` objects) and `location`/`about`
(no confirmed source at all currently — see README's known limitations).

## Goal
Define *our* public API contract (independent of LinkedIn's internal schema) and convert
Phase 3's LinkedIn-shaped parser output into it. This is what protects the API from
LinkedIn changing their internal field names/structure later.

## Prerequisites
Phase 3 done.

## Steps

1. `src/models/profile.types.ts` — Zod schemas (source of truth) + inferred TS types for
   the public response shape:
   - `Profile` (id/urn if available, `url`, `name: {firstName, lastName, fullName}`,
     `headline`, `location: {raw, city?, country?}`, `about`, `image: {url}`,
     `backgroundImage?: {url}`, `experience: Experience[]`, `education: Education[]`,
     `skills: Skill[]`, `certifications: Certification[]`, `languages: Language[]`)
   - `Experience`, `Education`, `Skill`, `Certification`, `Language` — per the shapes
     sketched in the architecture doc (e.g. `Experience: {title, company, companyUrl?,
     location?, description?, startDate?, endDate?}`).
2. `src/utils/date.util.ts` — `parseDateRangeText`/`parseIssuedText` split LinkedIn's
   pre-formatted display strings (e.g. `"Feb 2025 - Jun 2026 · 1 yr 5 mos"`,
   `"Issued Sep 2024"`) into `startDate`/`endDate`/`issueDate` fields. Kept as LinkedIn's
   own display text (`"Feb 2025"`) rather than converting to ISO — see notes below.
3. `src/normalizer/profile.normalizer.ts` (or fold into each parser — decide based on how
   it reads cleaner) — pure functions mapping Phase 3 output → the Zod schema shape above.
   No I/O, no LinkedIn client calls here — pure data transformation, easy to unit test.
4. Final assembly function: `normalizeProfile(parsedSections, sourceUrl): Profile` — calls
   `ProfileSchema.parse()` (or `.safeParse()` with explicit handling) before returning, so
   a malformed normalization fails loudly in tests rather than silently shipping bad data.
5. Fields LinkedIn doesn't expose for a given profile (privacy settings, section not
   filled in) should be `undefined`/omitted, not empty strings or fabricated values.

## Files touched
`src/models/profile.types.ts`, `src/utils/date.util.ts`, `src/normalizer/*.ts`.

## Acceptance criteria
- [x] `normalizeProfile()` run against Phase 3's fixture-derived output produces an object
      that passes `ProfileSchema.parse()` (it calls `.parse()` internally and returns the
      validated result — can't return an invalid shape by construction).
- [x] Optional/missing sections normalize to `undefined`/`[]`, never throw (verified via
      the minimal fixture).
- [x] Date normalization splits a combined display-text range into start/end text, strips
      the trailing duration annotation (`· 1 yr 5 mos`), and treats `"Present"` (LinkedIn's
      "current" marker) as an undefined `endDate`.
- [x] The public schema contains no LinkedIn-internal field names (`entityUrn`,
      `dateRange`, `companyName`, `schoolName`, `authority`, etc.) — only our own
      vocabulary (`company`, `school`, `issuingOrganization`, `startDate`/`endDate` as
      strings).

## Tests
- [x] `tests/unit/utils/date.util.test.ts` (6 tests) — range-with-duration-suffix,
      "Present" as current, no-suffix range, `Issued `-prefix stripping, undefined input.
- [x] `tests/unit/normalizer/profile.normalizer.test.ts` (3 tests) — full/empty
      `ParsedProfileSections` → `normalizeProfile()`, plus a schema-rejects-malformed-input
      test proving `ProfileSchema` does real validation.

## Notes / decisions log
- **`location` and `about` are always `undefined`**, not a heuristic split anymore.
  LinkedIn's confirmed sources for these (`/me` doesn't have them at all; the SDUI
  top-card HTML-rehydration payload does, per `docs/RESEARCH.md`, but hasn't been
  captured/mapped) don't currently provide this data — see README's known limitations.
  The schema fields stay optional so this is a silent gap, not a validation failure.
- Kept `Skill`/`Certification`/`Language` `name` fields **optional** rather than required
  — matches the project's "never fabricate values" principle; a nameless skill/cert is an
  edge case LinkedIn probably never actually sends, but the schema shouldn't crash the
  whole request if it ever does.
- `Experience.companyUrl` was dropped from the public schema — no confirmed real source
  for a company profile URL in the SDUI Experience response (unlike the old assumed
  Voyager shape, which had one).
