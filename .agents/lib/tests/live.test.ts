// The fetch helper, against a real pagefetch server.
//
// Excluded from the default suite: it needs a server running, and it sends real
// traffic to third-party sites. Running that constantly is the impoliteness
// pagefetch exists to avoid.
//
//   PAGEFETCH_LIVE=1 PAGEFETCH_URL=http://127.0.0.1:8790 \
//     PAGEFETCH_TOKEN=… bun test tests/live.test.ts

import { describe, expect, test } from "bun:test"
import { fetchPage } from "../src/fetch.js"

const URL_ = process.env.PAGEFETCH_URL
const TOKEN = process.env.PAGEFETCH_TOKEN
const enabled = process.env.PAGEFETCH_LIVE === "1" && Boolean(URL_) && Boolean(TOKEN)

const env = { PAGEFETCH_URL: URL_, PAGEFETCH_TOKEN: TOKEN }
const noSleep = async () => {}

/**
 * Refuses the origin, passes pagefetch through to the real server.
 *
 * The fallback only fires when the plain path is blocked, and no job board we
 * target actually blocks it — measured 2026-08-19, reed, totaljobs and jobindex
 * all answer plain HTTP, and even LinkedIn returns a 200 (with 8,000 characters
 * of wall rather than listings). So the trigger is stubbed and everything past
 * it is real: a real server, a real robots policy, a real fetch.
 *
 * Stubbing the origin instead of the service is the whole point. The bug this
 * suite exists to catch lived on the service side.
 */
function originRefuses(): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString()
    if (URL_ && url.startsWith(new URL(URL_).origin)) return fetch(input as string, init)
    return new Response("", { status: 403 })
  }) as unknown as typeof fetch
}

describe.skipIf(!enabled)("fetch — against a real pagefetch server", () => {
  test("the configured URL resolves to a route", async () => {
    // PAGEFETCH_URL is the service's BASE url and the endpoint is /fetch beneath
    // it. Getting that wrong 404s every call, and a stub transport cannot catch
    // it — which is exactly how it shipped in the scholarship repo.
    const result = await fetchPage("https://www.reed.co.uk/jobs?keywords=embedded", {
      env,
      fetchImpl: originRefuses(),
      sleep: noSleep,
    })

    expect(result.code).not.toMatch(/^pagefetch_http_/)
    expect(result.code).not.toBe("pagefetch_unreachable")
  }, 120_000)

  test("a blocked origin is fetched through pagefetch and returns content", async () => {
    const result = await fetchPage("https://www.reed.co.uk/jobs?keywords=embedded", {
      env,
      fetchImpl: originRefuses(),
      sleep: noSleep,
    })

    expect(result.via).toBe("pagefetch")
    expect(result.code).toBe("ok")
    expect(result.ok).toBe(true)
    expect(result.content).toBeTruthy()
  }, 120_000)

  test("a robots refusal arrives as a refusal, not as a failure", async () => {
    // linkedin.com/robots.txt is a bare Disallow: /. That is an answer, and the
    // caller must be able to tell it from a broken fetch — a retry loop against
    // a stated policy is the failure this mapping prevents.
    const result = await fetchPage("https://www.linkedin.com/jobs/search?keywords=embedded", {
      env,
      fetchImpl: originRefuses(),
      sleep: noSleep,
    })

    expect(result.via).toBe("pagefetch")
    expect(result.code).toBe("blocked_robots")
    expect(result.blocked).toBe("robots")
    expect(result.ok).toBe(false)
  }, 120_000)

  test("a site that answers plain HTTP never reaches the fallback", async () => {
    // reed is reachable without a browser, so the seam must stay out of the way.
    // A fallback that fires when it is not needed is a slower, heavier fetch and
    // an unnecessary request through someone else's browser.
    const result = await fetchPage("https://www.reed.co.uk/jobs?keywords=embedded", {
      env,
      sleep: noSleep,
      headers: { "accept-language": "en-GB,en;q=0.9" },
    })

    expect(result.via).toBe("http")
    expect(result.ok).toBe(true)
    expect(result.blocked).toBeNull()
  }, 120_000)
})
