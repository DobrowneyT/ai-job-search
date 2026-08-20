# Graphcore Careers URL Reference

Investigated 2026-07-19. Graphcore's own careers pages (`graphcore.ai/careers`,
`graphcore.ai/jobs`) are a thin client-side wrapper around a **Greenhouse job
board** — the actual data lives at `job-boards.greenhouse.io/graphcore` and is
served by Greenhouse's public **Job Board API**, a documented JSON API, not
scraped HTML. No authentication required.

## Access check

- `boards-api.greenhouse.io/robots.txt` disallows only `/embed/` — the `/v1/boards/...`
  paths used here are not disallowed.
- `job-boards.greenhouse.io/robots.txt` has no active `Disallow` rules (the
  blanket-ban block is commented out).
- No login is required to view listings — the API is fully public.

## List (used by `search`)

```
GET https://boards-api.greenhouse.io/v1/boards/graphcore/jobs
```

Returns **every open requisition in one response** (229 at time of writing) —
there is no `q`/`location`/`page` query parameter on this endpoint at all.
Passing unsupported params is silently ignored. `search` therefore fetches
this once per invocation and does all filtering, sorting (newest first by
`first_published`), and pagination client-side (25/page to match the other
portal skills in this repo).

Each entry (without `?content=true`, which we don't request for `search`
since it isn't needed and balloons the payload from ~180KB to ~3.9MB):

| Field | Notes |
|-------|-------|
| `id` | Numeric, stable — feeds directly into `detail <id>` |
| `title` | Sometimes has trailing double spaces in the source data (e.g. `"Senior Software Engineer  "`) — normalized by collapsing whitespace |
| `location.name` | Free-text string; multi-office roles are semicolon-joined, e.g. `"Bristol, UK; Cambridge, UK; Gdańsk, Pomeranian Voivodeship, Poland"` |
| `first_published` | ISO datetime — used as the posting date (`updated_at` used as fallback for the rare job missing it) |
| `absolute_url` | Full `job-boards.greenhouse.io/graphcore/jobs/<id>` link |
| `company_name` | Always `"Graphcore"` |

## Detail (used by `detail <id>`)

```
GET https://boards-api.greenhouse.io/v1/boards/graphcore/jobs/<id>
```

Unlike Adzuna (this repo's other JSON-API skill), Greenhouse supports a direct
by-ID lookup, so `detail` needs no local cache — it just re-queries the API.
A closed/invalid ID returns HTTP 404, mapped to `null` by `jsonFetch` and
surfaced as `JOB_NOT_FOUND`.

The single-job endpoint always includes (no `content=true` needed):

- `content` — the full description, **HTML-entity-double-encoded**: the raw
  JSON string contains literal `&lt;p&gt;...&lt;/p&gt;` rather than `<p>...</p>`,
  and entities already present in the source markup show up as `&amp;nbsp;`
  instead of `&nbsp;`. `contentToText()` in `helpers.ts` decodes in two
  passes — once to reveal real tags/entities, then strips tags and decodes
  again — confirmed clean (no leftover tags or entity codes) against several
  live postings.
- `departments[].name` — e.g. `"SW Device"`, `"Core"`
- `offices[].location` — same office set as `location.name` but as a
  structured array; used as a fallback if `location.name` is ever absent
- `metadata[]` — includes a `"If part time (Number of hours)"` entry; used to
  derive `employmentType` (`"Part-time"` if > 0 hours, else `"Full-time"`)
- `application_deadline` — observed `null` on every posting checked; not
  surfaced as a dedicated field, would need adding if Graphcore starts using it

## Quirks

- No server-side search/filter/pagination on the list endpoint — see above.
- Listings span Graphcore's global offices, not just Bristol: Bristol,
  Cambridge, and London (UK); Gdańsk (Poland); Bengaluru (India); Austin and
  Milpitas (US). `--location` is a plain substring filter over `location.name`,
  so e.g. `-l Bristol` also matches multi-office roles that list Bristol
  alongside other cities.
- 229 open requisitions at time of writing — a large fraction (~60+) are
  "2026 Graduate ..." roles and "... - Bengaluru, multiple vacancies" postings
  that repeat the same title with different location suffixes.
- Rate limiting: not observed during testing (a few dozen requests); the CLI
  still backs off on 429/5xx per the repo's standard `jsonFetch` pattern.
