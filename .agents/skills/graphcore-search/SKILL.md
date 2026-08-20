---
name: graphcore-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for open roles at
  Graphcore — the Bristol-headquartered AI chip design company behind the
  IPU accelerator — or to look up a specific Graphcore job posting. Covers
  Graphcore's UK offices (Bristol, Cambridge, London) as well as its Gdańsk,
  Bengaluru, and US (Austin/Milpitas) sites. Trigger phrases: Graphcore jobs,
  Graphcore careers, IPU accelerator jobs, AI chip jobs Bristol, silicon
  design jobs UK, Graphcore vacancies, look up this Graphcore posting.
context: fork
allowed-tools: Bash(bun run .agents/skills/graphcore-search/cli/src/cli.ts *)
---

# Graphcore Search Skill

Search live open roles on **Graphcore's public Greenhouse job board**
(`job-boards.greenhouse.io/graphcore`), Graphcore's own careers site being a
thin wrapper around the same data. This is a documented JSON API — **not
scraped HTML** — so it isn't subject to the bot-detection walls that block
direct scraping of some other boards. No authentication, no API key, and
**zero runtime dependencies** — it runs with just `bun`.

Directly relevant to embedded/silicon-focused searches: Graphcore designs
IPU (Intelligence Processing Unit) AI accelerators end-to-end, spanning
silicon, firmware, systems software, and datacenter infrastructure.

## When to use this skill

- Search for open roles at Graphcore, optionally filtered by keyword and/or office
- Filter by recency (posted within N days)
- Get the full description of a specific Graphcore posting

## Commands

### Search job listings

```bash
bun run .agents/skills/graphcore-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keywords matched against the job title and department (all terms must match). Recommended.
- `--location <text>` / `-l <text>` — substring match against the posting's office string, e.g. `Bristol`, `Cambridge`, `Gdansk`, `Bengaluru`. Optional; omit to search all Graphcore offices worldwide.
- `--jobage <days>` — posted within N days (based on `first_published`). Omit for all postings.
- `--page <n>` — page number (1-indexed, 25 results per page).
- `--limit <n>` / `-n <n>` — cap results emitted (client-side).
- `--format json|table|plain` — default `json`.

Graphcore's Greenhouse board has **no server-side query/location/pagination
parameters** — every call fetches the full open-roles list once and filters,
sorts (newest first), and paginates client-side. See `url-reference.md`.

### Fetch full job detail

```bash
bun run .agents/skills/graphcore-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the job ID from a `search` result (e.g. `8537660002`), or the full
`job-boards.greenhouse.io/graphcore/jobs/...` URL. Returns the full
description, department, employment type, and apply link.

## Usage examples

```bash
# Software engineering roles in Bristol
bun run .agents/skills/graphcore-search/cli/src/cli.ts search -q "software engineer" -l Bristol --format table

# Firmware roles anywhere Graphcore hires, posted in the last 30 days
bun run .agents/skills/graphcore-search/cli/src/cli.ts search -q "firmware" --jobage 30 --format table

# Embedded-adjacent roles, first 5
bun run .agents/skills/graphcore-search/cli/src/cli.ts search -q "embedded" --limit 5

# Second page of all "engineer" postings
bun run .agents/skills/graphcore-search/cli/src/cli.ts search -q "engineer" --page 2 --format table

# Full detail for a specific posting
bun run .agents/skills/graphcore-search/cli/src/cli.ts detail 8537660002 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data source: `boards-api.greenhouse.io/v1/boards/graphcore/jobs[/<id>]` — Greenhouse's official public Job Board API, not scraped HTML. See `url-reference.md` for full endpoint documentation and quirks.
- Graphcore's roles span Bristol, Cambridge, and London (UK), Gdańsk (Poland), Bengaluru (India), and Austin/Milpitas (US) — `--location` narrows to one of these via substring match, but omitting it searches everywhere Graphcore hires.
- Job descriptions come back HTML-entity-double-encoded from Greenhouse; the CLI decodes them in two passes before stripping tags — verified clean against live postings (no leftover tags or entity codes in `detail` output).
- No personal-use restriction applies here — this is an official public API intended for exactly this kind of integration, unlike the LinkedIn-style scraping skills in this repo.
