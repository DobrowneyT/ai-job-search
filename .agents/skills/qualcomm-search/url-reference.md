# Qualcomm Careers URL Reference

Public JSON endpoints backing `careers.qualcomm.com`. No authentication required.

## ATS platform: Eightfold.ai (not Workday)

The task brief flagged Workday as a likely ATS for a large enterprise like Qualcomm, but
investigation showed otherwise. Fetching `https://careers.qualcomm.com/careers` returns
response headers `x-ef-trace-id`, `x-ef-iid`, `x-ef-cid`, `x-ef-req-endpoint:
get_html_smartapply_matches_v2`, and a `Content-Security-Policy` that allow-lists
`docs.eightfold.ai`. The page also links to `https://qualcomm.eightfold.ai/careerhub` and
`https://app.eightfold.ai/careers?domain=qualcomm.com`. This is [Eightfold.ai](https://eightfold.ai/),
an AI-driven talent platform used by many large enterprises — confirmed, not guessed.

The rendered career page is a client-side React app; the initial HTML has no job data
embedded (confirmed by fetching a query URL and finding no listing text in the raw
response). The listings are fetched by the browser via XHR after page load, which is why
Step 2 required probing the API directly rather than trusting the static HTML.

## robots.txt

```
https://careers.qualcomm.com/robots.txt
```

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

Both API paths this skill uses (`/api/pcsx/*` and `/api/apply/*`) are explicitly allowed.
No login is required to view listings or detail pages — only to apply, which this skill
does not do. `qualcomm.eightfold.ai` (the underlying tenant domain) serves an identical
robots.txt.

## Search

```
GET https://careers.qualcomm.com/api/pcsx/search
```

Query params:

| Param | Meaning | Example |
|-------|---------|---------|
| `domain` | Required tenant identifier | `qualcomm.com` |
| `query` | Free-text keyword search | `embedded software engineer` |
| `location` | Free-text location filter (fuzzy-matched against `standardizedLocations`) | `San Diego`, `Cork, Ireland` |
| `start` | Pagination offset | `0`, `10`, `20`, … |
| `num` | **Documented but has no observed effect** — the API always returns exactly 10 results per page regardless of this value (tested 5/15/20/25, all returned 10) | — |

Response shape (relevant fields):

```jsonc
{
  "data": {
    "positions": [
      {
        "id": 446717134102,          // numeric job ID, pass to detail
        "displayJobId": "3087119",   // human-facing req number
        "name": "#Embedded Software Engineer",
        "locations": ["San Diego, California, United States of America"],
        "postedTs": 1773014400,      // unix seconds
        "creationTs": 1772150400,
        "department": "Software Engineering",
        "positionUrl": "/careers/job/446717134102"
      }
    ],
    "count": 1460,                   // total matches across all pages, not page size
    "filterDef": { /* facets: locations, job_family, skills, seniority, lat/long */ }
  }
}
```

A separate `/api/apply/v2/jobs?domain=qualcomm.com&...` endpoint (the more commonly
documented Eightfold public-jobs path) returns `403 {"message": "Not authorized for
PCSX"}` for this tenant — it is **not** usable for search on this site. `/api/pcsx/search`
is the one that actually works.

## Detail

```
GET https://careers.qualcomm.com/api/apply/v2/jobs/<id>?domain=qualcomm.com
```

Confusingly, the *detail* endpoint lives under `/api/apply/v2/jobs/<id>` — the same path
prefix that 403s for search — while *search* lives under `/api/pcsx/search`. The `domain`
param is optional for detail (omitting it still returns 200) but is always sent for
consistency. A nonexistent numeric ID returns a clean `404` (no crash).

Response shape (relevant fields):

```jsonc
{
  "id": 446717134102,
  "name": "#Embedded Software Engineer",
  "location": "San Diego, California, United States of America",
  "locations": ["San Diego, California, United States of America"],
  "department": "Software Engineering",
  "business_unit": "33223 CPSE Core Platform Software Services US",
  "job_description": "<h2>...</h2>...",   // rich HTML, includes pay range as plain text
  "canonicalPositionUrl": "https://careers.qualcomm.com/careers/job/446717134102",
  "t_create": 1772150400,
  "t_update": 1772150400
}
```

`job_description` is rich HTML (headings, lists, bold) and typically includes the US pay
range as inline text (e.g. `"$94,200.00 - $141,200.00"`) rather than as a separate field.
The CLI strips tags and decodes entities for `plain`/table output, preserving paragraph
breaks.

## Notes / quirks

- No cookies, CSRF token, or session state were needed for either endpoint once the
  correct paths were found — plain unauthenticated `fetch` works.
- `count` in the search response is the *total* matches for the query across all pages,
  not the page size — useful for knowing how many pages exist, but this CLI's
  `meta.count` in its own JSON output reports the count of results actually returned
  (post `--limit`), consistent with the other portal skills in this repo.
- Location filtering is fuzzy/substring-ish: `"Canada"` matches Markham, Ontario
  postings; `"San Diego"` matches all San Diego variants.
- Job titles in Qualcomm's data occasionally have a leading `#` character (internal
  convention, meaning unclear) — left as-is rather than stripped, since it's part of the
  real posting title.
