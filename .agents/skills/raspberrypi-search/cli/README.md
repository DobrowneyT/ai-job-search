# raspberrypi-cli

CLI for searching job listings at **both Raspberry Pi entities** — Raspberry Pi
Ltd (the commercial hardware/silicon company) and the Raspberry Pi Foundation
(the affiliated UK educational charity) — via Workable's public job-board API.

**Data source**: Workable (`apply.workable.com/api/v3/accounts/<account>/jobs` for search, `apply.workable.com/api/v1/widget/accounts/<account>` for detail), under two accounts: `raspberrypi` (Ltd) and `raspberrypifoundation` (Foundation).
**Authentication**: None required — both accounts' listings are public.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

`raspberrypi.com/jobs` itself is Cloudflare-challenge-walled (every path on the
domain 403s to a plain HTTP client) and cannot be scraped directly — this CLI
reaches the same underlying data through Workable instead. See `../url-reference.md`
for the full investigation.

## Installation

```bash
cd .agents/skills/raspberrypi-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search jobs by keyword across one or both entities |
| `detail` | Fetch full detail for a single job by id, URL, or bare shortcode |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Everything matching "software engineer" across both entities
bun run src/cli.ts search -q "software engineer" --format table

# Silicon/hardware roles at Raspberry Pi Ltd only
bun run src/cli.ts search -q "IC design" --source ltd --format table

# Foundation roles, Cambridge only
bun run src/cli.ts search --source foundation -l Cambridge --format table

# Full detail for one job
bun run src/cli.ts detail ltd:AB9B343504 --format plain
```

See `../SKILL.md` for the full flag reference and entity-distinguishing notes.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role). Full-text; optional. |
| `--source` | | `ltd` \| `foundation` \| `all` (default). |
| `--location` | `-l` | Client-side substring filter on the result's location string. |
| `--jobage` | | Posted within N days (client-side filter). |
| `--page` | | 1-indexed page (25/page, client-side). Default 1. |
| `--limit` | `-n` | Cap results emitted (client-side). |
| `--format` | | `json` \| `table` \| `plain`. |

## Tests

```bash
bun run typecheck
bun run test
```
