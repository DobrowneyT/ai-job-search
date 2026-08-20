import { describe, test, expect } from "bun:test";
import { parseSearchResponse, parseDetailResponse, jobageCutoff } from "../src/helpers";

describe("parseSearchResponse", () => {
  test("maps positions into JobResult shape", () => {
    const raw = {
      data: {
        positions: [
          {
            id: 123456789,
            displayJobId: "999",
            name: "#Embedded Software Engineer",
            locations: ["San Diego, California, United States of America"],
            postedTs: 1773014400,
            department: "Software Engineering",
            positionUrl: "/careers/job/123456789",
          },
        ],
        count: 1,
      },
    };
    const { results, count } = parseSearchResponse(raw);
    expect(count).toBe(1);
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.id).toBe("123456789");
    expect(r.title).toBe("#Embedded Software Engineer");
    expect(r.company).toBe("Qualcomm");
    expect(r.location).toBe("San Diego, California, United States of America");
    expect(r.date).toBe("2026-03-09");
    expect(r.url).toBe("https://careers.qualcomm.com/careers/job/123456789");
  });

  test("handles empty/missing positions without throwing", () => {
    const { results, count } = parseSearchResponse({ data: {} });
    expect(results).toHaveLength(0);
    expect(count).toBe(0);
  });

  test("handles completely malformed input without throwing", () => {
    const { results, count } = parseSearchResponse(null);
    expect(results).toHaveLength(0);
    expect(count).toBe(0);
  });

  test("falls back to a constructed URL when positionUrl is missing", () => {
    const raw = { data: { positions: [{ id: 42, name: "Engineer" }], count: 1 } };
    const { results } = parseSearchResponse(raw);
    expect(results[0].url).toBe("https://careers.qualcomm.com/careers/job/42");
  });
});

describe("parseDetailResponse", () => {
  test("strips HTML tags and decodes entities in job_description", () => {
    const raw = {
      id: 42,
      name: "Firmware Engineer",
      location: "San Diego, California, United States of America",
      department: "Software Engineering",
      business_unit: "Embedded Systems",
      job_description: "<p>Great role &amp; team.</p><p></p><p>Second paragraph.</p>",
      canonicalPositionUrl: "https://careers.qualcomm.com/careers/job/42",
      t_create: 1772150400,
    };
    const job = parseDetailResponse(raw);
    expect(job.title).toBe("Firmware Engineer");
    expect(job.company).toBe("Qualcomm");
    expect(job.description).toBe("Great role & team.\n\nSecond paragraph.");
    expect(job.url).toBe("https://careers.qualcomm.com/careers/job/42");
    expect(job.department).toBe("Software Engineering");
  });

  test("falls back to '(untitled)' when name is missing", () => {
    const job = parseDetailResponse({ id: 1 });
    expect(job.title).toBe("(untitled)");
    expect(job.description).toBeNull();
  });
});

describe("jobageCutoff", () => {
  test("returns null for undefined/0/very large values", () => {
    expect(jobageCutoff(undefined)).toBeNull();
    expect(jobageCutoff(0)).toBeNull();
    expect(jobageCutoff(9999)).toBeNull();
  });

  test("returns a cutoff timestamp in the past for a positive day count", () => {
    const cutoff = jobageCutoff(7);
    expect(cutoff).not.toBeNull();
    expect(cutoff! < Math.floor(Date.now() / 1000)).toBe(true);
  });
});
