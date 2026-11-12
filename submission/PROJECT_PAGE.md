# Keel — project page text

Copy each section into the matching field of the Space Apps project page.

**Project name:** Keel
**Challenge:** Create Health Monitoring Software for Astronauts on Space Missions
**Live demo:** https://aarav-agarwal331.github.io/keel-crew-health/
**Code:** https://github.com/aarav-agarwal331/keel-crew-health

---

## High-level summary

On the International Space Station a flight surgeon is seconds away by voice and speaks with each
crew member every week. On the way to Mars a signal takes up to about 24 minutes each way and
sometimes there is no link at all, so the crew must notice and act on health changes themselves. Keel is a crew health monitor that needs
no connection to Earth. It runs entirely on the crew member's own tablet, learns that person's own
normal for seventeen indicators, notices when readings drift, explains what changed in plain language,
and recommends one specific action tied to a documented countermeasure. The crew member owns the data
and chooses what the medical officer, the commander and the ground may see. We measured how well it
works on real wearable data from 251 people and report the result with false-alert rates, uncertainty
and its limits, inside the app.

## Project details

### What it does

- **Today.** One status (steady, worth a look, act today, act now), the two or three readings that
  changed, and a single recommended action. A clickable body figure shows each body system's status
  and why spaceflight affects it.
- **Trends.** Every indicator against the person's own usual range over two weeks, eight weeks or the
  mission, with alerts and gravity changes marked.
- **Alert detail.** What changed, how unusual it is for this person, what in their own recent data may
  be contributing, the recommended action with steps, how soon and who should know, the sources
  behind the advice, an audit trail of the exact rule and scores, and a log of what the crew member
  did and how they feel afterwards.
- **Check-in.** Four quick answers in about a minute (mood, symptoms, fluids, food), with red-flag
  symptoms set apart; optional extras: a reaction self-test, exercise, and spot measurements (blood
  pressure, thermometer temperature, oxygen, blood sugar in mg/dL, body mass) with "how to measure"
  instructions.
- **Safety rules.** A red-flag symptom or a single reading beyond a sourced threshold (for example a
  fingertip oxygen reading of 92% or lower) is acted on at once, without waiting for a trend.
- **Sharing.** Per role and per body system, four levels from private to full detail, with a preview of
  exactly what each role sees and an access log.
- **Crew readiness.** Before a demanding task such as a spacewalk the commander sees whether Keel has
  flags for each crew member, without the reasons unless the crew member shares them. It is an input
  to medical clearance, not a clearance.
- **Earth link.** The current simulated signal delay or blackout, what is queued for the ground, and a
  control that cuts the link so you can see that nothing stops working.
- **Mission replay.** A scripted health event on a simulated Mars transit, played in seconds: the
  readings drift, Keel alerts, explains and recommends.
- **Validation and method.** Results, method and limitations written for a non-specialist.

### How it works

Each person's baseline for each indicator is the median of their own previous four weeks, with a
robust measure of spread. Launch and landing are treated as expected changes: the baseline follows a
published adaptation curve and widens its band until the person's own new data takes over. Daily
deviations feed a multivariate detector that reacts to several small changes in a worrying direction.
Alert thresholds are not chosen by feel. They are set so that, on people the model has never seen, a
notice fires by mistake at most once per person-month and an alert at most once per four
person-months, because alarm fatigue is an operational hazard. A fixed table of 32 rules
turns a pattern, an entered reading or a reported symptom into wording, one action, follow-up steps,
how soon and who, each citing a NASA document, a published study or public clinical guidance. No
language model writes any advice.

### How it addresses the challenge

The challenge asks for software that gathers health indicators and lets astronauts evaluate and act on
their health. Keel gathers the indicators the statement names (blood pressure, heart rate, blood sugar,
body temperature, sleep hours, mood) and others chosen from NASA's Human Research Program material on
the five hazards. It answers the statement's guiding questions directly in the interface: which
measurements can be made in space and how, why each matters, how the hazards affect it, when a result
needs the crew medical officer or a flight surgeon, and what action prevents a worse outcome. It
includes the suggested clickable human figure, dynamic charts, colour coding that never relies on
colour alone, routine prompts, light gamification, plain-language instructions, and two environments
(Mars transit and lunar surface). A requirement-by-requirement table is in the repository README.

