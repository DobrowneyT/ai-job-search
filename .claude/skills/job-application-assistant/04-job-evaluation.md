# Job Evaluation Framework

<!-- SETUP: Skill match areas and career goals are personalized by running /setup -->

## Scoring Dimensions

Evaluate each job posting against these five dimensions:

### 1. Technical Skills Match (0-100)
How well do the required/preferred skills align with the candidate's capabilities?

| Score | Meaning |
|-------|---------|
| 80-100 | Core requirements are primary skills |
| 60-79 | Most requirements match, 1-2 gaps that are learnable |
| 40-59 | Partial match, significant upskilling needed |
| 0-39 | Fundamental mismatch |

**Strong match areas:** Embedded firmware (STM32, FreeRTOS), embedded Linux (kernel, U-Boot, UEFI, Kconfig/defconfig), CAN/J1939/ISOBUS and other low-level comms protocols (I2C, SPI, UART, USB), FPGA/Verilog, C/C++, real-time systems
**Moderate match areas:** Full PCB/hardware design and bring-up (genuinely strong experience from the UManitoba research role, but see Motivation Filter below - not his preferred day-to-day work even where he's qualified); Java (listed as a skill but no bullet demonstrates applied use - see Calibration note above)
**Weak match areas:** Professional (paid) computer-architecture / instruction-set-design experience and ASIC design-flow tooling - genuine aspiration and project-level exposure (a 16-bit processor designed in the "Modern Computing Systems" course) but not yet professional experience. Acknowledge this gap honestly rather than overstating fit for Computer Architect / ASIC roles.

### 2. Experience Match (0-100)
Does work history align with what they're looking for?

| Score | Meaning |
|-------|---------|
| 80-100 | Direct experience in the same domain and role type |
| 60-79 | Related experience, transferable skills clear |
| 40-59 | Adjacent experience, would need to make the case |
| 0-39 | Unrelated experience |

**Strong:** Embedded firmware development, real-time systems, hardware-software integration, automotive/industrial embedded (PTx Trimble, MacDon), low-level communication protocols
**Moderate:** Embedded Linux/kernel work (actively growing at PTx Trimble - U-Boot, UEFI, kernel config), full PCB/hardware bring-up (strong experience, lower motivational fit)
**Entry-level:** Computer architecture / instruction-set-architecture roles, ASIC/FPGA Design Engineer roles at chip companies - project-level exposure only (16-bit processor coursework project), no professional experience yet

### 3. Behavioral/Culture Fit (0-100)
Does the role and company culture match the behavioral profile?

| Score | Meaning |
|-------|---------|
| 80-100 | Culture strongly matches behavioral preferences |
| 60-79 | Mixed signals but mostly compatible |
| 40-59 | Some friction areas |
| 0-39 | Significant culture mismatch |

**Red flags to research:** Department disorganization, work dominated by maintenance over development, poor chemistry with leadership, culture mismatches. Check reviews, media coverage, LinkedIn connections, and network contacts for insider perspective.

### 4. Location & Logistics (Pass/Fail + Notes)
- Within commute range: PASS
- Remote with occasional office: PASS
- Requires relocation: FAIL (deal-breaker)
- Frequent international travel: FLAG (discuss with user)

### 5. Career Alignment & Motivation (0-100)
Does this role advance career goals and contain tasks that energize?

| Score | Meaning |
|-------|---------|
| 80-100 | Strongly aligned with career direction, clear growth path |
| 60-79 | Good role but only partially aligned with long-term goals |
| 40-59 | Decent job but doesn't build toward career goals |
| 0-39 | Dead end or backwards step |

**Career goals:**
- Move toward roles closer to the hardware/software boundary: kernel development, low-level embedded work, and ideally CPU instruction set architecture / silicon-adjacent engineering (this is what drew the Arm application specifically)
- Relocate to the UK (Liverpool/Manchester area) starting around January 2027, alongside a spouse's ~6-month student exchange, with a longer-term goal of settling there permanently
- Near-term (through end of 2026): open to Winnipeg/Canada-based or remote roles that build toward the above, not just any embedded job

**Motivation filter:** Evaluate not just whether you *can* do the tasks, but whether the tasks will *energize* you. Consider:
- Tasks that energize: low-level debugging; end-to-end systems architecture (understanding the full product pipeline to make better design decisions); micro- and macro-level architecture/design work; low-level communication protocols (I2C, SPI, CAN, UART); teaching and mentoring (has run LaTeX workshops, tutored calculus/chemistry/CS/engineering topics at university, and taught within Rusalka)
- Tasks that drain: working with people who aren't engaged or don't understand the problem (not meetings specifically - heavy meeting loads are explicitly fine); hardware bring-up / PCB-layout-heavy work as the primary focus (has strong experience here from the UManitoba lab role but would rather be writing the real-time firmware/sensor-logging code than doing the board design itself)
- Non-task factors: hybrid work strongly preferred; heavy travel is a friction point but not an automatic disqualifier if compensation is strong or family travel/support is covered (e.g. flights or a nanny)

**Life situation alignment:** Consider personal constraints:
- **Security**: Current salary is $74,000 CAD - treat as an absolute floor for any move. For UK roles (Liverpool/Manchester), minimum target is £40,000 GBP, reflecting higher cost of living than Winnipeg.
- **Flexibility**: Hybrid work is ideal. Planning a UK relocation around January 2027 (spouse's ~6-month student exchange in Liverpool), with a longer-term goal of settling in the UK permanently. No major hard deal-breakers identified otherwise.
- **Professional development**: Growth toward kernel development, embedded Linux, and ultimately computer-architecture/instruction-set-design work (dream companies: Tenstorrent, Arm, Raspberry Pi, RISC-V-ecosystem)

### 6. Salary Benchmark (Optional)

If the salary lookup tool is configured (`salary_data.json` exists), look up the company:
```
python salary_lookup.py "<Company Name>" --json
```

If a city is known from the posting, add `--city "<City>"` to narrow results.

Present findings as:
```
### Salary Benchmark
| Metric | Value |
|--------|-------|
| [Category] index | XX.X (+/-X.X% vs baseline) |
| Overall index | XX.X (+/-X.X% vs baseline) |
```

Interpret results relative to the baseline defined in the data file's metadata. For index-based data, higher typically means above-market compensation.

If the salary tool is not configured, skip this section.

## Output Format

Present the evaluation as:

```
## Job Fit Evaluation: [Role] at [Company]

| Dimension | Score | Notes |
|-----------|-------|-------|
| Technical Skills | XX/100 | [brief note] |
| Experience Match | XX/100 | [brief note] |
| Behavioral Fit | XX/100 | [brief note] |
| Location | PASS/FAIL | [brief note] |
| Career Alignment | XX/100 | [brief note] |

**Overall Score: XX/100** (weighted average of scored dimensions)

### Verdict: [Strong Fit / Good Fit / Moderate Fit / Weak Fit / Poor Fit]

### Key Strengths for This Role
- [bullet points]

### Gaps to Address
- [bullet points]

### Recommendation
[1-2 sentences: apply/skip/apply with caveats]

### Company Research Checklist
- [ ] Checked company website (mission, values, recent news)
- [ ] Checked review sites (Glassdoor, Jobindex, etc.)
- [ ] Checked LinkedIn for team size, recent hires, connections
- [ ] Checked media for restructuring, growth, or workplace issues
- [ ] Identified network contacts who may know the team/manager
```

## Calibration from Past Applications

<!-- Populated by /setup from documents/applications/. Single data points are labeled as such - not yet confirmed patterns (need 2+ similar outcomes). -->

- **Arm Ltd. - Debugger Software Engineer (Manchester, UK), rejected pre-interview (June 2026), single data point:** The posting required practical Java experience. The candidate's CV lists Java as a skill but no bullet anywhere demonstrates applied Java work - possible signal that a skill listed without concrete supporting evidence may not clear initial screening. Watch for this pattern repeating on future rejections.
- **Candidate's own reflection on this outcome:** the CV and cover letter should mirror the specific posting's language and emphasized requirements more closely, rather than leading with general embedded-systems framing.

## Weighting
- Technical Skills: 30%
- Experience Match: 25%
- Behavioral Fit: 15%
- Career Alignment: 30%

(Location is pass/fail, not weighted)

## Thresholds
- **Strong Fit** (75+): Definitely apply, tailor everything
- **Good Fit** (60-74): Apply, address gaps in cover letter
- **Moderate Fit** (45-59): Consider carefully, discuss with user
- **Weak Fit** (30-44): Probably skip unless strategic reasons
- **Poor Fit** (<30): Skip

## Pre-Application: Call the Employer (Best Practice)

Before writing the application, consider whether the candidate should call the contact person listed in the posting. **Only call if there are substantive questions** - never call just to "be remembered."

### When to Suggest Calling
- The posting has unclear or ambiguous requirements
- It's unclear which competencies are essential vs. nice-to-have
- The role description is vague about day-to-day tasks
- There's a named contact person who invites questions

### Good Questions to Ask
- "What are the primary challenges in this role?"
- "How is time typically divided across the listed responsibilities?"
- "Which competencies are most critical for success in this position?"
- "What does success look like in the first 6-12 months?"

### Rules for the Call
- Prepare a 30-second "elevator pitch" about your background in case they ask
- The call's purpose is **gathering information**, not delivering a pitch
- Take notes - use what you learn to tailor the application
- Reference the conversation naturally in the cover letter ("After speaking with [name], I was especially drawn to...")
