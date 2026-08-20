---
name: sifive-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs at SiFive — the
  company that commercialized RISC-V and designs RISC-V CPU cores/IP — or to
  look up a specific SiFive job posting. Covers SiFive's global openings
  (primarily United States, with additional listings in the United Kingdom,
  France, India, Taiwan, and Italy). Trigger phrases: SiFive jobs, SiFive
  careers, RISC-V jobs, RISC-V CPU design jobs, work at SiFive, SiFive
  openings, verification engineer RISC-V, CPU architecture jobs.
context: fork
allowed-tools: Bash(bun run .agents/skills/sifive-search/cli/src/cli.ts *)
---

# SiFive Search Skill

Search live job listings from **SiFive's** careers site
(`sifive.wd1.myworkdayjobs.com`), a Workday-hosted careers portal. No
authentication, no API key, and **zero runtime dependencies** — it runs with
just `bun`. Data comes from Workday's public, unauthenticated CXS JSON API
(the same endpoints SiFive's own frontend calls), not scraped HTML.

## Market note (important for UK-focused candidates)

SiFive is a **US-based company** (headquartered in Santa Clara/Milpitas, CA)
hiring primarily in the United States. It does have a real UK presence —
**Cambridge, England** is a genuine SiFive engineering site with its own
openings (CPU RTL design, ALU design, functional safety, licensing) — plus
smaller numbers of roles in France, India, Taiwan, and Italy.

**Caveat:** filtering by `--location "United Kingdom"` returns any requisition
that lists a UK site among its locations, including multi-location US-primary
roles (e.g. a Santa Clara-based req that also lists Cambridge as an option).
This is **not** a guarantee the role is primarily UK-resident — always check
`detail`'s `location` field (the primary/first-listed site) before assuming a
result is a genuine UK-based opening. Most results overall will be US roles;
treat this skill as "may include non-UK roles" and filter/verify accordingly.

## When to use this skill

- Search SiFive's open positions (RISC-V CPU/SoC design, verification, DV,
  physical design, software, ASIC, program management)
- Filter by keyword and, best-effort, by country/site
- Get the full description of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/sifive-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Optional — omit to browse all open roles.
- `--location <text>` / `-l <text>` — a country name (e.g. `"United Kingdom"`, `"United States of America"`) or a specific site/state name matching one of Workday's own facet values (e.g. `"Cambridge, England, United Kingdom"`). Unrecognized values return **zero results** rather than being silently ignored — see the market note above for what this filter does and doesn't guarantee.
- `--jobage <days>` — posted within N days. **Client-side filter within the current page only** (this Workday tenant has no server-side date facet); see Notes.
- `--page <n>` — page number (1-indexed, 20 results per page — Workday's hard cap for this tenant).
- `--limit <n>` / `-n <n>` — cap results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/sifive-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the requisition ID from `search` results (e.g. `R-101207`). You may
also pass a full SiFive/Workday job URL, or the raw `externalPath` a search
result's `url` field resolves to. Returns the full description, all listed
locations, employment type, posting date, and apply URL.

## Usage examples

```bash
# Verification/DV roles, human-readable
bun run .agents/skills/sifive-search/cli/src/cli.ts search -q "verification engineer" --format table

# RISC-V CPU design roles specifically in the UK (Cambridge site)
bun run .agents/skills/sifive-search/cli/src/cli.ts search -q "RTL design" -l "United Kingdom" --format table

# Software roles, first 10
bun run .agents/skills/sifive-search/cli/src/cli.ts search -q "software" --limit 10

# Browse everything currently open, page 2
bun run .agents/skills/sifive-search/cli/src/cli.ts search --page 2 --format table

# Full details for a specific requisition
bun run .agents/skills/sifive-search/cli/src/cli.ts detail R-101207 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- `company` is always `"SiFive"` — this is a single-company Workday tenant, not a multi-employer aggregator.
- Page size is fixed at 20 results per page (Workday's hard cap for this tenant — higher `limit` values 400 error server-side).
- `total` in JSON output can misreport as `0` on intermediate pages even when results are present; treat it as authoritative only on page 1. Requesting a page past the actual end silently repeats page 1's results rather than returning empty — don't loop on `--page` expecting a natural empty-page stop. See `url-reference.md`.
- `date` in `search` results is an approximate value derived from Workday's bucketed "Posted N Days Ago" text; postings older than 30 days show a `null` date (bucket is "30+ Days Ago", no exact figure available). `detail`'s `date` (from `startDate`) is the exact posting date.
- `--jobage`, when set, excludes any result with a `null` date (i.e. anything in the "30+ days" bucket) and only filters within the single fetched page — combine with `--page` or omit `--jobage` for full-history coverage.
- Multi-location requisitions show `"N Locations"` in `search`'s `location` field with no names; run `detail` to see every listed site.
