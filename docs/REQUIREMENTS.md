# Requirements checklist

Extracted from the official statement in [CHALLENGE.md](CHALLENGE.md). Each row is traced to a
visible feature in the README traceability table. Status as of 2026-11-12 (where each item is visible: README traceability table):
`[x]` met, `[~]` partly met (see note), `[ ]` not done.

## A. Objectives (what the challenge says the tool must do)

| ID | Requirement (quoted or closely paraphrased) | Status |
|----|----------------------------------------------|--------|
| A1 | "Build a health monitoring software that **gathers health indicators**" | [x] |
| A2 | "Enables astronauts to **evaluate** … the status of their health" (self-assessment, no ground needed) | [x] |
| A3 | "Enables astronauts to … **act on** the status of their health"; "provides guidance on treatments and health improvements" | [x] |
| A4 | "Create a **visual tool**" | [x] |
| A5 | Gather data through any input: "keyboard text, mouse clicks, or camera images" | [~] taps, numbers, file import and a live sensor are supported; camera images are not |
| A6 | Data must "represent a health indicator" (units stated, e.g. "blood sugar levels in mg/dL") | [x] |
| A7 | Indicators the statement names as useful: **blood pressure, heart rate, blood sugar, body temperature, daily sleep hours, mood** | [x] |
| A8 | Address the health problems named: immune changes, bone density loss, cardiovascular events, inadequate nutrition, behavioral health conditions | [x] |
| A9 | Ground the design in the **five hazards** (radiation, isolation and confinement, distance from Earth, gravity fields, hostile closed environments) | [x] |
| A10 | Use NASA Human Research Program resources and other agencies' public resources to choose indicators | [x] |

## B. Guiding questions (the statement says these are "worth considering")

| ID | Question | Status |
|----|----------|--------|
| B1 | Which measurements can be performed in space? | [x] |
| B2 | Why is an exam needed? | [x] |
| B3 | How do spaceflight hazards affect these health indicators? | [x] |
| B4 | When might a result warrant attention from the crew or from flight surgeons on the ground? | [x] |
| B5 | What actions can be taken to prevent a critical health condition? | [x] |
| B6 | UI presents "metrics and diagnosis clearly"; consider animations and interactivity | [x] |
| B7 | Example given: "a human figure where each part of the body is clickable and displays information about its function and health status" | [x] |

## C. Potential considerations (optional per the statement)

| ID | Consideration | Status |
|----|---------------|--------|
| C1 | Health insights in different environments: spacecraft, space station, rover, base on another planet or moon | [x] |
| C2 | Prompt astronauts to take measurements or complete actions as part of the mission routine | [x] |
| C3 | Gamification that helps astronauts engage with health-supporting tasks | [~] a streak and a weekly exercise ring; deliberately light |
| C4 | Dynamic charts of indicators over time | [x] |
| C5 | Color coding to interpret status at a glance | [x] |
| C6 | Do not assume astronauts know how to assess their health: simple instructions and explanations for measurements, indicators and risks | [x] |

## D. Listed resources

The Resources tab read "Resources will be available on Friday, November 13" when retrieved on
2026-11-12, so no official resource could be listed. The statement itself points to:

| ID | Resource | Status |
|----|----------|--------|
| D1 | NASA Human Research Program resources (five hazards, risk list) | [x] |
| D2 | Publicly available resources from other space agencies | [~] ESA sources are cited for lunar light time; ESA and other agency archives were surveyed but had no open data (docs/DATA.md) |
| D3 | Official Resources tab items (published 2026-11-13) | [ ] human step: the tab opens on 2026-11-13 |

## E. Team-imposed requirements (from the project brief, beyond the statement)

| ID | Requirement | Status |
|----|-------------|--------|
| E1 | Works with no connection to Earth; all detection on-device; offline proven by automated test | [x] |
| E2 | Personal baselines; microgravity adaptation not flagged as illness | [x] |
| E3 | Detection measured on real labeled data with false-alarm rates and intervals | [x] illness only; other event types are tested in simulation |
| E4 | Simulation clearly labeled wherever shown | [x] |
| E5 | Rule-based, auditable alert-to-action with cited countermeasures and escalation tiers | [x] |
| E6 | Crew member owns data; per-role sharing with access log | [x] |
| E7 | Privacy-preserving crew readiness view | [x] |
| E8 | Link status with delay/blackout and queued medical summary; link-cut demo control | [x] |
| E9 | Mission replay showing detection, explanation, action in under a minute | [x] |
| E10 | Decision support, not a diagnostic device, stated in the app | [x] |
