# Nordic Semiconductor Careers URL Reference

Investigated 2026-07-19. Nordic Semiconductor's careers site
(`careers.nordicsemi.com`, linked from `www.nordicsemi.com/Careers`) runs on
**Teamtailor** — confirmed via the response's
`content-security-policy: frame-ancestors 'self' careers.nordicsemi.com
app.teamtailor.com` header and `assets-aws.teamtailor-cdn.com` asset URLs.

Rather than parsing the rendered HTML, this skill hits Teamtailor's own public
**JSON Feed** endpoint directly (per add-portal.md's platform-detection
guidance: prefer a known platform's own API over scraping HTML). The page
itself even advertises it: the HTML response's `Link` header includes
`<https://careers.nordicsemi.com/jobs.json>; rel="alternate";
type="application/json"` alongside a `jobs.md` markdown alternate.

## Access rules (robots.txt, checked 2026-07-19)

```
User-Agent: *
Disallow: /app/
Disallow: /messages/
Disallow: /messenger/
Disallow: /facebook/tab/
Disallow: /jobs/internal/
Sitemap: https://careers.nordicsemi.com/sitemap.xml
```

`/jobs` and `/jobs.json` are unrestricted for `User-agent: *`. No login is
required to view listings. Note: `www.nordicsemi.com` itself sits behind a
Cloudflare bot-challenge (`Just a moment...` interstitial on direct fetch) —
this skill never touches that host; all traffic goes to `careers.nordicsemi.com`,
which has no such challenge.

## Search / feed endpoint

```
GET https://careers.nordicsemi.com/jobs.json?query=<keywords>&field-of-expertise=<category>&per_page=<n>&page=<n>
```

| Param | Meaning | Notes |
|-------|---------|-------|
| `query` | Free-text keyword search | Server-side full-text match across title **and** body — e.g. `query=firmware` matches postings that mention "firmware" in the description even when the title doesn't contain the word. `query=firmware+engineer` behaves like an OR across tokens, so it returns more/broader hits than `query=firmware` alone. |
| `field-of-expertise` | Category facet | Observed values on the site's own category links: `Engineering`, `Commercial`, `Administrative`, `IT-Operations`, `Quality`, `Supply Chain`. Exposed as `--category`. |
| `per_page` | Page size | Confirmed working (tested `per_page=2` → 2 items returned). This CLI requests `per_page=100` for search / `per_page=200` for detail to capture the whole matching set in one request (Nordic currently has ~14 open reqs company-wide, so 100/200 is comfortably enough headroom). |
| `page` | 1-indexed page | Confirmed working (`page=2` on a 14-item unfiltered feed correctly returned 0 items, i.e. real server-side pagination, not an error). Not used directly by this CLI — see Quirks. |

Response is a [JSON Feed 1.1](https://jsonfeed.org/version/1.1) document:

```
{ "version", "title", "home_page_url", "feed_url", "items": [ ... ] }
```

Each `items[]` entry:

- `id` — Teamtailor's internal UUID (not user-facing; **not** what this CLI exposes as `id`)
- `title`, `url` (canonical `.../jobs/<numericId>-<slug>`), `date_published` (ISO)
- `content_html` — full description, HTML
- `_jobposting` — a schema.org `JobPosting` object with:
  - `identifier.value` — the numeric job id (matches the leading digits of `url`'s slug) — **this is what the CLI uses as `id`**
  - `description` — same HTML as `content_html`, not truncated
  - `datePosted`, `validThrough` (deadline)
  - `hiringOrganization.name` (always `"Nordic Semiconductor"`)
  - `jobLocation` — a `Place` object **or array of `Place`s** for multi-site roles, each with `address.addressLocality` / `address.addressCountry`
  - No `employmentType` field is present on any observed posting — the CLI's `employmentType` is always `null`.

## No location or posted-since server parameter

Unlike `field-of-expertise`, there is no discoverable query parameter for
location or posting recency on this feed (no evidence of one in the rendered
page's filter links, and undocumented guesses were not tested against
production to avoid unnecessary load). Both `--location` and `--jobage` are
therefore applied **client-side** in `search.ts`, after fetching the full
`query`/`category`-filtered set from the server:

- `--location <text>` — case-insensitive substring match against the joined
  `jobLocation` display string (e.g. `"Oslo, NO; Trondheim, NO; Kraków, PL"`).
  Matching against country names spelled out (not just ISO codes) would
  require a lookup table this CLI doesn't ship — pass the city, or the
  ISO-2 code (`NO`, `PL`, `US`, `GB`), not the spelled-out country name.
- `--jobage <days>` — compares `date_published` to `Date.now() - days`.

## Detail

There is no single-job JSON endpoint (`GET /jobs/<id>.json` returns `406`).
`detail <id|url>` instead fetches the same `/jobs.json` feed unfiltered
(`per_page=200`) and finds the matching item by numeric id — cheap, since the
whole feed is one request and Nordic's total open-req count is small. The
job's own HTML detail page (`/jobs/<id>-<slug>`) also embeds an equivalent
`<script type="application/ld+json">` JobPosting block, confirmed present,
but was not used since the feed already has everything needed.

## Quirks

- `id` in this CLI is the **numeric** id from `_jobposting.identifier.value` /
  the URL slug — not Teamtailor's internal UUID (`items[].id` in the raw
  feed), which is not user-facing anywhere on the site.
- UK listings: at investigation time (2026-07-19) none of Nordic's ~14 open
  reqs were UK-based (seen: Oslo/Trondheim NO, Kraków PL, several US cities,
  Shanghai/Shenzhen CN, Manila PH) — Nordic does have a UK engineering
  presence per its own careers copy, but no open UK req existed at test time.
  This is a snapshot of current postings, not a limitation of the skill.
- `query=` does OR-style multi-token matching against full text, not an exact
  phrase match — expect broader-than-literal results for multi-word queries.
- The bare numeric detail URL (`/jobs/<id>` with no slug) 301-redirects to the
  canonical slugged URL; both forms are accepted by `normalizeId`.
