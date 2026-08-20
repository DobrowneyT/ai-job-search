---
name: raspberrypi-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search live job listings at Raspberry
  Pi — both Raspberry Pi Ltd (the Cambridge, UK commercial hardware/silicon company
  that designs the Raspberry Pi SBCs and RP2040/RP2350/RP1 chips) and the Raspberry
  Pi Foundation (the affiliated UK educational charity) — or to look up a specific
  Raspberry Pi job posting. Covers roles in Cambridge, England and UK-remote.
  Trigger phrases: Raspberry Pi jobs, Raspberry Pi careers, Raspberry Pi Ltd
  vacancies, Raspberry Pi Foundation jobs, RP2040/RP2350/RP1 silicon jobs, IC
  design engineer Cambridge, ASIC jobs at Raspberry Pi, look up this Raspberry Pi
  posting.
context: fork
allowed-tools: Bash(bun run .agents/skills/raspberrypi-search/cli/src/cli.ts *)
---

# Raspberry Pi Search Skill

Search live job listings from **both Raspberry Pi entities** via Workable's public
job-board API. No authentication, no API key, and **zero runtime dependencies** —
it runs with just `bun`.

## Two distinct entities, one skill

Raspberry Pi Ltd (the commercial hardware/silicon company) and the Raspberry Pi
Foundation (the affiliated UK educational charity) are legally distinct, but both
publish their open roles through **the same ATS, Workable**, under two separate
accounts:

| `--source` value | Entity | Workable account | What it hires for |
|---|---|---|---|
| `ltd` | **Raspberry Pi Ltd** (Raspberry Pi Trading) | `raspberrypi` | Cambridge-based silicon/hardware: IC design, IC verification, DFT, digital implementation, applications engineering |
| `foundation` | **Raspberry Pi Foundation** | `raspberrypifoundation` | Education-focused: software engineering for learning platforms, research, people & culture, admin |
| `all` (default) | Both, merged | both | Everything above |

Every result's `company` field says exactly which entity posted it ("Raspberry Pi
Ltd" or "Raspberry Pi Foundation"), and `id` is prefixed the same way
(`ltd:<code>` / `foundation:<code>`), so the two sources never get confused with
each other downstream.

**Why not scrape `raspberrypi.com/jobs` directly?** That marketing page is fully
Cloudflare-challenge-walled — every path on the domain (not just `/jobs`) returns
`403` with a `Cf-Mitigated: challenge` header to a plain HTTP client, the same
signature this repo already documents for Indeed/Glassdoor/Adzuna's own frontend.
It cannot be scraped without a real browser. Investigation found that its
underlying vacancy data is served by the Workable `raspberrypi` account above, so
this skill reaches Raspberry Pi Ltd's postings through Workable instead — same
data, no wall.

## When to use this skill

- Search for open roles at Raspberry Pi Ltd (hardware/silicon) or the Raspberry Pi
  Foundation (education), or both at once
- Filter by keyword, recency (posted within N days), or location text
- Get the full description, requirements, and benefits of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/raspberrypi-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Optional; Workable does full-text matching over title/description.
- `--source <src>` — `ltd` | `foundation` | `all`. Default `all`.
- `--location <text>` / `-l <text>` — client-side substring filter on the result's formatted location (e.g. `Cambridge`, `Remote`). Workable's server-side location filter needs opaque nested location objects, so this skill filters client-side instead — see `url-reference.md`.
- `--jobage <days>` — posted within N days, filtered client-side against the posting date. Omit for all postings.
- `--page <n>` — 1-indexed page (25 results/page, client-side — Workable's search has no server-side pagination since each account only carries a handful of open roles).
- `--limit <n>` / `-n <n>` — cap results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/raspberrypi-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is a search result's `id` (e.g. `ltd:AB9B343504` or `foundation:1E64D1DB65`).
You may also pass a full `apply.workable.com/<account>/j/<code>` URL, or a bare
Workable shortcode — a bare shortcode is resolved to its owning account via a
redirect lookup. Returns the full HTML-stripped description, department,
employment type, education/experience level, function, industry, and apply link.

## Usage examples

```bash
# Everything matching "software engineer" across both entities
bun run .agents/skills/raspberrypi-search/cli/src/cli.ts search -q "software engineer" --format table

# Silicon/hardware roles at Raspberry Pi Ltd only
bun run .agents/skills/raspberrypi-search/cli/src/cli.ts search -q "IC design" --source ltd --format table

# Foundation roles based in or around Cambridge
bun run .agents/skills/raspberrypi-search/cli/src/cli.ts search --source foundation -l Cambridge --format table

# Anything posted in the last 30 days, first 5 results
bun run .agents/skills/raspberrypi-search/cli/src/cli.ts search -q "engineer" --jobage 30 --limit 5

# Full detail for a specific posting
bun run .agents/skills/raspberrypi-search/cli/src/cli.ts detail ltd:AB9B343504 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data source: Workable's public job-board API (`apply.workable.com/api/v3/accounts/<account>/jobs` for search, `apply.workable.com/api/v1/widget/accounts/<account>` for detail) — not scraped HTML, and not subject to the Cloudflare wall on `raspberrypi.com` itself. See `url-reference.md` for full endpoint documentation.
- Both accounts are small (typically 5-10 open roles each), so all filtering beyond the initial keyword query (`--location`, `--jobage`) happens client-side after fetching the full unfiltered list.
- If one account's request fails (e.g. transient network error) while the other succeeds, `search` still returns the successful account's results and surfaces the failure in `meta.warnings` rather than failing the whole command. Only exits non-zero if **both** accounts fail.
- Raspberry Pi Ltd's roles skew heavily toward Cambridge on-site silicon/ASIC work (IC design, verification, DFT); the Foundation's roles are UK-remote-friendly and education-focused. Relevant context for a candidate targeting embedded/silicon roles specifically: use `--source ltd` to see only the hardware company's postings.
