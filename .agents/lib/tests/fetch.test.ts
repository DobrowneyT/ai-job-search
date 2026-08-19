import { describe, expect, test } from "bun:test"
import { fetchPage, MemoryReachabilityLog } from "../src/fetch"

// A stub transport, so these tests never touch the network. The fetch helper is
// tested at the module seam alongside the parsers, per the seam decision on #1.
function transport(responses: Array<{ status: number; body?: string; url?: string }>) {
  const calls: string[] = []
  let i = 0
  const impl = async (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString()
    calls.push(url)
    const r = responses[Math.min(i, responses.length - 1)]
    i++
    return new Response(r.body ?? "", {
      status: r.status,
      headers: { "content-type": "text/html" },
    })
  }
  return { impl: impl as unknown as typeof fetch, calls }
}

// A realistically-sized listing page. Real award pages carry thousands of
// characters of text; an empty shell carries almost none, and the gap between
// them is what block detection keys on.
const PAGE =
  "<html><body>" +
  Array.from(
    { length: 12 },
    (_, i) =>
      `<article class="award"><h2>Award number ${i}</h2>` +
      `<p>Open to postgraduate students in any discipline, tenable for one academic year.</p>` +
      `<p>Applications close 1 December 2026.</p></article>`,
  ).join("") +
  "</body></html>"
const noSleep = async () => {}

describe("fetch — the plain HTTP path", () => {
  test("returns content on 200", async () => {
    const t = transport([{ status: 200, body: PAGE }])
    const result = await fetchPage("https://example.org/awards", { fetchImpl: t.impl, env: {} })
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.content).toBe(PAGE)
    expect(result.via).toBe("http")
    expect(result.blocked).toBeNull()
  })

  test("sends a browser User-Agent", async () => {
    let seen: Headers | undefined
    const impl = (async (_u: string, init?: RequestInit) => {
      seen = new Headers(init?.headers)
      return new Response(PAGE, { status: 200 })
    }) as unknown as typeof fetch
    await fetchPage("https://example.org/awards", { fetchImpl: impl, env: {} })
    expect(seen?.get("user-agent")).toMatch(/Mozilla/)
  })

  test("returns null content on 404 rather than throwing", async () => {
    const t = transport([{ status: 404 }])
    const result = await fetchPage("https://example.org/gone", { fetchImpl: t.impl, env: {} })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
    expect(result.content).toBeNull()
    expect(result.blocked).toBeNull()
  })

  test("retries a 429 and succeeds on the retry", async () => {
    const t = transport([{ status: 429 }, { status: 200, body: PAGE }])
    const result = await fetchPage("https://example.org/awards", {
      fetchImpl: t.impl,
      env: {},
      sleep: noSleep,
    })
    expect(result.ok).toBe(true)
    expect(t.calls.length).toBe(2)
  })

  test("gives up after the retry budget on repeated 5xx", async () => {
    const t = transport([{ status: 503 }])
    const result = await fetchPage("https://example.org/awards", {
      fetchImpl: t.impl,
      env: {},
      sleep: noSleep,
      retries: 2,
    })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(503)
    expect(t.calls.length).toBe(3) // initial + 2 retries
  })

  test("does not retry a 404", async () => {
    const t = transport([{ status: 404 }])
    await fetchPage("https://example.org/gone", { fetchImpl: t.impl, env: {}, sleep: noSleep })
    expect(t.calls.length).toBe(1)
  })
})

describe("fetch — block detection", () => {
  test("a 403 is reported as a challenge block, not a plain failure", async () => {
    const t = transport([{ status: 403, body: "Attention Required! Cloudflare" }])
    const result = await fetchPage("https://example.org/awards", {
      fetchImpl: t.impl,
      env: {},
      sleep: noSleep,
    })
    expect(result.ok).toBe(false)
    expect(result.blocked).toBe("challenge")
  })

  test("a 403 is not retried — it is a decision, not a transient failure", async () => {
    const t = transport([{ status: 403 }])
    await fetchPage("https://example.org/awards", { fetchImpl: t.impl, env: {}, sleep: noSleep })
    expect(t.calls.length).toBe(1)
  })

  test("a 200 that is an empty shell is reported as such", async () => {
    const t = transport([{ status: 200, body: "<html><head></head><body><div id=root></div></body></html>" }])
    const result = await fetchPage("https://example.org/awards", { fetchImpl: t.impl, env: {} })
    expect(result.blocked).toBe("empty_shell")
    expect(result.ok).toBe(false)
  })

  test("a substantial 200 is not mistaken for an empty shell", async () => {
    const t = transport([{ status: 200, body: PAGE }])
    const result = await fetchPage("https://example.org/awards", { fetchImpl: t.impl, env: {} })
    expect(result.blocked).toBeNull()
  })
})

describe("fetch — the pagefetch seam, unconfigured", () => {
  test("with PAGEFETCH_URL unset the fallback is disabled entirely", async () => {
    const t = transport([{ status: 403 }])
    const result = await fetchPage("https://example.org/awards", {
      fetchImpl: t.impl,
      env: {},
      sleep: noSleep,
    })
    expect(result.via).toBe("http")
    expect(result.blocked).toBe("challenge")
    // Only the plain attempt was made — nothing reached for a fallback.
    expect(t.calls).toEqual(["https://example.org/awards"])
  })

  test("a token without a URL does not enable the fallback", async () => {
    const t = transport([{ status: 403 }])
    const result = await fetchPage("https://example.org/awards", {
      fetchImpl: t.impl,
      env: { PAGEFETCH_TOKEN: "secret" },
      sleep: noSleep,
    })
    expect(result.via).toBe("http")
    expect(t.calls.length).toBe(1)
  })

  test("a URL without a token does not enable the fallback", async () => {
    const t = transport([{ status: 403 }])
    const result = await fetchPage("https://example.org/awards", {
      fetchImpl: t.impl,
      env: { PAGEFETCH_URL: "http://127.0.0.1:8790/mcp" },
      sleep: noSleep,
    })
    expect(result.via).toBe("http")
    expect(t.calls.length).toBe(1)
  })

  test("the plain path still succeeds with the fallback unconfigured", async () => {
    const t = transport([{ status: 200, body: PAGE }])
    const result = await fetchPage("https://example.org/awards", { fetchImpl: t.impl, env: {} })
    expect(result.ok).toBe(true)
    expect(result.via).toBe("http")
  })
})

// Routes origin requests and pagefetch requests separately, so these tests can
// assert on what was sent to the service as well as what came back.
function routed(origin: { status: number; body?: string }, service: unknown, serviceStatus = 200) {
  const sent: Array<{ url: string; init?: RequestInit }> = []
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString()
    sent.push({ url, init })
    if (url.includes("8790")) {
      return new Response(JSON.stringify(service), {
        status: serviceStatus,
        headers: { "content-type": "application/json" },
      })
    }
    return new Response(origin.body ?? "", { status: origin.status })
  }) as unknown as typeof fetch
  return { impl, sent }
}

// The documented shape: PAGEFETCH_URL is the service's BASE url. See pagefetch
// docs/USING-PAGEFETCH.md.
const CONFIGURED = { PAGEFETCH_URL: "http://127.0.0.1:8790", PAGEFETCH_TOKEN: "secret" }

describe("fetch — where the request is actually sent", () => {
  // This is the bug a stub cannot catch. The client POSTed to whatever
  // PAGEFETCH_URL said, so a correctly configured base URL 404'd on every call
  // against a real server, and the stub answered anyway.
  test("a base URL is resolved to the /fetch endpoint", async () => {
    const r = routed({ status: 403 }, { code: "ok", content: PAGE })
    await fetchPage("https://example.org/awards", {
      fetchImpl: r.impl,
      env: { PAGEFETCH_URL: "http://127.0.0.1:8790", PAGEFETCH_TOKEN: "secret" },
      sleep: noSleep,
    })
    const service = r.sent.find((call) => call.url.includes("8790"))
    expect(service?.url).toBe("http://127.0.0.1:8790/fetch")
  })

  test("a URL that already names an endpoint is normalised, not doubled", async () => {
    for (const configured of [
      "http://127.0.0.1:8790/",
      "http://127.0.0.1:8790/fetch",
      "http://127.0.0.1:8790/mcp",
    ]) {
      const r = routed({ status: 403 }, { code: "ok", content: PAGE })
      await fetchPage("https://example.org/awards", {
        fetchImpl: r.impl,
        env: { PAGEFETCH_URL: configured, PAGEFETCH_TOKEN: "secret" },
        sleep: noSleep,
      })
      const service = r.sent.find((call) => call.url.includes("8790"))
      expect(service?.url).toBe("http://127.0.0.1:8790/fetch")
    }
  })
})

describe("fetch — the pagefetch seam, configured", () => {
  test("a blocked plain fetch delegates to pagefetch and returns its content", async () => {
    const r = routed({ status: 403 }, { code: "ok", content: PAGE, url_final: "https://example.org/awards" })
    const result = await fetchPage("https://example.org/awards", {
      fetchImpl: r.impl,
      env: CONFIGURED,
      sleep: noSleep,
    })
    expect(result.ok).toBe(true)
    expect(result.via).toBe("pagefetch")
    expect(result.content).toBe(PAGE)
    expect(result.blocked).toBeNull()
  })

  test("the bearer token is sent to the service", async () => {
    const r = routed({ status: 403 }, { code: "ok", content: PAGE })
    await fetchPage("https://example.org/awards", { fetchImpl: r.impl, env: CONFIGURED, sleep: noSleep })
    const call = r.sent.find((s) => s.url.includes("8790"))
    expect(new Headers(call!.init!.headers).get("authorization")).toBe("Bearer secret")
  })

  test("the requested url is passed to fetch_page", async () => {
    const r = routed({ status: 403 }, { code: "ok", content: PAGE })
    await fetchPage("https://example.org/awards", { fetchImpl: r.impl, env: CONFIGURED, sleep: noSleep })
    const call = r.sent.find((s) => s.url.includes("8790"))
    const body = JSON.parse(call!.init!.body as string)
    expect(body.arguments.url).toBe("https://example.org/awards")
  })

  test("a successful plain fetch never reaches the service", async () => {
    const r = routed({ status: 200, body: PAGE }, { code: "ok", content: "should not be used" })
    const result = await fetchPage("https://example.org/awards", { fetchImpl: r.impl, env: CONFIGURED })
    expect(result.via).toBe("http")
    expect(r.sent.some((s) => s.url.includes("8790"))).toBe(false)
  })

  test("blocked_challenge from the service is definitive — reported, not escalated", async () => {
    const r = routed({ status: 403 }, { code: "blocked_challenge" })
    const result = await fetchPage("https://example.org/awards", {
      fetchImpl: r.impl,
      env: CONFIGURED,
      sleep: noSleep,
    })
    expect(result.ok).toBe(false)
    expect(result.blocked).toBe("challenge")
    expect(result.code).toBe("blocked_challenge")
    // One origin attempt, one service attempt, and no escalation beyond that.
    expect(r.sent).toHaveLength(2)
  })

  test("blocked_robots is reported as policy rather than as a block to work around", async () => {
    const r = routed({ status: 403 }, { code: "blocked_robots" })
    const result = await fetchPage("https://example.org/awards", {
      fetchImpl: r.impl,
      env: CONFIGURED,
      sleep: noSleep,
    })
    expect(result.blocked).toBe("robots")
    expect(result.code).toBe("blocked_robots")
  })

  test("domain_benched is reported as such", async () => {
    const r = routed({ status: 403 }, { code: "domain_benched" })
    const result = await fetchPage("https://example.org/awards", {
      fetchImpl: r.impl,
      env: CONFIGURED,
      sleep: noSleep,
    })
    expect(result.blocked).toBe("benched")
  })

  test("an unreachable service degrades to the plain result rather than throwing", async () => {
    const impl = (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.includes("8790")) throw new Error("ECONNREFUSED")
      return new Response("", { status: 403 })
    }) as unknown as typeof fetch
    const result = await fetchPage("https://example.org/awards", {
      fetchImpl: impl,
      env: CONFIGURED,
      sleep: noSleep,
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe("pagefetch_unreachable")
    expect(result.blocked).toBe("challenge")
  })

  test("an empty shell also triggers the fallback — client-side rendering is what it is for", async () => {
    const r = routed(
      { status: 200, body: "<html><body><div id=root></div></body></html>" },
      { code: "ok", content: PAGE },
    )
    const result = await fetchPage("https://example.org/awards", { fetchImpl: r.impl, env: CONFIGURED })
    expect(result.via).toBe("pagefetch")
    expect(result.ok).toBe(true)
  })
})

