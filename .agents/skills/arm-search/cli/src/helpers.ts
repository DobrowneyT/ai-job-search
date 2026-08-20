// Data source: careers.arm.com, Arm's own careers site, built on the Radancy
// "TalentBrew" career-site platform (company ID 33099; script/CSS assets are
// served from tbcdn.talentbrew.com). This is NOT one of the well-known ATS
// platforms with a documented public JSON API (Workday/Greenhouse/Lever/
// SmartRecruiters/Workable/iCIMS/SuccessFactors) — actual applications go
// through iCIMS (experienced-arm.icims.com / earlycareers-arm.icims.com), but
// that's only the apply flow. Listings themselves are server-rendered HTML on
// careers.arm.com, so this skill scrapes that HTML rather than an API.
//
// robots.txt on careers.arm.com only disallows `/search-jobs/` (trailing
// slash) — the AJAX endpoints used for client-side pagination/sorting/facet
// filtering (`/search-jobs/results`, `/search-jobs/resultspost`,
// `/search-jobs/GetSearchRequestGeoLocation`). This skill never calls those.
// It only calls the top-level `/search-jobs?k=...&p=...` page (no trailing
// slash — allowed) and `/job/<slug>/<slug>/<orgId>/<id>` detail pages
// (allowed, not under /search-jobs/ at all). See url-reference.md for the
// full investigation notes, including why location/date filters are not
// supported (they are facet/AJAX-only features gated behind the disallowed
// path).

export const BASE_URL = "https://careers.arm.com"
export const SEARCH_URL = `${BASE_URL}/search-jobs`
export const ORG_ID = "33099"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
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
  category: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  reqId: string | null
  applyUrl: string | null
}

export interface SearchPage {
  total: number
  totalPages: number
  currentPage: number
  jobs: JobCard[]
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

// Named entities beyond the XML-standard five. Arm's job descriptions are
// authored in a rich-text editor that emits Word/Office-style "smart
// punctuation" entities (curly quotes, en/em dashes, ellipsis) alongside the
// standard ones — both sets show up in the wild.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  trade: "™",
  reg: "®",
  copy: "©",
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (full, name) => NAMED_ENTITIES[name.toLowerCase()] ?? full)
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/** Convert an HTML description to readable plain text, keeping paragraph breaks. */
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

/**
 * Normalize Arm's non-zero-padded date strings (e.g. "2026-6-16") to
 * YYYY-MM-DD. Returns null if the input doesn't parse as Y-M-D.
 */
export function normalizeDate(s: unknown): string | null {
  if (typeof s !== "string") return null
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  const [, y, mo, d] = m
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
}

/**
 * Extract just the real job-results list from a /search-jobs page.
 *
 * The `job-card__title` CSS class is reused by an unrelated "jobs you may
 * like" / related-content widget elsewhere on the page (its entries link to
 * stories/pages via `data-page-id`, not real postings, and appear even when
 * the real result list is empty, e.g. requesting a page past the last one).
 * Scoping to the substring between `<ul id="search-results-jobs">` and the
 * following `<nav id="pagination-bottom">` avoids picking those up.
 */
function extractResultsListHtml(html: string): string {
  const start = html.indexOf('id="search-results-jobs"')
  if (start === -1) return ""
  const navIdx = html.indexOf('<nav id="pagination-bottom"', start)
  return navIdx === -1 ? html.slice(start) : html.slice(start, navIdx)
}

/** Parse the totals/pagination metadata from the <section id="search-results"> tag. */
function parseTotals(html: string): { total: number; totalPages: number; currentPage: number } {
  const section = html.match(/<section id="search-results"([^>]*)>/)
  const attrs = section?.[1] ?? ""
  const get = (name: string): number => {
    const m = attrs.match(new RegExp(`data-${name}="(-?\\d+)"`))
    return m ? parseInt(m[1], 10) : 0
  }
  return {
    total: get("total-job-results"),
    totalPages: get("total-pages"),
    currentPage: get("current-page") || 1,
  }
}

/**
 * Parse a /search-jobs results page. Job cards are parsed independently so
 * one malformed card cannot break the rest.
 */