### What makes it different

Most health dashboards assume someone on Earth is watching. Keel assumes nobody is. It is built
around the communication gap, proves offline operation with an automated test, treats false alarms as
a design constraint with a measured budget, gives ownership of the data to the crew member, and
publishes its own validation, including where a simpler method does as well.

## Use of data and tools

**Real data (downloaded by `make data`; not redistributed):**

- Stanford COVID-19 wearables, phase 1. Mishra T, Wang M, Metwally AA, et al. Pre-symptomatic detection
  of COVID-19 from smartwatch data. Nat Biomed Eng 4, 1208–1220 (2020).
  https://doi.org/10.1038/s41551-020-00640-6
- Stanford COVID-19 wearables, phase 2 (all 84 positives and 120 other participants). Alavi A, Bogu GK,
  Wang M, et al. Real-time alerting system for COVID-19 and other stress events using wearable data.
  Nat Med 28, 175–184 (2022). https://doi.org/10.1038/s41591-021-01593-2
- LifeSnaps. Yfantidou S, Karagianni C, Efstathiou S, et al. LifeSnaps, a 4-month multi-modal dataset
  capturing unobtrusive snapshots of our lives in the wild. Sci Data 9, 663 (2022).
  https://doi.org/10.5281/zenodo.7229547 (CC BY 4.0)
- NASA Life Sciences Data Archive, public head-down-tilt bed-rest campaigns (daily vitals of 29
  volunteers), via the NASA Life Sciences Portal. https://nlsp.nasa.gov/

**NASA and space agency resources used for the design** (62 sources opened, listed with links in
`docs/DOMAIN.md` and in the app under How Keel works → Sources), including NASA Human Research Program
"5 Hazards of Human Spaceflight" and "The Human Body in Space"; the Human Research Roadmap risk pages;
NASA-STD-3001 Volume 1 sections 4 and 6; NASA's Earth-Independent Medical Operations concept of
operations; NASA Space Radiation Analysis Group; ESA lunar communication figures; Barger et al. 2014
(sleep in spaceflight); Law et al. 2014 (CO2 and headache on the ISS); Zeitlin et al. 2013 and Zhang et
al. 2020 (radiation in transit and on the lunar surface).

**What we looked for and could not use:** NASA's Open Science Data Repository has no human wearable
time series; in-flight actigraphy and cognition data in the NASA Life Sciences Data Archive are
available on request only; Inspiration4 open data is omics and blood panels. This is documented in
`docs/DATA.md`.

Public clinical reference values (MedlinePlus, U.S. National Library of Medicine) are used for the
fixed safety thresholds and are cited in the app.

**Tools:** TypeScript, React, Vite, IndexedDB, Web Workers, Service Worker, Web Bluetooth; Python with
NumPy, pandas, SciPy and scikit-learn; Vitest, pytest and Playwright for tests; GitHub Pages for
hosting. No NASA logos or insignia are used. Keel is not affiliated with or endorsed by NASA.

## Validation results

All numbers come from scripts in the repository and are shown in the app with their method.
Detection is reported **above luck**: at one false alert per person-month an alert falls inside a
two-week window by chance about a third of the time, so we measure that with pretend events and
subtract it.

**Real data: 251 people, 37,234 person-days, 107 dated illness episodes, held-out people.**

| At a budget of | Keel flags | By luck | Keel above luck (95% interval) | One threshold for everyone, above luck |
|---|---|---|---|---|
| 1 false alert per person-month | 66% | 36% | **+30 points** (20 to 40) | +17 (7 to 27) |
| 0.25 per person-month, with daily steps | 43% | 11% | +32 (22 to 42) | +9 (3 to 17) |
| 0.25 per person-month, with the 7-day activity average the app uses | 23% | 11% | +12 (3 to 20) | |

