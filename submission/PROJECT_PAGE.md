# Keel — project page text

Copy each section into the matching field of the Space Apps project page.

**Project name:** Keel
**Challenge:** Create Health Monitoring Software for Astronauts on Space Missions
**Live demo:** https://aarav-agarwal331.github.io/keel-crew-health/
**Code:** https://github.com/aarav-agarwal331/keel-crew-health

---

## High-level summary

On the International Space Station a flight surgeon is seconds away by voice and talks privately with
each crew member about once a week; routine vital signs are not streamed to the ground. On the way to
Mars a signal takes up to about 24 minutes each way and sometimes there is no link at all, so the crew
must notice and act on health changes themselves. Keel is a crew health monitor that needs
no connection to Earth. It runs entirely on the crew member's own tablet, learns that person's own
normal for 18 indicators, notices when readings drift, explains what changed in plain language,
and recommends one specific action from a fixed table of rules with cited sources. The crew member
owns the data and chooses what the medical officer, the commander and the ground may see. Mission data
in the app is simulated and labelled. We measured how well its method works on real wearable data from 251
people and report the result with false-alert rates, uncertainty and its limits, inside the app. Keel
is decision support, not a diagnostic device.

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
  instructions, a photo for the medical officer (stored on the device, not analysed) and medication
  classes without doses.
- **Safety rules.** A red-flag symptom or a single reading beyond a sourced threshold (for example a
  fingertip oxygen reading of 92% or lower) is acted on at once, without waiting for a trend. Every
  entered reading is kept with its time and the worst reading of the day counts, so a repeat normal
  reading does not erase an abnormal one. Out-of-range readings are saved at once and can be withdrawn
  as typing mistakes (kept, struck through). An urgent reading turns its body area and the medical
  officer's view red, and exercise is held while any stop-or-rest advice is open. "Now" and "today"
  findings stay on the medical officer's list until the medical officer closes them with a note.
- **Sharing.** Per role and per body system, four levels from private to full detail, with a preview of
  exactly what each role sees and an access log. Some red-flag symptoms (thoughts of self-harm, an
  injury, tooth pain, one-sided swelling) go to the medical officer only, not the commander. Under
  emergency sharing the medical officer sees the symptom names and the readings with their times.
- **Crew readiness.** Before a demanding task such as a spacewalk the commander sees whether Keel has
  flags for each crew member, without the reasons unless the crew member shares them. It is an input
  to medical clearance, not a clearance.
- **Earth link.** The current simulated signal delay or blackout, what is queued for the ground, and a
  control that cuts the link so you can see that nothing stops working.
- **Mission replay.** A scripted illness on a simulated Mars transit, played in seconds (on first run
  the Today screen offers it as "Demo: replay a scripted event (40 s)"). Keel flags it on the day
  symptoms begin, from the symptoms ticked at check-in combined with drifting readings; the sensors
  alone show the illness pattern one day after symptoms begin.
- **Validation and method.** Results, method and limitations written for a non-specialist.

### How it works

Each person's baseline for each indicator is the median of their own previous four weeks, with a
robust measure of spread. Launch and landing are treated as expected changes: the baseline follows a
published adaptation curve and widens its band until the person's own new data takes over. Daily
deviations feed a multivariate detector that reacts to several small changes in a worrying direction.
Alert thresholds are not chosen by feel. They are set in simulation to a budget of one mistaken notice
per person-month and one mistaken alert per four person-months, because alarm fatigue is an
operational hazard; on real people they ran over that budget (1.40 and 0.39 per person-month).
Thresholds depend on which sensors are present and have to be set per sensor set; that is not built
yet. A fixed table of 39 rules turns a pattern, an entered reading or a reported symptom into wording, one action,
follow-up steps, how soon and who, each citing a NASA document, a published study or public clinical
guidance. No language model writes any advice, and by design Keel gives no medication or treatment
advice.

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

