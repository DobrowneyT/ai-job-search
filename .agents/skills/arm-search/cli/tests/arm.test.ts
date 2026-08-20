// Live smoke tests against careers.arm.com. Kept minimal (a couple of network
// requests total) so running the suite doesn't hammer the site.
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

describe("arm-cli live smoke", () => {
  test("search returns real results with required fields", async () => {
    const result = await runCLI(["search", "-q", "software engineer", "--limit", "5"]);
    expect(result.exitCode).toBe(0);
    const data = parseJSON<SearchResponse>(result);
    expect(data.meta.count).toBeGreaterThanOrEqual(1);
    for (const job of data.results) {
      expect(job.id).toBeTruthy();
      expect(job.title).toBeTruthy();
      expect(job.url).toMatch(/^https:\/\/careers\.arm\.com\/job\//);
    }
  }, 30000);

  test("detail returns a readable description for a searched id", async () => {
    const search = await runCLI(["search", "-q", "software engineer", "--limit", "1"]);
    const data = parseJSON<SearchResponse>(search);
    expect(data.results.length).toBeGreaterThanOrEqual(1);
    const id = data.results[0].id!;

    const detail = await runCLI(["detail", id]);
    expect(detail.exitCode).toBe(0);
    const job = parseJSON<{ id: string; title: string; description: string | null }>(detail);
    expect(job.id).toBe(id);
    expect(job.title).toBeTruthy();
    expect(job.description).toBeTruthy();
    // Entities decoded, tags stripped.
    expect(job.description).not.toMatch(/<\/?[a-z]+>/i);
    expect(job.description).not.toContain("&amp;");
  }, 30000);
});

describe("arm-cli error handling", () => {
  test("bad --page exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "-q", "firmware", "--page", "abc"]);
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

  test("detail with a bogus id exits 1 with NOT_FOUND", async () => {
    const result = await runCLI(["detail", "00000000000"]);
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("NOT_FOUND");
  }, 30000);
});
