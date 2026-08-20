# Adzuna Jobs API Reference

Investigated 2026-07-11. Unlike this repo's other portal skills, Adzuna is
accessed through its **official public API** (`api.adzuna.com`), not scraped
HTML. Adzuna's own web frontend (`www.adzuna.co.uk`) returns 403 to plain
HTTP clients (bot-protected, like Indeed and Glassdoor) — never fetch it
directly; the API is the intended integration path and is not blocked.

## Authentication

Every request requires `app_id` and `app_key` query parameters from a free
account at <https://developer.adzuna.com/>. No key → `401 AUTH_FAIL` with a
JSON body `{"exception": "AUTH_FAIL", ...}`.

## Search

```
GET https://api.adzuna.com/v1/api/jobs/gb/search/<page>
    ?app_id=<id>&app_key=<key>&results_per_page=25&content-type=application/json
    &what=<keywords>&where=<location>&distance=<miles>
    &max_days_old=<days>&sort_by=date
```

| Parameter | Notes |
|-----------|-------|
| `<page>` | Path segment, 1-indexed |
| `what` | Free-text keywords |
| `where` | UK town/city/region |
| `distance` | Miles radius around `where` |
| `max_days_old` | Any positive integer (not bucketed, unlike Reed/Totaljobs) |
| `sort_by` | `date` (used here) \| `relevance` \| `salary` |
| `content-type` | `application/json` — without it, some responses may vary; always set it |

Response top level: `{ count, mean, results: [...] }`. `count` is the total
match count across all pages (25/page).

Each `results[]` entry:

- `id` (string, numeric) — **no dedicated single-job endpoint exists for it**; an `id=` query parameter on `/search` is silently ignored (returns a generic HTML error page, not JSON — confirmed by testing)
- `title`
- `company.display_name`
- `location.display_name`, `location.area[]` (hierarchical: country → region → town)
- `created` (ISO datetime)
- `description` — **truncated to ~500 characters with a trailing "…"**; there is no `full_description` parameter (confirmed: returns `400`)
- `salary_min` / `salary_max` (numbers, absent when unknown) + `salary_is_predicted` (Adzuna ML-estimated vs employer-stated)
- `category.tag` / `category.label`
- `redirect_url` — an adzuna.co.uk link; **returns 403** to a plain fetch (confirmed with full browser headers + referer) — do not rely on this for detail content. Shape varies between results: observed both `/jobs/land/ad/<id>?se=...` and `/jobs/details/<id>?utm_medium=...` — parse the ID by matching either pattern
- `latitude` / `longitude`

## No detail endpoint

Confirmed during investigation:
- No `/jobs/gb/<id>` or similar single-ad endpoint exists in the documented API (`https://api.adzuna.com/v1/doc` lists only: search, salary histogram/history, regional stats, categories, top companies).
- The `redirect_url` (Adzuna's own ad-landing page) returns `403` — same signature as Indeed/Glassdoor, i.e. Adzuna's frontend is bot-protected even though its API is not.
- Therefore this skill's `detail` command reads from a **local cache written by `search`** (see `cli/src/cache.ts`) rather than querying Adzuna again. There is no way to retrieve more than the ~500-char snippet `search` already returns.

## Other documented endpoints (not used by this skill)

- `/v1/api/jobs/gb/history` — historical salary trends by category/location
- `/v1/api/jobs/gb/histogram` — salary distribution histogram
- `/v1/api/jobs/gb/geodata` — regional job-count/salary stats
- `/v1/api/jobs/gb/top_companies` — top companies by category

These could extend the skill later (e.g. a `stats` command) but were out of
scope for the `search`/`detail` contract this skill implements.

## Quirks

- Rate limiting: rapid successive requests during testing returned an
  occasional `503` (HTML error page, not JSON) — transient; back off and retry.
- `app_id`/`app_key` in the URL are visible in server logs/history on the
  machine running the CLI; treat them as secrets (kept in a gitignored `.env`,
  never in `SKILL.md`, `url-reference.md`, or committed code).
