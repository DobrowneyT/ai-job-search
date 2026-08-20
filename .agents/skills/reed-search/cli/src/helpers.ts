// Data source: reed.co.uk public job pages. No authentication required.
// Both the search page (/jobs?keywords=...) and the detail page (/jobs/<slug>/<id>)
// are Next.js pages that embed their full data as JSON in a
// <script id="__NEXT_DATA__"> tag, so we extract that blob and read structured
// fields instead of parsing HTML markup. robots.txt allows /jobs/ paths and
// disallows /api/ — we only ever fetch the public pages.

import { fetchPage, FileReachabilityLog } from "../../../../lib/src/fetch.js"

export const BASE_URL = "https://www.reed.co.uk"

/**
 * Where to append reachability measurements, if anywhere.
 *
 * Unset means no log rather than a default path — a CLI that silently created
 * files in whatever directory it was run from would be a surprise.
 */
const REACHABILITY_LOG = process.env.REACHABILITY_LOG

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

/**
 * Fetch HTML, falling back to pagefetch when reed refuses the plain request.
 *
 * **The fallback is inert today.** Measured 2026-08-19: reed answers a plain
 * HTTP request and returns real listings, so this path never reaches pagefetch.
 * It is here because the failure it guards against is sudden — a site turns on
 * a challenge and every run returns nothing — and because `fetchPage` logs every
 * attempt to the reachability log, which is the data that says whether that has
 * started happening.
 *
 * Unset means disabled: with no PAGEFETCH_URL and PAGEFETCH_TOKEN this is a
 * plain fetch and nothing else, which is what keeps the repo forkable.
 *
 * Returns "" on a 404 — reed 404s on out-of-range page numbers rather than
 * returning an empty result page.
 */
export async function htmlFetch(url: string): Promise<string> {
  const result = await fetchPage(url, {
    source: "reed-search",
    // reed is a UK board and its listings read better in en-GB.
    headers: { "user-agent": UA, "accept-language": "en-GB,en;q=0.9" },
    // Matches the backoff this used to do by hand. Transient only — a block is
    // never retried, because retrying a refusal is how an address earns a
    // permanent listing.
    retries: 6,
    log: REACHABILITY_LOG ? new FileReachabilityLog(REACHABILITY_LOG) : undefined,
  })

  if (result.code === "not_found") return ""

  if (!result.ok || result.content === null) {
    // A refusal and a failure are different things and the caller is told which.
    // `blocked` is only ever set when the origin deliberately refused us.
    throw new Error(
      result.blocked
        ? `reed.co.uk refused the request (${result.blocked}${result.code ? `: ${result.code}` : ""})`
        : `Request failed: ${result.status ?? result.code ?? "no response"}`,
    )
  }

  return result.content
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
  remote: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  contractType: string | null
  employmentHours: string | null
  expiryDate: string | null
  applyUrl: string | null
}

export interface SearchPage {
  total: number
  jobs: JobCard[]
}

/** Extract and parse the Next.js data blob from a reed.co.uk page. */
export function extractNextData(html: string): any | null {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/,
  )
  if (!m) return null
  try {
    return JSON.parse(m[1])
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

function formatMoney(n: number): string {
  return "£" + n.toLocaleString("en-GB")
}

/** Build a display salary from the search result's numeric fields. */
function searchSalary(jd: any): string | null {
  const from = typeof jd.salaryFrom === "number" && jd.salaryFrom > 0 ? jd.salaryFrom : null
  const to = typeof jd.salaryTo === "number" && jd.salaryTo > 0 ? jd.salaryTo : null
  if (from && to) return `${formatMoney(from)} - ${formatMoney(to)}`
  if (from) return `from ${formatMoney(from)}`
  if (to) return `up to ${formatMoney(to)}`
  return null
}

/** ISO date -> YYYY-MM-DD, or null. */
function isoDay(s: unknown): string | null {
  if (typeof s !== "string") return null
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/**
 * Parse a search-results page. Each entry in searchResults.jobs wraps its data
 * in jobDetail; entries are parsed independently so one malformed record cannot
 * break the rest. Promoted jobs can appear twice, so results are deduped by id.
 */
export function parseSearchPage(html: string): SearchPage {
  const data = extractNextData(html)
  const sr = data?.props?.pageProps?.searchResults
  if (!sr || !Array.isArray(sr.jobs)) return { total: 0, jobs: [] }

  const seen = new Set<string>()
  const jobs: JobCard[] = []
  for (const item of sr.jobs) {
    try {
      const jd = item?.jobDetail
      if (!jd || jd.jobId == null || !jd.jobTitle) continue
      const id = String(jd.jobId)
      if (seen.has(id)) continue
      seen.add(id)
      const locality = jd.displayLocationName || null
      const county = jd.countyLocation || null
      jobs.push({
        id,
        title: String(jd.jobTitle),
        company: jd.ouName || item.profileName || null,
        location: locality && county && county !== locality ? `${locality}, ${county}` : locality || county,
        date: isoDay(jd.displayDate) ?? isoDay(jd.dateCreated),
        url: item.url ? `${BASE_URL}${item.url}` : `${BASE_URL}/jobs/j/${id}`,
        salary: searchSalary(jd),
        remote: jd.remoteWorkingOption || null,
      })
    } catch {
      continue
    }
  }
  return { total: typeof sr.count === "number" ? sr.count : jobs.length, jobs }
}

/** Parse a job detail page's embedded data. Returns null if the blob is missing. */
export function parseJobDetail(html: string, id: string): JobDetail | null {
  const data = extractNextData(html)
  const pageProps = data?.props?.pageProps
  const jd = pageProps?.consolidatedJobDetails?.jobDetails
  if (!jd) return null

  const hours = jd.jobEmploymentHours
  const employmentHours =
    hours?.isFullTime && hours?.isPartTime
      ? "Full-time or part-time"
      : hours?.isFullTime
        ? "Full-time"
        : hours?.isPartTime
          ? "Part-time"
          : null

  const canonical: string | null =
    pageProps.canonicalUrl || (pageProps.jobUrl ? `${BASE_URL}${pageProps.jobUrl}` : null)

  return {
    id: jd.id != null ? String(jd.id) : id,
    title: jd.title || "(untitled)",
    company: jd.jobOwner?.profileName || null,
    location: jd.jobLocation?.locationName || null,
    date: isoDay(jd.displayDate) ?? isoDay(jd.createdDate),
    url: canonical || `${BASE_URL}/jobs/j/${id}`,
    salary: jd.jobSalary?.displaySalary || null,
    remote: jd.jobLocation?.isRemoteJob
      ? "Remote"
      : jd.jobLocation?.inferredJobLocationType || null,
    description: jd.description ? htmlToText(jd.description) : null,
    contractType: jd.jobContractType?.name || null,
    employmentHours,
    expiryDate: isoDay(jd.expiryDate),
    applyUrl: canonical,
  }
}

/**
 * Map a job age in days onto Reed's datecreatedoffset buckets:
 * today | lastthreedays | lastweek | lasttwoweeks | (omitted = anytime).
 */
export function jobageToOffset(days: number): string | null {
  if (!days || days <= 0 || days >= 9999) return null
  if (days <= 1) return "today"
  if (days <= 3) return "lastthreedays"
  if (days <= 7) return "lastweek"
  return "lasttwoweeks"
}
