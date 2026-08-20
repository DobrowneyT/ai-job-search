import {
  SEARCH_URL,
  DOMAIN,
  jsonFetch,
  parseSearchResponse,
  jobageCutoff,
  writeError,
  type JobResult,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

// Qualcomm's Eightfold-backed search API returns a fixed 10 results per page
// regardless of the requested page size — see ../../url-reference.md.
const PAGE_SIZE = 10

function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  params.set("domain", DOMAIN)
  if (opts.query) params.set("query", opts.query)
  if (opts.location) params.set("location", opts.location)
  params.set("start", String((opts.page - 1) * PAGE_SIZE))
  params.set("num", String(PAGE_SIZE))
  return `${SEARCH_URL}?${params.toString()}`
}

function renderTable(jobs: JobResult[]): string {
  if (jobs.length === 0) return "No results."
  const rows = jobs.map((j) => {
    const title = (j.title || "").slice(0, 48).padEnd(48)
    const loc = (j.location || "—").slice(0, 30).padEnd(30)
    const date = j.date || "—"
    return `${j.id.padEnd(14)} ${title} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(14) + " " + "TITLE".padEnd(48) + " " + "LOCATION".padEnd(30) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const json = await jsonFetch(buildUrl(opts))
    let results: JobResult[] = []
    if (json) {
      results = parseSearchResponse(json).results
    }

    const cutoff = jobageCutoff(opts.jobage)
    if (cutoff !== null) {
      results = results.filter((r) => {
        if (!r.date) return true // keep undated results rather than silently dropping them
        const ts = Date.parse(r.date) / 1000
        return isNaN(ts) || ts >= cutoff
      })
    }

    if (opts.limit !== undefined && opts.limit >= 0) results = results.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(results) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        results
          .map(
            (r) =>
              `${r.title}\n  ${r.company || "—"} · ${r.location || "—"} · ${r.date || "—"}\n  id: ${r.id}\n  ${r.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: results.length, page: opts.page }, results }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
