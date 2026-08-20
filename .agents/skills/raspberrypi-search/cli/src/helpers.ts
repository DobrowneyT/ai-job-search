// Data source: Workable's public job-board API (apply.workable.com). Both
// Raspberry Pi entities publish their vacancies through Workable, under two
// separate accounts:
//   - "foundation" -> apply.workable.com/raspberrypifoundation/  (the education charity)
//   - "ltd"         -> apply.workable.com/raspberrypi/            (the commercial hardware
//                       company — confirmed by its widget "name": "Raspberry Pi" and its
//                       job list being entirely Cambridge-based silicon/IC roles: IC Design
//                       Engineer, IC Verification Engineer, DFT Engineer, etc.)
//
// raspberrypi.com/jobs itself is fully Cloudflare-challenge-walled (every path, not just
// /jobs, returns 403 "Just a moment..." with a `Cf-Mitigated: challenge` header to a plain
// fetch) — the same signature this repo already documents for Indeed/Glassdoor/Adzuna's own
// frontend. It cannot be scraped directly. But probing found that its underlying vacancy data
// is the same Workable "raspberrypi" account discovered above, so this skill reaches the Ltd
// company's postings through Workable instead of the blocked marketing site.
//
// Search: POST https://apply.workable.com/api/v3/accounts/<slug>/jobs {"query": "..."}
//   - No auth required. `department`/`location` filters exist but require opaque numeric
//     department IDs / nested location objects (confirmed via 400 validation errors), so this
//     skill applies --location and --jobage client-side instead (see search.ts).
//   - No pagination params are accepted server-side (offset/page/limit all "Not allowed") --
//     both accounts are small (5-10 open jobs each), so client-side paging is sufficient.
// Detail: no by-ID endpoint exists. Instead GET the account's widget endpoint, which returns
// every job WITH its full HTML description in one call:
//   https://apply.workable.com/api/v1/widget/accounts/<slug>?details=true
//   Note: the widget response has one entry per (job, location) pair -- a job posted to
//   multiple locations appears multiple times with the same shortcode -- so detail dedupes
//   by shortcode.

export type AccountKey = "foundation" | "ltd"

export const ACCOUNTS: Record<AccountKey, { slug: string; company: string }> = {
  foundation: { slug: "raspberrypifoundation", company: "Raspberry Pi Foundation" },
  ltd: { slug: "raspberrypi", company: "Raspberry Pi Ltd" },
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** POST a JSON body with exponential backoff on 429/5xx. Throws on other non-2xx. */
export async function postJson(url: string, body: unknown): Promise<any> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      await sleep(delay + Math.floor(Math.random() * 500))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`Workable API error ${response.status}: ${text.slice(0, 200)}`)
    }
    return response.json()
  }
  throw new Error("Request failed after max retries")
}

/** GET JSON with the same backoff policy. Returns null on 404. */
export async function getJson(url: string): Promise<any | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      await sleep(delay + Math.floor(Math.random() * 500))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Workable API error ${response.status}: ${response.statusText}`)
    }
    return response.json()
  }
  throw new Error("Request failed after max retries")
}

/**
 * Resolve which account a bare shortcode belongs to by following the global
 * shortlink's redirect (it 301s to /<account-slug>/j/<shortcode>). Only used
 * when `detail` is given a shortcode with no "foundation:"/"ltd:" prefix and
 * no full URL to parse the account from directly.
 */
export async function resolveAccountForShortcode(shortcode: string): Promise<AccountKey | null> {
  const response = await fetch(`https://apply.workable.com/j/${encodeURIComponent(shortcode)}`, {
    headers: { "User-Agent": UA },
    redirect: "manual",
  })
  const location = response.headers.get("location") || ""
  for (const [key, acc] of Object.entries(ACCOUNTS) as [AccountKey, { slug: string; company: string }][]) {
    if (location.includes(`/${acc.slug}/j/`)) return key
  }
  return null
}

export interface JobCard {
  id: string // "<accountKey>:<shortcode>"
  title: string
  company: string
  location: string | null
  date: string | null
  url: string
  department: string | null
  workplace: string | null
}

