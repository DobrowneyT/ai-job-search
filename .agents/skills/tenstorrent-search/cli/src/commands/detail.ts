import { BOARD_URL, jsonFetch, writeError, toJobResult, greenhouseContentToText, type GreenhouseJob, type JobDetail } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a raw numeric Greenhouse job ID or a job-boards.greenhouse.io / tenstorrent.com job URL. */
function normalizeId(input: string): string | null {
  const url = input.match(/greenhouse\.io\/tenstorrent\/jobs\/(\d+)/) || input.match(/\/jobs\/(\d+)(?:\?|$)/)
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
    const job = await jsonFetch<GreenhouseJob>(`${BOARD_URL}/${id}`)
    if (!job || !job.id) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const base = toJobResult(job)
    const department = job.departments?.[0]?.name ?? null
    const detail: JobDetail = {
      ...base,
      description: job.content ? greenhouseContentToText(job.content) : null,
      department,
      requisitionId: job.requisition_id ?? null,
      applyUrl: job.absolute_url,
    }

    if (opts.format === "plain") {
      const lines = [
        detail.title,
        `${detail.company || "—"} · ${detail.location || "—"}`,
        "",
        detail.department ? `Department: ${detail.department}` : "",
        detail.requisitionId ? `Requisition: ${detail.requisitionId}` : "",
        "",
        detail.description || "(no description)",
        "",
        `URL: ${detail.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(detail, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
