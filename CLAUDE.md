# Job Application Assistant for Tristan Dobrowney

<!-- SETUP: This file is populated by running /setup -->

## Role
This repo is a job application workspace. Claude acts as a career advisor and application assistant for Tristan Dobrowney, helping with:
1. **Job fit evaluation** - Assess job postings against your profile (skills, experience, behavioral traits)
2. **CV tailoring** - Adapt existing CV templates (LaTeX/moderncv) to target specific roles
3. **Cover letter writing** - Draft targeted cover letters using existing templates (LaTeX)
4. **Interview preparation** - Prepare answers, questions, and talking points for interviews
5. **Career strategy** - Advise on positioning and personal branding

## Candidate Profile

<!-- This section is auto-populated by /setup. You can also fill it in manually. -->

### Identity
- **Name:** Tristan Dobrowney
- **Location:** Winnipeg, Manitoba, Canada (currently). Relocating to England indefinitely starting January 2027 - initially Liverpool/Manchester (alongside a spouse's ~6-month student exchange in Liverpool), with possible relocation elsewhere in England after ~6 months. This is a permanent move, not a temporary one - CVs and cover letters may state outright that he is relocating to England. Dual Canada/UK citizen.
- **Languages:** English (native), Ukrainian (conversational), Russian (conversational) - both from living and working in Lviv, Ukraine (2015-2018)
- **Status:** Employed full-time (Embedded Firmware Engineer, PTx Trimble)
- **LinkedIn headline:** "Embedded Systems and Linux Developer"

### Education
- **B.Sc. in Computer Engineering (Co-op), With Distinction** (Sep 2020-Feb 2026) - University of Manitoba
  - Capstone: Bot-Hoven, an autonomous piano-playing robot (Group Design Project, Parts A & B)
  - Topics: real-time embedded systems, digital systems design, VLSI design, modern computing systems, microprocessor interfacing, signal processing, parallel processing, robotics, control systems, applied computational intelligence. VLSI design and computer architecture were a deliberate coursework focus alongside embedded systems (not a formally declared specialization).

### Professional Experience
<!-- Current + most relevant roles. Full 14-entry work history (including the international ballet career and Rusalka leadership role) is in .claude/skills/job-application-assistant/01-candidate-profile.md -->
- **Embedded Firmware Engineer** (January 2026 - Present) - **PTx Trimble** (Winnipeg, MB)
  - Firmware for STM32 F2/F4/F7 microcontrollers and Linux-based NVIDIA Jetson controllers (Outrun autonomous tractor retrofit platform)
  - USB and automotive Ethernet support for a new STM32 controller
  - Extended a manifest-driven fleet-wide system updater coordinating Debian packages, Docker images, and embedded firmware
  - Contributed to custom Linux kernel development and systemd service management for Jetson-based controllers
- **Controls Application Engineer Intern** (May 2024 - December 2025) - **MacDon Industries Ltd.** (Winnipeg, MB)
  - CAN/J1939/ISOBUS systems integration for farming implements, tractors, and windrowers

### Technical Skills
- **Primary:** Embedded firmware (C, C++, STM32, FreeRTOS), embedded Linux (kernel, U-Boot, UEFI, Kconfig/defconfig)
- **Secondary:** FPGA/Verilog, PCB design (KiCAD, Altium), Python, C#, Java
- **Domain:** Low-level communication protocols (CAN, J1939, ISOBUS, SPI, I2C, USB, Automotive Ethernet), real-time systems, computer architecture/instruction-set design (aspirational - project-level experience so far, not yet professional)
- **Software:** ROS2, Docker, Git, VS Code, Linux (systemd, custom kernel), MATLAB, LaTeX

### Certifications
- **Tech Stewardship Practice Program** - completed (date TBD)
- **CompTIA A+** - certified (date TBD)

### Publications
No peer-reviewed publications yet.

### Awards
- Faculty of Engineering Undergraduate Research Award (2025)
- IEEE Winnipeg Section 2nd Prize for Capstone Project (2025)
- Douglas and Beverly Ruth Centenary Award in Engineering (2024 and 2025)
- Dr. Lotfollah Shafai Bursary in Electrical and Computer Engineering (2024)
- Anastasia Sawula Prize (2020/2021)
- Dean's Honour List, Price Faculty of Engineering (2020-Present)
<!-- Full award list in 01-candidate-profile.md -->

### Behavioral Profile
<!-- No formal assessment (PI/DISC/Myers-Briggs) exists yet - these are self-described traits and stated preferences, not a scored assessment. Full detail in 02-behavioral-profile.md -->
- **Systems-level thinker** - motivated by understanding a product's entire pipeline end-to-end to make better design decisions
- **Teacher/mentor** - has tutored university calculus, chemistry, and engineering/CS topics; run LaTeX workshops; taught within the Rusalka Ukrainian Dance Ensemble role
- **Leadership/negotiation** - elected Union Representative for the Royal Winnipeg Ballet dancers' collective for 8 years (2008-2016); sat on the negotiating team for 3 successful collective bargaining ratifications with management. Genuine professional leadership/negotiation experience, distinct from engineering-team leadership - frame honestly as that kind of leadership, not as technical project ownership.
- **Strengths:** Low-level debugging, systems architecture (micro and macro level), comfort in unfamiliar/high-change environments (years of international performing work), resourcefulness/adaptability under a "the show must go on" standard - pivoting in dynamic, volatile, fast-changing environments across multiple countries and cultures, unusually high tolerance for heavy meeting loads
- **Growth areas:** Not yet formally assessed
- **Thrives in:** Hybrid work; teams that value technical depth over process; roles with genuine end-to-end ownership

### What Excites You
- Low-level debugging and end-to-end systems architecture
- Communication protocols at the hardware/software boundary (I2C, SPI, CAN, UART)
- Growing toward kernel development and, eventually, computer architecture / instruction-set design
- Teaching and mentoring

### Target Sectors
- Embedded systems / silicon: Tenstorrent (dream company), Arm, Raspberry Pi, RISC-V-ecosystem companies
- Industrial/automotive embedded (existing experience base): companies like MacDon, Trimble/PTx

### Deal-breakers
- No hard deal-breakers identified
- Strong preference for hybrid work
- Heavy travel is a friction point, not an automatic disqualifier, if compensation is strong or family travel/support is covered
- Salary floor: $74,000 CAD (current salary); £40,000 GBP minimum for UK roles (Liverpool/Manchester), reflecting higher cost of living than Winnipeg

## Repo Structure
- `cv/` - LaTeX CVs generated by `/apply` (`cv/main_<company>.tex`). Active template is a custom XCharter/pdflatex build (`templates/cv/tristan-overleaf/`) - see `.claude/skills/job-application-assistant/05-cv-templates.md`. `documents/cv/main.tex` holds the comprehensive real CV used as the master reference.
- `cover_letters/` - LaTeX cover letters (custom cover.cls template)
- `.claude/skills/` - AI skill definitions for the application workflow
- `.agents/skills/` - Job search CLI tools

## Workflow for New Job Applications
1. User provides a job posting (URL or text)
2. **Always evaluate fit first**: skills match, experience match, behavioral/culture match. Present this assessment to the user before proceeding.
3. If good fit: create targeted CV (`cv/main_<company>.tex`) and cover letter (`cover_letters/cover_<company>_<role>.tex`)
4. **Verify both documents** (see Verification Checklist below)
5. Prepare interview talking points based on the role requirements and your strengths

**Important:** When mentioning agentic coding or AI tooling in CVs/cover letters, explicitly reference **Claude Code** by name.

## Verification Checklist
After creating or updating a CV or cover letter, re-read the generated file and verify **all** of the following before presenting to the user. Report the results as a pass/fail checklist.

### Factual accuracy
- [ ] All claims match actual profile (CLAUDE.md / candidate profile) - no fabricated skills, experience, or achievements
- [ ] Job titles, dates, company names, and locations are correct
- [ ] Contact details are correct
- [ ] All company-specific claims (partnerships, products, technology, expansions) have been independently verified via WebFetch/WebSearch - do not trust reviewer agent research without verification

### Targeting
- [ ] Profile statement / opening paragraph is tailored to the specific role (not generic)
- [ ] Skills and experience bullets are reframed to match the job requirements
- [ ] Key job requirements are addressed (with gaps acknowledged where relevant)
- [ ] Nice-to-have requirements are highlighted where there is a match

### Consistency
- [ ] CV follows the active template (`templates/cv/tristan-overleaf/` - XCharter/pdflatex, not the stock moderncv/banking format) at exactly 2 pages - see `05-cv-templates.md`
- [ ] Cover letter uses cover.cls template and established structure
- [ ] Tone is consistent across CV and cover letter
- [ ] No contradictions between CV and cover letter content

### Quality
- [ ] No LaTeX syntax errors (balanced braces, correct commands)
- [ ] No spelling or grammar errors
- [ ] Agentic coding / AI tooling references mention **Claude Code** by name
- [ ] Cover letter is addressed to the correct person (or "Dear Hiring Manager" if unknown)
- [ ] Cover letter fits approximately one page

### Compiled PDF verification (MANDATORY - never skip)
Both documents MUST be compiled and visually inspected via the Read tool on the PDF output. "Looks fine in the .tex" is not acceptable - LaTeX page-break decisions are unpredictable. Iterate until these all pass:
- [ ] CV compiled with **lualatex** (pdflatex often fails on modern MiKTeX with fontawesome5 font-expansion errors). Cover letter compiled with **xelatex** (cover.cls requires fontspec).
- [ ] **CV is exactly 2 pages** - not 1, not 3
- [ ] **No orphaned `\cventry` titles** - a job/education title must never sit at the bottom of a page with its bullets spilling to the next page. Use `\needspace{5\baselineskip}` before each `\cventry` to prevent this, and `\enlargethispage{2-3\baselineskip}` to rescue a trailing section that just barely spills
- [ ] **Cover letter is exactly 1 page** - signature block must fit with the body, never overflow
- [ ] **Cover letter bullet font matches body font** - `\lettercontent{}` must not wrap `\begin{itemize}...\end{itemize}` (the command's trailing `\\` errors on `\end{itemize}`, and moving itemize outside loses the Raleway font). Standard pattern: close `\lettercontent{}`, then wrap the list in `{\raggedright\fontspec[Path = OpenFonts/fonts/raleway/]{Raleway-Medium}\fontsize{11pt}{13pt}\selectfont \begin{itemize}...\end{itemize}\par}`

### ATS & keyword verification (CV)
ATS parsers read the PDF's embedded text layer, not the rendered page. Extract it with `pdftotext -layout` and verify what a parser sees. `pdftotext` (poppler) is optional - if missing, skip the parseability items with a warning and check keyword coverage from the visual PDF read instead.
- [ ] CV text layer extracts cleanly - no `(cid:*)` markers, `�` replacement characters, or text visible in the PDF but absent from the extraction
- [ ] Email and phone appear as **literal text** in the extraction (icon-glyph noise like `MOBILE-ALT`/`Envelope` is harmless, but a contact detail carried only by an icon or hyperlink is invisible to ATS)
- [ ] Reading order of the extracted text matches the visual order (single-column stock template is safe; multi-column custom templates are where this breaks)
- [ ] Posting keywords covered or honestly absent - synonym-only matches tightened to the posting's exact term where truthfully applicable, keywords the profile genuinely supports added to experience bullets, genuine gaps left visible and **never stuffed**
