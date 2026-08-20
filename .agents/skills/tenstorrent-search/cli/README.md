# tenstorrent-cli

CLI for searching **Tenstorrent's** job openings — the AI/RISC-V chip design
company (Jim Keller's company) — across any team (Software, Hardware, ASIC/
Silicon, Firmware, RISC-V CPU, etc.).

**Data source**: Greenhouse's public job-board JSON API, `boards-api.greenhouse.io/v1/boards/tenstorrent`.
Tenstorrent's own careers page (`tenstorrent.com/en/careers`) is a Next.js front-end
that embeds a Greenhouse widget pointed at this same board.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

## Installation

```bash
cd .agents/skills/tenstorrent-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search Tenstorrent's open reqs (title/location/department filters) |
| `detail` | Fetch full detail for a single posting |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Firmware roles
bun run src/cli.ts search -q "firmware" --format table

# Software roles in Toronto
bun run src/cli.ts search -q "software" -l Toronto --format table

# RISC-V roles posted in the last 30 days
bun run src/cli.ts search -q "RISC-V" --jobage 30 --format table

# Everything in the "Tensix" department
bun run src/cli.ts search -d Tensix --format table

# Full detail for one posting
bun run src/cli.ts detail 5132733007 --format plain
```

See `../SKILL.md` for the full flag reference.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords, matched against the job title. Recommended. |
| `--location` | `-l` | Substring match against the posting's location field, e.g. `Toronto`, `Santa Clara`, `Remote`. Optional. |
| `--department` | `-d` | Substring match against the Greenhouse department name, e.g. `RISC V`, `Firmware`, `AI SW`. Optional. |
| `--jobage` | | Only postings first published within N days. |
| `--page` | | 1-indexed page (20 results/page, client-side — see Notes). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## Notes

- Greenhouse's board API has no server-side query, filter, or pagination parameters
  — it returns the *entire* open-requisition list in one response (~130 postings as
  of 2026-07). This CLI fetches the full board once per command and does all
  filtering/sorting/pagination client-side. `meta.total` in JSON output is the
  match count across the whole board (before the page/limit slice), matching the
  `reed-search` convention.
- `search` fetches the board **without** `content=true` (a lean ~95KB payload with
  no description text) since descriptions aren't needed for listing. `detail`
  fetches the single-job endpoint, which includes the full `content` HTML by default.
- There's no native "posted date" filter; `--jobage` is computed client-side from
  each job's `first_published` timestamp (falling back to `updated_at` if absent).
- Results are sorted freshest-first by that same date.
- A posting's `location` field can list multiple sites separated by `;` (e.g. a
  role open to both Santa Clara and Taipei) — this is passed through as-is.
- Greenhouse's `content` field is HTML that has itself been HTML-entity-escaped
  before being placed in the JSON string (so the raw JSON value contains literal
  `&lt;div&gt;` rather than `<div>`). `greenhouseContentToText` in `helpers.ts`
  decodes entities twice — once to reveal the real tags, once more for anything
  nested inside them (e.g. a stray `&amp;nbsp;`) — before stripping tags.
