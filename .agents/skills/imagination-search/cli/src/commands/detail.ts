import { JOBS_URL, jsonFetch, toJobDetail, writeError, type RawJob } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a raw job ID or a full job-detail URL (e.g. .../job/502702/senior-...-engineer). */
function normalizeId(input: string): string | null {
  const url = input.match(/\/job\/(\d+)(?:\/|$)/)
  if (url) return url[1]
  const bare = input.match(/^\d+$/)
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
    // PageUp's own widget resolves "detail" by re-filtering the same jobs.json array by Id
    // (see helpers.ts) rather than a separate per-job endpoint, so we do the same.
    const raw = (await jsonFetch(JOBS_URL)) as RawJob[] | null
    const match = (raw ?? []).find((j) => String(j.Id) === id)
    if (!match) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = toJobDetail(match)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company} · ${job.location || "—"}`,
        "",
        job.workType ? `Work type: ${job.workType}` : "",
        job.jobSector ? `Sector: ${job.jobSector}` : "",
        job.categories ? `Categories: ${job.categories}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.closingDate ? `Closes: ${job.closingDate}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
        job.applyUrl ? `Apply: ${job.applyUrl}` : "",
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
