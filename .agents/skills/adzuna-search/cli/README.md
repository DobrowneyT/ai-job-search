# adzuna-cli

Zero-runtime-dependency CLI for searching UK jobs via **Adzuna's official
public Jobs API** (not scraped HTML). Runs with just `bun` — `bun install`
only pulls dev-time TypeScript types.

## Setup

1. Register for a free API key at <https://developer.adzuna.com/>.
2. Copy `.env.example` to `.env` in this directory and fill in your credentials:
   ```
   ADZUNA_APP_ID=your-app-id
   ADZUNA_APP_KEY=your-app-key
   ```
   `.env` is gitignored — never commit real credentials.

## Usage

```bash
bun run src/cli.ts search -q "embedded firmware engineer" --format table
bun run src/cli.ts detail 5763963528 --format plain

# checks
bun install          # dev types only
bun run typecheck
bun run test         # live smoke tests against the real API
```

Adzuna's free API has no by-ID lookup endpoint, so `detail` reads from a local
cache (`$TMPDIR/adzuna-search-cache.json`) written by `search` — run `search`
before `detail`. See `../url-reference.md` for full API documentation.
