import { BASE_URL, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a raw job ID or a reed.co.uk job URL (/jobs/<slug>/<id>). */
function normalizeId(input: string): string | null {
  const url = input.match(/reed\.co\.uk\/jobs\/[^/]+\/(\d{5,})(?:[?#]|$)/)
  if (url) return url[1]
  const bare = input.match(/^\d{5,}$/)
  if (bare) return input
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a job ID from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    // Any slug resolves as long as the ID is right, so "j" works for bare IDs.
    const html = await htmlFetch(`${BASE_URL}/jobs/j/${id}`)
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, id)
    if (!job) {
      writeError("Could not parse job data from the page (markup may have changed)", "PARSE_FAILED")
      return 1
    }

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.contractType ? `Contract: ${job.contractType}` : "",
        job.employmentHours ? `Hours: ${job.employmentHours}` : "",
        job.remote ? `Workplace: ${job.remote}` : "",
        job.date ? `Posted: ${job.date}` : "",
        job.expiryDate ? `Expires: ${job.expiryDate}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
