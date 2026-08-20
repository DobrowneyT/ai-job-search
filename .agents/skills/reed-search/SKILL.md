---
name: reed-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in the United
  Kingdom on reed.co.uk — job listings anywhere in the UK (London, Manchester,
  Cambridge, Edinburgh, remote UK roles) or to look up a specific Reed job
  posting. Trigger phrases: UK jobs, jobs in the UK, reed, reed.co.uk, find a
  job in England/Scotland/Wales, London jobs, UK vacancies, UK job search,
  British job market, look up this reed posting.
context: fork
allowed-tools: Bash(bun run .agents/skills/reed-search/cli/src/cli.ts *)
---

# Reed Search Skill

Search live job listings from **reed.co.uk**, the UK's largest stand-alone job
board. No authentication, no API key, and **zero runtime dependencies** — it runs
with just `bun`. Covers the whole United Kingdom; filter by town/city/postcode
with a proximity radius.

## Access note

Data comes from Reed's public `/jobs` pages, which Reed's robots.txt explicitly
allows (only `/api/` paths are disallowed, and this skill never touches them).
Still, this is for **personal job searching**: keep request volume low and do not
use it commercially or for bulk data collection.

## When to use this skill

- Search for job openings anywhere in the UK, optionally around a town/city/postcode
- Filter by recency (posted today / last 3 / 7 / 14 days)
- Get the full description, salary, and contract details of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/reed-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Recommended.
- `--location <text>` / `-l <text>` — UK town, city, or postcode (e.g. `Cambridge`, `London`, `M1`). Optional; omit for UK-wide.
- `--proximity <miles>` — radius around `--location` (Reed's default is 10 miles).
- `--jobage <days>` — posted within N days. Mapped to Reed's buckets: `1` → today, `≤3` → last three days, `≤7` → last week, anything else ≤ 9998 → last two weeks. Omit for all postings.
- `--page <n>` — page number (1-indexed, 25 results per page).
- `--limit <n>` / `-n <n>` — cap results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/reed-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the job ID from `search` results (e.g. `57073138`). You may also pass a
full `reed.co.uk/jobs/<slug>/<id>` URL. Returns the full description, salary,
contract type, hours, workplace type, posting and expiry dates.

## Usage examples

```bash
# Embedded firmware roles across the UK, human-readable
bun run .agents/skills/reed-search/cli/src/cli.ts search -q "embedded firmware engineer" --format table

# Embedded roles within 25 miles of Cambridge
bun run .agents/skills/reed-search/cli/src/cli.ts search -q "embedded engineer" -l Cambridge --proximity 25 --format table

# Fresh postings only (last week), first 10
bun run .agents/skills/reed-search/cli/src/cli.ts search -q "firmware" --jobage 7 --limit 10

# Software roles in London, page 2
bun run .agents/skills/reed-search/cli/src/cli.ts search -q "software engineer" -l London --page 2 --format table

# Full details for a specific job
bun run .agents/skills/reed-search/cli/src/cli.ts detail 57073138 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is read from the `__NEXT_DATA__` JSON blob embedded in Reed's public pages — structured fields, not HTML scraping, so results are complete and stable. See `url-reference.md` for the endpoint documentation.
- Page size is fixed at 25 results per page. `meta.total` in JSON output is Reed's full match count across all pages.
- Reed's date filter is bucketed (today / 3 / 7 / 14 days); `--jobage` snaps up to the nearest bucket. There is no bucket beyond two weeks — for older postings, omit the flag.
- Requesting a page beyond the last one returns HTTP 404; the CLI reports it as zero results rather than an error.
- Salaries in search results are reconstructed from numeric fields as `£from - £to`; the `detail` command returns Reed's own display string (e.g. "£38,000 - £70,000 per annum").
- Promoted listings can appear twice in Reed's data; the CLI dedupes by job ID.
