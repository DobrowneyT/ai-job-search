# Imagination Technologies Careers URL Reference

## How the page is built

`https://www.imaginationtech.com/careers/vacancies/` is a WordPress page that embeds the
**PageUp People** applicant-tracking system's job-listing/search widget. This is visible in
the page source as:

- `<script id="pageup-thirdparty-js" src="https://careers.static.pageuppeople.com/Widgets/v3.js">`
- `<script id="pageup-scripts-js" src="https://www.imaginationtech.com/wp-content/themes/imgtec/js/src/pageup.js">`
  which defines the constants `pageUpBaseURL = 'https://careers.pageuppeople.com/'`,
  `pageUpID = '774'`, `pageUpChannel = 'cw'`, and instantiates
  `PU.Widgets.jobListing(...)` / `PU.Widgets.search(...)` against them.

None of PageUp's endpoints match the well-known ATS platforms listed in the add-portal
checklist (Workday/Greenhouse/Lever/SmartRecruiters/Workable/iCIMS/SuccessFactors) — PageUp
is a separate, less commonly-documented ATS, but it exposes a genuine public JSON API, so we
use that instead of scraping the WordPress-rendered HTML or the PageUp-rendered HTML pages.

## Why JSON over HTML

PageUp's own widget JS (`Widgets/v3.js`, `buildUrls`) resolves its listing data from:

```
GET https://careers.pageuppeople.com/774/cw/en/jobs.json
```

(dropping the `?callback=...` JSONP wrapper param the widget itself adds returns plain JSON).
This is the same data source the rendered `/774/cw/en/listjobs` and `/774/cw/en/listing/`
HTML pages use, but as clean structured JSON with the full job description inline — so per
the add-portal guidance to prefer a platform's own JSON API over HTML scraping, this skill
hits `jobs.json` directly for both `search` and `detail`.

## Search

```
GET https://careers.pageuppeople.com/774/cw/en/jobs.json
```

Query params (verified live to genuinely filter server-side, not just accepted-and-ignored):

| Param | Meaning | Verified example |
|-------|---------|-------------------|
| `search-keyword` | Free-text query (title/description) | `director` -> 4/22 jobs, `verification` -> 8/22, `marketing` -> 2/22 |
| `location` | Location facet (exact string from the site's filter list) | `location=Bristol UK` -> 10/22 jobs (matches the site's own facet count) |
| `category` | "Fields of interest" facet (`AI`, `Connectivity`, `Graphics`) | `category=AI` -> 2/22 jobs |
| `work-type` | `Early Career` / `Experienced Professional` | not exercised live, but same param family |

**Not supported** (accepted but silently ignored — confirmed by testing `page`, `page-items`
against a known total of 22 and getting all 22 back regardless): server-side pagination and
any posting-age / date-range filter. This CLI implements `--page` (fixed 20/page) and
`--jobage` client-side against each job's `OpeningDateUtc`.

Response: a flat JSON array, one object per vacancy. Key fields used:

| JSON field | Our field | Notes |
|---|---|---|
| `Id` / `ExternalJobNo` | `id` | Numeric string, e.g. `"502702"` |
| `Title` | `title` | |
| — | `company` | Constant `"Imagination Technologies"` (single-company feed) |
| `Locations` | `location` | Comma-joined if multiple, e.g. `"Kings Langley UK, Bristol UK"` |
| `OpeningDateUtc` | `date` | ASP.NET JSON date `"/Date(1783497600000)/"` — parsed to ISO in `helpers.ts` |
| — | `url` | Constructed as `https://careers.pageuppeople.com/774/cw/en/job/<id>/` |
| `Overview` | `description` (detail only) | Full HTML job description — stripped/decoded to plain text |
| `WorkType`, `JobSector`, `Categories`, `Salary`, `ClosingDateUtc`, `ApplyUrl` | detail extras | |

## Detail

No separate per-job JSON endpoint exists. PageUp's widget code (`loadDetailsInline` mode)
resolves job detail by re-filtering the *same* `jobs.json` array by `Id` rather than a second
request — this CLI does the same: `detail <id>` fetches the unfiltered `jobs.json` feed and
finds the matching `Id`.

The human-facing HTML detail page is:

```
https://careers.pageuppeople.com/774/cw/en/job/<id>/<any-or-no-slug>
```

Verified live that the slug is cosmetic — any slug, or none, resolves to the same job (200 OK,
no redirect) — so `url` in our output always uses a slug-less URL for simplicity.

## Access check

- `robots.txt` for `careers.pageuppeople.com` (fetched live) disallows only admin/UAT/staging
  paths (`/admin`, `/uat`, `/ci`, `/staging`, etc. and their per-locale variants) — the
  `jobs.json`, `listjobs`, `listing`, and `job/<id>` paths used by this skill are **not**
  disallowed.
- `robots.txt` for `www.imaginationtech.com` disallows only `/wp-admin/` and
  `/wp-content/plugins/`/`/wp-includes/` — the `/careers/vacancies/` page is not disallowed.
- No login is required to view listings or vacancy detail; it's a public careers site.
- This is Imagination Technologies' own official careers site (not a scraped third-party
  aggregator), so no personal-use/ToS warning is included in `SKILL.md`.

## Quirks recorded for future maintainers

- Total open-vacancy count is small (~22 at time of writing) and the feed returns the full
  matching set in one response — if Imagination's headcount search grows dramatically, revisit
  whether `page`/`page-items` params start being honored (they weren't as of this writing).
- `search-keyword=software engineer` happened to return the same count as the unfiltered feed
  (22/22) purely because most current openings contain "Software" or "Engineer" in the title —
  this is coincidence, not evidence the filter is a no-op (confirmed genuine filtering with
  `director`, `verification`, `marketing`, and a nonsense keyword returning 0).
