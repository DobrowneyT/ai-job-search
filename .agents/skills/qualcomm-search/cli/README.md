# qualcomm-cli

CLI for searching jobs on Qualcomm's own careers site (`careers.qualcomm.com`).

**Data source**: Qualcomm's Eightfold.ai-backed JSON API (`/api/pcsx/search` for search,
`/api/apply/v2/jobs/<id>` for detail). See `../url-reference.md` for full endpoint details.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

## Installation

```bash
cd .agents/skills/qualcomm-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings on Qualcomm's careers site |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Embedded software engineer roles
bun run src/cli.ts search -q "embedded software engineer" --format table

# Firmware roles in San Diego, last 30 days
bun run src/cli.ts search -q "firmware" -l "San Diego" --jobage 30 --format table

# Full detail for one job
bun run src/cli.ts detail 446717134102 --format plain
```

See `../SKILL.md` for the full flag reference and quirks notes.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role). |
| `--location` | `-l` | Free-text location filter, e.g. `"San Diego"`, `"Cork, Ireland"`. |
| `--jobage` | | Posted within N days. Applied client-side (no native API param). |
| `--page` | | 1-indexed page (10 results/page, fixed by the API). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |
