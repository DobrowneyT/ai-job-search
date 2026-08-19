// The shared fetch helper. Plain HTTP is the default and the only path that
// works out of the box; the pagefetch fallback is a seam that stays disabled
// unless both PAGEFETCH_URL and PAGEFETCH_TOKEN are set.
//
// Unset means disabled, and that property is what keeps this repo forkable — a
// forker must never need a VPS. It is asserted directly in the tests.

import { appendFileSync, existsSync, readFileSync } from "fs"

export type BlockReason = "challenge" | "empty_shell" | "robots" | "benched"

/**
 * Which pagefetch codes mean "this site refused us", as opposed to "this fetch
 * failed". Only the former belong in the block rate.
 *
 * See pagefetch `docs/USING-PAGEFETCH.md`. `origin_error`, `timeout`,
 * `not_found`, `rate_limited` and `invalid_url` are all failures rather than
 * refusals — `rate_limited` is even our own limiter rather than theirs.
 */
function blockReasonFor(code: string): BlockReason | null {
  if (code === "blocked_robots") return "robots"
  if (code === "domain_benched") return "benched"
  if (code === "blocked_challenge") return "challenge"
  return null
}

export type Via = "http" | "pagefetch"

export interface FetchResult {
  ok: boolean
  status: number | null
  content: string | null
  url_final: string | null
  via: Via
  blocked: BlockReason | null
  /** Machine-readable reason from pagefetch's error contract, when it was used. */
  code: string | null
}

export interface ReachabilityEntry {
  at: string
  source: string | null
  host: string
  url: string
  status: number | null
  via: Via
  blocked: BlockReason | null
  ok: boolean
}

export interface ReachabilityLog {
  record(entry: ReachabilityEntry): void
}

/** In-memory log, used by tests and by callers that do not want a file. */
export class MemoryReachabilityLog implements ReachabilityLog {
  entries: ReachabilityEntry[] = []
  record(entry: ReachabilityEntry): void {
    this.entries.push(entry)
  }
}

/**
 * Append-only JSONL on disk. Append-only because the whole point is to
 * accumulate measurements across runs — a writer that rewrote the file would
 * lose exactly the history the pagefetch decision depends on.
 */
export class FileReachabilityLog implements ReachabilityLog {
  constructor(private readonly path: string) {}
  record(entry: ReachabilityEntry): void {
    appendFileSync(this.path, JSON.stringify(entry) + "\n", "utf8")
  }
}

export interface ReachabilitySummary {
  host: string
  attempts: number
  blocked: number
  block_rate: number
}

/** Per-host block rates, so the decision to build pagefetch is made from data. */
export function summariseReachability(path: string): ReachabilitySummary[] {
  if (!existsSync(path)) return []
  const byHost = new Map<string, { attempts: number; blocked: number }>()

  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue
    let entry: ReachabilityEntry
    try {
      entry = JSON.parse(line) as ReachabilityEntry
    } catch {
      continue // One malformed line must not cost the whole summary.
    }
    const bucket = byHost.get(entry.host) ?? { attempts: 0, blocked: 0 }
    bucket.attempts++
    if (entry.blocked) bucket.blocked++
    byHost.set(entry.host, bucket)
  }

  return [...byHost.entries()]
    .map(([host, b]) => ({ host, ...b, block_rate: b.attempts === 0 ? 0 : b.blocked / b.attempts }))
    .sort((a, b) => b.block_rate - a.block_rate || a.host.localeCompare(b.host))
}

export interface FetchOptions {
  fetchImpl?: typeof fetch
  env?: Record<string, string | undefined>
  log?: ReachabilityLog
  source?: string
  /** Retries for transient failures (429/5xx). Blocks and 404s are never retried. */
  retries?: number
  sleep?: (ms: number) => Promise<void>
  /** CSS selector for pagefetch to await, when the fallback is used. */
  waitFor?: string
  /**
   * Extra request headers for the plain path.
   *
   * The sources are not interchangeable — jobindex asks for Danish, reed for
   * en-GB, and totaljobs needs a session cookie before its detail pages will
   * answer at all. Those belong to the source, so they are passed in rather
   * than guessed here. They apply to the plain fetch only: pagefetch is a real
   * browser and sends its own.
   */
  headers?: Record<string, string>
}

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Exponential backoff with jitter. Jitter matters when several source CLIs run
 * in the same minute — without it they retry in lockstep and look far more like
 * a bot than they are.
 */
function backoffMs(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 8000)
  return base + Math.floor(Math.random() * 250)
}

/**
 * An empty shell is a 200 whose body carries no meaningful content because the
 * listings are rendered client-side. Distinguishing it from a genuine empty
 * result set is inherently approximate, so the threshold is deliberately low —
 * a false "empty_shell" costs a log line, a missed one costs a silent zero.
 */
function looksLikeEmptyShell(body: string): boolean {
  const withoutScripts = body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
  const text = withoutScripts.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  return text.length < 200
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

interface PagefetchConfig {
  url: string
  token: string
}

/**
 * `PAGEFETCH_URL` is the service's **base** URL — `http://127.0.0.1:8790` — and
 * the plain-JSON tool endpoint is `/fetch` beneath it.
 *
 * This used to POST to whatever the variable said, which meant a correctly
 * configured base URL 404'd on every call. The stub transport in the tests
 * answered whatever it was given, so nothing caught it until the client met a
 * real server. A value that already names an endpoint is normalised rather than
 * rejected, so an existing `.env` keeps working either way.
 */
function endpointFor(base: string): string {
  return `${base.replace(/\/+$/, "").replace(/\/(fetch|mcp)$/, "")}/fetch`
}

/** Both variables are required. One without the other is not configuration. */
function pagefetchConfig(env: Record<string, string | undefined>): PagefetchConfig | null {
  const url = env.PAGEFETCH_URL
  const token = env.PAGEFETCH_TOKEN
  if (!url || !token) return null
  return { url: endpointFor(url), token }
}

export async function fetchPage(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const env = opts.env ?? (process.env as Record<string, string | undefined>)
  const impl = opts.fetchImpl ?? fetch
  const sleep = opts.sleep ?? defaultSleep
  const retries = opts.retries ?? 2

  const result = await plainFetch(url, impl, sleep, retries, opts.headers)

  // Only reach for the fallback when the plain path was actually blocked, and
  // only when the service is fully configured.
  const config = result.blocked ? pagefetchConfig(env) : null
  const final = config ? await viaPagefetch(url, config, impl, opts.waitFor, result) : result

  opts.log?.record({
    at: new Date().toISOString(),
    source: opts.source ?? null,
    host: hostOf(url),
    url,
    status: final.status,
    via: final.via,
    blocked: final.blocked,
    ok: final.ok,
  })

  return final
}

async function plainFetch(
  url: string,
  impl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
  retries: number,
  headers: Record<string, string> = {},
): Promise<FetchResult> {
  let last: FetchResult = {
    ok: false,
    status: null,
    content: null,
    url_final: null,
    via: "http",
    blocked: null,
    code: null,
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    let response: Response
    try {
      response = await impl(url, {
        headers: { "user-agent": BROWSER_UA, accept: "text/html,application/xhtml+xml", ...headers },
        redirect: "follow",
      })
    } catch {
      last = { ...last, status: null, code: "network_error" }
      if (attempt < retries) await sleep(backoffMs(attempt))
      continue
    }

    const status = response.status

    // A 404 is an answer, not a failure to retry.
    if (status === 404) {
      return { ok: false, status, content: null, url_final: response.url || url, via: "http", blocked: null, code: "not_found" }
    }

    // A 403 is a deliberate decision by the origin. Retrying it is exactly how
    // an address earns a permanent listing, so it is never retried.
    if (status === 403) {
      return {
        ok: false,
        status,
        content: null,
        url_final: response.url || url,
        via: "http",
        blocked: "challenge",
        code: "blocked_challenge",
      }
    }

    if (status === 429 || status >= 500) {
      last = { ...last, status, code: "transient" }
      if (attempt < retries) await sleep(backoffMs(attempt))
      continue
    }

    const body = await response.text()
    if (looksLikeEmptyShell(body)) {
      return {
        ok: false,
        status,
        content: body,
        url_final: response.url || url,
        via: "http",
        blocked: "empty_shell",
        code: "empty_shell",
      }
    }

    return { ok: true, status, content: body, url_final: response.url || url, via: "http", blocked: null, code: "ok" }
  }

  return last
}

/**
 * Client for the pagefetch service. The wire format lives in this one function.
 *
 * The service is built and this has now spoken to a real one — see
 * `tests/live.test.ts`, which is excluded from the default suite because it
 * needs a running server. The contract it honours is pagefetch's
 * `docs/USING-PAGEFETCH.md`.
 */
async function viaPagefetch(
  url: string,
  config: PagefetchConfig,
  impl: typeof fetch,
  waitFor: string | undefined,
  plain: FetchResult,
): Promise<FetchResult> {
  try {
    const response = await impl(config.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({
        tool: "fetch_page",
        arguments: { url, format: "html", ...(waitFor ? { wait_for: waitFor } : {}) },
      }),
    })

    if (!response.ok) return { ...plain, code: `pagefetch_http_${response.status}` }

    const payload = (await response.json()) as {
      // The origin's HTTP status, as a number. `code` carries the error
      // contract; `status` is what the site said, and the two are not
      // interchangeable — a blocked_challenge arrives with status 403.
      status?: number
      code?: string
      content?: string
      url_final?: string
    }

    const code = payload.code ?? "ok"

    // Per the spec's error contract, these are definitive — the caller should
    // report and move on rather than escalate.
    if (code !== "ok" || typeof payload.content !== "string") {
      return {
        ok: false,
        status: plain.status,
        content: null,
        url_final: payload.url_final ?? plain.url_final,
        via: "pagefetch",
        // Only a deliberate refusal counts as blocked. A broken origin, a
        // timeout or a 404 is a failure, and recording it as a block would
        // inflate the per-host block rate the reachability log exists to
        // measure. The code is kept either way.
        blocked: blockReasonFor(code),
        code,
      }
    }

    return {
      ok: true,
      status: 200,
      content: payload.content,
      url_final: payload.url_final ?? url,
      via: "pagefetch",
      blocked: null,
      code: "ok",
    }
  } catch {
    return { ...plain, code: "pagefetch_unreachable" }
  }
}
