import { describe, test, expect } from "bun:test";
import {
  matchesQuery,
  matchesLocation,
  matchesDepartment,
  toJobResult,
  daysAgo,
  greenhouseContentToText,
  type GreenhouseJob,
} from "../src/helpers";

function job(overrides: Partial<GreenhouseJob> = {}): GreenhouseJob {
  return {
    id: 12345,
    title: "Staff Firmware Engineer",
    absolute_url: "https://job-boards.greenhouse.io/tenstorrent/jobs/12345",
    location: { name: "Toronto, Ontario, Canada" },
    updated_at: "2026-07-14T16:16:58-04:00",
    first_published: "2026-05-05T12:27:59-04:00",
    requisition_id: "20231221",
    company_name: "Tenstorrent",
    departments: [{ id: 1, name: "Firmware" }],
    ...overrides,
  };
}

describe("matchesQuery", () => {
  test("case-insensitive substring match against title", () => {
    expect(matchesQuery(job(), "firmware")).toBe(true);
    expect(matchesQuery(job(), "FIRMWARE")).toBe(true);
    expect(matchesQuery(job(), "hardware")).toBe(false);
  });

  test("no query matches everything", () => {
    expect(matchesQuery(job(), undefined)).toBe(true);
  });
});

describe("matchesLocation", () => {
  test("substring match against location.name", () => {
    expect(matchesLocation(job(), "Toronto")).toBe(true);
    expect(matchesLocation(job(), "toronto")).toBe(true);
    expect(matchesLocation(job(), "Santa Clara")).toBe(false);
  });

  test("handles multi-site location strings", () => {
    const j = job({ location: { name: "Santa Clara, California, United States; Taipei City, Taiwan" } });
    expect(matchesLocation(j, "Taipei")).toBe(true);
    expect(matchesLocation(j, "Santa Clara")).toBe(true);
  });

  test("null location never matches a non-empty filter", () => {
    const j = job({ location: null });
    expect(matchesLocation(j, "Toronto")).toBe(false);
  });
});

describe("matchesDepartment", () => {
  test("substring match against department name", () => {
    expect(matchesDepartment(job(), "Firmware")).toBe(true);
    expect(matchesDepartment(job(), "RISC")).toBe(false);
  });
});

describe("toJobResult", () => {
  test("maps Greenhouse fields to the shared JobResult shape", () => {
    const r = toJobResult(job());
    expect(r).toEqual({
      id: "12345",
      title: "Staff Firmware Engineer",
      company: "Tenstorrent",
      location: "Toronto, Ontario, Canada",
      date: "2026-05-05",
      url: "https://job-boards.greenhouse.io/tenstorrent/jobs/12345",
    });
  });

  test("falls back to updated_at when first_published is absent", () => {
    const r = toJobResult(job({ first_published: null, updated_at: "2026-06-01T00:00:00-04:00" }));
    expect(r.date).toBe("2026-06-01");
  });

  test("company falls back to Tenstorrent when company_name is missing", () => {
    const r = toJobResult(job({ company_name: null }));
    expect(r.company).toBe("Tenstorrent");
  });
});

describe("daysAgo", () => {
  test("null/undefined input returns null", () => {
    expect(daysAgo(null)).toBeNull();
    expect(daysAgo(undefined)).toBeNull();
  });

  test("unparseable date returns null", () => {
    expect(daysAgo("not-a-date")).toBeNull();
  });

  test("computes whole days since a recent timestamp", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    expect(daysAgo(tenDaysAgo)).toBe(10);
  });
});

describe("greenhouseContentToText", () => {
  test("decodes double-escaped HTML entities and strips tags", () => {
    // Greenhouse's `content` field is HTML whose tags are themselves
    // entity-escaped: the JSON value contains literal "&lt;div&gt;" text.
    const escaped =
      "&lt;div&gt;&lt;p&gt;Tenstorrent is hiring.&lt;/p&gt;&lt;p&gt;Second paragraph.&lt;/p&gt;&lt;/div&gt;";
    const text = greenhouseContentToText(escaped);
    expect(text).toContain("Tenstorrent is hiring.");
    expect(text).toContain("Second paragraph.");
    expect(text).not.toContain("<div>");
    expect(text).not.toContain("&lt;");
  });

  test("resolves nested double-encoded entities like &amp;nbsp;", () => {
    const escaped = "&lt;p&gt;Before&amp;nbsp;after&lt;/p&gt;";
    const text = greenhouseContentToText(escaped);
    expect(text).not.toContain("&nbsp;");
    expect(text).not.toContain("&amp;");
  });

  test("preserves paragraph breaks as newlines", () => {
    const escaped = "&lt;p&gt;One&lt;/p&gt;&lt;p&gt;Two&lt;/p&gt;";
    const text = greenhouseContentToText(escaped);
    expect(text.split("\n").filter(Boolean)).toEqual(["One", "Two"]);
  });
});
