# SiFive Careers (Workday) URL & Data Reference

Investigated 2026-07-19. SiFive's careers site (`https://www.sifive.com/careers`)
runs entirely on **Workday** at `https://sifive.wd1.myworkdayjobs.com/sifivecareers`.
Workday exposes a documented, unauthenticated JSON API ("CXS") that the site's
own frontend calls — no scraping, no API key, no login.

## Access rules (robots.txt, checked 2026-07-19)

`https://sifive.wd1.myworkdayjobs.com/robots.txt`:
```
User-agent: *
Allow: /sifivecareers/
Disallow: /refreshFacet/
```
The API paths this CLI uses (`/wday/cxs/sifive/sifivecareers/...`) are not
disallowed. `www.sifive.com/robots.txt` only sets a sitemap, no restrictions.
No login is required to view listings or postings.

## Search

```
POST https://sifive.wd1.myworkdayjobs.com/wday/cxs/sifive/sifivecareers/jobs
Content-Type: application/json

{ "appliedFacets": {}, "limit": 20, "offset": 0, "searchText": "<query>" }
```

| Field | Notes |
|-------|-------|
| `searchText` | Free-text query. Matches title *and* location text (e.g. `"United Kingdom"` alone returns the same 14 results as filtering by the `locationCountry` facet) — but combining a keyword with a location term is **not** an AND filter; Workday appears to score/union rather than intersect. Use `appliedFacets` for a real location filter instead. |
| `limit` | **Hard-capped at 20** for this tenant — any value above 20 returns HTTP 400. |
| `offset` | 0-indexed. See quirks below — paging past the end does not behave predictably. |
| `appliedFacets` | `{ "<facetParameter>": ["<id>"] }`. Relevant facets: `locationCountry` (country-level, ids are stable, e.g. UK = `29247e57dbaf46fb855b224e03170bc7`) and `locations` (specific site/state names). No date-posted facet is exposed on this tenant. |

Response shape:
- `.total` — see quirks, **not reliable except at `offset: 0`**.
- `.jobPostings[]`: `.title`, `.externalPath` (e.g. `/job/Austin-Texas-United-States/Staff-Verification-Engineer_R-101207`), `.locationsText` (a single site name, or `"N Locations"` for multi-site requisitions), `.bulletFields` — `[0]` is a bucketed posted-date string (`"Posted Today"` / `"Posted N Days Ago"` / `"Posted 30+ Days Ago"`), `[1]` is the requisition ID (`"R-101207"`).
- `.facets[]` — full facet tree; `locationMainGroup.values` holds the `locationCountry` and `locations` subfacets used for `--location` resolution (one extra lightweight request, `limit: 1`, only made when `--location` is passed).

## Detail

```
GET https://sifive.wd1.myworkdayjobs.com/wday/cxs/sifive/sifivecareers<externalPath>
```

e.g. `.../sifivecareers/job/Austin-Texas-United-States/Staff-Verification-Engineer_R-101207`.
Unknown paths return HTTP 404.

Response at `.jobPostingInfo`:
- `.title`, `.jobDescription` (**HTML** — needs tag-stripping/entity-decoding)
- `.jobReqId` (`"R-101207"`)
- `.location` (primary), `.additionalLocations[]` (array of strings) — multi-location requisitions list every site here
- `.startDate` — **this is the exact posting date** (ISO `YYYY-MM-DD`), verified against the `bulletFields` bucket text (e.g. `startDate: 2026-05-05` matched `"Posted 30+ Days Ago"` against a 2026-07-19 run — 75 days, consistent). Despite the name, it is not a job-start date.
- `.timeType` (e.g. `"Full time"`)
- `.externalUrl` — canonical public URL, also the apply-flow entry point

There is no separate "how to apply" field; `.externalUrl` is both the canonical
job page and where a candidate applies.

## Quirks

- **`total` is unreliable beyond the first page.** At `offset: 0` it correctly reports the full match count (e.g. 90). At intermediate offsets (e.g. 10, 70) it can read back as `0` even though `jobPostings` still contains a full, correct page of results. Treat `total` as authoritative only from a `page: 1` request; don't rely on it to detect the last page.
- **Offset does not clamp to empty past the end — it wraps.** Requesting `offset` at or beyond the true total (e.g. `offset: 90` or `100` when total is 90) silently returns the *same* first page of results again rather than an empty array or an error. There is no reliable signal from a single request that you've paged past the end; don't loop on `--page` indefinitely expecting it to terminate on an empty page.
- **Multi-location requisitions collapse to `"N Locations"` in search results.** `locationsText` only names a single site; once a requisition has 2+ locations it shows `"2 Locations"`, `"4 Locations"`, etc., with no names. Full location names are only available via `detail` (`.location` + `.additionalLocations[]`).
- **Filtering by `locationCountry` matches ANY of a requisition's locations, not just the primary one.** Filtering to United Kingdom surfaced several roles whose primary/first-listed site is Santa Clara, CA or La Ciotat, France, but which also list a UK site as an option (multi-location reqs). A result appearing under a UK location filter is **not proof the role is primarily UK-based** — always check `detail`'s `.location` (the primary site) before assuming a role is UK-resident.
- **No server-side date-posted facet exists on this tenant.** The only age signal in search results is the bucketed `bulletFields[0]` text (`Today` / `N Days Ago` / `30+ Days Ago`, no exact date). `--jobage` is therefore implemented as a client-side filter over the single fetched page (≤20 results) using this bucket; the `30+` bucket has no derivable exact date and is excluded whenever `--jobage` is set. For full age coverage, omit `--jobage` and check `detail`'s `.startDate` instead.
- **`searchText` also matches location text**, so combining a role keyword and a location string in one query does not behave like an AND filter (see Search table above) — use `--location` (facet-based) for location filtering, not the query string.
