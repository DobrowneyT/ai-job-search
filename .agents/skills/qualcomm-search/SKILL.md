---
name: qualcomm-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for open roles on Qualcomm's own
  careers site (careers.qualcomm.com) — Snapdragon / mobile & embedded SoC silicon,
  a top-tier target company for embedded, firmware, kernel, and computer-architecture
  candidates. Trigger phrases: Qualcomm jobs, Qualcomm careers, Qualcomm openings,
  Qualcomm vacancies, jobs at Qualcomm, Snapdragon jobs, "search Qualcomm", find a
  Qualcomm posting, look up this Qualcomm job.
context: fork
allowed-tools: Bash(bun run .agents/skills/qualcomm-search/cli/src/cli.ts *)
---

# Qualcomm Careers Search Skill

Search live job listings on Qualcomm's own careers site (`careers.qualcomm.com`) —
Qualcomm designs Snapdragon and other mobile/embedded/automotive SoCs, making this a
directly relevant portal for embedded systems, firmware, kernel, and computer-architecture
job searches. No authentication, no API key, and **zero runtime dependencies** — it runs
with just `bun`.

## Why this skill exists

Qualcomm's careers site is backed by the Eightfold.ai talent platform (not Workday,
despite Workday being common at large enterprises — see `url-reference.md`). Eightfold
exposes a real JSON search API and a JSON detail API that the React-rendered career page
calls internally. This skill calls those JSON endpoints directly instead of scraping
rendered HTML, which is far more stable.

## When to use this skill

- Search Qualcomm's open roles by keyword (job title, skill, technology)
- Filter by location (free text, fuzzy-matched against posting locations)
- Filter by recency (posted within N days) — applied client-side, see Notes
- Get the full description of a specific Qualcomm posting

## Commands

### Search job listings

```bash
bun run .agents/skills/qualcomm-search/cli/src/cli.ts search -q "<keywords>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Recommended.
- `--location <text>` / `-l <text>` — free-text location filter, e.g. `"San Diego"`,
  `"Cork, Ireland"`, `"Hyderabad"`. Matched fuzzily by Qualcomm's own search against each
  posting's standardized location.
- `--jobage <days>` — posted within N days. **Not a native API parameter** — the CLI
  fetches results normally and filters client-side against each result's posted date.
  Omit for all postings.
- `--page <n>` — 1-indexed page. The API returns a fixed 10 results per page regardless
  of any requested page size.
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/qualcomm-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric job ID from `search` results (e.g. `446717134102`). You may also pass
a full `careers.qualcomm.com/careers/job/<id>` URL. Returns the full job description,
department, business unit, and posted date.

## Usage examples

```bash
# Embedded software engineer roles, any location
bun run .agents/skills/qualcomm-search/cli/src/cli.ts search -q "embedded software engineer" --format table

# Firmware roles in San Diego, posted in the last 30 days
bun run .agents/skills/qualcomm-search/cli/src/cli.ts search -q "firmware" -l "San Diego" --jobage 30 --format table

# Kernel roles in Cork, Ireland
bun run .agents/skills/qualcomm-search/cli/src/cli.ts search -q "linux kernel" -l "Cork, Ireland" --format table

# Roles in Canada (matches Markham, Ontario and similar postings)
bun run .agents/skills/qualcomm-search/cli/src/cli.ts search -q "software engineer" -l "Canada" --format table

# Full details for a specific posting
bun run .agents/skills/qualcomm-search/cli/src/cli.ts detail 446717134102 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data source: Qualcomm's own public careers site, backed by Eightfold.ai (`/api/pcsx/search`
  for search, `/api/apply/v2/jobs/<id>` for detail — see `url-reference.md`). No credentials
  required; `robots.txt` explicitly allows both API paths.
- `company` is always `"Qualcomm"` — this is a single-employer career site, not an
  aggregator, so every result is a Qualcomm posting.
- Page size is fixed at 10 results per page; the API's `num` parameter has no effect.
- `--jobage` has no native API equivalent and is applied client-side against each
  result's posted date.
- Job descriptions are rich HTML in the source data; the CLI strips tags and decodes
  entities for `plain` output, preserving paragraph breaks.