- Keel's advantage over a fixed threshold, above luck: +14 points (interval 0 to 28) at the first
  budget.
- A simple personal rule (two of three days outside the personal range) is nearly as good: +27
  (17 to 38). At the first budget the four personal-baseline detectors cannot be told apart.
- Thresholds trained on one cohort hold on the other: trained on phase 1 and tested on phase 2,
  +29 above luck with 0.87 false alerts per person-month; the reverse, +36 with 1.11.
- Measured false alerts match the budget (0.99 against 1.00) when thresholds come from other real
  people. Thresholds calibrated only in simulation ran over budget on real people (1.38).
- Heart rate alone is +17 above luck; daily steps add the rest, largely because people move less once
  they feel ill.

**NASA bed-rest analog data (29 volunteers).** After getting up from weeks of head-down bed rest, a
plain personal baseline flags the pulse of 9 of 14 volunteers; Keel's handling of the transition
flags 4 (exact paired test p = 0.06).

**Simulated missions (100 test missions of four crew, 284 person-events, full sensor set).** 67%
flagged (60 to 73%) against 40% by luck: +26 points (20 to 33). Handling the launch transition halves
false alerts in the first month of flight (0.89 against 1.97 per person-month). The simulator's noise,
its correlations between indicators and its illness response are fitted to real data on one half of
the people and checked on the other half; it passes six of nine pass marks and we report the three it
fails.

## Limitations

- **No early warning.** On real data the alert usually starts on or just after the day symptoms
  begin: 39% of episodes had an alert start in the ten days up to onset, and luck gives 29%.
- **Most alerts are false.** At the in-flight rate of respiratory illness, between one alert in 11 and
  one in 28 at the strict tier would be a real illness. An alert is a prompt to look, not a verdict.
- **Ground data stands in for spaceflight data.** No open astronaut wearable time series exists. The
  people in the real evaluation were on Earth, wore consumer watches and mostly had COVID-19, and
  much of the signal is their change in activity, which cannot be separated from isolation at home.
- **Only illness is tested on real data,** with heart rate and steps. Sleep loss, cabin CO2,
  deconditioning, dehydration and low mood, and the contribution of HRV, oxygen, temperature and
  check-ins, are tested in simulation with assumed effect sizes.
- **The simulation is not reality.** Thresholds calibrated in simulation ran 38% over the false-alert
  budget on real people with two indicators, and up to nearly four times over with five. Simulated
  illness was harder to detect than real illness on the channels we could compare (+13 against +32).
- **Handling gravity changes has a cost.** It halves false alerts after launch but hides real problems
  that begin in the first weeks (+20 against +35 above luck in simulation).
- **Small samples:** about a hundred illness episodes, 29 bed-rest volunteers.
- **Not clinically reviewed.** The rules, the fixed thresholds and the readiness tier need review by a
  flight surgeon. Keel is decision support, not a medical device, and never states a diagnosis.
- **Analysis choices were revised during review** (the metric, the detector selection rule, the
  detection window). The decision log records each change and the more conservative alternatives.
- The link delay, blackouts, cabin CO2 and radiation readings in the demo are simulated.

## Future work

- Request NASA's in-flight actigraphy, cognition and standard-measures data and repeat the evaluation
  on astronauts; test in an isolation analog such as HERA.
- Use hourly data and overnight HRV, respiration and temperature from flight-grade wearables, which
  published work suggests carry earlier illness signals than daily heart rate.
- Clinical review of the rule table and thresholds with flight surgeons, and a crew usability study
  under fatigue.
- Tune how long the baseline band stays widened after a gravity change, so adaptation is not flagged
  but a real problem in the first weeks is not hidden either.
- Device-to-device sync between crew tablets without a server, so the medical officer's view updates
  on board.
- Camera-based inputs (for example a urine colour card for hydration).

## AI use

See `submission/AI_USE.md`.
