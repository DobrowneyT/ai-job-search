# arm-cli

CLI for searching jobs on **Arm's own careers site** (careers.arm.com), across
any of Arm's job categories (Software Engineering, Hardware Engineering,
Silicon, and more), worldwide.

**Data source**: careers.arm.com's server-rendered `/search-jobs` and `/job/...` pages (Radancy "TalentBrew" platform).
**Authentication**: None required to view listings.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

## Installation

```bash
cd .agents/skills/arm-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings (`--query` recommended) |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Software engineering roles worldwide
bun run src/cli.ts search -q "software engineer" --format table

# Firmware roles biased toward Cambridge (not a strict filter — see SKILL.md)
bun run src/cli.ts search -q "firmware engineer" -l Cambridge --format table

# Full detail for one job
bun run src/cli.ts detail 96521990288 --format plain
```

See `../SKILL.md` for the full flag reference, including important caveats on
`--location` and `--jobage` (Arm's site has no server-side filter for either —
see `../url-reference.md` for the investigation).

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role / team / office). Recommended. |
| `--location` | `-l` | Folded into the keyword query — **not a strict filter**. |
| `--jobage` | | Accepted for compatibility; **no effect** (no server-side date filter exists). |
| `--page` | | 1-indexed page (15 results/page). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |
