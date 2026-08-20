import { afterEach, describe, expect, test } from "bun:test";
import { runSearch } from "../src/commands/search";
import { runDetail } from "../src/commands/detail";

const originalFetch = globalThis.fetch;
const originalStdoutWrite = process.stdout.write;

function captureStdout(): { get: () => string } {
  let buf = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    buf += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  return { get: () => buf };
}

function v3Job(overrides: Record<string, unknown> = {}) {
  return {
    id: 5841683,
    shortcode: "AB9B343504",
    title: "Experienced IC Design Engineer",
    workplace: "on_site",
    location: { country: "United Kingdom", countryCode: "GB", city: "Cambridge", region: "England" },
    published: "2026-06-30T00:00:00.000Z",
    department: ["Engineering"],
    ...overrides,
  };
}

/** Mock fetch that answers POST (v3 search) and GET (widget) differently by URL. */
function mockFetch(opts: { search?: Record<string, unknown>; widget?: Record<string, unknown>; status?: number }): void {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = url.toString();
    if (init?.method === "POST" && u.includes("/api/v3/accounts/")) {
      return new Response(JSON.stringify(opts.search ?? { total: 0, results: [] }), {
        status: opts.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (u.includes("/api/v1/widget/accounts/")) {
      return new Response(JSON.stringify(opts.widget ?? { name: "x", description: "", jobs: [] }), {
        status: opts.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

const searchOpts = {
  jobage: 9999,
  page: 1,
  format: "json" as const,
  source: "all" as const,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.stdout.write = originalStdoutWrite;
});

describe("runSearch (mocked fetch)", () => {
  test("emits the contract envelope, deduped per account and sorted by date desc", async () => {
    mockFetch({ search: { total: 1, results: [v3Job()] } });
    const out = captureStdout();

    const code = await runSearch({ ...searchOpts, query: "IC design" });
    expect(code).toBe(0);

    const parsed = JSON.parse(out.get());
    // Both "foundation" and "ltd" are queried under source: "all"; both mocked to the same fixture.
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0].id).toMatch(/^(foundation|ltd):AB9B343504$/);
    expect(parsed.meta.count).toBe(parsed.results.length);
  });

  test("--source ltd only queries the Ltd account", async () => {
    mockFetch({ search: { total: 1, results: [v3Job()] } });
    const out = captureStdout();

    const code = await runSearch({ ...searchOpts, source: "ltd" });
    expect(code).toBe(0);
    const parsed = JSON.parse(out.get());
    expect(parsed.results.every((r: any) => r.company === "Raspberry Pi Ltd")).toBe(true);
  });

  test("--location filters client-side on the formatted location string", async () => {
    mockFetch({ search: { total: 1, results: [v3Job()] } });
    const out = captureStdout();

    const code = await runSearch({ ...searchOpts, source: "ltd", location: "Nowhereville" });
    expect(code).toBe(0);
    expect(JSON.parse(out.get()).results).toHaveLength(0);
  });

  test("empty result set yields an empty results array, not an error", async () => {
    mockFetch({ search: { total: 0, results: [] } });
    const out = captureStdout();

    const code = await runSearch({ ...searchOpts, source: "ltd", query: "nothing-matches-xyz" });
    expect(code).toBe(0);
    expect(JSON.parse(out.get()).results).toHaveLength(0);
  });

  test("a single account's network failure degrades gracefully (the other still returns)", async () => {
    let call = 0;
    globalThis.fetch = (async () => {
      call++;
      if (call === 1) throw new Error("ECONNREFUSED");
      return new Response(JSON.stringify({ total: 1, results: [v3Job()] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const out = captureStdout();

    const code = await runSearch({ ...searchOpts, source: "all" });
    expect(code).toBe(0);
    const parsed = JSON.parse(out.get());
    expect(parsed.meta.warnings).toBeDefined();
    expect(parsed.results.length).toBeGreaterThan(0);
  });

  test("every account failing exits 1 with SEARCH_FAILED", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    let err = "";
    const origErr = process.stderr.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      err += chunk.toString();
      return true;
    }) as typeof process.stderr.write;

    const code = await runSearch({ ...searchOpts, source: "all" });
    process.stderr.write = origErr;

    expect(code).toBe(1);
    expect(JSON.parse(err).code).toBe("SEARCH_FAILED");
  });
});

describe("runDetail (mocked fetch)", () => {
  test("finds a job by compound id and strips the description HTML", async () => {
    mockFetch({
      widget: {
        name: "Raspberry Pi",
        description: "",
        jobs: [
          {
            shortcode: "AB9B343504",
            title: "Experienced IC Design Engineer",
            city: "Cambridge",
            state: "England",
            country: "United Kingdom",
            telecommuting: false,
            published_on: "2026-06-30",
            department: "Engineering",
            description: "<p>Design silicon</p>",
          },
        ],
      },
    });
    const out = captureStdout();

    const code = await runDetail({ id: "ltd:AB9B343504", format: "json" });
    expect(code).toBe(0);
    const parsed = JSON.parse(out.get());
    expect(parsed.id).toBe("ltd:AB9B343504");
    expect(parsed.description).toBe("Design silicon");
    expect(parsed.company).toBe("Raspberry Pi Ltd");
  });

  test("a shortcode absent from the account's widget listing exits 1 with NOT_FOUND", async () => {
    mockFetch({ widget: { name: "x", description: "", jobs: [] } });
    let err = "";
    const origErr = process.stderr.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      err += chunk.toString();
      return true;
    }) as typeof process.stderr.write;

    const code = await runDetail({ id: "ltd:DOESNOTEXIST", format: "json" });
    process.stderr.write = origErr;

    expect(code).toBe(1);
    expect(JSON.parse(err).code).toBe("NOT_FOUND");
  });
});
