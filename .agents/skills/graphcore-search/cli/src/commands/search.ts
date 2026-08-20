import {
  LIST_URL,
  jsonFetch,
  parseJobsList,
  jobageToCutoff,
  matchesQuery,
  matchesLocation,
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

const PAGE_SIZE = 25

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 12).padEnd(12)
    const loc = (c.location || "—").slice(0, 28).padEnd(28)
    const date = c.date || "—"
    return `${c.id.padEnd(11)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(11) + " " + "TITLE".padEnd(42) + " " + "COMPANY".padEnd(12) + " " + "LOCATION".padEnd(28) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    // Greenhouse's board API takes no query/location/page params — it always
    // returns every open requisition in one response, so we fetch once and do
    // all filtering, sorting, and pagination client-side.
    const data = await jsonFetch(LIST_URL)
    let cards = parseJobsList(data)

    if (opts.query) cards = cards.filter((c) => matchesQuery(c, opts.query!))
    if (opts.location) cards = cards.filter((c) => matchesLocation(c, opts.location!))
    const cutoff = jobageToCutoff(opts.jobage)
    if (cutoff) cards = cards.filter((c) => c.date !== null && new Date(c.date) >= cutoff)

    // Newest first.
    cards.sort((a, b) => (b.date || "").localeCompare(a.date || ""))

    const total = cards.length
    const start = (opts.page - 1) * PAGE_SIZE
    cards = cards.slice(start, start + PAGE_SIZE)
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map((c) => `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`)
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: cards.length, total, page: opts.page }, results: cards }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
