---
name: adzuna-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in the United
  Kingdom via Adzuna's official job-search API — job listings anywhere in the
  UK (London, Manchester, Cambridge, Edinburgh) aggregated from many UK job
  sources, or to look up a previously-searched Adzuna posting. Trigger
  phrases: UK jobs, jobs in the UK, adzuna, find a job in England/Scotland/
  Wales, London jobs, UK vacancies, UK job search, British job market, look up
  this adzuna posting.
context: fork
allowed-tools: Bash(bun run .agents/skills/adzuna-search/cli/src/cli.ts *)
---

# Adzuna Search Skill

Search live job listings via **Adzuna's official public Jobs API**, which
aggregates postings from many UK job sources into one feed. Unlike this repo's
other portal skills, this is **not HTML scraping** — it's a documented JSON API,
so it isn't subject to the bot-detection walls that block direct scraping of
Indeed, Glassdoor, or CV-Library. **Zero runtime dependencies** — it runs with
just `bun`.

## Setup (required)

This skill needs a free Adzuna API key:

1. Register at <https://developer.adzuna.com/> (free, email + password).
2. Find your `App ID` and `App Key` on your account dashboard.
3. Create `.agents/skills/adzuna-search/cli/.env` (copy `.env.example` in the
   same folder) with:
   ```
   ADZUNA_APP_ID=your-app-id
   ADZUNA_APP_KEY=your-app-key
   ```
   This file is gitignored — **never commit real credentials**.

Without these, every command exits with a `NO_AUTH` error.

## Known limitation

Adzuna's free API returns only a **truncated (~500 character) description**
per job, and has **no endpoint to fetch a single job by ID**. The ad redirect
link that would show the full posting is blocked (403) to non-browser clients.
So:
- `search` results include the truncated snippet as `descriptionSnippet`.
- `detail <id>` cannot query Adzuna directly. Instead, `search` caches full
  result records to a local temp file, and `detail` reads from that cache —
  **you must run `search` before `detail` will find anything**. There is no
  way to get more description text than `search` already returned.

## When to use this skill

- Search for job openings anywhere in the UK, optionally around a town/city
- Filter by recency (posted within N days) or salary-relevant location
- Re-display a previously-searched job's snippet, salary, and category

## Commands

### Search job listings

```bash
bun run .agents/skills/adzuna-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Recommended.
- `--location <text>` / `-l <text>` — UK town or city (e.g. `Cambridge`, `London`). Optional; omit for UK-wide.
- `--distance <miles>` — radius around `--location`.
- `--jobage <days>` — posted within N days (any positive integer, unlike the bucketed limits on other UK portals). Omit for all postings.
- `--page <n>` — page number (1-indexed, 25 results per page).
- `--limit <n>` / `-n <n>` — cap results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch cached job detail

```bash
bun run .agents/skills/adzuna-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the job ID from a `search` result (e.g. `5763963528`), or the full
`adzuna.co.uk/jobs/land/ad/...` URL. Fails with `NOT_CACHED` if the ID wasn't
in a recent `search` result — this is expected, not a bug (see limitation above).

## Usage examples

```bash
# Embedded firmware roles across the UK, human-readable
bun run .agents/skills/adzuna-search/cli/src/cli.ts search -q "embedded firmware engineer" --format table

# Embedded roles within 20 miles of Cambridge
bun run .agents/skills/adzuna-search/cli/src/cli.ts search -q "embedded engineer" -l Cambridge --distance 20 --format table

# Fresh postings only (last 7 days), first 10
bun run .agents/skills/adzuna-search/cli/src/cli.ts search -q "firmware" --jobage 7 --limit 10

# Software roles in London, page 2
bun run .agents/skills/adzuna-search/cli/src/cli.ts search -q "software engineer" -l London --page 2 --format table

# Re-display a job found in the last search
bun run .agents/skills/adzuna-search/cli/src/cli.ts detail 5763963528 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's cached snippet (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data source: `api.adzuna.com/v1/api/jobs/gb/search/<page>` — Adzuna's official public Jobs API, not scraped HTML. See `url-reference.md` for full parameter documentation.
- Adzuna aggregates from many UK sources, so results overlap with `reed-search` and `totaljobs-search` in places, but also surface postings unique to Adzuna's index.
- `sort_by=date` is always applied so the newest postings surface first.
- Salary is reconstructed from `salary_min`/`salary_max` where present; many postings have neither (returns `null`).
- Adzuna's own web frontend (`adzuna.co.uk`) is bot-protected like several other big UK boards — only the documented `api.adzuna.com` endpoints are used here.
