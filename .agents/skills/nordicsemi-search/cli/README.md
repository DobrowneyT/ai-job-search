# nordicsemi-cli

Zero-dependency CLI for searching jobs on **Nordic Semiconductor's** careers
site (`careers.nordicsemi.com`, Teamtailor). Runs with just `bun` — `bun
install` only pulls dev-time TypeScript types.

```bash
# from this directory
bun run src/cli.ts search -q "firmware engineer" --format table
bun run src/cli.ts detail 8056908 --format plain

# checks
bun install          # dev types only
bun run typecheck
bun run test         # unit tests + live smoke tests (a couple of network requests)
```

Data comes from Teamtailor's public `/jobs.json` JSON Feed — see
`../url-reference.md` for the endpoint, parameters, and known quirks (notably:
no server-side location or posted-since filter, so `--location`/`--jobage`
are applied client-side).
