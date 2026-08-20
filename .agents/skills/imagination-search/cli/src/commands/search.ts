import {
  JOBS_URL,
  jsonFetch,
  toJobCard,
  withinJobAge,
  writeError,
  DEFAULT_PAGE_SIZE,
  type JobCard,
  type RawJob,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  if (opts.query) params.set("search-keyword", opts.query)
  if (opts.location) params.set("location", opts.location)
  return `${JOBS_URL}?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 26).padEnd(26)
    const date = (c.date || "—").slice(0, 10)
    return `${c.id.padEnd(9)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(9) +
    " " +
    "TITLE".padEnd(42) +
    " " +
    "COMPANY".padEnd(24) +
    " " +
    "LOCATION".padEnd(26) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const raw = (await jsonFetch(buildUrl(opts))) as RawJob[] | null
    const all = raw ?? []
    const filtered = all.filter((j) => withinJobAge(j, opts.jobage))
    const total = filtered.length

    // The jobs.json endpoint returns the whole matching set in one response (no server-side
    // paging), so --page is applied client-side against a fixed page size.
    const start = (opts.page - 1) * DEFAULT_PAGE_SIZE
    let cards = filtered.slice(start, start + DEFAULT_PAGE_SIZE).map(toJobCard)
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
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
