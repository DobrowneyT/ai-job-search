import {
  API_BASE,
  getCredentials,
  jsonFetch,
  parseSearchResponse,
  jobageToMaxDaysOld,
  writeError,
  type JobCard,
} from "../helpers.js"
import { cacheJobs } from "../cache.js"

export interface SearchOpts {
  query?: string
  location?: string
  distance?: number
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

const PER_PAGE = 25

function buildUrl(opts: SearchOpts, appId: string, appKey: string): string {
  const params = new URLSearchParams()
  params.set("app_id", appId)
  params.set("app_key", appKey)
  params.set("results_per_page", String(PER_PAGE))
  params.set("content-type", "application/json")
  if (opts.query) params.set("what", opts.query)
  if (opts.location) params.set("where", opts.location)
  if (opts.distance !== undefined) params.set("distance", String(opts.distance))
  const maxDaysOld = jobageToMaxDaysOld(opts.jobage)
  if (maxDaysOld) params.set("max_days_old", String(maxDaysOld))
  params.set("sort_by", "date")
  return `${API_BASE}/gb/search/${opts.page}?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const salary = (c.salary || "—").slice(0, 20).padEnd(20)
    const date = c.date || "—"
    return `${c.id.padEnd(11)} ${title} ${company} ${loc} ${salary} ${date}`
  })
  const header =
    "ID".padEnd(11) +
    " " +
    "TITLE".padEnd(40) +
    " " +
    "COMPANY".padEnd(24) +
    " " +
    "LOCATION".padEnd(22) +
    " " +
    "SALARY".padEnd(20) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  const creds = await getCredentials()
  if (!creds) {
    writeError(
      "Missing Adzuna API credentials. Set ADZUNA_APP_ID and ADZUNA_APP_KEY " +
        "(env vars, or a .env file in cli/) — register free at https://developer.adzuna.com/",
      "NO_AUTH",
    )
    return 1
  }
  try {
    const data = await jsonFetch(buildUrl(opts, creds.appId, creds.appKey))
    const page = parseSearchResponse(data)
    let cards = page.jobs
    // Adzuna has no by-ID lookup, so `detail` depends on this cache existing.
    await cacheJobs(cards)
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.salary || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: cards.length, total: page.total, page: opts.page }, results: cards },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
