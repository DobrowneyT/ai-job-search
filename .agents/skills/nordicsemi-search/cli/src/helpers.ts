// Data source: Nordic Semiconductor's careers site (careers.nordicsemi.com), which
// runs on Teamtailor. Teamtailor careers sites publish a public JSON Feed
// (https://jsonfeed.org) of open positions at `/jobs.json` — the exact same feed
// that backs the site's own RSS/JSON export link. We hit that feed directly rather
// than scraping the rendered HTML: it is server-rendered, requires no auth, and
// already gives every field this CLI needs (including the full job description as
// both `content_html` and a schema.org JobPosting block in `_jobposting`), so a
// second HTML fetch for `detail` is unnecessary.
//
// robots.txt (careers.nordicsemi.com) disallows only /app/, /messages/,
// /messenger/, /facebook/tab/, /jobs/internal/ — the /jobs and /jobs.json paths
// used here are unrestricted for User-agent: *.

export const FEED_URL = "https://careers.nordicsemi.com/jobs.json"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on a 404. */
export async function jsonFetch(url: string): Promise<unknown | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, application/feed+json;q=0.9, */*;q=0.8",
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
  employmentType: string | null
  deadline: string | null
  applyUrl: string | null
}

const COMPANY_NAME = "Nordic Semiconductor"

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

interface RawJobLocation {
  address?: {
    addressLocality?: string
    addressCountry?: string
  }
}

interface RawJobPosting {
  identifier?: { value?: number | string }
  description?: string
  datePosted?: string
  validThrough?: string
  jobLocation?: RawJobLocation | RawJobLocation[]
}

interface RawFeedItem {
  id?: string
  title?: string
  url?: string
  date_published?: string
  content_html?: string
  _jobposting?: RawJobPosting
}

/** Pull the numeric job id Nordic's own URLs use (the slug's leading digits). */
function idFromUrl(url: string | undefined): string | null {
  if (!url) return null
  const m = url.match(/\/jobs\/(\d+)/)
  return m ? m[1] : null
}

/** Join a JobPosting's jobLocation(s) into a single display string. */
function joinLocations(loc: RawJobLocation | RawJobLocation[] | undefined): string | null {
  if (!loc) return null
  const list = Array.isArray(loc) ? loc : [loc]
  const parts = list
    .map((l) => {
      const city = l.address?.addressLocality
      const country = l.address?.addressCountry
      if (city && country) return `${city}, ${country}`
      return city || country || null
    })
    .filter((s): s is string => !!s)
  return parts.length ? parts.join("; ") : null
}

/**
 * Parse the `/jobs.json` JSON Feed into JobCards. Each item is parsed
 * independently so one malformed entry cannot break the rest.
 */
export function parseFeed(data: unknown): JobCard[] {
  const items = (data as { items?: RawFeedItem[] })?.items
  if (!Array.isArray(items)) return []

  const results: JobCard[] = []
  for (const item of items) {
    try {
      const id = idFromUrl(item.url) ?? (item._jobposting?.identifier?.value != null
        ? String(item._jobposting.identifier.value)
        : null)
      if (!id || !item.title || !item.url) continue
      results.push({
        id,
        title: item.title,
        company: COMPANY_NAME,
        location: joinLocations(item._jobposting?.jobLocation),
        date: isoDay(item.date_published) ?? isoDay(item._jobposting?.datePosted),
        url: item.url,
      })
    } catch {
      continue
    }
  }
  return results
}

/** Find one job's full detail in a parsed feed by its numeric id. */
export function findJobDetail(data: unknown, id: string): JobDetail | null {
  const items = (data as { items?: RawFeedItem[] })?.items
  if (!Array.isArray(items)) return null

  for (const item of items) {
    const itemId = idFromUrl(item.url) ?? (item._jobposting?.identifier?.value != null
      ? String(item._jobposting.identifier.value)
      : null)
    if (itemId !== id) continue

    const rawDescription = item._jobposting?.description ?? item.content_html
    return {
      id,
      title: item.title || "(untitled)",
      company: COMPANY_NAME,
      location: joinLocations(item._jobposting?.jobLocation),
      date: isoDay(item.date_published) ?? isoDay(item._jobposting?.datePosted),
      url: item.url || `https://careers.nordicsemi.com/jobs/${id}`,
      description: rawDescription ? htmlToText(rawDescription) : null,
      employmentType: null, // Nordic's JobPosting blocks do not include employmentType
      deadline: isoDay(item._jobposting?.validThrough),
      applyUrl: item.url || null,
    }
  }
  return null
}

/** Accept a raw numeric id or a full careers.nordicsemi.com job URL. */
export function normalizeId(input: string): string | null {
  const fromUrl = idFromUrl(input)
  if (fromUrl) return fromUrl
  const bare = input.match(/^\d+$/)
  return bare ? input : null
}

/** True if a job's location string plausibly matches a user's --location text. */
export function locationMatches(jobLocation: string | null, want: string): boolean {
  if (!jobLocation) return false
  return jobLocation.toLowerCase().includes(want.toLowerCase())
}

/** True if a job's ISO date is within the last N days (client-side --jobage filter). */
export function withinJobage(date: string | null, days: number): boolean {
  if (!days || days <= 0 || days >= 9999) return true
  if (!date) return true // don't drop postings whose date we couldn't parse
  const posted = new Date(date).getTime()
  if (isNaN(posted)) return true
  const cutoff = Date.now() - days * 86400 * 1000
  return posted >= cutoff
}
