import {
  BOARD_URL,
  jsonFetch,
  writeError,
  toJobResult,
  matchesQuery,
  matchesLocation,
  matchesDepartment,
  daysAgo,
  postingDateRaw,
  type GreenhouseJob,
  type JobResult,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  department?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

// Greenhouse's board API returns the whole board in one response (no native
// page size), so we define our own client-side page size for consistency
// with the other portal skills.
const PAGE_SIZE = 20

function renderTable(jobs: JobResult[]): string {
  if (jobs.length === 0) return "No results."
  const rows = jobs.map((j) => {
    const title = (j.title || "").slice(0, 42).padEnd(42)
    const company = (j.company || "—").slice(0, 14).padEnd(14)
    const loc = (j.location || "—").slice(0, 36).padEnd(36)
    const date = j.date || "—"
    return `${j.id.padEnd(11)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(11) + " " + "TITLE".padEnd(42) + " " + "COMPANY".padEnd(14) + " " + "LOCATION".padEnd(36) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

function renderPlain(jobs: JobResult[]): string {
  return jobs
    .map((j) => `${j.title}\n  ${j.company || "—"} · ${j.location || "—"} · ${j.date || "—"}\n  id: ${j.id}\n  ${j.url}`)
    .join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const data = await jsonFetch<{ jobs: GreenhouseJob[] }>(BOARD_URL)
    const all = data?.jobs ?? []

    let filtered = all.filter(
      (j) => matchesQuery(j, opts.query) && matchesLocation(j, opts.location) && matchesDepartment(j, opts.department),
    )

    if (opts.jobage && opts.jobage > 0 && opts.jobage < 9999) {
      filtered = filtered.filter((j) => {
        const age = daysAgo(postingDateRaw(j))
        return age !== null && age <= opts.jobage
      })
    }

    // Freshest postings first.
    filtered.sort((a, b) => {
      const da = new Date(postingDateRaw(a) ?? 0).getTime()
      const db = new Date(postingDateRaw(b) ?? 0).getTime()
      return db - da
    })

    const total = filtered.length
    const start = (opts.page - 1) * PAGE_SIZE
    let pageItems = filtered.slice(start, start + PAGE_SIZE)
    if (opts.limit !== undefined && opts.limit >= 0) pageItems = pageItems.slice(0, opts.limit)

    const results = pageItems.map(toJobResult)

    if (opts.format === "table") {
      process.stdout.write(renderTable(results) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(results) + "\n")
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: results.length, page: opts.page, total }, results }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
