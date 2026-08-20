import {
  API_BASE,
  jsonFetch,
  parseJobDetail,
  normalizeExternalPath,
  isBareReqId,
  writeError,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Resolve a bare requisition ID (e.g. "R-101207") to its externalPath via a search lookup. */
async function resolveReqId(reqId: string): Promise<string | null> {
  const data = await jsonFetch(`${API_BASE}/jobs`, {
    appliedFacets: {},
    limit: 5,
    offset: 0,
    searchText: reqId,
  })
  const postings = Array.isArray(data?.jobPostings) ? data.jobPostings : []
  for (const jp of postings) {
    const bullets: string[] = Array.isArray(jp.bulletFields) ? jp.bulletFields : []
    if (bullets.some((b) => typeof b === "string" && b.trim().toUpperCase() === reqId.toUpperCase())) {
      return jp.externalPath || null
    }
  }
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  let externalPath: string | null = normalizeExternalPath(opts.id)

  if (!externalPath && isBareReqId(opts.id)) {
    try {
      externalPath = await resolveReqId(opts.id.trim())
    } catch (e) {
      writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
      return 1
    }
  }

  if (!externalPath) {
    writeError(`Could not parse a job ID from "${opts.id}"`, "BAD_ID")
    return 1
  }

  try {
    const data = await jsonFetch(`${API_BASE}${externalPath}`)
    if (!data) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(data, externalPath)
    if (!job) {
      writeError("Could not parse job data from the response (API shape may have changed)", "PARSE_FAILED")
      return 1
    }

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company} · ${job.locations.join(" / ") || "—"}`,
        "",
        job.employmentType ? `Employment type: ${job.employmentType}` : "",
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
