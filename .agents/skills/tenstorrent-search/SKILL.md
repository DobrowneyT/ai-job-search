---
name: tenstorrent-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search Tenstorrent's job openings
  — the AI/RISC-V chip design company founded by Jim Keller, and the
  candidate's stated "dream company." Covers all Tenstorrent teams globally
  (Software, Hardware, ASIC/Silicon, Firmware, RISC-V CPU architecture,
  Packaging, Automotive, etc.) across all Tenstorrent sites (Santa Clara,
  Toronto, Austin, Taipei, and others) and remote. Trigger phrases: Tenstorrent
  jobs, Tenstorrent careers, Tenstorrent openings, jobs at Tenstorrent, RISC-V
  chip jobs at Tenstorrent, Jim Keller company jobs, check Tenstorrent for new
  postings.
context: fork
allowed-tools: Bash(bun run .agents/skills/tenstorrent-search/cli/src/cli.ts *)
---

# Tenstorrent Search Skill

Search live job openings from **Tenstorrent's** Greenhouse-hosted careers board
— the AI/RISC-V chip design company founded by Jim Keller. No authentication,
no API key, and **zero runtime dependencies** — it runs with just `bun`.

Tenstorrent is called out explicitly in this candidate's profile (`CLAUDE.md`)
as the "dream company" among target sectors (embedded systems / silicon,
alongside Arm, Raspberry Pi, and RISC-V-ecosystem companies), so this skill is
a strong fit for direct, recurring monitoring rather than only appearing via
general aggregator searches.

## When to use this skill

- Check whether Tenstorrent has any new openings matching the candidate's
  profile (firmware, embedded Linux, RISC-V, silicon/ASIC, etc.)
- Search Tenstorrent's board by keyword, location, or department
- Get the full description of a specific Tenstorrent posting

## Commands

### Search job listings

```bash
bun run .agents/skills/tenstorrent-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (matched against job title). Recommended.
- `--location <text>` / `-l <text>` — substring match against the posting's location text, e.g. `"Toronto"`, `"Santa Clara"`, `"Remote"`. Optional.
- `--department <text>` / `-d <text>` — substring match against the Greenhouse department name, e.g. `"RISC V"`, `"Tensix"`, `"AI SW"`. Optional; see Notes — department names don't include a literal "Firmware" team.
- `--jobage <days>` — only postings first published within N days. Omit for all postings.
- `--page <n>` — page number (1-indexed, 20 results per page — client-side, see Notes).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/tenstorrent-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric Greenhouse job ID from `search` results (e.g. `5132733007`).
You may also pass a full `job-boards.greenhouse.io/tenstorrent/jobs/<id>` URL.
Returns the full description, department, requisition ID, and apply link.

## Usage examples

```bash
# Firmware roles anywhere
bun run .agents/skills/tenstorrent-search/cli/src/cli.ts search -q "firmware" --format table

# Software roles in Toronto
bun run .agents/skills/tenstorrent-search/cli/src/cli.ts search -q "software" -l Toronto --format table

# RISC-V roles posted in the last 30 days
bun run .agents/skills/tenstorrent-search/cli/src/cli.ts search -q "RISC-V" --jobage 30 --format table

# Everything in the Tensix department
bun run .agents/skills/tenstorrent-search/cli/src/cli.ts search -d Tensix --format table

# Full details for a specific posting
bun run .agents/skills/tenstorrent-search/cli/src/cli.ts detail 5132733007 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data source: Greenhouse's public, unauthenticated job-board JSON API
  (`boards-api.greenhouse.io/v1/boards/tenstorrent`) — the same API that backs
  Tenstorrent's own `tenstorrent.com/en/careers` page. See `url-reference.md`
  for full endpoint documentation.
- The Greenhouse board endpoint has **no server-side search/filter/pagination
  parameters** — it returns the entire open-requisition list (~130 postings) in
  one response. This CLI fetches the full board once per command and does all
  filtering, sorting (freshest-first), and paging client-side. `--page` here is
  a client-side 20-per-page slice, not a portal-native page.
- `--jobage` is computed from each posting's `first_published` date (falling
  back to `updated_at`) since Greenhouse has no native age filter.
- A posting's location can list multiple sites (e.g. one req open to both
  Santa Clara and Taipei) as a single `;`-separated string.
- Department names reflect Tenstorrent's internal team taxonomy (`Tensix`,
  `RISC V`, `AI SW`, `CPU`, `Systems SW`, `Packaging`, `Automotive`, etc.) —
  there is no literal `"Firmware"` department, so `--department` is a
  secondary filter alongside `--query`, not a substitute for it.
- No personal-use warning is required: this is Greenhouse's own public REST
  API, not scraped HTML, and neither Tenstorrent's nor Greenhouse's robots.txt
  disallows the paths used.
