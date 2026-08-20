import { DETAIL_URL, DOMAIN, jsonFetch, parseDetailResponse, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a raw numeric job ID or a full careers.qualcomm.com job URL. */
function normalizeId(input: string): string | null {
  const bare = input.match(/^\d+$/)
  if (bare) return input
  const url = input.match(/\/careers\/job\/(\d+)/)
  if (url) return url[1]
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a job ID from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const json = await jsonFetch(`${DETAIL_URL}/${id}?domain=${DOMAIN}`)
    if (!json) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseDetailResponse(json)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.department ? `Department: ${job.department}` : "",
        job.businessUnit ? `Business unit: ${job.businessUnit}` : "",
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
