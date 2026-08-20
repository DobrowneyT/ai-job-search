import { describe, test, expect } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

// Live smoke tests against the real careers.qualcomm.com API. Keep volume low —
// one search, one detail lookup. See ../../url-reference.md for endpoint details.

interface SearchResult {
  meta: { count: number; page: number };
  results: Array<{ id: string; title: string; company: string | null; location: string | null; date: string | null; url: string }>;
}

describe("qualcomm-cli live search", () => {
  test("search returns real, non-empty results for a common query", async () => {
    const result = await runCLI(["search", "-q", "embedded software engineer", "--limit", "5"]);
    const json = parseJSON<SearchResult>(result);

    expect(json.results.length).toBeGreaterThan(0);
    for (const r of json.results) {
      expect(r.id).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.url).toContain("careers.qualcomm.com");
    }
  }, 30000);

  test("detail returns a readable description for a real job ID", async () => {
    const search = await runCLI(["search", "-q", "embedded software engineer", "--limit", "1"]);
    const searchJson = parseJSON<SearchResult>(search);
    const id = searchJson.results[0]?.id;
    expect(id).toBeTruthy();

    const detail = await runCLI(["detail", id, "--format", "plain"]);
    expect(detail.exitCode).toBe(0);
    expect(detail.stdout.length).toBeGreaterThan(50);
    expect(detail.stdout).not.toMatch(/<[a-z][\s\S]*>/i); // no leftover HTML tags
  }, 30000);
});

describe("qualcomm-cli flag validation", () => {
  test("bad --jobage value exits 1 with a JSON stderr error", async () => {
    const result = await runCLI(["search", "-q", "test", "--jobage", "notanumber"]);
    expect(result.exitCode).not.toBe(0);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("BAD_ARG");
    expect(err.error).toMatch(/jobage/);
  });

  test("detail with no id exits 1 with a JSON stderr error", async () => {
    const result = await runCLI(["detail"]);
    expect(result.exitCode).not.toBe(0);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("NO_ID");
  });

  test("detail with an unparseable id exits 1 with a JSON stderr error", async () => {
    const result = await runCLI(["detail", "not-an-id"]);
    expect(result.exitCode).not.toBe(0);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("BAD_ID");
  });
});
