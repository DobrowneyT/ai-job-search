import {
  API_BASE,
  PAGE_SIZE,
  jsonFetch,
  parseSearchResponse,
  parsePostedBucket,
  resolveLocationFacet,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const loc = (c.location || "—").slice(0, 30).padEnd(30)
    const date = c.date || "—"
    return `${c.id.padEnd(11)} ${title} ${loc} ${date}`
  })
  const header = "ID".padEnd(11) + " " + "TITLE".padEnd(42) + " " + "LOCATION".padEnd(30) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const appliedFacets: Record<string, string[]> = {}

    if (opts.location) {
      const match = await resolveLocationFacet(opts.location)
      if (!match) {
        // No matching Workday facet (country or named site) — report zero
        // results rather than silently ignoring the filter.
        const empty =
          opts.format === "json"
            ? JSON.stringify({ meta: { count: 0, total: 0, page: opts.page }, results: [] }, null, 2) + "\n"
            : "No results.\n"
        process.stdout.write(empty)
        return 0
      }
      appliedFacets[match.facetParameter] = [match.id]
    }

    const offset = (opts.page - 1) * PAGE_SIZE
    const body = {
      appliedFacets,
      limit: PAGE_SIZE,
      offset,
      searchText: opts.query || "",
    }
    const data = await jsonFetch(`${API_BASE}/jobs`, body)
    if (!data) {
      process.stdout.write(
        opts.format === "json"
          ? JSON.stringify({ meta: { count: 0, total: 0, page: opts.page }, results: [] }, null, 2) + "\n"
          : "No results.\n",
      )
      return 0
    }

    const page = parseSearchResponse(data)
    let cards = page.jobs

    // jobage filtering is client-side and only applies within this one fetched
    // page (max 20 results) — Workday exposes no server-side date facet on
    // this tenant. See url-reference.md for the "30+ Days Ago" bucket quirk.
    if (opts.jobage < 9999) {
      cards = cards.filter((c) => {
        if (!c.date) return false // unknown age (30+ bucket) — excluded from age-bounded searches
        const days = Math.floor((Date.now() - new Date(c.date).getTime()) / 86400000)
        return days <= opts.jobage
      })
    }

    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map((c) => `${c.title}\n  ${c.company} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`)
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

export { parsePostedBucket }
