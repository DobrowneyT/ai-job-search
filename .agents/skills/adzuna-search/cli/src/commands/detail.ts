import { writeError } from "../helpers.js"
import { lookupCachedJob } from "../cache.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/**
 * Accept a raw job ID or an adzuna.co.uk redirect URL. Adzuna's redirect_url
 * shape varies between `/jobs/land/ad/<id>` and `/jobs/details/<id>` (observed
 * across different results) — match either.
 */
function normalizeId(input: string): string | null {
  const url = input.match(/\/jobs\/(?:land\/ad|details)\/(\d+)/)
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

  const job = await lookupCachedJob(id)
  if (!job) {
    writeError(
      "No cached data for this job ID. Adzuna's API has no direct job-lookup " +
        "endpoint, so `detail` only works for IDs returned by a recent `search` " +
        "run (search caches results locally). Run search again and retry.",
      "NOT_CACHED",
    )
    return 1
  }

  if (opts.format === "plain") {
    const lines = [
      job.title,
      `${job.company || "—"} · ${job.location || "—"}`,
      "",
      job.salary ? `Salary: ${job.salary}` : "",
      job.category ? `Category: ${job.category}` : "",
      job.date ? `Posted: ${job.date}` : "",
      "",
      job.descriptionSnippet
        ? `${job.descriptionSnippet}\n\n(Adzuna's free API only provides this truncated snippet — see the apply URL below for the full posting.)`
        : "(no description available)",
      "",
      `URL: ${job.url}`,
    ].filter((l) => l !== "")
    process.stdout.write(lines.join("\n") + "\n")
  } else {
    process.stdout.write(JSON.stringify({ ...job, descriptionTruncated: true }, null, 2) + "\n")
  }
  return 0
}
