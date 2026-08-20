# Candidate Profile

<!-- SETUP: This file is populated by running /setup -->
<!-- This is the exhaustive master record. Tailored CVs (cv/main_<company>.tex) pull a relevant subset - they do not need every entry below. -->

## Identity
- **Name:** Tristan Dobrowney
- **Location:** Winnipeg, Manitoba, Canada
- **Phone:** (306) 880-2917
- **Email:** dobrownt@myumanitoba.ca
- **LinkedIn:** https://www.linkedin.com/in/tristandobrowney-68b3ba161
- **GitHub:** https://github.com/DobrowneyT
- **Languages:** English (native); Ukrainian (conversational); Russian (conversational) - both from living and working in Lviv, Ukraine (2015-2018)
- **Status:** Employed full-time (Embedded Firmware Engineer, PTx Trimble, Winnipeg). Dual Canada/UK citizen.
- **Constraints:** Relocating to England indefinitely starting January 2027 - a permanent move, not tied to a fixed return date. Initially Liverpool/Manchester (wife is doing a ~6-month student exchange in Liverpool starting January 2027), with possible relocation elsewhere in England after ~6 months. CVs and cover letters may state outright that he is relocating to England. Near-term (through end of 2026), open to Winnipeg/Canada-based or remote roles.

## Education

| Degree | Period | Institution | Key Topics |
|--------|--------|-------------|------------|
| B.Sc. in Computer Engineering (Co-op), With Distinction | Sep 2020 - Feb 2026 | University of Manitoba | Real-time embedded systems, digital systems design, VLSI design, modern computing systems, microprocessor interfacing, signal processing, parallel processing, robotics, control systems, applied computational intelligence. VLSI design and computer architecture were a deliberate coursework focus alongside embedded systems (confirmed 2026-08-09) - not a formal declared specialization/concentration, just where his elective/technical coursework concentrated. |

Capstone: Bot-Hoven autonomous piano-playing robot (Group Design Project, Parts A & B) - see Independent Projects.

## Professional Experience

### Embedded Firmware Engineer - PTx Trimble (January 2026 - Present)
Winnipeg, MB
- Developed firmware for STM32 F2/F4/F7 microcontrollers and Linux-based NVIDIA Jetson controllers as part of the Outrun autonomous tractor retrofit platform
- Implemented USB interface and automotive Ethernet support for a new STM32 controller, expanding system connectivity
- Extended and hardened a bespoke system updater tool that manages fleet-wide software deployments via a manifest file, coordinating Debian package updates, Docker image upgrades, embedded controller firmware, and peripheral configuration without full image rebuilds
- Contributed to custom Linux kernel development and system maintenance for Jetson-based controllers, including systemd service management and log diagnostics
- Maintained and extended internal development tooling built in C#, Vue, and JavaScript
- Builds wire harnesses for prototyping and bench-level integration across STM32/Jetson controllers (not production harness design/ownership - integrates with the vehicle harness rather than owning its design); the fleet updater communicates device status over MQTT alongside its manifest-driven package/firmware coordination; some light development work on the cloud side of the fleet system (minor, not a primary responsibility). No direct experience with perception models/ML sensor pipelines - confirmed as a genuine gap, do not claim this.

### Co-Artistic Director - Rusalka Ukrainian Dance Ensemble (January 2022 - July 2025)
Winnipeg, MB
<!-- NEW from LinkedIn - no bullets available from any source yet. Add 2-3 achievements/responsibilities for this role before using it in an application. -->

### Undergraduate Research Assistant - UManitoba Electromagnetic Imaging Lab (May - December 2025)
Winnipeg, MB (full-time May-Aug; 20h/week Sep-Dec)
- Designed full PCB schematics and layouts for prototype and final-production magnetic field sensor hardware, including full routing and pinout ownership
- Selected and sourced all components, managing part evaluation and procurement through to functional prototypes - including IP68-rated connectors, required because the sensor was deployed outdoors in harsh conditions
- Iterated through multiple hardware revisions, validating performance at each stage from bench testing through final qualification

### Controls Application Engineer Intern - MacDon Industries Ltd. (May 2024 - December 2025)
Winnipeg, MB (full-time May-Aug 2024; 20h/week Sep 2024-Dec 2025)
- Developed custom plotter and statistical analysis tool for J1939 trace files
- Implemented systems integration solutions using CAN, J1939, and ISOBUS communication protocols
- Optimized legacy codebase performance through refactoring in Lua, IQAN, and Crank IDE environments

