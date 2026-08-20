# graphcore-cli

Zero-runtime-dependency CLI for searching open roles on **Graphcore's public
Greenhouse job board** (not scraped HTML — a documented JSON API). Runs with
just `bun` — `bun install` only pulls dev-time TypeScript types. No API key
or authentication required.

## Usage

```bash
bun run src/cli.ts search -q "software engineer" -l Bristol --format table
bun run src/cli.ts detail 8615313002 --format plain

# checks
bun install          # dev types only
bun run typecheck
bun run test         # live smoke tests against the real API
```

Graphcore's Greenhouse board has no server-side query, location, or
pagination parameters — `search` fetches the full open-roles list
(`boards-api.greenhouse.io/v1/boards/graphcore/jobs`) once per invocation and
filters, sorts (newest first), and paginates client-side. `detail` queries
Greenhouse's single-job endpoint directly by ID. See `../url-reference.md`
for full endpoint documentation and known quirks.