/** ISO datetime -> YYYY-MM-DD, or null. */
function isoDay(s: unknown): string | null {
  if (typeof s !== "string") return null
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/** Human-readable location string from a v3 job's location object + workplace flag. */
export function formatLocation(
  loc: { city?: string | null; region?: string | null; country?: string | null } | null | undefined,
  workplace: string | null | undefined,
): string | null {
  const parts = [loc?.city, loc?.region, loc?.country].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  )
  const base = parts.length ? parts.join(", ") : null
  if (workplace === "remote") return base ? `${base} (Remote)` : "Remote"
  return base
}

/** Parse a Workable v3 /jobs search response for one account into contract JobCards. */
export function parseSearchResponse(data: any, accountKey: AccountKey): JobCard[] {
  const acc = ACCOUNTS[accountKey]
  const results = Array.isArray(data?.results) ? data.results : []
  const jobs: JobCard[] = []
  for (const job of results) {
    try {
      if (!job?.shortcode || !job.title) continue
      jobs.push({
        id: `${accountKey}:${job.shortcode}`,
        title: String(job.title).trim(),
        company: acc.company,
        location: formatLocation(job.location, job.workplace),
        date: isoDay(job.published),
        url: `https://apply.workable.com/${acc.slug}/j/${job.shortcode}`,
        department: Array.isArray(job.department) && job.department.length ? job.department.join(", ") : null,
        workplace: job.workplace ?? null,
      })
    } catch {
      continue
    }
  }
  return jobs
}

/** Map a job age in days to a cutoff Date, or null when "all" (0/absent/>=9999). */
export function jobageToCutoff(days: number): Date | null {
  if (!days || days <= 0 || days >= 9999) return null
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  return cutoff
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  education: string | null
  experience: string | null
  jobFunction: string | null
  industry: string | null
  applyUrl: string | null
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
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

/** Strip a Workable job description's HTML into readable prose. Null for empty input. */
export function cleanHtml(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

/**
 * Parse one widget-endpoint job entry (the shape returned by
 * /api/v1/widget/accounts/<slug>?details=true) into a JobDetail.
 */
export function parseWidgetJob(job: any, accountKey: AccountKey): JobDetail {
  const acc = ACCOUNTS[accountKey]
  const loc = { city: job.city, region: job.state, country: job.country }
  return {
    id: `${accountKey}:${job.shortcode}`,
    title: job.title ? String(job.title).trim() : "(untitled)",
    company: acc.company,
    location: formatLocation(loc, job.telecommuting ? "remote" : null),
    date: isoDay(job.published_on) ?? isoDay(job.created_at),
    url: `https://apply.workable.com/${acc.slug}/j/${job.shortcode}`,
    department: job.department || null,
    workplace: job.telecommuting ? "remote" : null,
    description: cleanHtml(job.description),
    employmentType: job.employment_type || null,
    education: job.education || null,
    experience: job.experience || null,
    jobFunction: job.function || null,
    industry: job.industry || null,
    applyUrl: job.application_url || job.shortlink || null,
  }
}

/** Extract "foundation"/"ltd" + shortcode from a compound id or a Workable job URL. */
export function normalizeId(input: string): { account: AccountKey; shortcode: string } | null {
  const trimmed = input.trim()
  const compound = trimmed.match(/^(foundation|ltd):([A-Za-z0-9]+)$/)
  if (compound) return { account: compound[1] as AccountKey, shortcode: compound[2] }

  for (const [key, acc] of Object.entries(ACCOUNTS) as [AccountKey, { slug: string; company: string }][]) {
    const m = trimmed.match(new RegExp(`/${acc.slug}/j/([A-Za-z0-9]+)`))
    if (m) return { account: key, shortcode: m[1] }
  }
  return null
}

/** A bare shortcode with no account prefix/URL context (letters + digits, no slashes/colons). */
export function looksLikeBareShortcode(input: string): boolean {
  return /^[A-Za-z0-9]+$/.test(input.trim())
}
