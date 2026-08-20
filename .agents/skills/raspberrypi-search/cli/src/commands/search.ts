import {
  ACCOUNTS,
  postJson,
  parseSearchResponse,
  jobageToCutoff,
  writeError,
  type AccountKey,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
  source: AccountKey | "all"
}

const PAGE_SIZE = 25

function accountsToQuery(source: AccountKey | "all"): AccountKey[] {
  return source === "all" ? (Object.keys(ACCOUNTS) as AccountKey[]) : [source]
}

/** Client-side location filter: case-insensitive substring match on the formatted location string. */
function matchesLocation(job: JobCard, location: string | undefined): boolean {
  if (!location) return true
  const needle = location.trim().toLowerCase()
  if (!needle) return true
  return (job.location || "").toLowerCase().includes(needle)
}

/** Client-side jobage filter: keep jobs posted on/after the cutoff, or undated jobs (can't tell). */
function matchesJobage(job: JobCard, cutoff: Date | null): boolean {
  if (!cutoff) return true
  if (!job.date) return true
  return new Date(job.date) >= cutoff
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const id = c.id.padEnd(20)
    const title = (c.title || "").slice(0, 36).padEnd(36)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const loc = (c.location || "—").slice(0, 26).padEnd(26)
    const date = c.date || "—"
    return `${id} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(20) + " " + "TITLE".padEnd(36) + " " + "COMPANY".padEnd(22) + " " + "LOCATION".padEnd(26) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

function renderPlain(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  return cards
    .map(
      (c) =>
        `${c.title}\n  ${c.company} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
    )
    .join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  const accounts = accountsToQuery(opts.source)
  const cutoff = jobageToCutoff(opts.jobage)
  const warnings: string[] = []

  const perAccount = await Promise.all(
    accounts.map(async (key) => {
      try {
        const data = await postJson(`https://apply.workable.com/api/v3/accounts/${ACCOUNTS[key].slug}/jobs`, {
          query: opts.query || "",
        })
        return parseSearchResponse(data, key)
      } catch (e) {
        warnings.push(`${ACCOUNTS[key].company}: ${e instanceof Error ? e.message : String(e)}`)
        return [] as JobCard[]
      }
    }),
  )

  // Every account failed: this is a hard failure, not a partial result.
  if (accounts.length > 0 && warnings.length === accounts.length) {
    writeError(`All Workable accounts failed: ${warnings.join("; ")}`, "SEARCH_FAILED")
    return 1
  }

  let jobs = perAccount
    .flat()
    .filter((j) => matchesLocation(j, opts.location) && matchesJobage(j, cutoff))
    // Newest first, consistent with the other portal skills.
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))

  const total = jobs.length
  const start = (opts.page - 1) * PAGE_SIZE
  jobs = jobs.slice(start, start + PAGE_SIZE)
  if (opts.limit !== undefined && opts.limit >= 0) jobs = jobs.slice(0, opts.limit)

  if (opts.format === "table") {
    process.stdout.write(renderTable(jobs) + "\n")
  } else if (opts.format === "plain") {
    process.stdout.write(renderPlain(jobs) + "\n")
  } else {
    const meta: Record<string, unknown> = { count: jobs.length, page: opts.page, total }
    if (warnings.length) meta.warnings = warnings
    process.stdout.write(JSON.stringify({ meta, results: jobs }, null, 2) + "\n")
  }
  return 0
}
