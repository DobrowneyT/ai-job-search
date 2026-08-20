// Data source: STMicroelectronics' careers site, which runs on Eightfold.ai
// (not Workday/SuccessFactors as might be assumed for a large multinational
// manufacturer). The rendered page at /careers calls Eightfold's own CXS-style
// JSON API to populate search results and job detail, so we call that API
// directly instead of scraping HTML. See ../url-reference.md for the endpoint
// investigation. robots.txt explicitly allows /careers and /api/apply.

export const BASE_URL = "https://stmicroelectronics.eightfold.ai"
export const API_BASE = `${BASE_URL}/api/apply/v2/jobs`
export const DOMAIN = "stmicroelectronics.com"
export const COMPANY = "STMicroelectronics"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

/**
 * Fetch JSON with exponential backoff on 429/5xx. Returns `null` on a 404
 * (Eightfold returns a clean `{"message": "..."}` 404 body for unknown job IDs)
 * rather than throwing.
 */
export async function jsonFetch(url: string): Promise<any | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
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

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
}

export interface JobDetail extends JobCard {
  description: string | null
  department: string | null
  businessUnit: string | null
  workLocationOption: string | null
  locations: string[]
  displayJobId: string | null
}

export interface SearchPage {
  total: number
  jobs: JobCard[]
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      const cp = parseInt(dec, 10)
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
    })
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => {
      const cp = parseInt(hex, 16)
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
    })
    .replace(/&nbsp;/g, " ")
}

/** Convert a job description's HTML (from Eightfold's `job_description` field) to readable plain text. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Unix seconds -> YYYY-MM-DD, or null. */
function isoDay(seconds: unknown): string | null {
  if (typeof seconds !== "number" || !isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

function jobUrl(id: unknown, canonical: unknown): string {
  if (typeof canonical === "string" && canonical) return canonical
  return `${BASE_URL}/careers/job/${id}`
}

/**
 * Parse a search response from `/api/apply/v2/jobs`. Positions are mapped
 * independently so one malformed record cannot break the rest.
 */
export function parseSearchPage(data: any): SearchPage {
  const positions = Array.isArray(data?.positions) ? data.positions : []
  const jobs: JobCard[] = []
  for (const p of positions) {
    try {
      if (p?.id == null || !p?.name) continue
      jobs.push({
        id: String(p.id),
        title: String(p.name),
        company: COMPANY,
        location: p.location || (Array.isArray(p.locations) ? p.locations[0] : null) || null,
        date: isoDay(p.t_create),
        url: jobUrl(p.id, p.canonicalPositionUrl),
      })
    } catch {
      continue
    }
  }
  return { total: typeof data?.count === "number" ? data.count : jobs.length, jobs }
}

/** Parse a single job's detail response from `/api/apply/v2/jobs/<id>`. */
export function parseJobDetail(data: any, id: string): JobDetail | null {
  if (!data || data.name == null) return null
  return {
    id: data.id != null ? String(data.id) : id,
    title: data.name || "(untitled)",
    company: COMPANY,
    location: data.location || (Array.isArray(data.locations) ? data.locations[0] : null) || null,
    date: isoDay(data.t_create),
    url: jobUrl(data.id ?? id, data.canonicalPositionUrl),
    description: data.job_description ? htmlToText(data.job_description) : null,
    department: data.department || null,
    businessUnit: data.business_unit || null,
    workLocationOption: data.work_location_option || null,
    locations: Array.isArray(data.locations) ? data.locations : [],
    displayJobId: data.display_job_id != null ? String(data.display_job_id) : null,
  }
}

/**
 * Eightfold's API has no recency/date filter parameter. `--jobage` is applied
 * client-side against each position's `t_create` (creation timestamp in the
 * ATS, the closest available proxy for posting date). Returns a Unix-seconds
 * cutoff, or null when no filtering should be applied.
 */
export function jobageToCutoff(days: number): number | null {
  if (!days || days <= 0 || days >= 9999) return null
  return Math.floor(Date.now() / 1000) - days * 86400
}
