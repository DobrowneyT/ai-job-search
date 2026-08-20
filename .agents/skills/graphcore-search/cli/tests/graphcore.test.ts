// Live smoke tests against Graphcore's public Greenhouse job board API. No
// credentials required. Kept minimal (a few network requests) to avoid
// hammering the API during test runs.
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

describe("graphcore-cli live smoke", () => {
  test("search returns real results with required fields", async () => {
    const result = await runCLI(["search", "-q", "software engineer", "--limit", "5"]);
    expect(result.exitCode).toBe(0);
    const data = parseJSON<SearchResponse>(result);
    expect(data.meta.count).toBeGreaterThanOrEqual(1);
    expect(data.meta.page).toBe(1);
    for (const job of data.results) {
      expect(job.id).toBeTruthy();
      expect(job.title).toBeTruthy();
      expect(job.company).toBe("Graphcore");
      expect(job.url).toMatch(/^https:\/\/job-boards\.greenhouse\.io\/graphcore\//);
    }
  }, 30000);

  test("detail on a searched id returns readable description", async () => {
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
    // Decoded text should contain no leftover HTML tags or entities.
    expect(job.description).not.toMatch(/<[a-z][\s\S]*>/i);
    expect(job.description).not.toMatch(/&(lt|gt|amp|nbsp|#\d+);/);
  }, 30000);

  test("detail on an unknown id fails with JOB_NOT_FOUND", async () => {
    const result = await runCLI(["detail", "999999999999"]);
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("JOB_NOT_FOUND");
  }, 30000);
});

describe("graphcore-cli error handling", () => {
  test("bad --jobage exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "-q", "engineer", "--jobage", "abc"]);
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
