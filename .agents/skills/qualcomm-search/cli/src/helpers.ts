// Data source: Qualcomm's own careers site (careers.qualcomm.com), which runs on the
// Eightfold.ai talent platform (confirmed via `x-ef-*` response headers, the
// `docs.eightfold.ai` / `app.eightfold.ai` references in the page, and the
// `qualcomm.eightfold.ai` tenant alias) — NOT Workday. Eightfold exposes a JSON search
// API (`/api/pcsx/search`) and a JSON detail API (`/api/apply/v2/jobs/<id>`) that the
// React-rendered career site calls via XHR. We call both directly instead of scraping
// the rendered HTML. See ../url-reference.md for how these were found.

export const DOMAIN = "qualcomm.com"
export const SEARCH_URL = "https://careers.qualcomm.com/api/pcsx/search"
export const DETAIL_URL = "https://careers.qualcomm.com/api/apply/v2/jobs"
export const CAREERS_BASE = "https://careers.qualcomm.com"

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
    return (await response.json()) as T
  }
  throw new Error("Request failed after max retries")
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
  department: string | null
  businessUnit: string | null
  description: string | null
  applyUrl: string | null
}

/** Raw shape of one entry in `data.positions` from /api/pcsx/search. */
interface RawPosition {
  id: number
  displayJobId?: string
  name: string
  locations?: string[]
  postedTs?: number
  creationTs?: number
  department?: string
  positionUrl?: string
}

interface RawSearchResponse {
  data?: {
    positions?: RawPosition[]
    count?: number
  }
}

/** Raw shape of the /api/apply/v2/jobs/<id> detail response. */
interface RawDetail {
  id: number
  name?: string
  location?: string
  locations?: string[]
  department?: string
  business_unit?: string
  job_description?: string
  canonicalPositionUrl?: string
  t_create?: number
  t_update?: number
}

function unixToIso(ts: number | undefined): string | null {
  if (!ts) return null
  return new Date(ts * 1000).toISOString().slice(0, 10)
}

/** Convert one raw position into the shared JobResult shape. */
function toJobResult(p: RawPosition): JobResult {
  const url = p.positionUrl ? `${CAREERS_BASE}${p.positionUrl}` : `${CAREERS_BASE}/careers/job/${p.id}`
  return {
    id: String(p.id),
    title: p.name,
    company: "Qualcomm",
    location: p.locations && p.locations.length > 0 ? p.locations.join("; ") : null,
    date: unixToIso(p.postedTs ?? p.creationTs),
    url,
  }
}

/** Parse the /api/pcsx/search JSON response into JobResult[] plus the total count. */
export function parseSearchResponse(json: unknown): { results: JobResult[]; count: number } {
  const parsed = (json ?? {}) as RawSearchResponse
  const positions = parsed.data?.positions ?? []
  return {
    results: positions.map(toJobResult),
    count: parsed.data?.count ?? positions.length,
  }
}

/** Convert a Unicode code point to a string, dropping out-of-range values. */
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

/** Strip HTML tags from Qualcomm's rich-text job_description, preserving paragraph breaks. */
function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const stripped = withBreaks.replace(/<[^>]+>/g, "")
  return decodeHtmlEntities(stripped)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Parse the /api/apply/v2/jobs/<id> JSON response into a JobDetail. */
export function parseDetailResponse(raw: unknown): JobDetail {
  const json = raw as RawDetail
  const url = json.canonicalPositionUrl || `${CAREERS_BASE}/careers/job/${json.id}`
  return {
    id: String(json.id),
    title: json.name || "(untitled)",
    company: "Qualcomm",
    location:
      json.locations && json.locations.length > 0
        ? json.locations.join("; ")
        : json.location || null,
    date: unixToIso(json.t_create),
    url,
    department: json.department || null,
    businessUnit: json.business_unit || null,
    description: json.job_description ? htmlToPlainText(json.job_description) : null,
    applyUrl: url,
  }
}

/** Convert a job-age in days to a Unix-seconds cutoff. Qualcomm's API has no native
 * posted-within filter, so this is applied client-side against each result's `date`. */
export function jobageCutoff(days: number | undefined): number | null {
  if (!days || days <= 0 || days >= 9999) return null
  return Math.floor(Date.now() / 1000) - days * 86400
}
