import { DETAIL_URL, jsonFetch, parseJobDetail, normalizeId, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a job ID from "${opts.id}"`, "BAD_ID")
    return 1
  }

  try {
    const raw = await jsonFetch(DETAIL_URL(id))
    if (raw === null) {
      writeError(`No Graphcore posting found for id "${id}" (may have closed).`, "JOB_NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(raw)
    if (!job) {
      writeError(`Malformed response for id "${id}".`, "JOB_NOT_FOUND")
      return 1
    }

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.department ? `Department: ${job.department}` : "",
        job.employmentType ? `Employment type: ${job.employmentType}` : "",
        job.date ? `Posted: ${job.date}` : "",
        "",
        job.description || "(no description available)",
        "",
        `Apply: ${job.applyUrl || job.url}`,
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