**NASA and space agency resources used for the design** (69 sources opened, listed with links in
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
NumPy, pandas, SciPy and scikit-learn; Vitest, pytest and Playwright for tests (24 Python tests, 52
TypeScript unit tests, 2 offline end-to-end tests); GitHub Pages for hosting. No NASA logos or
insignia are used. Keel is not affiliated with or endorsed by NASA.

## Validation results

All numbers come from scripts in the repository and are shown in the app with their method.
Detection is reported **above luck**: the share of episodes flagged minus the share an alert would
hit by chance, measured with pretend illness dates. The detection window runs from 10 days before
to 4 days after symptom onset. "Above luck" is an upper bound: pretend dates cannot be matched to the
calendar (dates are shifted for privacy), so travel, testing and isolation near a real onset are not
reproduced.

**Real data: 251 people, 107 dated illness episodes, two sensors (overnight heart rate and
activity).**

| On real illness episodes | Flagged | By luck | Above luck (95% interval) | False alerts per person-month (budget) |
|---|---|---|---|---|
| **Keel's method, thresholds set only in simulation,** notice tier | 72% | 40% | **+32 points** (22 to 41) | 1.40 (1.00) |
| Keel's method, thresholds set only in simulation, alert tier | 32% | 13% | +19 (9 to 28) | 0.39 (0.25) |
| Thresholds calibrated on other real people, with daily steps | 66% | 33% | +34 (24 to 44) | about 1.00 |
| One threshold for everyone, with daily steps | 41% | 23% | +18 (8 to 27) | |

- The headline is Keel's method, on two sensors, with thresholds set only in simulation: the
  detector run on the two sensors the real data has (overnight heart rate and 7-day activity), with
  its model and thresholds fitted only on simulated people and applied unchanged to real people. On
  the 113 people the simulator's calibration did not use (41 episodes) it is +38 (23 to 50). The
  alert tier is the one that brings in the medical officer. Both tiers ran over their false-alert
  budget.
- The model file the app ships is calibrated for all eleven on-board channels. Given only the
  channels a real watch import has (overnight heart rate, sometimes sleep), it flagged 12% of
  episodes, +9 above luck (4 to 16), at 0.08 false alerts per person-month, and its alert tier never
  fired. See Limitations.
- With thresholds calibrated on other real people (five folds over people): heart rate alone
  +22 (12 to 32); heart rate with 7-day activity +31 (21 to 41), alert tier +13 (4 to 21); heart rate
  with daily steps +34, alert tier +33 (23 to 43). The +34 is not our headline because its thresholds
  were set on real people and Keel does not use daily steps.
- Keel's lead over one fixed threshold is +16 (3 to 29) in the detection window used and
  +10 (−3 to 23) in the original wider window (−14 to +7 days). With 7-day activity the fixed
  threshold is +7 (−1 to 15) and Keel's lead is +24 (11 to 36) at the notice tier and +8 (−1 to 18)
  at the alert tier. Four detectors, two tiers and several windows were compared without correction,
  so a personal baseline is probably better than a fixed threshold, not proven.
- Keel's detector is not shown to beat a simple personal rule (two of three days outside the personal
  range). The simple rule alone is +28 (19 to 38); the detector's lead over it is +5 (−2 to 12), not
  distinguishable.
- Robustness of the cross-validated result: trained on one cohort and tested on the other, +33 and
  +33; five fold splits, +34 to +36; original window, +31 (22 to 40).
- Much of the signal is behavioural. Heart rate alone is +22; activity adds the rest because people
  move less when ill (median daily steps fall from 7,554 to 4,210), which cannot be separated from
  isolating at home.

**NASA bed-rest analog data.** After getting up from head-down bed rest, a plain personal baseline
flags the pulse of 9 of 14 volunteers; Keel flags 4. The difference is not significant (exact paired
p = 0.06), there is no ground truth that those flags are false, and the gain comes from widening the
band.

**Simulated missions (full sensor set, 1 false alert per person-month).** 67% flagged against 41% by
luck: +26 points (19 to 33). The lead over a fixed threshold is +6 (−2 to 14). By event type, above
luck: sleep restriction +55, exercise outage +54, low fluids +26 (10 to 40), cabin CO2 +11 (1 to 21),
illness +11 (−9 to 30), low mood +13 (−5 to 32); for illness and low mood the interval includes zero.
Mission-phase handling (gravity changes) gives 0.90 false alerts per person-month in the first 30
flight days against 1.98 without it. With luck taken from the same flight days, events that begin in
the first 25 flight days are +24 (14 to 33) above luck with phase handling and +15 (6 to 25) without. The simulator passes its realism checks only on quantities
fitted to the other half of the same data; the independent checks fail or are off, as listed below.

## Limitations

