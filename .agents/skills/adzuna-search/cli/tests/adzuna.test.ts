// Live smoke tests against Adzuna's public Jobs API. Requires ADZUNA_APP_ID /
// ADZUNA_APP_KEY in the environment (Bun auto-loads .env in this directory).
// Kept minimal (2 network requests) so running the suite doesn't waste quota.
import { describe, expect, test } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

interface SearchResponse {
  meta: { count: number; total: number; page: number };
  results: Array<{
    id: string | null;
    title: string | null;
    company: string | null;
    location: string | null;
    date: string | null;
    url: string | null;
  }>;
}

describe("adzuna-cli live smoke", () => {
  test("search returns real results with required fields", async () => {
    const result = await runCLI([
      "search",
      "-q",
      "embedded firmware engineer",
      "--limit",
      "5",
    ]);
    expect(result.exitCode).toBe(0);
    const data = parseJSON<SearchResponse>(result);
    expect(data.meta.count).toBeGreaterThanOrEqual(1);
    expect(data.meta.page).toBe(1);
    for (const job of data.results) {
      expect(job.id).toBeTruthy();
      expect(job.title).toBeTruthy();
      expect(job.url).toMatch(/^https:\/\/www\.adzuna\.co\.uk\//);
    }
  }, 30000);

  test("detail reads a searched id back from the local cache", async () => {
    const search = await runCLI(["search", "-q", "firmware", "--limit", "1"]);
    const data = parseJSON<SearchResponse>(search);
    expect(data.results.length).toBeGreaterThanOrEqual(1);
    const id = data.results[0].id!;

    const detail = await runCLI(["detail", id]);
    expect(detail.exitCode).toBe(0);
    const job = parseJSON<{ id: string; title: string; descriptionSnippet: string | null }>(detail);
    expect(job.id).toBe(id);
    expect(job.title).toBeTruthy();
    expect(job.descriptionSnippet).toBeTruthy();
  }, 30000);

  test("detail on an unknown id fails with NOT_CACHED (Adzuna has no lookup-by-id)", async () => {
    const result = await runCLI(["detail", "999999999999"]);
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("NOT_CACHED");
  });
});

describe("adzuna-cli error handling", () => {
  test("bad --jobage exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "-q", "firmware", "--jobage", "abc"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("BAD_ARG");
  });

  test("unknown command exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["frobnicate"]);
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("BAD_CMD");
  });

  test("detail without id exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["detail"]);
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("NO_ID");
  });
});
