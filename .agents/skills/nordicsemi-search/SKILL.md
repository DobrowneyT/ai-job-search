---
name: nordicsemi-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs at Nordic
  Semiconductor — the Norwegian low-power wireless/IoT chipmaker (nRF series)
  with engineering sites in Norway, Poland, the US, and a UK presence.
  Covers all of Nordic's open positions worldwide (Oslo, Trondheim, Kraków,
  UK, US, APAC). Trigger phrases: Nordic Semiconductor jobs, Nordic Semi
  careers, nRF jobs, jobs at Nordic, Nordic Semiconductor careers, careers.nordicsemi.com,
  embedded jobs Norway, wireless chip jobs, IoT chip jobs, look up this Nordic
  Semiconductor posting.
context: fork
allowed-tools: Bash(bun run .agents/skills/nordicsemi-search/cli/src/cli.ts *)
---

# Nordic Semiconductor Search Skill

Search live job listings from **Nordic Semiconductor's** careers site
(`careers.nordicsemi.com`, built on Teamtailor). No authentication, no API
key, and **zero runtime dependencies** — it runs with just `bun`. Data comes
from the site's own public JSON Feed rather than scraped HTML (see
`url-reference.md` for why).

## When to use this skill

- Search Nordic Semiconductor's open positions worldwide, optionally filtered
  by keyword, field of expertise, location, or recency
- Get the full description, deadline, and location(s) of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/nordicsemi-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, or role). Server-side full-text match across title and description. Recommended.
- `--category <text>` — field-of-expertise facet: `Engineering`, `Commercial`, `Administrative`, `IT-Operations`, `Quality`, `Supply Chain`.
- `--location <text>` / `-l <text>` — city or ISO-2 country code (e.g. `Oslo`, `GB`, `PL`). **Client-side filter** — the portal has no server-side location facet; see `url-reference.md`.
- `--jobage <days>` — posted within N days. **Client-side filter** — the portal has no server-side recency facet. Omit for all postings.
- `--page <n>` — page number (1-indexed, 10 results/page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/nordicsemi-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric job id from `search` results (e.g. `8056908`) or a full
`careers.nordicsemi.com/jobs/...` URL. Returns the full description, all
listed office locations, and the application deadline.

## Usage examples

```bash
# Firmware engineer roles, any location
bun run .agents/skills/nordicsemi-search/cli/src/cli.ts search -q "firmware engineer" --format table

# Embedded software roles, filtered to UK listings (client-side)
bun run .agents/skills/nordicsemi-search/cli/src/cli.ts search -q "embedded software" -l "GB" --format table

# All engineering roles posted in the last 30 days
bun run .agents/skills/nordicsemi-search/cli/src/cli.ts search --category Engineering --jobage 30 --format table

# Full details for a specific posting
bun run .agents/skills/nordicsemi-search/cli/src/cli.ts detail 8056908 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data source is Teamtailor's public `/jobs.json` JSON Feed — no credentials required, no bot-challenge (unlike `www.nordicsemi.com`, which sits behind Cloudflare; this skill never touches that host).
- `--location` and `--jobage` are applied client-side after fetching the server-filtered set — Nordic's Teamtailor feed exposes no location or posted-since query parameter. See `url-reference.md` for the full parameter table and quirks.
- `query=` does OR-style multi-token full-text matching (title + body), not an exact phrase match — a two-word query broadens rather than narrows results.
- Nordic's total open-req count is small (order of dozens), so `search` and `detail` each fetch the feed in a single request (`per_page=100`/`200`) rather than paginating server-side.
- No `employmentType` field is present on any observed posting; the CLI always returns `null` for it in `detail`.
