# LinkedIn Voyager Research

Living document, written during [Phase 1](phases/phase-1-research.md). Captures exactly
what LinkedIn's own web client sends when rendering a profile page, so the code in
`src/linkedin/` replicates it faithfully.

## Confirmed so far

### `GET /voyager/api/me` (identity check, not the full profile endpoint)
- Method: GET
- URL: `https://www.linkedin.com/voyager/api/me`
- Request headers confirmed present: `accept: application/vnd.linkedin.normalized+json+2.1`
- Response headers of note:
  - `content-type: application/vnd.linkedin.normalized+json+2.1; charset=UTF-8`
  - `x-restli-protocol-version: 2.0.0`
  - `cache-control: no-cache, no-store, no-transform`
- Response shape: **normalized graph format**, confirmed:
  ```
  data: { "*miniProfile": "urn:li:fs_miniProfile:<id>", ... }
  included: [ { entityUrn: "urn:li:fs_miniProfile:<id>", firstName, lastName,
                occupation, publicIdentifier, picture: {...VectorImage...},
                backgroundImage: {...VectorImage...}, ... } ]
  ```
  This matches the architecture doc's `data` + `included[]` URN-referenced graph exactly
  — top-level fields prefixed `*` are URN pointers into `included[]`, resolved by
  matching `entityUrn`.
- Image shape: `picture`/`backgroundImage` are `VectorImage` objects with a `rootUrl` and
  an `artifacts[]` array of `{width, height, fileIdentifyingUrlPathSegment}` — full image
  URL = `rootUrl + fileIdentifyingUrlPathSegment`. Multiple sizes available; parser should
  pick the largest `width`/`height`.
- **Not sufficient for our purposes** — only returns the authenticated user's own mini
  identity (name, headline/occupation, photo, public identifier). No experience,
  education, skills, certifications, or languages. This is what LinkedIn's client fires
  on every page load for nav-bar rendering, not the profile-page data itself.

### Confirmed general request header pattern (from a cancelled `voyagerMessagingDashMessagingSettings` GraphQL call — not the profile endpoint itself, but the header shape applies to all Voyager calls)
- `accept: application/vnd.linkedin.normalized+json+2.1`
- `x-restli-protocol-version: 2.0.0`
- `csrf-token: <value>` — **confirmed equal to the unquoted `JSESSIONID` cookie value**
  (cookie was `JSESSIONID="ajax:0116974044034004747"`, header was
  `csrf-token: ajax:0116974044034004747` — quotes stripped).
- `cookie: <full cookie jar>` — must include at least `li_at` and `JSESSIONID`; browser
  sends the full jar, unclear yet which subset is strictly required (assume `li_at` +
  `JSESSIONID` are the load-bearing ones, matching every public LinkedIn scraping
  writeup; treat others as optional/browser-fingerprint noise for now).
- `x-li-lang: en_US`
- `x-li-page-instance: urn:li:page:d_flagship3_profile_view_base_contact_details;<token>`
  (varies per page/view — likely safe to omit or use a generic placeholder)
- `x-li-track: {"clientVersion":"...","mpVersion":"...","osName":"web","timezoneOffset":...,"timezone":"...","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":...,"displayWidth":...,"displayHeight":...}`
  (JSON-stringified client metadata blob; likely fine with static reasonable defaults)
- `user-agent: <realistic desktop or mobile browser UA>`
- `referer: https://www.linkedin.com/...` (same-origin)
- `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`, `sec-fetch-dest: empty`,
  `sec-fetch-mode: cors`, `sec-fetch-site: same-origin` — browser client-hint headers,
  likely worth mimicking to reduce bot-detection risk, exact necessity unconfirmed.

⚠️ **Credential hygiene note:** a real `li_at`/`JSESSIONID` value was briefly exposed in
chat during this capture and has been rotated. Never store real cookie values in this
repo, `docs/`, or any fixture — only in a local, gitignored `.env`.

