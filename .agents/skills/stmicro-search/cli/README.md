# stmicro-cli

Zero-dependency CLI for searching jobs on **STMicroelectronics'** careers site
(global — Europe, Asia, the Americas; postings across all countries ST hires
in). Runs with just `bun` — `bun install` only pulls dev-time TypeScript types.

```bash
# from this directory
bun run src/cli.ts search -q "embedded software engineer" --format table
bun run src/cli.ts detail 563637172372091 --format plain

# checks
bun install          # dev types only
bun run typecheck
bun run test         # live smoke tests (2-3 network requests)
```

Data comes from ST's own Eightfold.ai-hosted job-search API
(`stmicroelectronics.eightfold.ai/api/apply/v2/jobs`) — see `../url-reference.md`
for the endpoint and field documentation. Personal use; keep request volume low.