- **No useful early warning shown.** At the notice tier an alert started in the ten days up to
  symptom onset for 46% of episodes against 28% by luck (+18, 9 to 28); at the alert tier, the one
  that brings in the medical officer, the gain is +1 (−5 to 7), that is, none. The notice-tier gain
  is small and confounded (test dates, isolation after a positive test, lower activity on the day),
  so we do not claim it. In the scripted replay Keel flags the illness on the day symptoms begin,
  and the sensors alone show it one day after.
- **Most alerts are false.** At the in-flight rate of respiratory illness, between 1 in 11 and
  1 in 27 alert-tier alerts would be a real illness, and about 1 in 40 notices. An alert is a prompt
  to look, not a verdict.
- **Keel's method runs over its false-alert budget on real people:** 1.40 against 1.00 per
  person-month at the notice tier, 0.39 against 0.25 at the alert tier.
- **The shipped model is not set up for a watch import.** The model file the app ships is calibrated
  for all eleven on-board channels. Given only the channels a real watch import has (overnight heart
  rate, sometimes sleep), it flagged 12% of episodes, +9 above luck (4 to 16), at 0.08 false alerts
  per person-month, and its alert tier never fired. Thresholds have to be set per sensor set; that is
  not built. The app says so on its import card.
- **Not shown to beat simpler methods.** The detector cannot be told apart from a simple personal
  rule, and the lead of a personal baseline over a fixed threshold is probable, not proven.
- **Ground data stands in for spaceflight data.** No open astronaut wearable time series exists. The
  people in the real evaluation were on Earth, wore consumer watches and mostly had COVID-19, and
  much of the signal is their change in activity, which cannot be separated from isolation at home.
  Heart rate alone (+22) is the safer figure.
- **Only illness is tested on real data,** with heart rate and activity. Sleep loss, cabin CO2,
  deconditioning, dehydration and low mood, and the contribution of HRV, oxygen, temperature and
  check-ins, are tested in simulation with assumed effect sizes.
- **The simulation is not reality.** Simulated illness raises heart rate by 2.1 bpm against 4.6 in
  real episodes; simulated HRV variability is 37% too high; sleep carry-over is off; nights under six
  hours are 50% against a published 44%. Thresholds from simulation gave 1.38 and 0.40 false alerts
  per person-month on 72 real people (budgets 1.00 and 0.25), and 2.04 and 0.97 with five sensors on
  16 people. Like for like on two channels, simulated illness is flagged +11 above luck against +35
  for real episodes.
- **Gravity-change handling is tested only in simulation.** It halves false alerts after launch (0.90
  against 1.98 per person-month) and has no measured cost: events that begin in the first 25 flight
  days are +24 (14 to 33) above luck with it and +15 (6 to 25) without. An earlier analysis that
  reported a cost was wrong (luck had been drawn from late flight).
- **Small samples:** 107 illness episodes; 14 bed-rest volunteers in the comparison.
- **Not clinically reviewed.** No clinician has reviewed anything. The rules, the fixed thresholds
  and the readiness tier need review by a flight surgeon. Keel is decision support, not a medical
  device, and never states a diagnosis.
- **Nothing was pre-registered.** Analysis choices (the metric, the detector selection rule, the
  detection window) changed during four rounds of AI role-played review (a flight surgeon, a
  statistician, an astronaut, a judge). The decision log records each change.
- The link delay, blackouts, cabin CO2 and radiation readings in the demo are simulated.

## Future work

- Request NASA's in-flight actigraphy, cognition and standard-measures data and repeat the evaluation
  on astronauts; test in an isolation analog such as HERA.
- Use hourly data and overnight HRV, respiration and temperature from flight-grade wearables, which
  published work suggests carry earlier illness signals than daily heart rate.
- Clinical review of the rule table and thresholds with flight surgeons, and a crew usability study
  under fatigue.
- Set thresholds per sensor set, so a watch import with only heart rate and sleep is not judged by
  thresholds calibrated for eleven channels.
- Test the gravity-change handling on real launch or analog data rather than in simulation only.
- Device-to-device sync between crew tablets without a server, so the medical officer's view updates
  on board.
- Image analysis. Check-in stores a photo for the medical officer, but Keel does not analyse images
  (for example a urine colour card for hydration).
- Possible wider use, untested: other isolated teams with delayed medical support, such as Antarctic
  winter stations or ships at sea.

## AI use

See `submission/AI_USE.md`.
