---
name: totaljobs-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in the United
  Kingdom on totaljobs.com (StepStone group) — job listings anywhere in the UK
  (London, Manchester, Cambridge, Edinburgh) or to look up a specific Totaljobs
  posting. Trigger phrases: UK jobs, jobs in the UK, totaljobs, totaljobs.com,
  find a job in England/Scotland/Wales, London jobs, UK vacancies, UK job
  search, British job market, look up this totaljobs posting.
context: fork
allowed-tools: Bash(bun run .agents/skills/totaljobs-search/cli/src/cli.ts *)
---

# Totaljobs Search Skill

Search live job listings from **totaljobs.com**, one of the UK's largest job
boards (StepStone group). No authentication, no API key, and **zero runtime
dependencies** — it runs with just `bun`. Covers the whole United Kingdom;
filter by town/city with a radius in miles.

## Access note

Data comes from Totaljobs' public job pages. Their robots.txt allows the `/jobs`
search paths for general agents (with some pagination-parameter restrictions the
CLI respects by using the site's own offset parameter). This is for **personal
job searching**: keep request volume low and do not use it commercially or for
bulk data collection. Run it on your own responsibility.

## When to use this skill

- Search for job openings anywhere in the UK, optionally around a town/city
- Filter by recency (posted today / last 3 / 7 / 14 days)
- Get the full description, salary, and employment type of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/totaljobs-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Recommended.
- `--location <text>` / `-l <text>` — UK town or city (e.g. `Cambridge`, `London`). Optional; omit for UK-wide.
- `--radius <miles>` — radius around `--location`.
- `--jobage <days>` — posted within N days. Mapped to Totaljobs' buckets: `1` → last 24 h, `≤3` → 3 days, `≤7` → 7 days, anything else ≤ 9998 → 14 days. Omit for all postings.
- `--page <n>` — page number (1-indexed, 25 results per page).
- `--limit <n>` / `-n <n>` — cap results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/totaljobs-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the job ID from `search` results (e.g. `107667827`). You may also pass a
full `totaljobs.com/job/...` URL. Returns the full description, salary,
employment type, posting and expiry dates.

## Usage examples

```bash
# Embedded firmware roles across the UK, human-readable
bun run .agents/skills/totaljobs-search/cli/src/cli.ts search -q "embedded firmware engineer" --format table

# Embedded roles within 20 miles of Cambridge
bun run .agents/skills/totaljobs-search/cli/src/cli.ts search -q "embedded engineer" -l Cambridge --radius 20 --format table

# Fresh postings only (last week), first 10
bun run .agents/skills/totaljobs-search/cli/src/cli.ts search -q "firmware" --jobage 7 --limit 10

# Software roles in London, page 2
bun run .agents/skills/totaljobs-search/cli/src/cli.ts search -q "software engineer" -l London --page 2 --format table

# Full details for a specific job
bun run .agents/skills/totaljobs-search/cli/src/cli.ts detail 107667827 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Search data is read from the `window.__PRELOADED_STATE__["app-unifiedResultlist"]` JSON embedded in the results page; detail data from the schema.org JobPosting `ld+json` block. Structured fields, not markup scraping — see `url-reference.md`.
- **Detail pages hang for cookie-less clients.** The `detail` command transparently bootstraps a session cookie with one extra lightweight request first; this is expected behavior, not a bug.
- Page size is fixed at 25. `meta.total` in JSON output is the full match count across all pages. Pagination uses the site's own `of=<offset>` parameter (robots.txt restricts the `page=` parameter, which the CLI therefore avoids).
- Totaljobs' date filter is bucketed (1 / 3 / 7 / 14 days); `--jobage` snaps up to the nearest bucket. No bucket beyond 14 days — omit the flag for older postings.
- Keywords and location are slugified into the URL path (`/jobs/embedded-firmware-engineer/in-cambridge`), matching how the site itself builds search URLs.
- Salary is the site's display string (e.g. "£60000 - £80000 per annum"); it can be null, and on detail pages is sometimes empty even when the search card showed one.
