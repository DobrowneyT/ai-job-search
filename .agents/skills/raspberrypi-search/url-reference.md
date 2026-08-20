# Raspberry Pi Jobs — Endpoint Reference

Investigated 2026-07-19. Two legally distinct entities, one shared ATS.

## Access check (robots.txt / walls)

- `apply.workable.com/robots.txt` — `Disallow:` is empty (nothing blocked); `Content-Signal: search=yes, ai-input=yes, ai-train=no`. No restriction on the endpoints this skill uses.
- `raspberrypi.com/robots.txt` — does **not** disallow `/jobs`. However the entire domain returns `403 Forbidden` with a `Cf-Mitigated: challenge` header and a "Just a moment..." interstitial to **every** path tested (`/jobs/`, `/wp-json/`, `/api/jobs`, the bare root with and without `www.`) under a plain HTTP client — this is a Cloudflare JS/Turnstile challenge, not a login wall, but it is equally unsolvable without a real browser. Confirmed via WebFetch too (renders an empty "Current jobs" table shell with no populated rows — the table is filled client-side after the challenge passes). Same signature this repo already documents for Indeed, Glassdoor, and Adzuna's own frontend (see `adzuna-search/url-reference.md`). **Declined as a direct scrape target** — not because of robots.txt, but because it is technically inaccessible to a non-browser client.

## How the Ltd company was found anyway

`raspberrypi.com/jobs` visibly renders Workable-shaped job data once JS runs (a
"Current jobs" table). Probing Workable's public account-slug API directly for
plausible slugs (`raspberrypi`, `raspberrypitrading`, `raspberrypiltd`,
`raspberrypicomputing`, `raspberrypifoundation`) found that `raspberrypi` (bare,
no suffix) is a **live, populated Workable account** whose widget-endpoint company
description reads: *"Raspberry Pi makes computers that make technology accessible
to people and businesses all over the world..."* and whose five open roles were
all Cambridge-based silicon/ASIC engineering (IC Design, IC Verification, Digital
IC Implementation, DFT, Applications Engineer) — unambiguously the commercial
hardware company, not the charity. This is almost certainly the same backing data
`raspberrypi.com/jobs` renders client-side; querying Workable directly sidesteps
the Cloudflare wall entirely.

## Accounts

| Key | Workable slug | Entity |
|---|---|---|
| `foundation` | `raspberrypifoundation` | Raspberry Pi Foundation (educational charity) |
| `ltd` | `raspberrypi` | Raspberry Pi Ltd / Raspberry Pi Trading (commercial hardware company) |

## Search

```
POST https://apply.workable.com/api/v3/accounts/<slug>/jobs
Content-Type: application/json

{"query": "<keywords>"}
```

- No authentication required.
- `query` does real full-text matching over title + description (confirmed: a nonsense string returns `{"total":0}`; `"DFT"` returns exactly the 2 postings whose title/description mention it, not all 5).
- **`department` and `location` filter fields exist but are impractical to expose**: submitting `{"department":["Engineering"]}` returns `400 {"department":{"0":"\"department[0]\" must be a number"}}` — department is filtered by an opaque internal numeric ID, not a label, and those IDs aren't documented or discoverable without walking every department first. `{"location":["Cambridge"]}` returns `400` too — it wants an array of full location **objects** (`{country, countryCode, city, region}`), not free text. Both are skipped; this skill filters `--location` client-side on the formatted result string instead (see `helpers.ts::formatLocation` / `search.ts::matchesLocation`).
- **No server-side pagination**: `{"page":2}`, `{"offset":0,"limit":2}` all return `400 "Not allowed"`. Not an issue in practice — each account has only ~5 open roles at a time — so `search`/`--page`/`--limit` slice client-side after fetching the full (query-filtered) list.
- Response shape: `{"total": <int>, "results": [job, ...]}`. Each `job`:
  - `id` (number, internal — not used; `shortcode` is the stable public identifier)
  - `shortcode` (string, e.g. `"AB9B343504"`) — used to build this skill's compound `id` (`<account>:<shortcode>`) and the job URL
  - `title`
  - `remote` (bool) and `workplace` (`"remote"` | `"on_site"` | `"hybrid"`, seen: remote/on_site)
  - `location` — `{country, countryCode, city, region}`, any field may be `null`
  - `locations` — array variant for multi-location postings
  - `published` (ISO datetime)
  - `department` (array of strings, may be empty)
  - `code` (employer's internal req code, cosmetic)

## Detail

No by-ID lookup endpoint exists (confirmed: `GET /api/v3/accounts/<slug>/jobs/<shortcode>` → `404`; `GET /api/v3/accounts/<slug>/jobs?id=...` ignores the param). Instead, the **widget endpoint** returns every job for an account WITH its full HTML description in one call:

```
GET https://apply.workable.com/api/v1/widget/accounts/<slug>?details=true
```

- No authentication required.
- Response: `{"name": "...", "description": "<company blurb HTML>", "jobs": [...]}`.
- **Quirk: one entry per (job, location) pair.** A job posted to multiple locations (e.g. the Foundation's "Computer Science Trainer (Odisha)" role, posted to 6 Indian towns) appears as 6 separate entries in `jobs[]`, all sharing the same `shortcode`. `detail` dedupes by taking the first match for the requested shortcode — this loses nothing important since the per-location fields (`city`/`state`/`country`) aren't otherwise surfaced differently per duplicate in practice.
- Each `jobs[]` entry carries: `title`, `shortcode`, `code`, `employment_type`, `telecommuting` (bool), `department`, `url` / `shortlink` / `application_url`, `published_on`, `created_at`, `country`/`city`/`state`, `education`, `experience`, `function`, `industry`, and `description` (HTML — stripped to plain text by this skill's `cleanHtml`).

## Resolving a bare shortcode to its account

The global shortlink resolves a shortcode to its owning account via a `301`:

```
GET https://apply.workable.com/j/<shortcode>   ->  301 Location: /<account-slug>/j/<shortcode>
```

`detail` uses this (with `redirect: "manual"`, reading only the `Location` header)
when given a bare shortcode with no `foundation:`/`ltd:` prefix and no full URL to
parse the account from directly. Confirmed working for shortcodes from both
accounts.

## Quirks summary

- Workable enforces no visible rate limit during testing (a handful of search + widget + shortlink requests, no `429`s seen), but the CLI still backs off with the standard exponential-retry policy on `429`/`5xx` as a precaution, matching every other portal skill in this repo.
- `remote` (bool) and `workplace` (string) are redundant but not always consistent in casing/presence across responses; `workplace` is treated as the source of truth for the "(Remote)" location suffix.
- Salary sometimes appears embedded in the free-text `description` (e.g. "Salary: £43,000 to £48,000...") but there is no structured salary field in either the search or widget response — not surfaced as a dedicated field.
