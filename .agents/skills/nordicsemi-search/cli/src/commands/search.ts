import {
  FEED_URL,
  jsonFetch,
  parseFeed,
  locationMatches,
  withinJobage,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  category?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

// Nordic's Teamtailor feed does real full-text search server-side (title +
// body) and paginates with page/per_page — but it has no location or
// posted-since facet, so those two filters are applied client-side below
// (see url-reference.md). per_page is set generously so the full matching set
// for a query is captured in one request before client-side filtering.
const FEED_PER_PAGE = 100

function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  if (opts.query) params.set("query", opts.query)
  if (opts.category) params.set("field-of-expertise", opts.category)
  params.set("per_page", String(FEED_PER_PAGE))
  return `${FEED_URL}?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 46).padEnd(46)
    const loc = (c.location || "—").slice(0, 30).padEnd(30)
    const date = c.date || "—"
    return `${c.id.padEnd(9)} ${title} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(9) + " " + "TITLE".padEnd(46) + " " + "LOCATION".padEnd(30) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const data = await jsonFetch(buildUrl(opts))
    let cards = data ? parseFeed(data) : []

    if (opts.location) cards = cards.filter((c) => locationMatches(c.location, opts.location!))
    if (opts.jobage < 9999) cards = cards.filter((c) => withinJobage(c.date, opts.jobage))

    const total = cards.length
    const pageSize = 10
    const start = (opts.page - 1) * pageSize
    cards = cards.slice(start, start + pageSize)
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: cards.length, total, page: opts.page }, results: cards },
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
