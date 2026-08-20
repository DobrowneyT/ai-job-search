import { describe, test, expect } from "bun:test";
import { parseSearchPage, parseJobDetail, normalizeId, normalizeDate } from "../src/helpers";

function searchPage(cardsHtml: string, opts?: { total?: number; totalPages?: number; currentPage?: number }): string {
  const total = opts?.total ?? 226;
  const totalPages = opts?.totalPages ?? 16;
  const currentPage = opts?.currentPage ?? 1;
  return `
    <section id="search-results" data-total-job-results="${total}" data-total-pages="${totalPages}" data-current-page="${currentPage}" data-records-per-page="15">
      <ul class="list-reset" id="search-results-jobs" data-results-count="${total}">
        ${cardsHtml}
      </ul>
      <nav id="pagination-bottom" class="pagination">
        <li class="job-card fs-start">
          <a class="job-card__title fs-11" href="/gpu-stories-chris-kwon" data-page-id="871346">Unrelated story widget entry</a>
        </li>
      </nav>
    </section>
  `;
}

function jobCard(id: string, title: string, location = "Cambridge, United Kingdom", category = "Software Engineering"): string {
  return `<li class="job-card fs-start fs-middle">
    <a class="job-card__title fs-11" href="/job/cambridge/${id}-slug/33099/${id}" data-job-id="${id}">${title}</a>
    <span class="location">${location}</span>
    <span class="category">${category}</span>
  </li>`;
}

describe("parseSearchPage", () => {
  test("parses job cards with id, title, location, category, url", () => {
    const html = searchPage(jobCard("96521990288", "Graphics Engineer"));
    const page = parseSearchPage(html);
    expect(page.total).toBe(226);
    expect(page.totalPages).toBe(16);
    expect(page.currentPage).toBe(1);
    expect(page.jobs).toHaveLength(1);
    const job = page.jobs[0];
    expect(job.id).toBe("96521990288");
    expect(job.title).toBe("Graphics Engineer");
    expect(job.company).toBe("Arm");
    expect(job.location).toBe("Cambridge, United Kingdom");
    expect(job.category).toBe("Software Engineering");
    expect(job.url).toBe("https://careers.arm.com/job/cambridge/96521990288-slug/33099/96521990288");
    expect(job.date).toBeNull();
  });

  test("ignores the unrelated 'jobs you may like' widget outside search-results-jobs", () => {
    // Regression test: job-card__title is reused by a related-content widget
    // (linking to stories via data-page-id) that appears even when the real
    // results list is empty (e.g. paging past the last page). The widget
    // entry is placed after </ul> inside <nav id="pagination-bottom"> in the
    // fixture, matching the real page structure.
    const html = searchPage(""); // empty real results list
    const page = parseSearchPage(html);
    expect(page.jobs).toHaveLength(0);
  });

  test("parses multiple cards independently — one malformed card doesn't break the rest", () => {
    const malformed = `<li class="job-card">no anchor here</li>`;
    const html = searchPage(
      jobCard("111111111", "Firmware Engineer") + malformed + jobCard("222222222", "Kernel Developer"),
    );
    const page = parseSearchPage(html);
    expect(page.jobs.map((j) => j.id)).toEqual(["111111111", "222222222"]);
  });

  test("decodes HTML entities in the title", () => {
    const html = searchPage(jobCard("333333333", "Senior Software&#x2014;Engineer"));
    const page = parseSearchPage(html);
    expect(page.jobs[0].title).toBe("Senior Software—Engineer");
  });
});

describe("parseJobDetail", () => {
  const ldJson = JSON.stringify({
    "@context": "http://schema.org",
    "@type": "JobPosting",
    datePosted: "2026-6-16",
    description: "<h2>Overview</h2><p>Build cool things &amp; ship them.</p>",
    employmentType: "Established",
    identifier: "2020-3449",
    title: "Graphics Engineer",
    url: "https://careers.arm.com/job/cambridge/graphics-engineer/33099/96521990288",
    hiringOrganization: { "@type": "Organization", name: "ARM" },
    jobLocation: [
      {
        "@type": "Place",
        address: { "@type": "PostalAddress", addressLocality: "Cambridge", addressCountry: "United Kingdom" },
      },
    ],
  });

  function detailPage(): string {
    return `
      <script type="application/ld+json">${ldJson}</script>
      <span class="job-id job-info"><b>Job ID</b> 2020-3449</span>
      <span class="job-date job-info"><b>Date posted</b> Jun. 16, 2026</span>
      <span class="job-location job-info"><b>Location</b> Cambridge, United Kingdom </span>
      <span class="job-category job-info"><b>Category</b> Software Engineering</span>
      <a data-selector-name="job-apply-link" href="https://experienced-arm.icims.com/jobs/3449/graphics-engineer/job/login">Apply</a>
    `;
  }

  test("parses title, location, description, employmentType, reqId from JSON-LD", () => {
    const job = parseJobDetail(detailPage(), "96521990288");
    expect(job).not.toBeNull();
    expect(job!.title).toBe("Graphics Engineer");
    expect(job!.location).toBe("Cambridge, United Kingdom");
    expect(job!.company).toBe("Arm");
    expect(job!.date).toBe("2026-06-16");
    expect(job!.employmentType).toBe("Established");
    expect(job!.reqId).toBe("2020-3449");
    expect(job!.description).toContain("Overview");
    expect(job!.description).toContain("Build cool things & ship them.");
    expect(job!.description).not.toMatch(/<\/?[a-z]+>/i);
    expect(job!.applyUrl).toBe("https://experienced-arm.icims.com/jobs/3449/graphics-engineer/job/login");
  });

  test("returns null when neither JSON-LD nor the Job ID span are present", () => {
    expect(parseJobDetail("<html><body>nothing here</body></html>", "123")).toBeNull();
  });
});

describe("normalizeDate", () => {
  test("zero-pads Arm's non-padded date strings", () => {
    expect(normalizeDate("2026-6-16")).toBe("2026-06-16");
    expect(normalizeDate("2026-12-1")).toBe("2026-12-01");
    expect(normalizeDate("2026-12-25")).toBe("2026-12-25");
  });

  test("returns null for unparseable input", () => {
    expect(normalizeDate("not a date")).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
  });
});

describe("normalizeId", () => {
  test("accepts a bare numeric id", () => {
    expect(normalizeId("96521990288")).toBe("96521990288");
  });

  test("extracts the id from a full job URL", () => {
    expect(normalizeId("https://careers.arm.com/job/cambridge/graphics-engineer/33099/96521990288")).toBe(
      "96521990288",
    );
  });

  test("returns null for input with no digits", () => {
    expect(normalizeId("not-an-id")).toBeNull();
  });
});