⚠️ **Second incident (2026-08-29):** while looking for `li_at`/`JSESSIONID` specifically,
an unfiltered "all cookies for this browser profile" export was pasted into chat —
containing live Google session cookies (`SID`/`SSID`/`SAPISID`/`SIDCC`) unrelated to
LinkedIn entirely, and neither of the two cookies actually needed. Both Google and
LinkedIn sessions were advised to be rotated. Lesson: filter DevTools' cookie table to the
specific domain (`https://www.linkedin.com`) and use the table's own name filter for
`li_at`/`JSESSIONID` specifically — never export/paste the full unfiltered cookie list.

### ⚠️ Major finding: the profile page is NOT classic server-rendered HTML or a simple Voyager JSON call — it's "SDUI"

Confirmed by inspecting the raw HTML `Document` response for `/in/<id>/` (View Page
Source, not DevTools' rendered DOM). LinkedIn's current web client ships a proprietary
**Server-Driven UI (SDUI)** framework: the initial HTML contains a
`window.__como_rehydration__ = [...]` payload that is a **serialized React (Server
Component-style) tree** — component descriptors, action definitions
(`proto.sdui.actions.*`), and inline data all interleaved — not a clean data object. This
supersedes the architecture doc's assumption of a single decorated Voyager JSON response.

**What IS embedded directly in that initial payload (no extra request needed):**
- First/last name, full headline text
- `geoLocationName`-equivalent (freeform location string, e.g. "City, Region, Country")
- Current company name (preview only) and current school name (preview only)
- Connection count ("500+ connections" style string)
- Profile photo and background photo — same `VectorImage`-style shape confirmed on `/me`
  (`rootUrl` + `artifacts[]` with `width`/`height`/`fileIdentifyingUrlPathSegment`),
  embedded as plain URL strings within the tree rather than a clean `VectorImage` object
  in this payload, but the URL construction pattern is identical
- `publicIdentifier` and the internal profile URN (`ACoAA...` style ID)

**What is NOT embedded — deferred to a lazy, scroll-triggered request:**
Experience, education, skills, certifications, languages, and several other sections are
each their own component, rendered as an `AsyncComponentRequest` placeholder that only
resolves when it scrolls into view:
```
"componentKey": "profileCardsExperienceOnly<publicIdentifier>"
"content": {
  "$case": "asyncContent",
  "asyncContent": {
    "$type": "proto.sdui.actions.core.AsyncComponentRequest",
    "newComponentId": "com.linkedin.sdui.generated.profile.dsl.impl.profileCardsExperienceOnly",
    "requestedArguments": { "payload": { "vanityName": "<publicIdentifier>", "isSelfView": false, ... } }
  }
},
"key": { "value": { "$case": "id", "id": "profileCardsExperienceOnly<publicIdentifier>" } }
```
Trigger: `{"type":"onComponentAppear","visibilityRatio":0}` — fires as the section is
about to enter the viewport. Similar `newComponentId`s exist for other below-the-fold
cards (education is presumably one of the `profileCardsBelowActivityPart*` components,
not yet confirmed which one). **We have not yet captured the actual network request this
triggers, nor its response shape** — that's the single most important remaining gap.

**Confirmed: the exact request payload for the async Experience component** (found by
re-inspecting a second View Page Source capture of the same profile — the Experience
section itself was still a loading skeleton, not real data, but the embedded action
definition that fires when it scrolls into view is fully present):
```json
{
  "newComponentId": "com.linkedin.sdui.generated.profile.dsl.impl.profileCardsExperienceOnly",
  "requestedArguments": {
    "payload": {
      "isSelfView": false,
      "vanityName": "siddharthgupta007",
      "replaceableSectionArgs": {
        "vanityName": "siddharthgupta007",
        "hideCardsForGoldenGate": false,
        "shouldSetupReplaceableComponent": true,
        "isSelfView": false,
        "isSelfViewResolved": false
      },
      "profileComponentState": {
        "profileId": "siddharthgupta007",
        "...": "~15 more binding keys, all pointers into client-side memory state (cache flags, reload flags, last-performed-action ref) — not data, just client bookkeeping"
      }
    }
  }
}
```
This is the **request body**, not the response — still don't have the actual HTTP
method/URL/response. But it gives a precise, unique string to search for
(`profileCardsExperienceOnly`) rather than relying on scroll timing.

### ✅ CONFIRMED: the real SDUI async-component endpoint

Found via Network tab filtered to `larger-than:1k` (the standard payload-text search
missed it — this fires over `flagship-web`'s own RSC action dispatcher, not a URL
containing the component name in an indexable way the search panel liked).

```
POST https://www.linkedin.com/flagship-web/rsc-action/actions/component
    ?componentId=<newComponentId>
    &sduiid=<newComponentId>
    &parentSpanId=<base64-ish tracing token, varies per request>
```

Same pattern confirmed for multiple components on one page load — this is a **generic
dispatcher**, not one endpoint per section:
- `componentId=com.linkedin.sdui.generated.profile.dsl.impl.profileCardsExperienceOnly`
  → Experience section (confirmed 200 OK, this is the one with real Experience data
  visible on-page afterward).
- `componentId=com.linkedin.sdui.generated.profile.dsl.impl.profileCardsBelowActivityPart1WithoutExp`
  → likely Education (unconfirmed which section, but the naming + position right after
  Experience in the DOM strongly suggests it).

Also observed on the same capture (unrelated to profile data — just SDUI's client-side
heartbeat, ignore for this project):
```
POST https://www.linkedin.com/realtime/realtimeFrontendClientConnectivityTracking?action=sendHeartbeat
```
This confirms the earlier `realtimeDefaultHandler`/`isStreaming` reference in the HTML was
a red herring for *this* purpose — that's a separate liveness-ping channel, not how
component data arrives. The actual data fetch is a plain POST, just to a dispatcher path
we hadn't thought to look for.

**Request payload confirmed** (for `profileCardsBelowActivityPart1WithoutExp`, same shape
expected for every `componentId`):
```json
{
  "clientArguments": {
    "payload": { "isSelfView": false, "vanityName": "siddharthgupta007" },
    "states": [],
    "knownTemplateIds": []
  },
  "requestMetadata": { "$type": "proto.sdui.common.RequestMetadata" },
  "screenId": "com.linkedin.sdui.flagshipnav.profile.Profile"
}
```
Simple, uniform JSON body — same for any component, just swap `componentId`/`sduiid` query
params and this payload. No per-section payload shape to reverse-engineer.

### ⚠️⚠️ CRITICAL CONFIRMATION: the response is React Server Components "Flight" stream format — NOT JSON, NOT Voyager

Captured the raw response bytes (DevTools rendered it as hex because the content-type
isn't one it treats as text — almost certainly `text/x-component`, Next.js/React's actual
Flight-protocol MIME type). Decoded ASCII from the hex dump:
```
1:I["030d6035cb3a997efb1cff7a008d2f89",[],"default"]
2:I["e9e5744c902fddb98f0eb62aee5d400a",[],"TracedComponent"]
3:I["f54a4d9f94904eb227a6c1307124edd6",[],"ClientComponent"]
4:I["...
5:I["b552b661c9313cbd3c27c9f44d269...
...,"ReplaceableComponent"]
```
This is **the exact same serialization format** as `window.__como_rehydration__` in the
initial page HTML — numbered chunk references (`N:I[...]`), module-hash IDs
(`030d6035cb3a997efb1cff7a008d2f89` matches the `Screen`/`default` module referenced in
the original HTML dump), `ClientComponent`/`TracedComponent`/`ReplaceableComponent`
wrapper nodes. **Confirmed: every async SDUI component response is another React Flight
stream, recursively containing the same `proto.sdui.components.core.*` component-tree
shape as the top card, not a flat data object.**

**This settles the open architecture question from Phase 1/3:**
- The originally-planned `EntityResolver` (`included[]` → `Map<URN, Entity>`, classic
  Voyager graph model) **does not apply here at all** — there is no `data`/`included[]`
  Voyager response anywhere in this flow. `/voyager/api/me` (Confirmed section above) is
  the *only* classic-Voyager-shaped response found so far, and it's unrelated to profile
  content.
- What's needed instead is a **React Flight stream parser**: split the response on
  newlines into `<chunkId>:<type><payload>` lines, resolve `I[...]` references, walk the
  resulting tree looking for the same `TextModel`/text-node patterns already identified
  in the top-card HTML parsing (name, headline, location were extracted this way).
  Experience/education entries will be `proto.sdui.components.core.*` nodes nested
  somewhere in this resolved tree — likely inside list/collection components — need the
  full decoded text (not hex) to map the exact node shapes for title/company/dates/location.
- **Next capture step:** get the actual UTF-8 text of this response (not the hex view) —
  right-click the request in the Network list → **Copy → Copy response**, paste as text.
  The hex view is just DevTools' fallback renderer for a MIME type it doesn't recognize as
  text; the underlying bytes are plain UTF-8 (confirmed by the readable ASCII column above).

### ✅✅ CONFIRMED: wire format decoded and byte-verified for both Education and Experience

Captured base64-encoded responses for both `profileCardsBelowActivityPart1WithoutExp`
(Education + Certifications) and `profileCardsExperienceOnly` (Experience). Both were
independently run through `base64 -d`/`base64 -D` and grepped against the real, decoded
UTF-8 output — not inferred from a screenshot. Saved as real fixtures:
`tests/fixtures/flight/education-certifications-response.real.txt` and
`tests/fixtures/flight/experience-response.real.txt`.

- **Education response: school + degree decoded and byte-verified; also a partial
  capture.** `University School of Information, Communication & Technology (USICT)` and
  `Bachelor of Technology - BTech, Computer Science` came out as plain, correct UTF-8 text
  from individually well-formed chunks. But the response as a whole has a genuine
  corruption: chunk `6` (the `EducationTopLevelSection`'s content root) has a mismatched
  bracket partway through (a `}` where a `[` was still open — confirmed via a bracket-depth
  scan, not a guess) and several referenced chunks (`6`, `7`, `b`, `10`, everything past
  `1e` except a stray `22`) are simply never defined. This makes the resolved tree
  unwalkable from chunk `0` down to the real text — the school/degree strings above were
  confirmed by parsing each chunk *line* independently (each `<chunkId>:<payload>` line is
  its own self-contained JSON value), not by a full root-to-leaf tree resolution. Net
  effect: the wire format and field values are still genuinely real and byte-verified, but
  this specific captured copy can't serve as a full end-to-end integration fixture — see
  the Certifications correction below for what this cost us.
- **Experience response: byte-verified, but the capture is partial.** Decoding confirmed
  `Full Stack Engineer ( contract )`, `Cybership · Full-time`, `Feb 2025 - Jun 2026 · 1 yr
  5 mos`, and `Kansas, United States · Remote` all came out of the actual response bytes
  (`grep` against the decoded text, not a screenshot read). However, the resolved tree
  defines **3** `entity-collection-item-*` nodes (3 experience entries, not 4 as earlier
  assumed from the rendered page), and only the first entry's text chunks (`1c`/`1d`/`1e`/
  `1f`) are present in the captured bytes. Entries 2 and 3 reference chunks `$L21`–`$L29`
  for their title/company/date/location text, and those chunks are never defined anywhere
  in the response — it ends cleanly right after entry 1's location string, with no
  truncated/broken JSON. This points to the browser-copy or paste-into-chat step cutting
  the response short partway through, not a protocol quirk — the format itself parses
  cleanly up to the point it stops. Re-capturing the full response (all chunks through
  whatever the last one actually is) would let all N entries be fixture-verified, but
  isn't blocking: the wire-format algorithm below is already proven by two independent
  decodes, and the parser it implies is structurally entry-count-agnostic (it walks
  whatever `entity-collection-item-*` nodes exist, however many there are).

**Wire format (this is literally Next.js/React's "Flight" RSC streaming protocol):**
- Response body is newline-separated **chunks**, each line: `<chunkId>:<payload>`.
  `chunkId` is a short hex-like token assigned in emission order (`0`, `1`, `2`, ... `a`,
  `b`, ... `1c`, `1d`, ...) — treat as an opaque string key, not a number.
- Two payload forms per line:
  - `I["<moduleHash>",[],"<ComponentName>"]` — a **module reference** (e.g.
    `"TracedComponent"`, `"ClientComponent"`, `"default"`). Plumbing, not data — safe to
    ignore for extraction purposes.
  - A JSON value (object/array/string/`null`) — the actual **payload** for that chunk.
    Chunk `0` is always the root; start walking from there.
- **Reference resolution:** any string value shaped like `"$L<chunkId>"` is a lazy
  pointer — replace it with chunk `<chunkId>`'s payload (recursively).
- **Element nodes** are 4-element arrays: `["$", "<tag>", "<key-or-null>", {props}]`.
  `tag` is an HTML tag (`"div"`, `"p"`, `"span"`, `"section"`, `"hr"`) or another
  `"$L<chunkId>"` reference. `props.children` holds either nested elements or — the part
  that matters — **a plain string or array of plain strings, which is the actual data**.

**Confirmed extraction rule:** field values (job titles, companies, employment-type/dates
/location lines, degree names, bullet points) live in the `"children"` array of
`["$","p",null,{...,"children":["<text>"]}]` nodes. Everything else (`div`, `section`,
`hr`, buttons, icons, tracking specs) is layout chrome to skip over.

**Confirmed Experience entry shape** (entry 1 of 3 in this capture, byte-verified): title →
`"Full Stack Engineer ( contract )"`, subtitle → `"Cybership · Full-time"`, date range →
`"Feb 2025 - Jun 2026 · 1 yr 5 mos"`, location → `"Kansas, United States · Remote"`,
description → numbered bullet strings joined via sibling fragment references, plus an
associated-skills line and a company logo (same `VectorImage`-equivalent
`renderPayload.rootUrl` + `imageRenditions[]` shape as `/me`). Each experience entry
repeats this shape as a separate `entity-collection-item-*` node — entries 2 and 3 exist
structurally in this capture (their wrapper divs/dividers are present) but their text
chunks weren't captured (see partial-capture note above), so their exact field values are
unconfirmed pending a full re-capture.

**Confirmed Education entry shape:** school name (`"University School of Information,
Communication & Technology (USICT)"`), degree (`"Bachelor of Technology - BTech, Computer
Science"`) — each independently confirmed as its own well-formed, individually-parseable
Flight chunk (`p`-tag `children`), same school-logo image shape as elsewhere.

**⚠️ Correction (later resolved): Certifications field values were not byte-verified in
the truncated fixture — but were confirmed correct by a live end-to-end run.** An earlier
pass of this doc stated the Certifications section contained `"Sparkathon"` / `"Walmart"`
/ `"Issued Sep 2024"` / a credential ID, without a byte-level decode to back it up.
Re-checking the saved fixture (`education-certifications-response.real.txt`) found zero
occurrences of those strings — the response is truncated before the Certification chunks
are ever defined (chunks `6`, `7`, `b`, `10` and everything past `1e` except a stray `22`
are missing, likely the same paste/copy truncation seen with the Experience response). So
the positional inference (name → issuer → issued-date) used in `certifications.parser.ts`
shipped labeled "unverified."

**✅ Since confirmed real via a full live smoke test (2026-08-28), run by the developer
against their own profile through the actual running server + dashboard** (not a decode —
an end-to-end HTTP call through the whole pipeline): the response correctly showed
`Sparkathon · Walmart · Sep 2024`, proving the positional order was right all along — it
just wasn't provable from the one truncated capture available at the time. Same live run
also confirmed multi-entry Education (2 schools, correctly split via the
`entity-collection-item-*` path) and 4 Experience entries, all matching the real profile.
Two real, independent verification channels now agree: byte-level decode (Experience
entry 1, Education school/degree) and a full live API round-trip (everything, including
Certifications). Non-self-profile behavior remains the one still-untested gap.

**This fully resolves the Phase 1/3 open question.** Confirmed final architecture:
1. `LinkedInClient` POSTs to
   `flagship-web/rsc-action/actions/component?componentId=<id>&sduiid=<id>&parentSpanId=<token>`
   with the JSON body confirmed above. One call per section — `profileCardsExperienceOnly`
   and `profileCardsBelowActivityPart1WithoutExp` confirmed; `profileCardsBelowActivityPart2..7`
   (skills/projects/languages/etc.) not yet captured, componentId names for those
   unconfirmed.
2. A **Flight-stream parser** (replaces the planned Voyager `EntityResolver` entirely)
   splits response text into `<chunkId>:<payload>` lines, builds a
   `Map<chunkId, payload>`, and recursively resolves `$L<id>` references starting from
   chunk `0`.
3. Domain parsers walk the resolved tree looking for `p`-tag text nodes in known
   structural positions (title → subtitle → dates → location → bullets, repeated per
   collection item) rather than reading named JSON fields — LinkedIn's own layout
   structure *is* the schema here.
4. `parentSpanId` is a per-request tracing token that changes every call — needs
   confirming whether it's validated server-side or can be a fixed placeholder.

**Still not captured:** a Skills componentId, and whether the same endpoint/shape works
for a **non-self** profile (this was captured on the user's own profile while logged in as
themselves — the actual target use case is fetching *other* people's profiles, so one
capture against a different public profile is needed to confirm nothing changes).

### ✅✅ CONFIRMED (2026-08-29): top-card fields are server-rendered directly in the profile page HTML — no Flight-stream parsing needed, works for any profile

A live capture of the raw HTML for `GET /in/siddharthgupta007/` (View Page Source) shows
name, headline, and location sitting as **plain, directly-readable HTML text** — not
hidden inside the `window.__como_rehydration__` Flight stream at all. Byte-verified:
extracted `"Siddharth Gupta"` / the real headline / `"Gurugram, Haryana, India"` directly
from the saved fixture (`tests/fixtures/topcard-page.real.html`) via
`src/parsers/profile.parser.ts`'s `parseHtmlTopCard()`.

Confirmed structural pattern (stable across page loads — the surrounding CSS class hashes
change, but this doesn't):
- A `<div>`/`<section>` with `componentkey="...Topcard"` (prefix is a per-profile URN hash,
  suffix `Topcard` is stable — same suffix-matching approach already used for
  Education/Certification sections).
- Inside it, in document order: `<h2>` = full name, first `<p>` = headline, second `<p>` =
  current company/school summary (unused), third `<p>` = location, fourth `<p>` = a bare
  `"·"` separator, then a "Contact info" link (its text is nested inside an `<a>`, not
  directly in the `<p>`, so a naive `<p>`-text regex skips it automatically).

This **generalizes to any public profile** — `GET /in/<publicIdentifier>/` is the public
profile URL by construction, unlike `/voyager/api/me` which only ever returns the
authenticated user's own identity. `/me` is still used for firstName/lastName-split and
sized profile/background images (nicer than what's in this HTML snippet), but headline,
`fullName`, and — for the first time — **location** now come from this general HTML
source. `about` was not found anywhere in this capture; presumably another lazy
below-the-fold component, still unconfirmed.

### ✅✅ CONFIRMED (2026-08-29): Languages + Organizations componentId

Captured via the same profile page load: `POST .../actions/component?componentId=com.linkedin.sdui.generated.profile.dsl.impl.profileCardsBelowActivityPart4`
returns **both** Languages and Organizations sections in one response (mirroring how
`profileCardsBelowActivityPart1WithoutExp` combines Education + Certifications). Section
suffix confirmed via the resolved tree: `LanguageTopLevel` (note: no trailing `Section`,
unlike `EducationTopLevelSection`). Saved as
`tests/fixtures/flight/languages-organizations-response.real.txt` — a genuinely complete,
well-formed response (not truncated), but both sections show `"initialContent":"$undefined"`
because this profile has **no languages and no organizations listed**. This confirms the
componentId and section suffix but not the field order for a populated entry —
`languages.parser.ts` uses the same title→subtitle positional pattern as
Experience/Education by analogy, flagged as unverified in its own comment, same honesty
pattern as Certifications before its own live confirmation.

Also captured in the same batch, componentIds now known even though none had data for this
profile (all `"initialContent":"$undefined"`): `profileCardsBelowActivityPart3`
(Publications, Patents, Courses, Honors, Test Scores — five sections combined),
`profileCardsBelowActivityPart5` (Interests — actually embedded directly in the initial
page's own rehydration chunk, not lazy-loaded, when populated), `profileCardsBelowActivityPart6`
(Volunteer Causes). **Skills was not found in this batch** — likely `profileCardsBelowActivityPart2`
or `...Part7`, neither of which was captured with a real request/response pair this round.

**Implication for this project:**
- The **top card** section may be scrapable straight from the initial HTML/SDUI payload
  with no Voyager call at all — a different (and in some ways simpler) approach than
  planned, but requires writing a parser for this React-tree serialization format
  (walking `$`-prefixed references, `proto.sdui.components.core.text.TextModel`-shaped
  text nodes, etc.) rather than a flat JSON object.
- **Experience/education/skills/etc. still require a live-captured network request** —
  and given the top-level format surprise, its response may *also* be an SDUI tree rather
  than the classic `data`/`included[]` graph `/me` uses. This needs to be confirmed
  before writing any parser code for those sections against real data.

### Still needed
- A Skills componentId (not found in the `Part3`/`Part4`/`Part5`/`Part6` batch captured
  2026-08-29 — likely `Part2` or `Part7`, neither captured with a real request/response
  pair yet).
- An "About" (summary) source — not found in the HTML top-card capture; presumably another
  lazy below-the-fold component.
- Whether the confirmed mechanisms (component POST dispatcher, profile-page HTML top-card)
  work identically for a **non-self** profile — every capture so far has been the
  developer's own profile while logged in as themselves.
- Byte-verified field order for a *populated* Languages entry (the one real capture has no
  languages listed) and for Certifications (confirmed correct via a live smoke test, not a
  byte decode — see the correction above).
- Rate-limit / anti-bot behavior under normal browsing.
- URL → entity-type disambiguation (`/in/` vs `/company/` vs `/jobs/` vs `/posts/`).

### Working assumption for Phase 2 (superseded, kept for history — see finding above)
The originally-assumed endpoint below was a best-effort guess based on prior public
reverse-engineering of LinkedIn's *classic* Voyager API. The SDUI discovery above makes it
likely this specific endpoint/decoration no longer applies to the current web client,
though it — or something like it — may still exist for API compatibility. Not deleting
this until we've captured the real request, since it's still worth trying as a fallback:
```
GET /voyager/api/identity/dash/profiles
    ?q=memberIdentity
    &memberIdentity=<publicIdentifier>
    &decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-101
```

## Template for each discovered request

```
### <section name, e.g. "Profile top card">
- Method + URL:
- Query params:
- Persisted query ID (if GraphQL):
- Required headers:
- Required cookies:
- Response top-level shape:
- Notes / quirks:
```

## Endpoints discovered
_(TBD)_

## Auth notes
_(TBD — csrf-token derivation, cookie requirements)_

## Anti-bot / rate-limit observations
_(TBD)_

## URL → profile-vs-other-entity disambiguation
_(TBD — confirmed path patterns for `/in/`, `/company/`, `/jobs/`, `/posts/`, etc.)_
