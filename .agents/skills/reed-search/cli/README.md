# reed-cli

Zero-dependency CLI for searching jobs on **reed.co.uk** (United Kingdom).
Runs with just `bun` — `bun install` only pulls dev-time TypeScript types.

```bash
# from this directory
bun run src/cli.ts search -q "embedded firmware engineer" --format table
bun run src/cli.ts detail 57073138 --format plain

# checks
bun install          # dev types only
bun run typecheck
bun run test         # live smoke tests (2 network requests)
```

Data comes from the `__NEXT_DATA__` JSON blob embedded in Reed's public job
pages — see `../url-reference.md` for the endpoint and field documentation.
Personal use; keep request volume low.
