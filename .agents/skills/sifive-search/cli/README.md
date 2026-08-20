# sifive-cli

Zero-runtime-dependency CLI for searching jobs on **SiFive's** careers site.
Data comes from Workday's public, unauthenticated CXS JSON API (the same
endpoints SiFive's own careers frontend calls) — not scraped HTML, and no API
key required. Runs with just `bun` — `bun install` only pulls dev-time
TypeScript types.

## Usage

```bash
bun run src/cli.ts search -q "verification engineer" --format table
bun run src/cli.ts search -q "RTL design" -l "United Kingdom" --format table
bun run src/cli.ts detail R-101207 --format plain

# checks
bun install          # dev types only
bun run typecheck
bun run test         # live smoke tests against the real API
```

See `../url-reference.md` for the endpoint documentation and tenant-specific
quirks (offset wraparound, the "30+ Days Ago" bucket, multi-location
requisitions).
