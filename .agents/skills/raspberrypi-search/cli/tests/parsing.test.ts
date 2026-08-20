import { describe, test, expect } from "bun:test";
import {
  cleanHtml,
  formatLocation,
  normalizeId,
  looksLikeBareShortcode,
  jobageToCutoff,
  parseSearchResponse,
  parseWidgetJob,
} from "../src/helpers";

describe("formatLocation", () => {
  test("joins city, region, country", () => {
    expect(formatLocation({ city: "Cambridge", region: "England", country: "United Kingdom" }, null)).toBe(
      "Cambridge, England, United Kingdom",
    );
  });
  test("appends (Remote) when workplace is remote and a base location exists", () => {
    expect(formatLocation({ city: null, region: null, country: "United Kingdom" }, "remote")).toBe(
      "United Kingdom (Remote)",
    );
  });
  test("returns bare 'Remote' when no location fields are present", () => {
    expect(formatLocation({}, "remote")).toBe("Remote");
  });
  test("returns null when nothing is known", () => {
    expect(formatLocation(null, null)).toBeNull();
  });
});

describe("parseSearchResponse", () => {
  test("maps a v3 job into the contract shape with a compound id", () => {
    const data = {
      total: 1,
      results: [
        {
          id: 123,
          shortcode: "AB9B343504",
          title: "Experienced IC Design Engineer",
          workplace: "on_site",
          location: { country: "United Kingdom", countryCode: "GB", city: "Cambridge", region: "England" },
          published: "2026-06-30T00:00:00.000Z",
          department: ["Engineering"],
        },
      ],
    };
    const jobs = parseSearchResponse(data, "ltd");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe("ltd:AB9B343504");
    expect(jobs[0].company).toBe("Raspberry Pi Ltd");
    expect(jobs[0].date).toBe("2026-06-30");
    expect(jobs[0].url).toBe("https://apply.workable.com/raspberrypi/j/AB9B343504");
    expect(jobs[0].department).toBe("Engineering");
  });

  test("skips malformed entries without breaking the rest", () => {
    const data = { results: [{ title: "no shortcode" }, { shortcode: "X", title: "Valid" }] };
    const jobs = parseSearchResponse(data, "foundation");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Valid");
  });

  test("handles a non-array results field gracefully", () => {
    expect(parseSearchResponse({}, "ltd")).toEqual([]);
  });
});

describe("parseWidgetJob", () => {
  test("strips HTML from the description and carries extra detail fields", () => {
    const job = {
      shortcode: "1E64D1DB65",
      title: "Software Engineer",
      city: null,
      state: null,
      country: "United Kingdom",
      telecommuting: true,
      published_on: "2026-07-17",
      department: "Software Engineering",
      description: "<p>Build things</p><p>Ship &amp; iterate</p>",
      employment_type: "full",
      application_url: "https://apply.workable.com/j/1E64D1DB65/apply",
    };
    const detail = parseWidgetJob(job, "foundation");
    expect(detail.id).toBe("foundation:1E64D1DB65");
    expect(detail.company).toBe("Raspberry Pi Foundation");
    expect(detail.location).toBe("United Kingdom (Remote)");
    expect(detail.description).toBe("Build things\nShip & iterate");
    expect(detail.applyUrl).toBe("https://apply.workable.com/j/1E64D1DB65/apply");
  });
});

describe("cleanHtml", () => {
  test("preserves paragraph breaks between blocks", () => {
    expect(cleanHtml("<p>One</p><p>Two</p>")).toBe("One\nTwo");
  });
  test("decodes hex numeric entities", () => {
    expect(cleanHtml("Caf&#xE9;")).toBe("Café");
  });
  test("returns null for empty input", () => {
    expect(cleanHtml("")).toBeNull();
    expect(cleanHtml(null)).toBeNull();
  });
});

describe("normalizeId", () => {
  test("parses a compound foundation id", () => {
    expect(normalizeId("foundation:1E64D1DB65")).toEqual({ account: "foundation", shortcode: "1E64D1DB65" });
  });
  test("parses a compound ltd id", () => {
    expect(normalizeId("ltd:AB9B343504")).toEqual({ account: "ltd", shortcode: "AB9B343504" });
  });
  test("parses the account from a full job URL, distinguishing the two slugs", () => {
    expect(normalizeId("https://apply.workable.com/raspberrypi/j/AB9B343504")).toEqual({
      account: "ltd",
      shortcode: "AB9B343504",
    });
    expect(normalizeId("https://apply.workable.com/raspberrypifoundation/j/1E64D1DB65")).toEqual({
      account: "foundation",
      shortcode: "1E64D1DB65",
    });
  });
  test("returns null for an unparseable input", () => {
    expect(normalizeId("not an id")).toBeNull();
  });
});

describe("looksLikeBareShortcode", () => {
  test("accepts alphanumeric-only strings", () => {
    expect(looksLikeBareShortcode("AB9B343504")).toBe(true);
  });
  test("rejects strings with slashes or colons", () => {
    expect(looksLikeBareShortcode("ltd:AB9B343504")).toBe(false);
    expect(looksLikeBareShortcode("https://apply.workable.com/j/AB9B343504")).toBe(false);
  });
});

describe("jobageToCutoff", () => {
  test("returns null for 0, absent (falsy), or >= 9999", () => {
    expect(jobageToCutoff(0)).toBeNull();
    expect(jobageToCutoff(9999)).toBeNull();
  });
  test("returns a Date N days in the past for a positive value under 9999", () => {
    const cutoff = jobageToCutoff(7);
    expect(cutoff).not.toBeNull();
    const expected = new Date();
    expected.setUTCDate(expected.getUTCDate() - 7);
    expect(cutoff!.toDateString()).toBe(expected.toDateString());
  });
});
