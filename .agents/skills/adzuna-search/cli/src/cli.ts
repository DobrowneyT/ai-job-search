#!/usr/bin/env bun
// CLI for searching UK jobs via Adzuna's official public Jobs API (not
// scraping — a documented JSON API requiring free credentials). No external
// CLI framework, so it runs anywhere `bun` is available with just a package
// install for TypeScript types.
//
// Requires ADZUNA_APP_ID and ADZUNA_APP_KEY (env vars, or a .env file in this
// directory — Bun loads those automatically). Register free at
// https://developer.adzuna.com/.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `adzuna-cli — search UK jobs via Adzuna's official API

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

Requires ADZUNA_APP_ID and ADZUNA_APP_KEY (env vars, or a .env file in this
directory). Register free at https://developer.adzuna.com/.

SEARCH FLAGS
  --query, -q <text>      Keywords (job title, skill, or role). Recommended.
  --location, -l <text>   UK town or city, e.g. "Cambridge", "London".
  --distance <miles>      Radius around --location in miles.
  --jobage <days>         Posted within N days (any positive integer). Default: all.
  --page <n>              1-indexed page (25 results/page). Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

NOTE: Adzuna's free API returns a truncated (~500 char) description and has no
by-ID lookup endpoint. \`detail\` reads from a local cache written by \`search\`
— call search first, then detail on one of its IDs.

EXAMPLES
  bun run src/cli.ts search -q "embedded firmware engineer" --format table
  bun run src/cli.ts search -q "embedded engineer" -l Cambridge --distance 20 --format table
  bun run src/cli.ts search -q "firmware" --jobage 7 --limit 10
  bun run src/cli.ts detail 5763963528 --format plain

Personal use — Adzuna API Usage Guidelines & Limits apply (see their site).
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = parseInt(raw as string, 10)
      if (isNaN(val)) {
        process.stderr.write(JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n")
        return null
      }
      return val
    }

    let jobage = 9999
    if (flags.jobage !== undefined) {
      const v = parseIntFlag("jobage", flags.jobage)
      if (v === null) return 1
      jobage = v
    }
    let page = 1
    if (flags.page !== undefined) {
      const v = parseIntFlag("page", flags.page)
      if (v === null) return 1
      page = Math.max(1, v)
    }
    let limit: number | undefined
    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      limit = v
    }
    let distance: number | undefined
    if (flags.distance !== undefined) {
      const v = parseIntFlag("distance", flags.distance)
      if (v === null) return 1
      distance = v
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      distance,
      jobage,
      page,
      limit,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires an <id|url>", code: "NO_ID" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      id,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main().then((code) => process.exit(code))
