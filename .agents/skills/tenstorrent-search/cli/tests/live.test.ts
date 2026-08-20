import { describe, test, expect } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

interface JobResult {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  date: string | null;
  url: string;
}

interface SearchResponse {
  meta: { count: number; page: number; total: number };
  results: JobResult[];
}

// Live smoke test against Tenstorrent's real Greenhouse board. Keep volume low
// (one search, one detail fetch) — this hits the real network.
//
// Query on "engineer" rather than a specific discipline like "firmware": a
// single-title match is not guaranteed to stay open, and this board has no
// requisition older than a hiring cycle. "engineer" reliably matches a large
// share of a chip company's listings regardless of which teams are hiring.
describe("live search + detail", () => {
  test("search for 'engineer' returns at least one real result", async () => {
    const result = await runCLI(["search", "-q", "engineer", "--limit", "5"]);
    const data = parseJSON<SearchResponse>(result);
    expect(data.results.length).toBeGreaterThan(0);
    const first = data.results[0];
    expect(first.id).toBeTruthy();
    expect(first.title).toBeTruthy();
    expect(first.url).toContain("greenhouse.io/tenstorrent");
  });

  test("detail on a real result id returns readable description text", async () => {
    const searchResult = await runCLI(["search", "-q", "engineer", "--limit", "1"]);
    const data = parseJSON<SearchResponse>(searchResult);
    expect(data.results.length).toBeGreaterThan(0);
    const id = data.results[0].id;

    const detailResult = await runCLI(["detail", id, "--format", "plain"]);
    expect(detailResult.exitCode).toBe(0);
    expect(detailResult.stdout.length).toBeGreaterThan(50);
    expect(detailResult.stdout).not.toContain("<div");
    expect(detailResult.stdout).not.toContain("&lt;");
    expect(detailResult.stdout).toContain(`URL: https://job-boards.greenhouse.io/tenstorrent/jobs/${id}`);
  });
});
