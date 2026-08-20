---
name: imagination-search
version: 1.0.0
description: >
  Use this skill when the user wants to search job openings at Imagination Technologies —
  the UK-based (Kings Langley, Hertfordshire) semiconductor IP company known for PowerVR
  GPU IP and RISC-V CPU IP — or fetch details on a specific Imagination vacancy. Also hires
  in Bristol UK, Gdansk/Wroclaw Poland, Timisoara Romania, and Shanghai China. Trigger
  phrases: Imagination Technologies jobs, Imagination Tech careers, PowerVR jobs, GPU IP
  jobs, Imagination vacancies, jobs at Imagination, working at Imagination Technologies.
context: fork
allowed-tools: Bash(bun run .agents/skills/imagination-search/cli/src/cli.ts *)
---

# Imagination Technologies Search Skill

Search live job listings from Imagination Technologies' public careers site
(`imaginationtech.com/careers/vacancies/`), which is powered by the **PageUp People**
applicant-tracking system. No authentication, no API key, and **zero runtime
dependencies** — it runs with just `bun`.

Imagination Technologies designs GPU (PowerVR), AI accelerator, and RISC-V CPU IP licensed
to semiconductor and device makers worldwide — directly relevant to embedded systems / silicon
job searches, and UK-based (Kings Langley HQ, plus a Bristol office).

## When to use this skill

- Search for open roles at Imagination Technologies, optionally by keyword and/or location
- Filter by recency (posted within the last N days)
- Get the full description of a specific vacancy

## Commands

### Search job listings

```bash
bun run .agents/skills/imagination-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Filtered server-side.
- `--location <text>` / `-l <text>` — location facet, e.g. `"Bristol UK"`, `"Kings Langley UK"`,
  `"Gdansk Poland"`, `"Wroclaw Poland"`, `"Timisoara Romania"`, `"Shanghai China"`. Filtered server-side.
- `--jobage <days>` — posted within N days. Filtered **client-side** (the feed has no native date filter).
- `--page <n>` — page number (1-indexed, 20 results per page, paginated client-side).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/imagination-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the job ID from `search` results (e.g. `502702`). You may also pass a full job-detail
URL (e.g. `https://careers.pageuppeople.com/774/cw/en/job/502702/senior-gpu-software-engineer`).
Returns the full description, work type, job sector, categories, salary (if published), closing
date, and apply link.

## Usage examples

```bash
# Software engineering roles
bun run .agents/skills/imagination-search/cli/src/cli.ts search -q "software engineer" --format table

# GPU roles based in Bristol
bun run .agents/skills/imagination-search/cli/src/cli.ts search -q "GPU" -l "Bristol UK" --format table

# Firmware-adjacent roles, posted in the last 30 days
bun run .agents/skills/imagination-search/cli/src/cli.ts search -q "verification" --jobage 30 --format table

# Full details for a specific vacancy
bun run .agents/skills/imagination-search/cli/src/cli.ts detail 502702 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is Imagination Technologies' own public PageUp `jobs.json` feed — no credentials required,
  no personal-use warning needed (this is the company's own careers site, not a scraped third-party
  aggregator with restrictive ToS).
- Imagination currently has a small, single-digit-to-low-30s number of open roles at any time, so
  `search` fetches the (filtered) feed in one request rather than paging server-side.
- `--jobage` and `--page` are applied client-side — see `url-reference.md` for why.
- Job IDs are numeric (e.g. `502702`) — pass them as-is to `detail`.
