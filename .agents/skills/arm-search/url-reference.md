# careers.arm.com URL & Data Reference

Investigated 2026-07-19. Arm's careers site runs on the **Radancy "TalentBrew"**
career-site platform (visible in page markup: `tbcdn.talentbrew.com` assets,
company/tenant ID `33099`). This is not one of the well-known ATS platforms
with a documented public JSON API (Workday, Greenhouse, Lever,
SmartRecruiters, Workable, iCIMS, SuccessFactors). Applications themselves are
handed off to **iCIMS** (`experienced-arm.icims.com`, `earlycareers-arm.icims.com`)
but only at the point of clicking "Apply" — viewing listings requires no
login at all.

## Why HTML scraping, not an API

The page's CSP header advertises `connect-src https://jobseeker-api.prod.radancyai.click`,
suggesting a JSON API backs some client-side feature (likely search-box
autocomplete). It was investigated but every path tried (`/`, `/search`,
`/jobs`, `/v1/jobs`, `/v1/search`) returned a bare 404 with no discoverable
routing, and it isn't a documented/public API the way Greenhouse's or Lever's
are. Given the server-rendered `/search-jobs` HTML page works cleanly, is
allowed by robots.txt, and needs no reverse-engineered auth, this skill
scrapes that HTML instead — same architecture as `reed-search` and
`linkedin-search`.

## Access rules (robots.txt, checked 2026-07-19)

```
User-agent: *
Disallow:/search-jobs/
```

Only paths starting with `/search-jobs/` (**trailing slash**) are disallowed.
That covers three client-side AJAX endpoints this skill deliberately avoids:

- `/search-jobs/results` — pagination/facet-filter partial-HTML endpoint
- `/search-jobs/resultspost` — same, POST form
- `/search-jobs/GetSearchRequestGeoLocation` — geocodes a typed location into lat/long

The top-level `/search-jobs?k=...&p=...` page (**no trailing slash** — a
different path prefix) and all `/job/<slug>/<slug>/<orgId>/<id>` detail pages
are **not** covered by the disallow rule and are what this skill uses.

## Search

```
GET https://careers.arm.com/search-jobs?k=<query>&p=<page>
```

| Param | Notes |
|-------|-------|
| `k` | Free-text keyword query (title, skill, team name, office name — full-text, not field-scoped) |
| `p` | 1-indexed page number. Omit for page 1. |

Response is a server-rendered HTML page. Metadata lives on
`<section id="search-results" data-total-job-results="…" data-total-pages="…" data-current-page="…" data-records-per-page="15">`.
Each real job is an `<li class="job-card …">` inside
`<ul id="search-results-jobs">`:

- `<a class="job-card__title" href="/job/<city>/<slug>/33099/<id>" data-job-id="<id>">Title</a>`
- `<span class="location">City, Country</span>`
- `<span class="category">Software Engineering</span>` (Arm's internal job-family taxonomy)

No posting date is present on search cards (only on detail pages).

## Detail

```
GET https://careers.arm.com/job/<any-slug>/<any-slug>/33099/<id>
```

The slug segments are **entirely decorative** — `/job/x/x/33099/<id>` resolves
identically to the canonical URL (200, no redirect); an unknown ID 404s. The
richest source is a `<script type="application/ld+json">` `JobPosting` block:
`datePosted`, `description` (HTML), `employmentType`, `identifier` (Arm's own
req number, e.g. `2020-3449` — distinct from the numeric `<id>` in the URL),
`title`, `url`, `hiringOrganization.name`, `jobLocation[0].address`. Visible
`<span class="job-{id,date,location,category} job-info">` markup is used as a
fallback for any field missing from the JSON-LD.

## Quirks

- **`job-card__title` is reused by an unrelated "jobs you may like" widget**
  that links to stories/pages via `data-page-id` rather than real postings
  (`data-job-id`), and it renders even when the real result list is empty
  (e.g. requesting a page past the last one). The parser requires
  `data-job-id="<digits>"` on the anchor, which the widget never has, so it's
  excluded regardless; the results list is additionally scoped to the
  substring between `<ul id="search-results-jobs">` and the following
  `<nav id="pagination-bottom">` as defense in depth.
- **No server-side location filter reachable without JS.** The visible
  "Country"/"City" facet checkboxes and the free-text `Location`/`Country`
  form fields are all cosmetic on a plain GET to `/search-jobs` — tested
  `Country=<UK facet id>`, `location=Cambridge`, and even `latitude`/`longitude`/`distance`
  directly; none changed `data-total-job-results` or the returned job list.
  Real facet filtering only happens via the disallowed `/search-jobs/results`
  AJAX endpoint. This skill instead folds `--location` into the `k` keyword
  query, which does bias results (Arm's search matches office/city names in
  job text) but is **not a strict filter** — verify each result's own
  `location` field.
- **No server-side posting-age filter at all**, reachable or not — there is
  no date-bucket facet in the sidebar (unlike Reed's today/3-day/week/2-week
  buckets), and the sort dropdown ("Relevancy" / "Date Posted") is
  client-side-only (`sortCriteria`/`sortDirection`/`sort`/`s` query params were
  all tested and ignored on a plain GET). `--jobage` is accepted for CLI
  interface compatibility but has no effect.
- **Arm's `datePosted` is not zero-padded** (e.g. `"2026-6-16"`, not
  `"2026-06-16"`) — normalized before being emitted.
- Page size is fixed at 15 results/page (`data-records-per-page`).
- Company is always `"Arm"` in output — the site lists only Arm's own
  postings (single-tenant career site, org ID `33099`).
- Job descriptions use rich-text-editor "smart punctuation" HTML entities
  (`&rsquo;`, `&ldquo;`, `&rdquo;`, `&ndash;`, `&mdash;`, `&hellip;`) mixed
  with literal Unicode curly-quote characters in the same document —
  handling only the XML-standard five entities left curly quotes undecoded
  in some paragraphs; the decoder covers the wider named-entity set.
