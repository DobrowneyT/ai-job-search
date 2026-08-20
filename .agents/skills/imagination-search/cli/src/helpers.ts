// Data source: Imagination Technologies' careers site (imaginationtech.com/careers/vacancies/)
// is a WordPress page that embeds the PageUp People applicant-tracking widget
// (org id 774, channel "cw", locale "en"). The widget itself (careers.static.pageuppeople.com/
// Widgets/v3.js) drives its listing/search UI from a public, unauthenticated JSON endpoint:
//
//   https://careers.pageuppeople.com/774/cw/en/jobs.json
//
// This returns the FULL current vacancy list (with rich fields, including the full HTML
// job description) as JSON — no HTML scraping needed, no auth, no API key. `search-keyword`,
// `location`, `category`, and `work-type` query params are genuinely applied server-side
// (verified live: "director" -> 4/22, "verification" -> 8/22, "location=Bristol UK" -> 10/22).
// The endpoint does NOT support server-side paging (page/page-items params are accepted but
// ignored) or a posting-age filter, so both are implemented client-side against OpeningDateUtc.
//
// Detail is served by the SAME endpoint: PageUp's own widget code confirms this
// ("loadDetailsInline" mode just re-filters the already-fetched jobs.json array by Id), so we
// do the same rather than scrape the HTML detail page.

export const JOBS_URL = "https://careers.pageuppeople.com/774/cw/en/jobs.json"

/** Human-readable job detail page (any slug, or none, resolves — PageUp ignores the slug). */
export function detailPageUrl(id: string): string {
  return `https://careers.pageuppeople.com/774/cw/en/job/${id}/`
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on a 404. */
export async function jsonFetch(url: string): Promise<unknown> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      redirect: "follow",
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }
  throw new Error("Request failed after max retries")
}

/** Raw shape returned by PageUp's jobs.json (subset of fields we care about). */
export interface RawJob {
  Id: string
  Title: string
  Summary?: string
  Overview?: string
  Locations?: string
  WorkType?: string
  JobSector?: string
  Categories?: string
  Salary?: string
  ApplyUrl?: string
  OpeningDateUtc?: string | null
  ClosingDateUtc?: string | null
}

export interface JobCard {
  id: string
  title: string
  company: string
  location: string | null
  date: string | null
  url: string
}

export interface JobDetail extends JobCard {
  description: string | null
  workType: string | null
  jobSector: string | null
  categories: string | null
  salary: string | null
  closingDate: string | null
  applyUrl: string | null
}

const COMPANY = "Imagination Technologies"

/** PageUp encodes dates as ASP.NET JSON dates: "/Date(1783497600000)/". Returns an ISO date. */
export function parsePageUpDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = raw.match(/\/Date\((-?\d+)\)\//)
  if (!m) return null
  const ms = parseInt(m[1], 10)
  if (isNaN(ms)) return null
  return new Date(ms).toISOString()
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
}

/** Convert Overview HTML into readable plain text, keeping paragraph/list breaks as newlines. */
function cleanDescription(html: string | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(stripTags(withBreaks)).replace(/\n{3,}/g, "\n\n").trim()
  return text || null
}

export function toJobCard(job: RawJob): JobCard {
  return {
    id: String(job.Id),
    title: job.Title,
    company: COMPANY,
    location: job.Locations || null,
    date: parsePageUpDate(job.OpeningDateUtc),
    url: detailPageUrl(String(job.Id)),
  }
}

export function toJobDetail(job: RawJob): JobDetail {
  return {
    ...toJobCard(job),
    description: cleanDescription(job.Overview) ?? cleanDescription(job.Summary),
    workType: job.WorkType || null,
    jobSector: job.JobSector || null,
    categories: job.Categories || null,
    salary: job.Salary || null,
    closingDate: parsePageUpDate(job.ClosingDateUtc),
    applyUrl: job.ApplyUrl || null,
  }
}

/** Posting-age filter (--jobage <days>): applied client-side since jobs.json has no such param. */
export function withinJobAge(job: RawJob, days: number | undefined): boolean {
  if (!days || days <= 0 || days >= 9999) return true
  const iso = parsePageUpDate(job.OpeningDateUtc)
  if (!iso) return true // don't drop postings with no parseable date
  const postedMs = new Date(iso).getTime()
  const cutoffMs = Date.now() - days * 86400 * 1000
  return postedMs >= cutoffMs
}

export const DEFAULT_PAGE_SIZE = 20
