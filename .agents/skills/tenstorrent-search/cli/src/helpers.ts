// Data source: Tenstorrent's public Greenhouse job-board API.
//
// tenstorrent.com/en/careers is a Next.js front-end that embeds a Greenhouse
// job-board widget; the actual listings are served by Greenhouse's public,
// unauthenticated JSON API at boards-api.greenhouse.io/v1/boards/tenstorrent.
// No API key, no HTML scraping — this is Greenhouse's own hosted-jobs REST API.
//
// The board endpoint has no server-side query/filter/pagination parameters —
// Greenhouse returns the *entire* open-requisition list (~130 postings as of
// 2026-07) in one response. This CLI fetches the full board once per command
// and filters, sorts, and paginates client-side. See ../url-reference.md for
// full endpoint documentation.

export const BOARD_URL = "https://boards-api.greenhouse.io/v1/boards/tenstorrent/jobs"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on a 404. */
export async function jsonFetch<T = unknown>(url: string): Promise<T | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
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
    return (await response.json()) as T
  }
  throw new Error("Request failed after max retries")
}

export interface GreenhouseDepartment {
  id: number
  name: string
}

export interface GreenhouseJob {
  id: number
  title: string
  absolute_url: string
  location: { name: string } | null
  updated_at: string
  first_published?: string | null
  requisition_id?: string | null
  company_name?: string | null
  departments?: GreenhouseDepartment[]
  content?: string | null
}

export interface JobResult {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
}

export interface JobDetail extends JobResult {
  description: string | null
  department: string | null
  requisitionId: string | null
  applyUrl: string | null
}

/**
 * Convert a Unicode code point to a string. Uses `fromCodePoint` (not
 * `fromCharCode`) so supplementary-plane code points (emoji etc.) decode
 * correctly, and drops out-of-range values instead of throwing.
 */
function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/** Convert an HTML description to readable plain text, keeping paragraph breaks. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Greenhouse's `content` field comes back HTML-entity-escaped (the real markup
 * — `<div>`, `<p>`, `<li>` — is itself wrapped in `&lt;`/`&gt;`/`&quot;` before
 * being placed in the JSON string). Decode once to reveal the real tags, then
 * run the normal HTML-to-text pipeline, which decodes entities again for
 * anything nested inside the markup (e.g. a stray "&amp;nbsp;" that decodes to
 * "&nbsp;" on the first pass and to a space on the second).
 */
export function greenhouseContentToText(content: string): string {
  const rawHtml = decodeHtmlEntities(content)
  return htmlToText(rawHtml)
}

/** ISO datetime -> YYYY-MM-DD, or null. */
function isoDay(s: string | null | undefined): string | null {
  if (typeof s !== "string") return null
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/** Whole days between a job's timestamp field and now, or null if unparseable. */
export function daysAgo(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const t = new Date(dateStr).getTime()
  if (isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

/** Prefer first_published (when the req first went live) over updated_at as the posting date. */
export function postingDateRaw(job: GreenhouseJob): string | null {
  return job.first_published ?? job.updated_at ?? null
}

export function toJobResult(job: GreenhouseJob): JobResult {
  return {
    id: String(job.id),
    title: job.title,
    company: job.company_name || "Tenstorrent",
    location: job.location?.name || null,
    date: isoDay(postingDateRaw(job)),
    url: job.absolute_url,
  }
}

export function matchesQuery(job: GreenhouseJob, query?: string): boolean {
  if (!query) return true
  return job.title.toLowerCase().includes(query.toLowerCase())
}

export function matchesLocation(job: GreenhouseJob, location?: string): boolean {
  if (!location) return true
  return (job.location?.name || "").toLowerCase().includes(location.toLowerCase())
}

export function matchesDepartment(job: GreenhouseJob, department?: string): boolean {
  if (!department) return true
  const needle = department.toLowerCase()
  return (job.departments || []).some((d) => d.name.toLowerCase().includes(needle))
}
