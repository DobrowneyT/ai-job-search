# reed.co.uk URL & Data Reference

Investigated 2026-07-10. Reed is a Next.js site: every public page embeds its
full data as JSON in `<script id="__NEXT_DATA__" type="application/json">`.
Parse that blob — never scrape the visible markup (class names are hashed CSS
modules like `index-module_jobCard__DaYuk` and will churn).

## Access rules (robots.txt, checked 2026-07-10)

- `/jobs/` and `/jobs?...` are **allowed** for `User-agent: *` (and AI crawlers are explicitly allowed sitewide).
- `/api/`, `/handlers/`, `/linkclicked.html`, `?sourceInternal=` are **disallowed** — do not fetch them.
- No login required for search or detail pages.

## Search

```
GET https://www.reed.co.uk/jobs?keywords=<q>&location=<loc>&proximity=<miles>&pageno=<n>&datecreatedoffset=<bucket>
```

| Parameter | Notes |
|-----------|-------|
| `keywords` | Free-text query, `+`-separated words |
| `location` | UK town/city/postcode. Echoed lowercased in `criteria.location.locationName` |
| `proximity` | Miles radius around `location`; site default 10 |
| `pageno` | 1-indexed. **404 when past the last page** (handle as empty, not error) |
| `datecreatedoffset` | `today` \| `lastthreedays` \| `lastweek` \| `lasttwoweeks` \| `anytime` (case-insensitive; no month bucket) |

Response data at `props.pageProps.searchResults`:

- `.count` — total matches across all pages
- `.jobs[]` — 25 per page. Each entry:
  - `.jobDetail.jobId` (number), `.jobDetail.jobTitle`
  - `.jobDetail.ouName` — company (also `.profileName` on the wrapper)
  - `.jobDetail.displayLocationName` + `.jobDetail.countyLocation`
  - `.jobDetail.displayDate` / `.dateCreated` / `.dateUpdated` / `.expiryDate` (ISO)
  - `.jobDetail.salaryFrom` / `.salaryTo` (numbers, 0/null when absent), `.salaryType`
  - `.jobDetail.remoteWorkingOption` — e.g. `"On-Site"`
  - `.jobDetail.isPromoted` — promoted entries can duplicate organic ones → dedupe by jobId
  - `.url` — relative canonical path `/jobs/<slug>/<id>`
- `.promotedJobs[]` — separate promoted block (ignored by the CLI)
- `props.pageProps.criteria` — echo of the parsed query params (useful for debugging)
- `props.pageProps.filters` — filter definitions incl. the valid `dateCreatedOffSet` values

## Detail

```
GET https://www.reed.co.uk/jobs/<slug>/<id>
```

The slug is decorative: **any slug resolves** (the CLI uses `/jobs/j/<id>`),
status 200 with no redirect. Unknown IDs return 404.

Response data at `props.pageProps`:

- `.canonicalUrl`, `.jobUrl` — canonical location
- `.consolidatedJobDetails.jobDetails`:
  - `.id`, `.title`
  - `.description` — **HTML** (needs tag-stripping/entity-decoding)
  - `.jobOwner.profileName` — company name
  - `.jobLocation.locationName`, `.jobLocation.isRemoteJob`, `.jobLocation.inferredJobLocationType` (`"hybrid"` etc.)
  - `.jobSalary.displaySalary` — ready-made string, e.g. `"£ 38,000 - £ 70,000 per annum"`
  - `.jobContractType.name` — `"Permanent"` / `"Contract"` / `"Temporary"`
  - `.jobEmploymentHours.isFullTime` / `.isPartTime`
  - `.createdDate`, `.displayDate`, `.updatedDate`, `.expiryDate` (ISO)
  - `.isRedirect` — true when applying goes to an external site (the external URL is only present in search results as `jobDetail.externalUrl`)

## Quirks

- Out-of-range `pageno` → HTTP 404 (not an empty result set).
- Class names in the visible HTML are hashed CSS modules; the stable anchors, if
  DOM parsing is ever needed, are `data-qa="job-card"` and `data-id="job<id>"`
  on each `<article>`.
- `criteria.dateCreatedOffSet` echoes lowercased regardless of input case.
- Search-result salary fields are numeric only (currency implied GBP);
  the detail page has the formatted display string.