describe("fetch — the reachability log", () => {
  test("records a successful plain fetch", async () => {
    const log = new MemoryReachabilityLog()
    const t = transport([{ status: 200, body: PAGE }])
    await fetchPage("https://example.org/awards", { fetchImpl: t.impl, env: {}, log, source: "example" })
    expect(log.entries).toHaveLength(1)
    expect(log.entries[0]).toMatchObject({ source: "example", host: "example.org", status: 200, blocked: null })
  })

  test("records a block, which is the measurement the pagefetch decision rests on", async () => {
    const log = new MemoryReachabilityLog()
    const t = transport([{ status: 403 }])
    await fetchPage("https://example.org/awards", {
      fetchImpl: t.impl,
      env: {},
      log,
      source: "example",
      sleep: noSleep,
    })
    expect(log.entries[0].blocked).toBe("challenge")
  })

  test("records the transport actually used", async () => {
    const log = new MemoryReachabilityLog()
    const t = transport([{ status: 200, body: PAGE }])
    await fetchPage("https://example.org/awards", { fetchImpl: t.impl, env: {}, log, source: "example" })
    expect(log.entries[0].via).toBe("http")
  })
})

describe("fetch — per-source headers", () => {
  // Sources are not interchangeable. jobindex asks for Danish, reed for en-GB,
  // and totaljobs will not answer a detail page without a session cookie. Those
  // belong to the source rather than to this helper.
  test("caller headers reach the plain request", async () => {
    const seen: Array<Record<string, string>> = []
    const impl = (async (_input: string | URL | Request, init?: RequestInit) => {
      seen.push((init?.headers ?? {}) as Record<string, string>)
      return new Response(PAGE, { status: 200 })
    }) as unknown as typeof fetch

    await fetchPage("https://example.org/jobs", {
      fetchImpl: impl,
      env: {},
      headers: { "accept-language": "da,en;q=0.9", cookie: "session=abc" },
    })

    expect(seen[0]?.["accept-language"]).toBe("da,en;q=0.9")
    expect(seen[0]?.cookie).toBe("session=abc")
  })

  test("a caller header can override the default user-agent", async () => {
    const seen: Array<Record<string, string>> = []
    const impl = (async (_input: string | URL | Request, init?: RequestInit) => {
      seen.push((init?.headers ?? {}) as Record<string, string>)
      return new Response(PAGE, { status: 200 })
    }) as unknown as typeof fetch

    await fetchPage("https://example.org/jobs", {
      fetchImpl: impl,
      env: {},
      headers: { "user-agent": "jobindex-cli/1.0" },
    })

    expect(seen[0]?.["user-agent"]).toBe("jobindex-cli/1.0")
  })

  test("headers are not sent to pagefetch, which is a real browser", async () => {
    // pagefetch sends its own. Forwarding a hand-written user-agent to it would
    // be a fingerprint claim, which is out of scope by design.
    const r = routed({ status: 403 }, { code: "ok", content: PAGE })
    await fetchPage("https://example.org/jobs", {
      fetchImpl: r.impl,
      env: { PAGEFETCH_URL: "http://127.0.0.1:8790", PAGEFETCH_TOKEN: "secret" },
      headers: { "user-agent": "jobindex-cli/1.0" },
      sleep: noSleep,
    })

    const service = r.sent.find((call) => call.url.includes("8790"))
    const headers = (service?.init?.headers ?? {}) as Record<string, string>
    expect(headers["user-agent"]).toBeUndefined()
  })
})
