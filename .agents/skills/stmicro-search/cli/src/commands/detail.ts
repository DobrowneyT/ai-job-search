import { API_BASE, DOMAIN, jsonFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a raw numeric job ID or a full careers/job/<id> URL. */
function normalizeId(input: string): string | null {
  const url = input.match(/eightfold\.ai\/careers\/job\/(\d+)(?:[?#]|$)/)
  if (url) return url[1]
  const bare = input.match(/^\d{6,}$/)
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
    const data = await jsonFetch(`${API_BASE}/${id}?domain=${encodeURIComponent(DOMAIN)}`)
    if (!data) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(data, id)
    if (!job) {
      writeError("Could not parse job data from the response (API shape may have changed)", "PARSE_FAILED")
      return 1
    }

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.department ? `Department: ${job.department}` : "",
        job.businessUnit ? `Business unit: ${job.businessUnit}` : "",
        job.workLocationOption ? `Work location: ${job.workLocationOption}` : "",
        job.locations.length > 1 ? `Also posted at: ${job.locations.filter((l) => l !== job.location).join(", ")}` : "",
        job.date ? `Posted: ${job.date}` : "",
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
