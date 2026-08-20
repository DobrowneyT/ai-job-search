# Tenstorrent Careers URL Reference

Tenstorrent's public careers page (`https://tenstorrent.com/en/careers`) is a
Next.js front-end. It does not implement its own search API — it embeds a
Greenhouse job-board widget. The underlying listings are served by
**Greenhouse's own public, unauthenticated JSON API**, at a board keyed by the
company's Greenhouse token `tenstorrent`.

This is the same well-known Greenhouse Job Board API pattern documented at
`developers.greenhouse.io/job-board.html` — no scraping of `tenstorrent.com`
itself is needed or performed.

## Access check

- `tenstorrent.com/robots.txt` disallows `/checkout` and `/api/` on
  **tenstorrent.com** — irrelevant here, since this skill never calls
  `tenstorrent.com/api/*`. It only calls `boards-api.greenhouse.io`, a
  different domain entirely.
- `boards-api.greenhouse.io/robots.txt` disallows only `/embed/`. The paths
  this skill uses (`/v1/boards/tenstorrent/jobs` and
  `/v1/boards/tenstorrent/jobs/<id>`) are **not** disallowed.
- No login/authentication is required to view listings or detail pages.

## Board (search)

```
GET https://boards-api.greenhouse.io/v1/boards/tenstorrent/jobs
```

No query parameters are supported by this endpoint — it always returns **every**
open requisition on the board in one response (131 postings as of 2026-07-19,
~95KB without `content`). There is no native `keywords`, `location`,
`department`, or pagination parameter; this CLI fetches the full list once per
`search` invocation and does all filtering, sorting, and paging client-side
(see `cli/src/commands/search.ts`).

Optional `?content=true` also includes each job's full HTML description inline
— the CLI deliberately omits it for `search` (much smaller payload; descriptions
aren't needed for a listing) and only fetches content via the per-job detail
endpoint below.

Per-job fields used:

| Field | Meaning |
|-------|---------|
| `id` | Numeric Greenhouse job ID → CLI `id` |
| `title` | Job title → CLI `title` |
| `company_name` | Always `"Tenstorrent"` → CLI `company` |
| `location.name` | Free-text location; can list multiple sites separated by `;` (e.g. `"Santa Clara, California, United States; 新北市, New Taipei City, Taiwan"`) → CLI `location` |
| `first_published` | ISO datetime the req first went live; preferred as the "posting date" → CLI `date` (falls back to `updated_at` if absent) |
| `updated_at` | ISO datetime of last edit; fallback for `date` and for `--jobage` |
| `absolute_url` | Canonical `job-boards.greenhouse.io/tenstorrent/jobs/<id>` URL → CLI `url` |
| `departments[].name` | Team/department name, e.g. `"Tensix"`, `"RISC V"`, `"AI SW"`, `"CPU"`, `"Systems SW"` — used for `--department` filter. Note: `"Firmware"` is not itself a department name in the observed taxonomy; firmware-titled reqs currently live under departments like `"CPU"` and `"Systems SW"`, so `--department` is a secondary filter, not a substitute for `--query "firmware"`. |

## Detail

```
GET https://boards-api.greenhouse.io/v1/boards/tenstorrent/jobs/<id>
```

Returns the single posting. Unlike the board-list endpoint, **this one includes
`content` (the full HTML description) by default** — no `?content=true` needed.
Confirmed by a live fetch of job ID `5128310007`: `content` was present and
non-empty without the query parameter.

Additional fields used beyond the search set:

| Field | Meaning |
|-------|---------|
| `content` | Full job description, as HTML. See "Content encoding quirk" below. |
| `requisition_id` | Internal requisition number, e.g. `"20231221"` |
| `departments[0].name` | Primary department, surfaced as `detail.department` |

A request for a nonexistent ID returns HTTP `404`; the CLI's `jsonFetch`
converts that into `null`, which `detail` reports as `{"error":"Job not
found","code":"NOT_FOUND"}`.

## Content encoding quirk

The `content` field's value, once JSON-parsed, is **HTML whose own tags have
been HTML-entity-escaped** — the JSON string contains literal `&lt;div
class=&quot;content-intro&quot;&gt;...` rather than real `<div class="...">`
markup. `greenhouseContentToText()` in `cli/src/helpers.ts` decodes entities
once to reveal the real HTML, then runs the normal tag-strip + second entity
decode pass (needed for things like a stray `&amp;nbsp;` which only fully
resolves to a space after two decode passes).

## Departments endpoint (not used by this CLI, documented for reference)

```
GET https://boards-api.greenhouse.io/v1/boards/tenstorrent/departments
```

Lists every department (including empty ones) with nested `jobs` arrays. Useful
for discovering the full department taxonomy (confirmed department names
include `Tensix`, `RISC V`, `AI SW`, `Systems SW`, `CPU`, `Product Software
Engineering`, `Automotive`, `Silicon`, etc.) but not required for `search` or
`detail`, so the CLI does not call it.

## Notes / quirks

- No API key or authentication of any kind.
- Board size fluctuates as reqs open/close; do not hardcode a total count.
- `first_published` can be much earlier than `updated_at` if a posting was
  edited long after it first went live — `--jobage` uses `first_published`
  first specifically to reflect true posting age.
- Tenstorrent frequently posts roles open to multiple sites at once (e.g. one
  req covering both a US and a Taiwan office) — `location.name` reflects this
  as a single semicolon-joined string rather than one location.
