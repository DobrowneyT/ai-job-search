// Data source: totaljobs.com public job pages. No authentication required.
// Search pages embed their full result data in a
// `window.__PRELOADED_STATE__["app-unifiedResultlist"]` JSON assignment;
// detail pages carry a schema.org JobPosting in <script type="application/ld+json">.
// Detail pages stall the connection for cookie-less clients, so detail requests
// bootstrap a session cookie from a lightweight search hit first.

import { fetchPage, FileReachabilityLog } from "../../../../lib/src/fetch.js"

export const BASE_URL = "https://www.totaljobs.com"

/** Unset means no log, rather than a default path in whatever directory we ran from. */
const REACHABILITY_LOG = process.env.REACHABILITY_LOG

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

interface FetchOpts {
  cookie?: string
  referer?: string
}

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string, opts: FetchOpts = {}): Promise<Response> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        ...(opts.cookie ? { Cookie: opts.cookie } : {}),
        ...(opts.referer ? { Referer: opts.referer } : {}),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
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
    return response
  }
  throw new Error("Request failed after max retries")
}

/**
 * The content path, with pagefetch behind it when totaljobs refuses us.
 *
 * **The fallback is inert today.** Measured 2026-08-19: totaljobs answers a
 * plain HTTP request and returns real listings. It is wired because the failure
 * it guards against arrives all at once, and because `fetchPage` logs every
 * attempt to the reachability log.
 *
 * Unset means disabled: with no PAGEFETCH_URL and PAGEFETCH_TOKEN this is a
 * plain fetch and nothing else.
 */
export async function htmlFetchText(url: string, opts: FetchOpts = {}): Promise<string> {
  const result = await fetchPage(url, {
    source: "totaljobs-search",
    headers: {
      "user-agent": UA,
      "accept-language": "en-GB,en;q=0.9",
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.referer ? { referer: opts.referer } : {}),
    },
    retries: 6,
    log: REACHABILITY_LOG ? new FileReachabilityLog(REACHABILITY_LOG) : undefined,
  })

  if (result.code === "not_found") return ""

  if (!result.ok || result.content === null) {
    throw new Error(
      result.blocked
        ? `totaljobs.com refused the request (${result.blocked}${result.code ? `: ${result.code}` : ""})`
        : `Request failed: ${result.status ?? result.code ?? "no response"}`,
    )
  }

  return result.content
}

/**
 * Bootstrap a session cookie. Detail pages hang for cookie-less clients, so we
 * hit a minimal search page first and carry its cookies.
 *
 * **Deliberately NOT routed through pagefetch.** This function exists to read
 * `Set-Cookie` off the response, and the pagefetch contract returns content
 * rather than headers. It does not need to: pagefetch drives a real browser
 * with its own per-domain cookie jar, so a fetch through the fallback is
 * already a session. The cookie this returns is for the plain path only.
 *
 * A failure here returns "" rather than throwing, so a blocked bootstrap does
 * not stop the detail fetch from reaching the fallback that would have worked.
 */
export async function bootstrapCookies(): Promise<string> {
  try {
    const response = await htmlFetch(`${BASE_URL}/jobs/x`)
    await response.text()
    const setCookies = response.headers.getSetCookie?.() ?? []
    return setCookies.map((c) => c.split(";")[0]).join("; ")
  } catch {
    return ""
  }
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  expiryDate: string | null
  applyUrl: string | null
}

export interface SearchPage {
  total: number
  jobs: JobCard[]
}

/**
 * Extract a balanced-brace JSON object starting at `start` (the index of the
 * opening "{"), honoring strings and escapes — the JS equivalent of Python's
 * json raw_decode.
 */
function extractJsonObject(text: string, start: number): string | null {
  if (text[start] !== "{") return null
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (ch === "\\") i++
      else if (ch === '"') inString = false
    } else if (ch === '"') {
      inString = true
    } else if (ch === "{") {
      depth++
    } else if (ch === "}") {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/** Pull the unified-resultlist state object out of a search page. */
export function extractResultlistState(html: string): any | null {
  const m = html.match(/window\.__PRELOADED_STATE__\["app-unifiedResultlist"\]\s*=\s*/)
  if (!m) return null
  const raw = extractJsonObject(html, m.index! + m[0].length)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
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

/** Convert a job description's HTML to readable plain text, keeping paragraph breaks. */
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

/** ISO datetime -> YYYY-MM-DD, or null. */
function isoDay(s: unknown): string | null {
  if (typeof s !== "string") return null
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/**
 * Parse a search-results page. Items are parsed independently so one malformed
 * record cannot break the rest.
 */
export function parseSearchPage(html: string): SearchPage {
  const state = extractResultlistState(html)
  const sr = state?.searchResults
  if (!sr || !Array.isArray(sr.items)) return { total: 0, jobs: [] }

  const jobs: JobCard[] = []
  for (const item of sr.items) {
    try {
      if (item?.id == null || !item.title) continue
      jobs.push({
        id: String(item.id),
        title: String(item.title),
        company: item.companyName || null,
        location: item.location || null,
        date: isoDay(item.datePosted),
        url: item.url ? `${BASE_URL}${item.url}` : `${BASE_URL}/job/${item.id}`,
        salary: item.salary || null,
      })
    } catch {
      continue
    }
  }
  const total = sr.pagination?.totalCount
  return { total: typeof total === "number" ? total : jobs.length, jobs }
}

/** Parse the schema.org JobPosting from a detail page. Returns null if absent. */
export function parseJobDetail(html: string, id: string): JobDetail | null {
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  if (!ld) return null
  let posting: any
  try {
    const parsed = JSON.parse(ld[1])
    posting = Array.isArray(parsed) ? parsed.find((p) => p["@type"] === "JobPosting") : parsed
  } catch {
    return null
  }
  if (!posting || posting["@type"] !== "JobPosting") return null

  const address = posting.jobLocation?.address
  const location =
    address?.addressLocality ||
    (Array.isArray(posting.jobLocation) ? posting.jobLocation[0]?.address?.addressLocality : null) ||
    null

  const salary =
    typeof posting.baseSalary === "string"
      ? posting.baseSalary || null
      : posting.baseSalary?.value?.value || posting.baseSalary?.value || null

  const url = posting.url || `${BASE_URL}/job/${id}`

  return {
    id,
    title: posting.title || "(untitled)",
    company: posting.hiringOrganization?.name || null,
    location,
    date: isoDay(posting.datePosted),
    url,
    salary: typeof salary === "string" ? salary : null,
    description: posting.description ? htmlToText(posting.description) : null,
    employmentType: posting.employmentType || null,
    expiryDate: isoDay(posting.validThrough),
    applyUrl: url,
  }
}

/**
 * Map a job age in days onto totaljobs' postedWithin buckets: 1 | 3 | 7 | 14.
 * Returns null (no filter) for anything older.
 */
export function jobageToPostedWithin(days: number): number | null {
  if (!days || days <= 0 || days >= 9999) return null
  if (days <= 1) return 1
  if (days <= 3) return 3
  if (days <= 7) return 7
  return 14
}

/** "Embedded Firmware Engineer" -> "embedded-firmware-engineer" for URL paths. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "")
}