export function parseSearchPage(html: string): SearchPage {
  const totals = parseTotals(html)
  const listHtml = extractResultsListHtml(html)
  const jobs: JobCard[] = []

  const chunks = listHtml.split(/<li class="job-card/).slice(1)
  for (const chunk of chunks) {
    try {
      const linkMatch = chunk.match(
        /class="job-card__title[^"]*"[^>]*href="([^"]+)"[^>]*data-job-id="(\d+)"[^>]*>([\s\S]*?)<\/a>/i,
      )
      if (!linkMatch) continue
      const [, href, id, titleHtml] = linkMatch
      const title = clean(titleHtml)
      if (!title) continue

      const locMatch = chunk.match(/class="location"[^>]*>([\s\S]*?)<\/span>/i)
      const location = locMatch ? clean(locMatch[1]) || null : null

      const catMatch = chunk.match(/class="category"[^>]*>([\s\S]*?)<\/span>/i)
      const category = catMatch ? clean(catMatch[1]) || null : null

      const url = href.startsWith("http") ? href : `${BASE_URL}${href}`

      jobs.push({
        id,
        title,
        company: "Arm",
        location,
        date: null, // not present on search-result cards; see detail's datePosted
        url,
        category,
      })
    } catch {
      continue
    }
  }

  return { ...totals, jobs }
}

/** Extract and parse the JSON-LD JobPosting block from a job detail page. */
function extractJobPostingLd(html: string): any | null {
  const m = html.match(
    /<script type="application\/ld\+json">(\{[\s\S]*?"@type":"JobPosting"[\s\S]*?\})<\/script>/,
  )
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

/** Parse a job detail page. Returns null if neither the JSON-LD nor the ID can be resolved. */
export function parseJobDetail(html: string, id: string): JobDetail | null {
  const ld = extractJobPostingLd(html)

  // Fallback markup anchors, used for any field JSON-LD is missing.
  const locSpan = html.match(/class="job-location job-info"[^>]*><b>Location<\/b>([\s\S]*?)<\/span>/i)
  const dateSpan = html.match(/class="job-date job-info"[^>]*><b>Date posted<\/b>([\s\S]*?)<\/span>/i)
  const idSpan = html.match(/class="job-id job-info"[^>]*><b>Job ID<\/b>([\s\S]*?)<\/span>/i)
  const catSpan = html.match(/class="job-category job-info"[^>]*><b>Category<\/b>([\s\S]*?)<\/span>/i)
  const applyMatch = html.match(/data-selector-name="job-apply-link"[^>]*href="([^"]+)"/i)

  if (!ld && !idSpan) return null

  const address = ld?.jobLocation?.[0]?.address
  const location =
    address && (address.addressLocality || address.addressCountry)
      ? [address.addressLocality, address.addressCountry].filter(Boolean).join(", ")
      : locSpan
        ? clean(locSpan[1]) || null
        : null

  const title = ld?.title ? clean(String(ld.title)) : null
  const description = ld?.description ? htmlToText(String(ld.description)) : null

  return {
    id,
    title: title || "(untitled)",
    company: "Arm",
    location,
    date: normalizeDate(ld?.datePosted) ?? (dateSpan ? clean(dateSpan[1]) || null : null),
    url: ld?.url || `${BASE_URL}/job/job/job/${ORG_ID}/${id}`,
    category: catSpan ? clean(catSpan[1]) || null : null,
    description,
    employmentType: ld?.employmentType ? clean(String(ld.employmentType)) : null,
    reqId: ld?.identifier ? clean(String(ld.identifier)) : idSpan ? clean(idSpan[1]) || null : null,
    applyUrl: applyMatch ? decodeHtmlEntities(applyMatch[1]) : null,
  }
}

/** Accept a raw job ID or a full careers.arm.com job URL. */
export function normalizeId(input: string): string | null {
  const bare = input.match(/^\d{6,}$/)
  if (bare) return input
  const url = input.match(/\/job\/[^/]+\/[^/]+\/\d+\/(\d{6,})/)
  if (url) return url[1]
  const anyNum = input.match(/(\d{6,})/)
  return anyNum ? anyNum[1] : null
}

/** Build the detail URL for a job ID. The slug segments are decorative — any value resolves. */
export function detailUrl(id: string): string {
  return `${BASE_URL}/job/job/job/${ORG_ID}/${id}`
}
