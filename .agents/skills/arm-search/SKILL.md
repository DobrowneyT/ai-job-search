---
name: arm-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs at Arm on Arm's
  own careers site (careers.arm.com) — Software Engineering, Hardware
  Engineering, Silicon, and other roles worldwide (Cambridge/Manchester UK,
  Bengaluru, Austin, Budapest, Taipei, and more). Invoke for Arm openings,
  Arm vacancies, Arm careers, working at Arm, or to look up a specific Arm
  job posting by ID or URL. Trigger phrases: Arm jobs, jobs at Arm,
  careers.arm.com, Arm careers, Arm vacancies, Arm openings, working at Arm,
  look up this Arm posting.
context: fork
allowed-tools: Bash(bun run .agents/skills/arm-search/cli/src/cli.ts *)
---

# Arm Search Skill

Search live job listings from **careers.arm.com**, Arm's own careers site (built
on the Radancy "TalentBrew" platform). No authentication, no API key, and
**zero runtime dependencies** — it runs with just `bun`. Listings are global;
there is a meaningful UK presence (Cambridge is Arm's global HQ; Manchester
also appears) but most results will be non-UK (Bengaluru, Austin, Budapest,
Taipei, and more) since Arm hires worldwide in English.

## When to use this skill

- Search Arm's own open roles by keyword (title, skill, team)
- Get the full description, category, employment type, and apply link of a specific Arm posting

## Commands

### Search job listings

```bash
bun run .agents/skills/arm-search/cli/src/cli.ts search -q "<query>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role, team, office name). Recommended.
- `--location <text>` / `-l <text>` — **folded into the keyword query, not a strict filter.** Arm's careers site has no server-side location filter reachable without JavaScript (see "Notes" below); passing `-l Cambridge` biases full-text-matched results toward Cambridge but can still return other offices. Always check each result's own `location` field.
- `--jobage <days>` — **accepted but has no effect.** Arm's careers site has no server-side posting-age filter of any kind (see Notes). Kept for flag compatibility with other portal skills.
- `--page <n>` — page number (1-indexed, 15 results per page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/arm-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric job ID from `search` results (e.g. `96521990288`). You may
also pass a full `careers.arm.com/job/...` URL. Returns the full description,
category, employment type, posting date, Arm's internal req ID, and apply link.

## Usage examples

```bash
# Software engineering roles worldwide, human-readable
bun run .agents/skills/arm-search/cli/src/cli.ts search -q "software engineer" --format table

# Firmware roles biased toward Cambridge (Arm's global HQ)
bun run .agents/skills/arm-search/cli/src/cli.ts search -q "firmware engineer" -l Cambridge --format table

# Hardware engineering, page 2
bun run .agents/skills/arm-search/cli/src/cli.ts search -q "hardware engineer" --page 2 --format table

# Embedded Linux / kernel roles
bun run .agents/skills/arm-search/cli/src/cli.ts search -q "embedded linux kernel" --limit 10

# Full details for a specific job
bun run .agents/skills/arm-search/cli/src/cli.ts detail 96521990288 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is scraped from careers.arm.com's server-rendered `/search-jobs` and `/job/...` pages — see `url-reference.md` for the full investigation, including why an API route was not used.
- robots.txt only disallows `/search-jobs/` (trailing slash); this skill only ever fetches `/search-jobs` (no trailing slash, query-string only) and `/job/...`, both allowed.
- **No true server-side location filter.** Country/city facet checkboxes on the site are JavaScript/AJAX-driven against an endpoint robots.txt disallows; a plain GET with `Country=`, `location=`, or even `latitude`/`longitude`/`distance` params has no effect on results. `--location` therefore only folds into the keyword search.
- **No posting-age filter at all**, even client-side — there's no date-bucket facet on the site (unlike reed.co.uk's today/3-day/week/2-week buckets). `--jobage` is a no-op.
- Company is always `"Arm"`.
- Page size is fixed at 15 results per page.
- Arm's own internal req ID (e.g. `2020-3449`, shown as `reqId` in `detail` output) differs from the numeric job ID used in the URL and by this CLI's `search`/`detail` commands — use the numeric ID for `detail <id>`.
