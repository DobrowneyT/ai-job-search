// Data source: SiFive's careers site runs on Workday (sifive.wd1.myworkdayjobs.com).
// This is NOT scraped HTML — Workday exposes a documented, unauthenticated JSON
// API (the "CXS" endpoints) that its own site's frontend calls. No API key
// required. See ../url-reference.md for full endpoint documentation and quirks.

export const TENANT = "sifive"
export const SITE = "sifivecareers"
export const HOST = "https://sifive.wd1.myworkdayjobs.com"
export const API_BASE = `${HOST}/wday/cxs/${TENANT}/${SITE}`
export const SITE_BASE = `${HOST}/${SITE}`

// Workday's search endpoint caps limit at 20 per page for this tenant (values
// above 20 return HTTP 400).
export const PAGE_SIZE = 20

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

/** POST/GET JSON with exponential backoff on 429/5xx. Returns null on a 404. */
export async function jsonFetch(url: string, body?: unknown): Promise<any | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
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
  locations: string[]
  employmentType: string | null
  applyUrl: string | null
}

export interface SearchPage {
  total: number
  jobs: JobCard[]
}

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/**
 * Parse Workday's bucketed "Posted ..." bullet text into an approximate day
 * count. Returns null for the open-ended "30+ Days Ago" bucket (exact age
 * unknown beyond 30 days) — there is no server-side date facet on this
 * tenant, so this bucket text is the only signal available in search results
 * (the exact posting date is only available from `detail`, via `startDate`).
 */
export function parsePostedBucket(text: string | undefined): { daysAgo: number | null; date: string | null } {
  if (!text) return { daysAgo: null, date: null }
  if (/posted today/i.test(text)) return { daysAgo: 0, date: isoDaysAgo(0) }
  const m = text.match(/posted\s+(\d+)\s+days?\s+ago/i)
  if (m) {
    const n = parseInt(m[1], 10)
    return { daysAgo: n, date: isoDaysAgo(n) }
  }
  // "Posted 30+ Days Ago" or anything unrecognized.
  return { daysAgo: null, date: null }
}

/** Extract the requisition ID (e.g. "R-101207") from a job's bullet fields. */
function extractReqId(bulletFields: unknown, externalPath: string): string {
  if (Array.isArray(bulletFields)) {
    for (const b of bulletFields) {
      if (typeof b === "string" && /^R-\d+$/i.test(b.trim())) return b.trim()
    }
  }
  const m = externalPath.match(/_(R-\d+)(?:-\d+)?$/i)
  return m ? m[1] : externalPath
}

/** Build the public, human-viewable URL for a job from its externalPath. */
function jobUrl(externalPath: string): string {
  return `${SITE_BASE}${externalPath}`
}

/**
 * Parse a Workday `/jobs` search response. Entries are parsed independently
 * so one malformed record cannot break the rest. `company` is always
 * "SiFive" — this is a single-company Workday tenant, not a multi-employer
 * aggregator.
 */
export function parseSearchResponse(data: any): SearchPage {
  const postings = Array.isArray(data?.jobPostings) ? data.jobPostings : []
  const jobs: JobCard[] = []
  for (const jp of postings) {
    try {
      if (!jp?.externalPath || !jp.title) continue
      const { date } = parsePostedBucket(jp.bulletFields?.[0])
      jobs.push({
        id: extractReqId(jp.bulletFields, jp.externalPath),
        title: String(jp.title).trim(),
        company: "SiFive",
        location: jp.locationsText || null,
        date,
        url: jobUrl(jp.externalPath),
      })
    } catch {
      continue
    }
  }
  return { total: typeof data?.total === "number" ? data.total : jobs.length, jobs }
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
 * Parse a Workday job-detail response (`jobPostingInfo`). `startDate` is the
 * exact requisition posting date on this tenant (verified against the
 * "Posted N Days Ago" bucket text) — not a job start date, despite the name.
 */
export function parseJobDetail(data: any, externalPath: string): JobDetail | null {
  const info = data?.jobPostingInfo
  if (!info || !info.title) return null

  const locations = [info.location, ...(Array.isArray(info.additionalLocations) ? info.additionalLocations : [])]
    .filter((l): l is string => typeof l === "string" && l.length > 0)

  return {
    id: info.jobReqId || extractReqId(null, externalPath),
    title: String(info.title).trim(),
    company: "SiFive",
    location: info.location || null,
    date: isoDay(info.startDate),
    url: info.externalUrl || jobUrl(externalPath),
    description: info.jobDescription ? htmlToText(info.jobDescription) : null,
    locations,
    employmentType: info.timeType || null,
    applyUrl: info.externalUrl || null,
  }
}

export interface FacetMatch {
  facetParameter: string
  id: string
  descriptor: string
}

/**
 * Fetch the full facet tree (one lightweight request) and case-insensitively
 * match `term` against country names first, then specific site/location
 * names, so --location can map to Workday's `locationCountry` or `locations`
 * facet. Returns null if nothing matches (search must then report zero
 * results rather than silently ignoring the filter).
 */
export async function resolveLocationFacet(term: string): Promise<FacetMatch | null> {
  const data = await jsonFetch(`${API_BASE}/jobs`, { appliedFacets: {}, limit: 1, offset: 0, searchText: "" })
  const facets = Array.isArray(data?.facets) ? data.facets : []
  const needle = term.trim().toLowerCase()

  const locationGroup = facets.find((f: any) => f.facetParameter === "locationMainGroup")
  const subfacets = Array.isArray(locationGroup?.values) ? locationGroup.values : []

  // Countries first (broadest, most likely intent), then specific sites.
  const order = ["locationCountry", "locations"]
  for (const param of order) {
    const sub = subfacets.find((s: any) => s.facetParameter === param)
    const values = Array.isArray(sub?.values) ? sub.values : []
    const exact = values.find((v: any) => typeof v.descriptor === "string" && v.descriptor.toLowerCase() === needle)
    if (exact) return { facetParameter: param, id: exact.id, descriptor: exact.descriptor }
  }
  for (const param of order) {
    const sub = subfacets.find((s: any) => s.facetParameter === param)
    const values = Array.isArray(sub?.values) ? sub.values : []
    const partial = values.find((v: any) => typeof v.descriptor === "string" && v.descriptor.toLowerCase().includes(needle))
    if (partial) return { facetParameter: param, id: partial.id, descriptor: partial.descriptor }
  }
  return null
}

/** Extract the "/job/<slug>_R-XXXXXX" externalPath from an id or a full SiFive/Workday URL. */
export function normalizeExternalPath(input: string): string | null {
  const urlMatch = input.match(/\/job\/[^\s?#]+/)
  if (urlMatch) return urlMatch[0]
  // Already looks like an externalPath tail without the leading "/job/".
  if (/^[^/]+\/[^/]+_R-\d+/i.test(input)) return `/job/${input}`
  return null
}

/** True if the input is a bare requisition ID like "R-101207" (no slug/path known yet). */
export function isBareReqId(input: string): boolean {
  return /^R-\d+$/i.test(input.trim())
}
