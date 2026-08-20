# STMicroelectronics Careers URL & Data Reference

Investigated 2026-07-19.

## Finding the real careers platform

`st.com`'s own careers page (`https://www.st.com/content/st_com/en/about/careers.html`)
links out to a `stcareers.talent-soft.com` domain (visible in `st.com`'s CSP
header, suggesting ST used Cegid Talentsoft at some point), but every path
tried on that domain — `/`, `/accueil.aspx`, `/job/list-of-jobs.aspx`, and the
exact URLs surfaced by web search results (which looked like a stale Google
index) — returned a custom TalentSoft 404/500 page. That platform appears to
be decommissioned or reorganized; **do not build against `talent-soft.com`.**

The **live, current** careers platform is **Eightfold.ai**:

```
https://stmicroelectronics.eightfold.ai/careers
```

This is confirmed working (HTTP 200, real job links) and is what today's
"STMicroelectronics careers" web searches also surface. Not Workday, not
SuccessFactors, despite ST being a large multinational manufacturer where
those are common.

## robots.txt (checked 2026-07-19)

```
User-agent: *
Disallow: /
Allow: /$
Allow: /careers
Allow: /api/apply
Allow: /api/pcsx
Allow: /candidate/login
Allow: /login
Allow: /events/candidate
Allow: /events/open
Allow: /api/events
Allow: /careerhub/explore/jobs
Allow: /api/career_hub
Allow: /static/gen
Allow: /gen
```

`/careers` and `/api/apply` — exactly the paths this skill uses — are
**explicitly allowed**. No login is required to view listings or job detail.

## Why the JSON API, not HTML scraping

The rendered `/careers` page is a JS app that calls Eightfold's own API to
populate results (visible as `window._EF_GROUP_ID = "stmicroelectronics.com"`
and an embedded `smartApplyData` JSON blob in the page source). Calling that
API directly is far more stable than parsing the rendered markup.

- **Tenant identifier:** `domain=stmicroelectronics.com` (ST's Eightfold
  "group ID" — required on every API call).

## Search

```
GET https://stmicroelectronics.eightfold.ai/api/apply/v2/jobs
    ?domain=stmicroelectronics.com
    &query=<free text>
    &start=<0-indexed offset>
    &num=<page size>
```

- `query` — free-text search. Matches **both job title and location text**
  (confirmed: `query=United Kingdom` alone returns UK-located postings). There
  is no separate, reliable location-only filter param — see Quirks below.
- `start` / `num` — standard offset/limit pagination. `num=25` used as this
  CLI's fixed page size; `start = (page - 1) * 25`.
- No API key or session cookie needed.

Response JSON top-level keys of interest:

- `.count` — total matches across all pages
- `.positions[]` — one entry per job on this page:
  - `.id` (large integer) — stable job ID, use for `detail`
  - `.name` — job title
  - `.location` — primary display location, e.g. `"Napoli, Italy"`
  - `.locations[]` — **all** sites this posting is open at (many ST postings
    list 2-4 alternative locations)
  - `.department`, `.business_unit`
  - `.t_create`, `.t_update` — Unix-seconds timestamps (job creation/update in
    the ATS; used as the best available proxy for "posting date")
  - `.work_location_option` — e.g. `"onsite"`
  - `.canonicalPositionUrl` — full URL to the job page
  - `.display_job_id`, `.ats_job_id` — internal reference numbers (not needed
    for this CLI; `.id` is what `detail` takes)
- `.facets.locations` / `.facets.region_country` — facet counts (see Quirks —
  attempted as filters, didn't work as a request parameter)

## Detail

```
GET https://stmicroelectronics.eightfold.ai/api/apply/v2/jobs/<id>?domain=stmicroelectronics.com
```

Same per-job shape as above, plus:

- `.job_description` — **HTML** (needs tag-stripping/entity-decoding; this CLI
  reuses the `htmlToText` helper pattern from `reed-search`)
- `.urls.links` — related blog/video links (ignored by this CLI)

Unknown IDs return **HTTP 404** with a clean JSON body
(`{"message": "Job with ID <n> not found"}`) rather than an HTML error page —
easy to detect and report as `NOT_FOUND`.

## Quirks

- **Location is not a reliable separate filter.** Tried `location=`,
  `location_str=`, `country=`, `pcs_geo=`, `region_country=` (both full name
  and ISO alpha-2) as query-string params against `/api/apply/v2/jobs` —
  all either silently ignored the value (returned the unfiltered count) or
  returned `count: 0` even for values known to exist in the facets (e.g.
  `region_country=united kingdom` → 0, `region_country=gb` → 0). The one
  thing that reliably works is folding the location into the free-text
  `query` param (e.g. `query=embedded United Kingdom`), which the CLI does
  automatically when `--location` is passed — this matches the
  `jobindex-search` pattern the add-portal contract calls out for
  location-inside-keyword portals.
- **Location-in-query fuzzy matching can overlap unrelated countries.** Because
  `--location` is folded into the free-text `query`, a query like
  `"engineer United Kingdom"` can also surface `"United States"` postings —
  the search appears to score on partial word overlap ("United") rather than
  exact phrase match. Always check the `location` field of returned results
  rather than trusting the filter blindly; this is a real limitation of
  folding location into keyword search, not a bug in this CLI.
- **No native recency/date filter.** `sort_by=new` is accepted but doesn't
  reorder results in an obviously date-descending way, and there's no
  `posted_within` style param. `--jobage` is implemented client-side against
  each position's `t_create`, filtering only within the already-fetched page
  (not across the whole result set) — documented as an approximation.
- **Multi-site postings are common.** Many roles list several eligible
  locations (e.g. a role open in both Le Mans, France and Napoli, Italy). The
  CLI surfaces the primary `location` field and, in `detail --format plain`,
  an "Also posted at" line for the rest.
- **`talent-soft.com` is a dead end** for this integration — see above. Don't
  waste time on it if this skill needs revisiting later; go straight to
  `eightfold.ai`.
- Global coverage: results span many countries (France, Italy, Malta,
  Singapore, Malaysia, Philippines, Morocco, the US, and a small but real UK
  presence in Edinburgh, among others) — always worth checking `--location`
  or reading the `location` field rather than assuming UK/Winnipeg relevance.
