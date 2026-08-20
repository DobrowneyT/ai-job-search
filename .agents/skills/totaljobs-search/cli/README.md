# totaljobs-cli

Zero-dependency CLI for searching jobs on **totaljobs.com** (United Kingdom).
Runs with just `bun` — `bun install` only pulls dev-time TypeScript types.

```bash
# from this directory
bun run src/cli.ts search -q "embedded firmware engineer" --format table
bun run src/cli.ts detail 107667827 --format plain

# checks
bun install          # dev types only
bun run typecheck
bun run test         # live smoke tests (3 network requests)
```

Search data comes from the `__PRELOADED_STATE__` JSON embedded in the results
page; detail data from the schema.org JobPosting `ld+json` block. The `detail`
command makes one extra lightweight request first to bootstrap a session cookie
(detail pages hang for cookie-less clients). See `../url-reference.md` for the
endpoint and field documentation. Personal use; keep request volume low.
