# totaljobs.com URL & Data Reference

Investigated 2026-07-10. Totaljobs (StepStone group) renders search results
server-side with the data embedded as a
`window.__PRELOADED_STATE__["app-unifiedResultlist"] = {...}` assignment, and
job detail pages carry a schema.org **JobPosting** in
`<script type="application/ld+json">`. Parse those — the visible markup uses
`data-at="job-item*"` attributes as anchors if DOM parsing is ever needed.

## Access rules (robots.txt, checked 2026-07-10)

- `/jobs` search paths are allowed for `User-agent: *`.
- `?page=` / `&page=` params are **disallowed except pages 2–5** (`Allow: /jobs/*?page=2$` etc.). The site's own pagination links use `of=<offset>` instead, which is not restricted — the CLI uses `of=`.
- `/job/*/*/apply`, `/job/*/*/email`, `/candidate/`, `/recruiter-profile/` etc. are disallowed — never fetched.
- Blanket `Disallow: /` blocks apply only to named crawlers (Baiduspider, Yandex, CCBot, SEO bots), not to `*`.
- No login required, **but see the cookie quirk below**.

## Search

```
GET https://www.totaljobs.com/jobs/<keyword-slug>[/in-<location-slug>]?radius=<miles>&postedWithin=<days>&of=<offset>
```

| Component | Notes |
|-----------|-------|
| `<keyword-slug>` | Keywords lowercased, spaces → `-` (e.g. `embedded-firmware-engineer`) |
| `/in-<location-slug>` | Optional UK town/city, same slugification (e.g. `in-cambridge`) |
| `radius` | Miles around the location |
| `postedWithin` | `1` \| `3` \| `7` \| `14` (days; site's own facet values) |
| `of` | Result offset for pagination (25/page → page N = `of=(N-1)*25`). Matches the site's own "next" links (`?of=25&action=paging_next`) |

Response data at `window.__PRELOADED_STATE__["app-unifiedResultlist"]`
(extract with balanced-brace scanning — the assignment is not the only
`__PRELOADED_STATE__` write on the page):

- `.searchResults.items[]` — 25 per page:
  - `.id` (number), `.title`
  - `.url` — relative `/job/<slug>/<company>-job<id>`
  - `.companyName`, `.companyUrl`, `.companyLogoUrl`
  - `.datePosted` (ISO), `.publishToDate` (expiry)
  - `.location` (e.g. `"Cambridge, Cambridgeshire"`), `.postCode`
  - `.salary` — display string (e.g. `"£60000 - £80000 per annum"`) or empty
  - `.topLabels[]` — `FEATURED` etc.
- `.searchResults.pagination` — `{ page, perPage: 25, pageCount, totalCount }`
- `.searchResults.filters[]` — facet definitions; the `age` facet documents the valid `postedWithin` values

## Detail

```
GET https://www.totaljobs.com/job/<id>        (bare ID works)
GET https://www.totaljobs.com/job/<slug>/<company>-job<id>   (canonical)
```

**Cookie quirk:** detail requests from a cookie-less client are never answered
(the connection stalls / the HTTP/2 stream resets — curl and fetch both hang).
Bootstrap a session first: `GET /jobs/x`, collect the `Set-Cookie` values, and
send them (plus a `Referer`) with the detail request. With cookies the page
returns 200 reliably.

Data in the `ld+json` JobPosting block:

- `title`, `url`, `datePosted`, `validThrough` (ISO)
- `description` — **HTML** (needs tag-stripping/entity-decoding)
- `employmentType` — e.g. `FULL_TIME`, `CONTRACTOR`
- `hiringOrganization.name`
- `jobLocation.address.addressLocality` (+ geo coordinates)
- `baseSalary` — often an empty string even when the search card showed a salary

## Quirks

- The `__PRELOADED_STATE__` blob must be extracted with a balanced-brace scanner
  (several other `window.__PRELOADED_STATE__.xyz =` assignments precede it on
  the page; regex-to-end-of-line does not work).
- Search with a keyword slug that matches nothing still returns 200 with an
  empty `items` array (plus recommended jobs in the HTML — ignore those; they
  are not in `searchResults.items`).
- A search URL without any keyword (`/jobs`) is a browse page with the same
  state structure.
- `detail` bare-ID URL `/job/<id>` returns 200 directly (no redirect).
- CV-Library-style hard blocking was NOT observed here, but the site does
  fingerprint: keep the browser `User-Agent` header.
