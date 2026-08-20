// Data source: Graphcore's public Greenhouse Job Board API
// (boards-api.greenhouse.io/v1/boards/graphcore). This is a documented JSON
// API, not scraped HTML — Graphcore's own careers pages (graphcore.ai/jobs)
// are a thin client-side wrapper around this same board. No authentication
// required.
//
// Unlike Adzuna, Greenhouse's board API supports a direct by-ID detail
// lookup, so this skill needs no local cache. Unlike LinkedIn, the *list*
// endpoint takes no query/location/pagination parameters at all — it always
// returns every open requisition (229 at time of writing) in one response.
// `search` therefore fetches the full list once and filters/sorts/paginates
// client-side.

export const BOARD = "graphcore"
export const LIST_URL = `https://boards-api.greenhouse.io/v1/boards/${BOARD}/jobs`
export const DETAIL_URL = (id: string): string =>
  `https://boards-api.greenhouse.io/v1/boards/${BOARD}/jobs/${id}`

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on a 404. */
export async function jsonFetch(url: string): Promise<any> {
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
  offices: string | null
  employmentType: string | null
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

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * Greenhouse's `content` field is HTML-entity-encoded HTML — the raw JSON
 * string contains literal `&lt;p&gt;...&lt;/p&gt;` rather than `<p>...</p>`,
 * and entities that already exist inside the markup (e.g. `&nbsp;`) show up
 * double-escaped as `&amp;nbsp;`. So decoding runs in two passes: the first
 * unescapes the outer layer to reveal real tags and single-escaped entities,
 * the second (after stripping tags) resolves what's left.
 */
export function contentToText(content: string): string {
  const realHtml = decodeHtmlEntities(content)
  const withBreaks = realHtml
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  return decodeHtmlEntities(stripTags(withBreaks)).replace(/\n{3,}/g, "\n\n").trim()
}

/** ISO datetime -> YYYY-MM-DD, or null. */
function isoDay(s: unknown): string | null {
  if (typeof s !== "string") return null
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/** Parse one raw Greenhouse job record (from either the list or detail endpoint). */
function parseJobCard(job: any): JobCard | null {
  if (job?.id == null || !job.title) return null
  return {
    id: String(job.id),
    title: String(job.title).trim().replace(/\s+/g, " "),
    company: job.company_name || "Graphcore",
    location: job.location?.name || null,
    date: isoDay(job.first_published) || isoDay(job.updated_at),
    url: job.absolute_url || `https://job-boards.greenhouse.io/graphcore/jobs/${job.id}`,
  }
}

/** Parse the /jobs list response into JobCards, skipping any malformed entries. */
export function parseJobsList(data: any): JobCard[] {
  const jobs = Array.isArray(data?.jobs) ? data.jobs : []
  const results: JobCard[] = []
  for (const job of jobs) {
    try {
      const card = parseJobCard(job)
      if (card) results.push(card)
    } catch {
      continue
    }
  }
  return results
}

/** Parse a single-job detail response. */
export function parseJobDetail(job: any): JobDetail | null {
  const card = parseJobCard(job)
  if (!card) return null
  const departments = Array.isArray(job.departments)
    ? job.departments.map((d: any) => d?.name).filter(Boolean).join(", ")
    : ""
  const offices = Array.isArray(job.offices)
    ? job.offices.map((o: any) => o?.location || o?.name).filter(Boolean).join("; ")
    : ""
  const partTimeMeta = Array.isArray(job.metadata)
    ? job.metadata.find((m: any) => /part.?time/i.test(m?.name || ""))
    : null
  const employmentType =
    partTimeMeta && Number(partTimeMeta.value) > 0 ? "Part-time" : "Full-time"

  return {
    ...card,
    description: typeof job.content === "string" ? contentToText(job.content) || null : null,
    department: departments || null,
    offices: offices || card.location,
    employmentType,
    applyUrl: card.url,
  }
}

/** Cutoff Date for a job-age filter, or null if unbounded. */
export function jobageToCutoff(days: number): Date | null {
  if (!days || days <= 0 || days >= 9999) return null
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  return cutoff
}

/** Case-insensitive substring match against a job's title (+ department if present). */
export function matchesQuery(job: JobCard & { department?: string | null }, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = `${job.title} ${job.department || ""}`.toLowerCase()
  return q.split(/\s+/).every((term) => haystack.includes(term))
}

/** Case-insensitive substring match against a job's location string. */
export function matchesLocation(job: JobCard, location: string): boolean {
  const l = location.trim().toLowerCase()
  if (!l) return true
  return (job.location || "").toLowerCase().includes(l)
}

/** Extract a numeric Greenhouse job ID from a bare id or an absolute_url. */
export function normalizeId(input: string): string | null {
  const url = input.match(/\/jobs\/(\d+)(?:[/?]|$)/)
  if (url) return url[1]
  const bare = input.match(/^\d+$/)
  if (bare) return input
  return null
}
