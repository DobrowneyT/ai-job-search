import {
  ACCOUNTS,
  getJson,
  normalizeId,
  looksLikeBareShortcode,
  resolveAccountForShortcode,
  parseWidgetJob,
  writeError,
  type AccountKey,
  type JobDetail,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

function renderPlain(job: JobDetail): string {
  const lines = [job.title, `${job.company} · ${job.location || "—"}`]
  const field = (label: string, value: string | null) => {
    if (value) lines.push(`${label}: ${value}`)
  }
  field("Posted", job.date)
  field("Department", job.department)
  field("Employment", job.employmentType)
  field("Education", job.education)
  field("Experience", job.experience)
  field("Function", job.jobFunction)
  field("Industry", job.industry)
  lines.push("", job.description || "(no description)", "", `URL: ${job.url}`)
  if (job.applyUrl) lines.push(`Apply: ${job.applyUrl}`)
  lines.push(`id: ${job.id}`)
  return lines.join("\n")
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  let account: AccountKey | null = null
  let shortcode: string | null = null

  const parsed = normalizeId(opts.id)
  if (parsed) {
    account = parsed.account
    shortcode = parsed.shortcode
  } else if (looksLikeBareShortcode(opts.id)) {
    // No "foundation:"/"ltd:" prefix and no full URL — resolve which account owns this
    // shortcode via the global shortlink's redirect (apply.workable.com/j/<shortcode>).
    try {
      account = await resolveAccountForShortcode(opts.id.trim())
      shortcode = opts.id.trim()
    } catch (e) {
      writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
      return 1
    }
    if (!account) {
      writeError(`Could not resolve which account owns shortcode "${opts.id}"`, "BAD_ID")
      return 1
    }
  }

  if (!account || !shortcode) {
    writeError(
      `Could not parse a job id from "${opts.id}" (expected "foundation:<code>", "ltd:<code>", a Workable job URL, or a bare shortcode)`,
      "BAD_ID",
    )
    return 1
  }

  try {
    const widget = await getJson(`https://apply.workable.com/api/v1/widget/accounts/${ACCOUNTS[account].slug}?details=true`)
    const jobs: any[] = Array.isArray(widget?.jobs) ? widget.jobs : []
    // The widget lists one entry per (job, location) pair; dedupe by shortcode.
    const match = jobs.find((j) => j?.shortcode === shortcode)
    if (!match) {
      writeError(`No job with shortcode "${shortcode}" found in the ${ACCOUNTS[account].company} listings`, "NOT_FOUND")
      return 1
    }
    const detail = parseWidgetJob(match, account)

    if (opts.format === "plain") {
      process.stdout.write(renderPlain(detail) + "\n")
    } else {
      process.stdout.write(JSON.stringify(detail, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
