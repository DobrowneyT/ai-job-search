# Search Queries for Job Scraper

<!-- SETUP: Customize these queries based on your skills, target roles, and location -->
<!-- Set 2026-07: geographic scope is UK-only (Liverpool/Manchester or remote), targeting a January 2027 relocation. Revisit if the scope changes back to Canada. -->

## Search Sites

Primary (UK job market, via installed portal-search CLIs - see each skill's `SKILL.md` for exact flags):
- **reed-search** (`.agents/skills/reed-search/`) - reed.co.uk, UK's largest stand-alone job board
- **linkedin-search** (`.agents/skills/linkedin-search/`) - LinkedIn job listings, location e.g. "Liverpool, England, United Kingdom", "Manchester, England, United Kingdom", or "Remote"

Removed from active rotation (2026-07-20) - consistent failures:
- **totaljobs-search** (`.agents/skills/totaljobs-search/`) - totaljobs.com HTML pages reliably block WebFetch (timeouts) once `/rank` tries to read the actual posting text. Left installed but not used by `/scrape` or `/rank`.
- **adzuna-search** (`.agents/skills/adzuna-search/`) - the official API search itself still works (used successfully in `/scrape`), but every `adzuna.co.uk/jobs/...` posting URL it returns gets HTTP 429'd by the public website when `/rank` tries to fetch the full description - so results from this portal were consistently unusable at the scoring stage across every `/rank` run this month. Left installed but not used.

Deprioritized while the search is UK-only:
- **jobbank-search** (jobbank.gc.ca) - Canada-specific; left installed, not used for now. Reactivate if the geographic scope shifts back to Canada.
- Danish portals (jobindex-search, jobdanmark-search, jobnet-search) and freehire-search - not relevant to a UK search; left installed and unused.

Company career-site portals (added 2026-07-19, direct-to-employer, bypasses generic aggregator blocking):
- **arm-search** (`.agents/skills/arm-search/`) - careers.arm.com (Radancy/TalentBrew, HTML scrape). Dream company. No working server-side location or posting-age filter - Arm hires globally with no reliable UK scoping; `--location` is a soft keyword bias only.
- **tenstorrent-search** (`.agents/skills/tenstorrent-search/`) - Tenstorrent's Greenhouse board (`boards-api.greenhouse.io/v1/boards/tenstorrent`), official JSON API. Dream company (RISC-V/AI silicon). Supports `--location`/`--department` client-side filters.
- **raspberrypi-search** (`.agents/skills/raspberrypi-search/`) - Raspberry Pi Ltd (hardware/silicon, Cambridge, `--source ltd`) and Raspberry Pi Foundation (`--source foundation`), both via Workable's API. raspberrypi.com/jobs itself is Cloudflare-walled; this skill reaches Ltd's postings through Workable directly instead.
- **qualcomm-search** (`.agents/skills/qualcomm-search/`) - careers.qualcomm.com, backed by Eightfold.ai's API. Major SoC/mobile-silicon company.
- **imagination-search** (`.agents/skills/imagination-search/`) - Imagination Technologies (UK, Kings Langley - PowerVR GPU / RISC-V CPU IP), via PageUp's public JSON feed with genuine server-side keyword/location/category filtering.
- **graphcore-search** (`.agents/skills/graphcore-search/`) - Graphcore (UK, Bristol - AI/IPU chips), via its Greenhouse board's JSON API.
- **sifive-search** (`.agents/skills/sifive-search/`) - SiFive (RISC-V core design), via Workday's CXS API. Primarily US-hiring; `--location "United Kingdom"` matches loosely (a requisition merely listing Cambridge as one of several eligible sites will surface even if mostly US-based) - verify each result's actual location before assuming UK relevance.
- **stmicro-search** (`.agents/skills/stmicro-search/`) - STMicroelectronics (STM32 manufacturer - the candidate's current professional chip family), via Eightfold.ai's API. No reliable server-side location filter; `--location` folds into free-text query and can leak non-UK results.
- **nordicsemi-search** (`.agents/skills/nordicsemi-search/`) - Nordic Semiconductor (nRF low-power/IoT chips), via Teamtailor's public JSON feed. Small headcount - UK openings are not always present; check current listings rather than assuming coverage gaps.

All nine were built via `/add-portal` and live-tested; see each skill's `url-reference.md` for the exact endpoints and parsing quirks discovered during that investigation.

## Query Categories

Queries are grouped by priority. Location for portal-CLI searches: `Liverpool` / `Manchester` / omit for UK-wide+remote. Google fallback queries below use `site:` filters for when a portal CLI isn't the right tool.

### Priority 1: Embedded / Firmware / Kernel Engineering

Strongest and most desired career direction - the hardware/software boundary, real-time and kernel-level work.

Role titles: Embedded Software Engineer, Firmware Engineer, Embedded Linux Engineer, Kernel Developer

```
site:reed.co.uk "Embedded Software Engineer" Manchester OR Liverpool OR remote
site:reed.co.uk "Firmware Engineer" STM32
site:reed.co.uk "Embedded Linux Engineer"
site:linkedin.com/jobs "Kernel Developer" "United Kingdom"
```

### Priority 2: Domain Expertise - Real-Time Systems & Communication Protocols

Key skills: STM32, FreeRTOS, CAN/J1939, Embedded Linux (U-Boot, UEFI, Kconfig, defconfig), FPGA

```
site:reed.co.uk FreeRTOS OR "real-time" embedded Manchester OR Liverpool
site:reed.co.uk "embedded Linux" u-boot OR uefi OR kernel
site:reed.co.uk CAN OR J1939 embedded
site:linkedin.com/jobs FPGA embedded "United Kingdom"
```

### Priority 3: Adjacent / Aspirational - Computer Architecture & Silicon

Roles to pivot toward: ASIC/FPGA Design Engineer, Computer Architect, RISC-V/instruction-set-architecture work. Genuine growth area (project-level exposure so far, e.g. a 16-bit processor designed in coursework) rather than direct professional experience - flag gaps honestly rather than overstating fit.

```
site:reed.co.uk "FPGA Design Engineer" OR "ASIC Design Engineer"
site:linkedin.com/jobs "Computer Architect" RISC-V OR ISA
site:linkedin.com/jobs Verilog "computer architecture"
```

Dream/target companies - monitor directly via their own career-site portal skills (see "Company career-site portals" above) rather than Google `site:` fallback:

```
bun run .agents/skills/arm-search/cli/src/cli.ts search -q "Firmware Engineer" --format table
bun run .agents/skills/arm-search/cli/src/cli.ts search -q "Embedded Software Engineer" --format table
bun run .agents/skills/tenstorrent-search/cli/src/cli.ts search -q "firmware" --format table
bun run .agents/skills/tenstorrent-search/cli/src/cli.ts search -q "RISC-V" --format table
bun run .agents/skills/raspberrypi-search/cli/src/cli.ts search -q "engineer" --source ltd --format table
bun run .agents/skills/qualcomm-search/cli/src/cli.ts search -q "embedded software engineer" --format table
bun run .agents/skills/qualcomm-search/cli/src/cli.ts search -q "linux kernel engineer" --format table
bun run .agents/skills/imagination-search/cli/src/cli.ts search -q "firmware verification engineer" --format table
bun run .agents/skills/graphcore-search/cli/src/cli.ts search -q "firmware" --location "UK" --format table
bun run .agents/skills/sifive-search/cli/src/cli.ts search -q "RISC-V CPU design engineer" --format table
bun run .agents/skills/stmicro-search/cli/src/cli.ts search -q "STM32 firmware engineer" --format table
bun run .agents/skills/nordicsemi-search/cli/src/cli.ts search -q "firmware engineer" --format table
```

For SiFive and STMicroelectronics especially, verify each result's actual location before assuming UK relevance - both skills' location filters are loose (see their notes in "Company career-site portals" above).

### Priority 4: Broader Technical Net

Wider net if the above are thin.

```
site:reed.co.uk "embedded developer" United Kingdom
site:linkedin.com/jobs "embedded systems" "United Kingdom"
```

## Location Filter

Geographic scope for now is **UK-only** (targeting a January 2027 relocation to Liverpool, alongside a spouse's student exchange). Winnipeg/Canada-based searches are paused, not deleted - see `jobbank-search` note above.

- **Liverpool** and **Manchester** - ideal (this is the target area)
- **Remote (UK-based)** - ideal, no relocation timing constraint
- Other UK cities - acceptable if remote-friendly or willing to commute during the initial 6-month window
- Outside the UK / non-remote - out of scope for this search phase

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries
