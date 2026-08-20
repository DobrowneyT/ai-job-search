# imagination-cli

CLI for searching jobs on **Imagination Technologies'** public careers site
(GPU/AI/connectivity IP, Kings Langley UK — PowerVR GPUs, RISC-V CPU IP).

**Data source**: PageUp People's public `jobs.json` feed that backs
`imaginationtech.com/careers/vacancies/` (org id `774`, channel `cw`, locale `en`):
`https://careers.pageuppeople.com/774/cw/en/jobs.json`.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

## Installation

```bash
cd .agents/skills/imagination-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search current vacancies (`--query`, `--location`, `--jobage`, `--page`, `--limit`) |
| `detail` | Fetch full detail for a single vacancy by ID or job-detail URL |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Software engineering roles
bun run src/cli.ts search -q "software engineer" --format table

# GPU roles in Bristol
bun run src/cli.ts search -q "GPU" -l "Bristol UK" --format table

# Posted in the last 30 days
bun run src/cli.ts search -q "verification" --jobage 30 --format table

# Full detail for one vacancy
bun run src/cli.ts detail 502702 --format plain
```

See `../SKILL.md` for the full flag reference and `../url-reference.md` for the endpoint details.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role). Filtered server-side by PageUp. |
| `--location` | `-l` | Location facet, e.g. `"Bristol UK"`, `"Kings Langley UK"`, `"Gdansk Poland"`. Filtered server-side. |
| `--jobage` | | Posted within N days. **Filtered client-side** — the feed has no date-range param. |
| `--page` | | 1-indexed page (20 results/page, client-side — the feed returns the whole matching set in one response). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## Notes

- Imagination's current vacancy count is small (~20-35 openings across all locations at any
  time), so the "search" endpoint fetching the full feed and filtering client-side (for jobage
  and paging) is cheap and accurate.
- The feed includes the full HTML job description (`Overview`) inline, so `detail` re-filters
  the same feed by ID rather than hitting a separate per-job endpoint (mirrors PageUp's own
  widget behavior in "load details inline" mode).
