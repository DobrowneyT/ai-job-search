// Data source: Adzuna's official public Jobs API (api.adzuna.com), which
// aggregates listings from many UK job sources. Unlike this repo's other
// portal skills, this one is NOT scraped HTML — it's a documented JSON API
// that requires a free app_id/app_key pair (register at
// https://developer.adzuna.com/). Adzuna's own web frontend (adzuna.co.uk) is
// Cloudflare-protected like several other big UK boards, but the api.adzuna.com
// endpoints are the intended integration surface and are not blocked.
//
// Known limitation: Adzuna's free API only returns a truncated (~500 char)
// description per job, and there is no by-ID detail endpoint. The ad redirect
// URL that would show the full posting returns 403, so there is no way to
// fetch a fuller description than what `search` already returns. Since the API
// also has no way to look up an arbitrary job by ID, `search` caches full
// records to disk (see cache.ts) so a subsequent `detail <id>` can read them
// back — that's the only way this data source can support a detail command.

export const API_BASE = "https://api.adzuna.com/v1/api/jobs"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

/**
 * Bun auto-loads .env relative to the *current working directory*, not this
 * script's location. Every portal skill's documented invocation runs `bun run
 * .agents/skills/<name>/cli/src/cli.ts ...` from the repo root, so cwd-based
 * loading silently misses cli/.env whenever the caller isn't already inside
 * cli/. Load it explicitly from a path relative to this file instead.
 */
async function loadDotEnvIfNeeded(): Promise<void> {
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) return
  const envPath = new URL("../.env", import.meta.url).pathname
  const file = Bun.file(envPath)
  if (!(await file.exists())) return
  const text = await file.text()
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

/** Reads ADZUNA_APP_ID / ADZUNA_APP_KEY from the environment, loading cli/.env explicitly if needed. */
export async function getCredentials(): Promise<{ appId: string; appKey: string } | null> {
  await loadDotEnvIfNeeded()
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) return null
  return { appId, appKey }
}

/** Fetch JSON with exponential backoff on 429/5xx. Throws on 4xx (auth/bad request). */
export async function jsonFetch(url: string): Promise<any> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
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
    if (!response.ok) {
      const body = await response.text()
      let detail = body
      try {
        detail = JSON.parse(body).exception || JSON.parse(body).display || body
      } catch {
        // leave detail as raw body
      }
      throw new Error(`Adzuna API error ${response.status}: ${detail}`)
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
  salary: string | null
  descriptionSnippet: string | null
  category: string | null
}

export interface SearchPage {
  total: number
  jobs: JobCard[]
}

/** ISO datetime -> YYYY-MM-DD, or null. */
function isoDay(s: unknown): string | null {
  if (typeof s !== "string") return null
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function formatMoney(n: number): string {
  return "£" + Math.round(n).toLocaleString("en-GB")
}

function jobSalary(job: any): string | null {
  const min = typeof job.salary_min === "number" ? job.salary_min : null
  const max = typeof job.salary_max === "number" ? job.salary_max : null
  if (min && max && min !== max) return `${formatMoney(min)} - ${formatMoney(max)}`
  if (min) return formatMoney(min)
  if (max) return formatMoney(max)
  return null
}

/** Parse an Adzuna /search response. Entries are parsed independently. */
export function parseSearchResponse(data: any): SearchPage {
  const results = Array.isArray(data?.results) ? data.results : []
  const jobs: JobCard[] = []
  for (const job of results) {
    try {
      if (job?.id == null || !job.title) continue
      jobs.push({
        id: String(job.id),
        title: String(job.title).trim(),
        company: job.company?.display_name || null,
        location: job.location?.display_name || null,
        date: isoDay(job.created),
        url: job.redirect_url || `https://www.adzuna.co.uk/jobs/land/ad/${job.id}`,
        salary: jobSalary(job),
        descriptionSnippet: job.description ? String(job.description).trim() : null,
        category: job.category?.label || null,
      })
    } catch {
      continue
    }
  }
  return { total: typeof data?.count === "number" ? data.count : jobs.length, jobs }
}

/**
 * Map a job age in days onto Adzuna's max_days_old parameter (it accepts any
 * positive integer directly, unlike the bucketed portals).
 */
export function jobageToMaxDaysOld(days: number): number | null {
  if (!days || days <= 0 || days >= 9999) return null
  return Math.floor(days)
}
