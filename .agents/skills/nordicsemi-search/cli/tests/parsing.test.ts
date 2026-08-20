import { describe, test, expect } from "bun:test";
import { parseFeed, findJobDetail, locationMatches, withinJobage, normalizeId } from "../src/helpers";

// Minimal JSON Feed fixture shaped like careers.nordicsemi.com/jobs.json.
// One malformed item (no title) is included to exercise the "skip, don't crash" rule.
function fixtureFeed() {
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: "Nordic Semiconductor",
    items: [
      {
        id: "uuid-1",
        title: "Embedded Developer for Bluetooth",
        url: "https://careers.nordicsemi.com/jobs/8056908-embedded-developer-for-bluetooth",
        date_published: "2026-07-13T00:00:00+02:00",
        content_html: "<p><strong>About</strong> the job &amp; team</p><ul><li>Item one</li></ul>",
        _jobposting: {
          identifier: { value: 8056908 },
          description: "<p><strong>About</strong> the job &amp; team</p><ul><li>Item one</li></ul>",
          datePosted: "2026-07-13T00:00:00+02:00",
          validThrough: "2026-08-16T23:59:59+02:00",
          jobLocation: [
            { address: { addressLocality: "Oslo", addressCountry: "NO" } },
            { address: { addressLocality: "Kraków", addressCountry: "PL" } },
          ],
        },
      },
      {
        // malformed: no title, no _jobposting.identifier — should be skipped, not crash parseFeed
        id: "uuid-2",
        url: "https://careers.nordicsemi.com/jobs/9999999-broken",
      },
      {
        id: "uuid-3",
        title: "Field Application Engineer",
        url: "https://careers.nordicsemi.com/jobs/7777383-field-application-engineer",
        date_published: "2020-01-01T00:00:00+02:00",
        _jobposting: {
          identifier: { value: 7777383 },
          jobLocation: { address: { addressLocality: "San Jose", addressCountry: "US" } },
        },
      },
    ],
  };
}

describe("parseFeed", () => {
  test("parses well-formed items and skips malformed ones", () => {
    const cards = parseFeed(fixtureFeed());
    expect(cards.length).toBe(2);
    expect(cards.map((c) => c.id)).toEqual(["8056908", "7777383"]);
  });

  test("uses the numeric id from the url slug, not the feed's internal uuid", () => {
    const [card] = parseFeed(fixtureFeed());
    expect(card.id).toBe("8056908");
    expect(card.id).not.toBe("uuid-1");
  });

  test("joins multi-location jobLocation arrays with '; '", () => {
    const [card] = parseFeed(fixtureFeed());
    expect(card.location).toBe("Oslo, NO; Kraków, PL");
  });

  test("company is always Nordic Semiconductor", () => {
    const cards = parseFeed(fixtureFeed());
    expect(cards.every((c) => c.company === "Nordic Semiconductor")).toBe(true);
  });

  test("date is normalized to YYYY-MM-DD", () => {
    const [card] = parseFeed(fixtureFeed());
    expect(card.date).toBe("2026-07-13");
  });

  test("empty/malformed feed returns an empty array instead of throwing", () => {
    expect(parseFeed({})).toEqual([]);
    expect(parseFeed(null)).toEqual([]);
    expect(parseFeed({ items: "not-an-array" })).toEqual([]);
  });
});

describe("findJobDetail", () => {
  test("finds a job by numeric id and strips/decodes its HTML description", () => {
    const job = findJobDetail(fixtureFeed(), "8056908");
    expect(job).not.toBeNull();
    expect(job!.title).toBe("Embedded Developer for Bluetooth");
    expect(job!.description).toContain("About the job & team");
    expect(job!.description).toContain("• Item one");
    expect(job!.description).not.toMatch(/<\/?[a-z]+>/i);
  });

  test("returns the deadline from validThrough", () => {
    const job = findJobDetail(fixtureFeed(), "8056908");
    expect(job!.deadline).toBe("2026-08-16");
  });

  test("employmentType is always null (field never present upstream)", () => {
    const job = findJobDetail(fixtureFeed(), "8056908");
    expect(job!.employmentType).toBeNull();
  });

  test("returns null for an id not present in the feed", () => {
    expect(findJobDetail(fixtureFeed(), "123")).toBeNull();
  });
});

describe("locationMatches", () => {
  test("case-insensitive substring match", () => {
    expect(locationMatches("Oslo, NO; Kraków, PL", "oslo")).toBe(true);
    expect(locationMatches("Oslo, NO; Kraków, PL", "PL")).toBe(true);
    expect(locationMatches("Oslo, NO", "GB")).toBe(false);
  });

  test("null location never matches", () => {
    expect(locationMatches(null, "oslo")).toBe(false);
  });
});

describe("withinJobage", () => {
  test("9999 (default/omitted) always passes", () => {
    expect(withinJobage("2000-01-01", 9999)).toBe(true);
  });

  test("recent date passes a short window", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(withinJobage(today, 7)).toBe(true);
  });

  test("old date fails a short window", () => {
    expect(withinJobage("2000-01-01", 7)).toBe(false);
  });

  test("null/unparseable date is not dropped", () => {
    expect(withinJobage(null, 7)).toBe(true);
    expect(withinJobage("not-a-date", 7)).toBe(true);
  });
});

describe("normalizeId", () => {
  test("accepts a bare numeric id", () => {
    expect(normalizeId("8056908")).toBe("8056908");
  });

  test("extracts the id from a full job URL", () => {
    expect(normalizeId("https://careers.nordicsemi.com/jobs/8056908-embedded-developer-for-bluetooth")).toBe(
      "8056908",
    );
  });

  test("rejects garbage input", () => {
    expect(normalizeId("not-an-id")).toBeNull();
  });
});