### Embedded Design Assistant - Price Electronics (May - August 2023)
Winnipeg, MB
- Reverse-engineered and documented control algorithms for current and legacy embedded products
- Designed and prototyped novel airflow sensor solutions from concept through functional testing
- Developed automated test frameworks and generated calibration curves for sensor validation

### Vice-Stick Corporate Relations / Director of Electronic Communications - UMES (2021 - Present)
Winnipeg, MB
- Successfully implemented a strategy to secure $20,000 in sponsorship funding
- Established and maintained positive relationships with industry professionals
- Designed and managed the development of a new website for UMES

### Command and Data Handling Systems Member - UMSATS (2021 - 2023)
Winnipeg, MB
- Programmed a module in C to send timestamps from the satellite to the ground as requested
- Participated in workshops on Libero, SoftConsole, C, GitHub, CANBus, FreeRTOS
- Performed unit tests to ensure individual methods work as intended

### Undergraduate Research (NSERC) - UManitoba Electromagnetic Imaging Lab (May - September 2022)
Winnipeg, MB
- Developed embedded firmware for microcontroller communication using SPI and I2C protocols
- Designed and prototyped innovative hail monitoring device with potential patent application
- Collaborated with research team on electromagnetic imaging applications for weather monitoring systems

### HVAC Technician - Synoptic Heating and Cooling (March - September 2021)
Winnipeg, MB
- Installed and commissioned HVAC systems in residential and commercial construction projects
- Executed electrical installations following National Electrical Code standards and safety protocols
- Demonstrated versatility working both independently and in collaborative team environments

### Soloist - Royal Winnipeg Ballet (July 2019 - September 2020)
Winnipeg, MB
- Maintained principal artist roles through disciplined performance improvement and goal achievement
- Adapted performance techniques based on constructive feedback from artistic directors and peers
- Developed creative problem-solving skills through artistic interpretation and technical execution

### Professional Dancer - Atlantic Ballet Atlantique Canada (October 2018 - May 2019)
Moncton, New Brunswick
<!-- NEW from LinkedIn - no bullets available yet. Add 2-3 achievements/responsibilities if this role should be usable in an application. -->

### Principal Dancer - Lviv National Opera and Ballet (July 2016 - September 2018)
Lviv Region, Ukraine
<!-- NEW from LinkedIn - no bullets available yet. Add 2-3 achievements/responsibilities if this role should be usable in an application. -->

### Assistant Director - Rozmai Ukrainian Dancers (September 2013 - May 2016)
Winnipeg, MB
<!-- NEW from LinkedIn - no bullets available yet. Add 2-3 achievements/responsibilities if this role should be usable in an application. -->

### Professional Dancer - Royal Winnipeg Ballet (July 2008 - May 2016)
Winnipeg, Canada Area
- Served as Union Representative for the dancers' collective for the full 8-year tenure, acting as the elected liaison between the company and management
- Sat on the negotiating team for 3 successful collective bargaining ratifications with management, representing dancer interests directly at the table
- Adapted to touring across multiple countries and cultures (including performing internationally), working effectively with unfamiliar teams, venues, and last-minute changes under a "the show must go on" standard - real-time problem-solving and resourcefulness were not optional

## Independent Projects

- **Bot-Hoven: Autonomous Piano-Playing Robot (Capstone)** - https://www.youtube.com/@Bot-hoven
  - Architected ROS2 hardware interface layer supporting 20+ actuators with sub-millisecond timing precision
  - Designed modular hardware abstraction layer integrating servo controllers, stepper drivers, and GPIO expanders
  - Implemented batch communication protocols reducing I2C transaction overhead by 60%
  - Developed real-time control systems for coordinated multi-actuator piano performance
- **CAN Trace Plotter and Analyzer** (MacDon Industries Ltd.)
  - Developed Python desktop application using PyQt6 for visualizing automotive CAN bus communication traces
  - Implemented multi-format file parsing supporting .trc, .asc, .bfl, and .csv trace files with DBC database integration
  - Created drag-and-drop interface with up to 4 simultaneous plot displays and statistical analysis tools
  - Delivered production-ready executable reducing manual diagnostic workflows for system debugging
