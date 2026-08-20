import { SEARCH_URL, htmlFetch, parseSearchPage, writeError, type JobCard } from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

/**
 * Arm's careers site does not support location or posting-age as server-side
 * GET filters (they're client-side facets applied via an AJAX endpoint that
 * robots.txt disallows — see url-reference.md). `--location` is folded into
 * the free-text keyword query instead: Arm's keyword search matches against
 * job text (including office names), so this biases results toward that
 * place without being a strict filter. `--jobage` has no effect and is
 * accepted only so this CLI is drop-in interchangeable with other portal
 * skills; a warning is written to stderr (not treated as fatal).
 */
function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  const keywords = [opts.query, opts.location].filter(Boolean).join(" ")
  if (keywords) params.set("k", keywords)
  if (opts.page > 1) params.set("p", String(opts.page))
  return `${SEARCH_URL}?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 8).padEnd(8)
    const loc = (c.location || "—").slice(0, 24).padEnd(24)
    const cat = c.category || "—"
    return `${c.id.padEnd(12)} ${title} ${company} ${loc} ${cat}`
  })
  const header =
    "ID".padEnd(12) +
    " " +
    "TITLE".padEnd(42) +
    " " +
    "COMPANY".padEnd(8) +
    " " +
    "LOCATION".padEnd(24) +
    " CATEGORY"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  // --jobage is accepted but has no effect — see the module comment above.
  try {
    const html = await htmlFetch(buildUrl(opts))
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
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.category || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: { count: cards.length, total: page.total, page: page.currentPage || opts.page },
            results: cards,
          },
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
