import {
  API_BASE,
  DOMAIN,
  jsonFetch,
  parseSearchPage,
  jobageToCutoff,
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

// Eightfold's `query` param free-text matches against title AND location, so
// when --location is given (and the portal has no dedicated location filter
// that reliably narrows results — see url-reference.md) we fold it into the
// keyword query, the same pattern jobindex-search uses.
const PAGE_SIZE = 25

function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  params.set("domain", DOMAIN)
  const q = [opts.query, opts.location].filter(Boolean).join(" ").trim()
  if (q) params.set("query", q)
  params.set("start", String((opts.page - 1) * PAGE_SIZE))
  params.set("num", String(PAGE_SIZE))
  return `${API_BASE}?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 45).padEnd(45)
    const loc = (c.location || "—").slice(0, 28).padEnd(28)
    const date = c.date || "—"
    return `${c.id.padEnd(18)} ${title} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(18) + " " + "TITLE".padEnd(45) + " " + "LOCATION".padEnd(28) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const data = await jsonFetch(buildUrl(opts))
    if (!data) {
      process.stdout.write(
        opts.format === "json"
          ? JSON.stringify({ meta: { count: 0, total: 0, page: opts.page }, results: [] }, null, 2) + "\n"
          : "No results.\n",
      )
      return 0
    }
    const page = parseSearchPage(data)
    let cards = page.jobs

    const cutoff = jobageToCutoff(opts.jobage)
    if (cutoff !== null) {
      // Client-side only: filters within the fetched page, since the API has
      // no server-side date parameter (see helpers.ts / url-reference.md).
      cards = cards.filter((c) => c.date !== null && new Date(c.date).getTime() / 1000 >= cutoff)
    }

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
