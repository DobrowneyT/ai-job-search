---
name: stmicro-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs at
  STMicroelectronics — the semiconductor manufacturer behind the STM32
  microcontroller family — or to look up a specific STMicroelectronics job
  posting. Results span STMicroelectronics' global operations (many European
  sites including the UK, plus Asia and the Americas), not a single country,
  so pass a location filter when the user cares about a specific market.
  Trigger phrases: STMicroelectronics jobs, ST jobs, STM32 jobs, semiconductor
  jobs, chip jobs, embedded firmware jobs at ST, silicon company jobs, careers
  at STMicroelectronics, ST careers, look up this STMicroelectronics posting.
context: fork
allowed-tools: Bash(bun run .agents/skills/stmicro-search/cli/src/cli.ts *)
---

# STMicroelectronics Search Skill

Search live job listings from **STMicroelectronics'** careers site
(`stmicroelectronics.eightfold.ai`), a major European semiconductor
manufacturer and maker of the STM32 microcontroller family. No authentication,
no API key, and **zero runtime dependencies** — it runs with just `bun`.

> ST hires across ~40 countries. Postings in the search results can span
> Europe (France, Italy, UK, Malta, Germany, ...), Asia (Singapore, Malaysia,
> Taiwan, the Philippines, China, ...), North Africa (Morocco), and the
> Americas. There is no single-market default — always check the `location`
> field, or pass `--location` to narrow the keyword query, if a specific
> country or city matters.

## Access note

Data comes from ST's own Eightfold.ai-hosted job-search API
(`/api/apply/v2/jobs`), which ST's `robots.txt` **explicitly allows**
alongside `/careers`. This is a documented JSON API the site's own front end
calls, not scraped HTML. Still, keep request volume low and use it for
personal job searching, not bulk data collection.

## When to use this skill

- Search for embedded/firmware/software/hardware roles (or any other
  discipline) at STMicroelectronics, globally or in a specific country/city
- Get the full description, department, business unit, and all eligible
  locations for a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/stmicro-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Recommended.
- `--location <text>` / `-l <text>` — free-text location filter, e.g. `"United Kingdom"`, `"Edinburgh"`. ST's API has no dedicated location parameter that reliably narrows results (see `url-reference.md`), so this is folded into the keyword query — same pattern as `jobindex-search`'s "include the city in `--query`" approach. This is fuzzy, not exact: it can occasionally surface unrelated countries on partial word overlap (e.g. "United Kingdom" pulling in some "United States" postings) — always check the `location` field of results rather than trusting the filter blindly.
- `--jobage <days>` — posted within N days. There's no server-side date filter; this is applied client-side against each job's ATS creation date, and only within the already-fetched page (documented approximation, see `url-reference.md`).
- `--page <n>` — page number (1-indexed, 25 results per page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/stmicro-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the job ID from a `search` result (e.g. `563637172372091`). You may
also pass a full `stmicroelectronics.eightfold.ai/careers/job/<id>` URL.
Returns the full description, department, business unit, work-location mode,
and every eligible location for the role.

## Usage examples

```bash
# Embedded software roles anywhere ST hires
bun run .agents/skills/stmicro-search/cli/src/cli.ts search -q "embedded software engineer" --format table

# STM32-specific roles
bun run .agents/skills/stmicro-search/cli/src/cli.ts search -q "STM32" --format table

# Firmware roles, UK only (folded into the keyword query — see Notes)
bun run .agents/skills/stmicro-search/cli/src/cli.ts search -q "firmware" -l "United Kingdom" --format table

# First 10 results, page 2
bun run .agents/skills/stmicro-search/cli/src/cli.ts search -q "software engineer" --page 2 --limit 10

# Full details for a specific posting
bun run .agents/skills/stmicro-search/cli/src/cli.ts detail 563637172372091 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data source: `stmicroelectronics.eightfold.ai/api/apply/v2/jobs` (and
  `/jobs/<id>` for detail) — ST's own Eightfold.ai-hosted API, not scraped
  HTML. See `url-reference.md` for full endpoint documentation and the
  quirks discovered while investigating it (including a dead-end
  `talent-soft.com` domain surfaced by some web searches — don't build
  against that one).
- Page size is fixed at 25 results per page.
- `--location` narrows results by folding the text into the free-text
  `query` parameter (which matches against both title and location) rather
  than a dedicated location filter — several other location-filter
  parameter names were tried against the live API and none reliably narrowed
  results (see `url-reference.md` Quirks).
- Many postings are open at multiple sites simultaneously; `search` surfaces
  the primary location, and `detail --format plain` lists the rest under
  "Also posted at".
- `--jobage` is a client-side approximation (no server-side date filter
  exists) and only filters within the page already fetched, not the full
  result set.