- **TeaMate: Autonomous Tea-Making Robot** - https://github.com/DobrowneyT/teamate
  - Designed 3-DOF robotic arm with Arduino Mega 2560 implementing inverse kinematics and PID control
  - Developed C++ embedded systems with real-time sensor fusion and trajectory planning algorithms
  - Achieved sub-millimeter positioning accuracy through automatic calibration and encoder feedback systems
  - Integrated 5+ sensor types for autonomous brewing sequence with collision avoidance and safety features
- **16-bit Processor Design** (Modern Computing Systems coursework, ECE 4560)
  - Designed and implemented a parametrized, single-cycle ("flow-through") 16-bit RISC processor in Verilog on an Altera DE-10 FPGA, with full fetch/decode/execute/memory/write-back datapath and condition-code branch resolution (BEQ/BGT/BHI/BLO/BNE/BRA against N/Z/V/C flags)
  - Genuinely parametrized for width: ALU, register file, and memory widths are all set from one data-width parameter, decoupled from the instruction encoding, so extending the datapath to 64-bit is a small, contained change (verified directly against the source - `alu.v`, `regFile.v`, `memFile.v`, `mux41.v`, `SignExtender.v` are all cleanly parameter-driven)
  - **Correction (2026-08-01):** the course covered pipelining and branch prediction as theory/exercises, but neither was implemented in this project - confirmed by reading the actual Verilog source (`Controller.v`'s own header reads "Flow-Through Architecture"; single ALU; no pipeline registers between stages; `branchController.v` is a plain combinational condition evaluator, not a predictor). An earlier profile version incorrectly stated these were implemented, based on a mistaken recollection - do not use that claim in any future application or interview prep. The defensible, honest framing: the design's clean stage separation and Harvard-style instruction/data memory split make it a strong base to *explain how you would* add pipelining (stage registers, forwarding/stalling for data hazards, stall-or-flush for control hazards given no predictor), which is itself a legitimate demonstration of depth - just don't claim it was built.
  - Directly relevant project evidence for computer-architecture / instruction-set-design career goals - the strongest concrete example on file for that direction, particularly for the parametrization/scalability story, which is fully verified and safe to use confidently.
- **Teaching / Tutoring / LaTeX Workshops** <!-- needs dates and format (was this a formal university TA role, private tutoring, ad hoc peer help?) before this can be dated/formalized as an entry -->
  - Tutored university-level calculus, chemistry, and other engineering/computer science topics
  - Ran several LaTeX workshops for students
  - Also active within Rusalka's teaching context (see Co-Artistic Director role above)

## Technical Skills

### Programming
- C, C++, C#, Java, Python, Verilog, MATLAB, LaTeX

### High-Performance Computing
- MPI, CUDA, OpenMP

### Hardware Design
- FPGA, Microcontrollers, PCB Design (KiCAD, Altium), Circuit Design, Verilog

### Communication Protocols
- CAN, J1939, ISOBUS, SPI, I2C, USB, Automotive Ethernet

### Software & Tools
- ROS2, Linux (systemd, custom kernel development), Embedded Linux (U-Boot, UEFI, kernel configuration via Kconfig/defconfig), Docker, VS Code, Git, Fusion360

### Operating Systems
- Windows, macOS, Android, Linux (NVIDIA Jetson, STM32)

## Certifications
- Tech Stewardship Practice Program - completed (date not specified on LinkedIn - confirm if relevant)
- CompTIA A+ - certified (date not specified on LinkedIn - confirm if relevant)

## Publications
No peer-reviewed publications yet.

## Awards
- Faculty of Engineering Undergraduate Research Award - 2025
- IEEE Winnipeg Section 2nd Prize for Capstone Project - 2025
- Douglas and Beverly Ruth Centenary Award in Engineering - 2024 and 2025 (received in both the 2023/2024 and 2024/2025 aid years per official transcript)
- Dr. Lotfollah Shafai Bursary in Electrical and Computer Engineering - 2024
- Amanda Hancox Award - 2023
- Easton I. Lexier Award for Community Leadership - 2023
- Faculty of Engineering NSERC Undergraduate Student Research Award - 2022
- Peter F Bronfman Memorial Award - 2022
- Anastasia Sawula Prize - 2020/2021 (from official transcript; not previously on CV)
- Dean's Honour List, Price Faculty of Engineering - 2020 - Present

## References
- [NAME], [TITLE], [COMPANY] ([EMAIL], [PHONE])

None yet on file - `documents/references/` is empty. More references available upon request.
