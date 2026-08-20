import {
  BASE_URL,
  htmlFetchText,
  parseSearchPage,
  jobageToPostedWithin,
  slugify,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  radius?: number
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

const PER_PAGE = 25

function buildUrl(opts: SearchOpts): string {
  let path = "/jobs"
  if (opts.query) path += `/${slugify(opts.query)}`
  if (opts.location) path += `/in-${slugify(opts.location)}`
  const params = new URLSearchParams()
  if (opts.radius !== undefined) params.set("radius", String(opts.radius))
  const within = jobageToPostedWithin(opts.jobage)
  if (within) params.set("postedWithin", String(within))
  // Pagination is offset-based ("of"), matching the site's own next-page links.
  if (opts.page > 1) params.set("of", String((opts.page - 1) * PER_PAGE))
  const qs = params.toString()
  return `${BASE_URL}${path}${qs ? `?${qs}` : ""}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const salary = (c.salary || "—").slice(0, 26).padEnd(26)
    const date = c.date || "—"
    return `${c.id.padEnd(10)} ${title} ${company} ${loc} ${salary} ${date}`
  })
  const header =
    "ID".padEnd(10) +
    " " +
    "TITLE".padEnd(40) +
    " " +
    "COMPANY".padEnd(24) +
    " " +
    "LOCATION".padEnd(22) +
    " " +
    "SALARY".padEnd(26) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetchText(buildUrl(opts))
    if (!html) {
      process.stdout.write(
        opts.format === "json"
          ? JSON.stringify({ meta: { count: 0, total: 0, page: opts.page }, results: [] }, null, 2) + "\n"
          : "No results.\n",
      )
      return 0
    }
    const page = parseSearchPage(html)
    let cards = page.jobs
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
