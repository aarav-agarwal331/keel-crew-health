# Keel: method

This is the full method. The app's *How Keel works* screen is the plain-language version of the same
content. Reference numbers in square brackets point to the reference list in
[DOMAIN.md](DOMAIN.md); dataset details are in [DATA.md](DATA.md). Every script named here lives in
`research/scripts/` and is run by a `make` target.

Notation: person *i*, day *t*, indicator *j*. `x[i,t,j]` is a daily value, missing values are NaN.

---

## 1. Indicators

Chosen to cover the five hazards [6][7] and the challenge's own list (blood pressure, heart rate, blood
sugar, body temperature, sleep hours, mood), restricted to what a crew can measure with small hardware
(DOMAIN.md section 3). Definitions, units, plain-language explanations and measuring instructions are
in `shared/indicators.json`, which both the research code and the app read.

| Indicator | Unit | Source | In the detector | Risk tracked | Basis |
|---|---|---|---|---|---|
| Resting heart rate | bpm | wearable, overnight | yes, high is a concern | infection, dehydration, deconditioning | [58][60][21] |
| Heart rate variability (RMSSD) | ms, log scale | wearable, overnight | yes, low | physiological strain, recovery | [60][55a] |
| Blood oxygen | % | wearable or fingertip | yes, low | respiratory problems, cabin atmosphere | [57] |
| Skin temperature (overnight) | °C | wearable | yes, high | infection, inflammation | [60][23] |
| Body temperature (thermometer) | °C | spot | fixed rule (≥ 38.0) | fever | [63] |
| Sleep duration | h | wearable | yes, low | sleep loss | [31][17] |
| Sleep timing shift | h from schedule | wearable | yes, both directions | circadian misalignment | [17][30] |
| Exercise, 7-day mean | min/day | device log or check-in | yes, low | bone, muscle and aerobic loss | [10][50][26] |
| Reaction time | ms | check-in self-test | yes, high | fatigue, CO2 | [32][33] |
| Mood | 1 to 5 | check-in | yes, low | behavioral health | [6][28] |
| Fluid intake | L/day | check-in | yes, low | renal stones, dehydration | [53][54] |
| Food intake | % of plan | check-in | yes, low | body mass loss, nutrition | [52d][22] |
| Body mass | kg | weekly | fixed rule (≥ 5% below pre-flight) | nutrition | [52d] |
| Blood pressure (systolic) | mmHg | weekly, cuff | fixed rule (< 90, ≥ 140) | cardiovascular regulation | [21][65][67] |
| Blood glucose | mg/dL | weekly, fingertip | fixed rule (< 70, ≥ 200) | named in the challenge | [64][66] |
| Cabin CO2 | mmHg | cabin sensor | fixed rule | headache, cognition | [37][38] |
| Radiation dose | mSv/day and total | personal dosimeter | recorded after the fact | radiation exposure | [29][44][45][47] |
| Symptoms | yes/no list | check-in | rules | all | [52b] |

Weekly spot measurements are too sparse for a daily detector; they are shown against a personal band
computed over a longer window. Bone density and eye changes cannot be measured daily with small
hardware, so Keel tracks the countermeasure (exercise) and asks about vision.

## 2. Data sources and daily features

Adapters: (a) real open datasets, (b) CSV / Fitbit JSON / Apple Health XML parsed in the browser
(`app/src/core/importers.ts`), (c) a heart-rate strap over Web Bluetooth (`app/src/core/ble.ts`,
standard Heart Rate service; RMSSD from RR intervals with ectopic-beat rejection), (d) the simulator.

Daily features from raw wearable streams (`build_daily.py`):

- **Resting heart rate**: heart rate resampled to one-minute means; a minute is *resting* if the step
  count over the previous 12 minutes is zero (the definition used by Mishra et al. [58]); the daily
  value is the median over resting minutes between 00:00 and 07:00, requiring at least 30.
- **Steps**: daily total, only on days with at least 600 minutes of heart-rate data.
- **Sleep duration**: hours in non-wake stages in the night ending that day.

**Time of day and activity** are handled in the feature definition rather than by regression: the
heart-rate and HRV features are taken at rest, at night. A further linear adjustment of heart rate for
the previous day's activity was evaluated on real data and did not improve detection (section 8), so it
is implemented (`Model.adjust`) but switched off.

## 3. Simulator

`research/keel/simulator.py`. Generates daily indicators for a crew through a pre-flight baseline
period and a flight, with a shared cabin environment and scripted events.

```
x[i,t,j] = trait[i,j] + shift[i,j] * a(t) + SUM_k beta[j,k] * d_k[i,t] + n[i,t,j]

a(t)     = 1 - exp(-(t - t_launch) / tau)                       adaptation to weightlessness
n[i,t,j] = rho_j * n[i,t-1,j] + e,   e ~ N(0, (sd_j * g[i,j])^2 * (1 - rho_j^2))
g[i,j]   ~ LogNormal(0, sigma_person)                           people differ in how noisy they are
D[i,t]   = min(4, max(0, 0.75 * D[i,t-1] + 0.5 * (need[i] - sleep[i,t-1])))    sleep debt, hours
```

Drivers `d_k`: sleep debt, exercise load, deconditioning (accumulates when the weekly exercise falls
below 70% of plan), dehydration, space motion sickness in the first days, and the scripted events.
Events are intensity curves (linear rise, hold, exponential fall): illness, sleep restriction, cabin
CO2 rise (crew-wide), exercise outage, low fluid intake, low-mood period, solar particle event.
Headaches follow the published dose-response: the odds double per +1 mmHg CO2 [37]. Mission phases:
launch into weightlessness and, for the lunar scenario, landing in one-sixth gravity.

**Parameter provenance.** Every parameter is in `shared/sim_params.json` with a `basis`:

- *published*: taken from a source opened for DOMAIN.md (for example in-flight sleep 6.09 h [31], space
  motion sickness in 60–80% of crew [52a], body mass −2.8 to −4.4% [52d], transit dose 1.8 mSv/day [44]);
- *calibrated*: fitted to real data by `calibrate_sim.py` on a **calibration half** of the people;
- *assumption*: chosen by us. This includes every effect size for HRV, temperature, oxygen, mood,
  reaction time, and all non-illness events.

**Calibration** (`calibrate_sim.py`):

1. Day-to-day variability. For each real person the within-person SD is the SD of the daily values
   after removing a 28-day rolling median. The simulator's noise SD is scaled until the *total*
   simulated within-person SD (which also contains sleep-debt and exercise effects) matches the real
   median. Sources: Stanford wearables (resting heart rate, people with no reported illness) and
   LifeSnaps (HRV, oxygen, skin temperature, sleep).
2. Between-person spread of that variability: `sigma_person` = mean over indicators of
   `ln(Q3/Q1)/1.349` of the real within-person SDs.
3. Correlation between indicators. Within a person, day-to-day residuals of overnight heart rate and
   HRV are strongly anticorrelated in real data (median −0.64). The simulator's noise therefore shares
   one factor across heart rate, HRV, skin temperature and sleep, with loadings fitted to the real
   correlations. (The first version generated them independently; the realism check caught it.)
4. Illness response. The mean resting-heart-rate change around dated illness onsets is fitted with the
   event template by least squares over days of rise before onset, days to the peak, hold and
   recovery; the amplitude is the fitted peak (4.8 bpm, about two days after onset). Episodes differ a
   great deal: the between-episode SD of the response, after subtracting measurement noise, is 1.9
   times its mean. Each simulated illness is scaled by `max(0, N(1, 1.87))`, renormalised to mean 1,
   so about three in ten have no heart-rate response at all.

**Realism check** (`sim_realism.py`, Validation section 3) uses the *other* half of the people:
distributions of within-person SD, lag-1 autocorrelation, the event-aligned illness response, and
published in-flight values that were not tuned (for example the share of nights under 6 h [31]). A
**like-for-like check** runs detection on simulated illness using only the two channels the real
illness data has, and compares the detection rate with the real one.

## 4. Personal baselines

`research/keel/core.py: personal_baseline`, mirrored in `app/src/core/detect.ts`.

```
window(t) = { x[s] : t - g - W <= s < t - g },   W = 28 days, g = 3 days
m[t]      = median(window)                         needs at least 7 valid days
s[t]      = max(floor_j, 1.4826 * MAD(window))
z[t]      = clip((x[t] - m[t]) / s[t], -4, +4)
```

The gap *g* keeps a change that is just starting out of its own baseline. Median and MAD make the
baseline insensitive to isolated sensor errors. The floor stops a very regular person from having an
absurdly narrow band. Clipping stops one extreme reading from firing an alert by itself. HRV is
modelled on the log scale. The baseline is strictly causal (unit test
`test_baseline_is_strictly_causal`).

**Mission phase.** A phase change at day *t0* (launch, landing) carries an expected shift *Δ* and a
time constant *τ* per indicator. After the change the window never reaches back across *t0*. Until
enough new data exists the estimate blends the old baseline moved along the adaptation curve with
the person's own new data, and the band is widened:

```
prior_m[t] = m_before + Δ * (1 - exp(-(t - t0)/τ))
prior_s[t] = s_before * (1 + (κ - 1) * exp(-(t - t0)/τ)),      κ = 2.5
w          = min(1, n_new / 14)
m[t]       = (1 - w) * prior_m[t] + w * median(new window)
s[t]       = max(floor, (1 - w) * prior_s[t] + w * scale(new window))
```

*Δ* comes from published population values where they exist (sleep −0.86 h [31]) and from the
simulator's population parameters otherwise. Individuals deviate from *Δ*; the blend lets each
person's own data take over within two weeks.

## 5. Detection

All detectors work on `u = concern_j * z` (deviation in the direction of concern; `|z|` when both
directions matter).

| Detector | Score for day *t* |
|---|---|
| Fixed threshold (comparison) | same as below but with `z_pop = (x - mean_pop) / sd_pop` from training people |
| Personal z-score | max over indicators of the 2nd largest `u` in the last 3 days (a "2 of 3 days" rule) |
| CUSUM | `S[t] = max(0, S[t-1] + u[t] - 0.75)`; held on missing days, reset after 5 missing or 3 in-control days; score = max over indicators |
| Multivariate EWMA | `y[t] = 0.3 z[t] + 0.7 y[t-1]` (missing counts as 0); `y+` = `y` clipped to the direction of concern; `T² = y+ᵀ (0.3/1.7 · R)⁻¹ y+` over the indicators the person has ever reported |
| Fusion | `max(CUSUM / h_C, T² / h_M)` with each component's own threshold at 1 false alert per person-month |

*R* is the correlation matrix of personal z-scores on quiet days of training people, shrunk 20%
toward the identity.

**Alert episodes.** An alert is a maximal run of days with score ≥ threshold; runs separated by 3 days
or fewer are one alert.

**False-alert budget.** Alarm fatigue is an operational hazard [61][62], so thresholds are not chosen by
feel. For a budget *B* (false alerts per person-month) the threshold is the smallest value for which
training people's quiet periods produce at most *B*. Two tiers: **notice** (B = 1) and **alert**
(B = 0.25). An alert that stays open counts again every 7 days, so a single endless alert cannot hide
inside the budget.

**Which detector is deployed** is decided in `fit_mission_model.py` on simulated *training* missions
only, by a rule fixed in advance: order the candidates from simplest to most complex (z-score rule,
CUSUM, multivariate EWMA, fusion) and move to a more complex one only if it flags more than 3
percentage points more events *above luck* (section 6), averaged over the two tiers. It selected the
multivariate EWMA (31.7 against 27.5 for the z-score rule). Real data and test missions had no vote.
On the test missions the z-score rule was in fact slightly ahead, and on real data the multivariate
detector was; the four personal detectors cannot be told apart with the data we have.

**Rules outside the detector.** Some things do not depend on a personal baseline or cannot wait for
one, and have fixed rules that are always evaluated: red-flag symptoms; a single entered reading
beyond a safety threshold (thermometer ≥ 38.0 °C [63], fingertip oxygen ≤ 92% [57], blood sugar
< 70 mg/dL [64], systolic pressure < 90 mmHg [65]); resting heart rate above 100 on two nights; very
low mood for days; body mass ≥ 5% below pre-flight; cabin CO2 at or above 3.0 mmHg as a 24-hour
mean [38]; and a cabin CO2 above 2.5 mmHg together with a reported headache [37]. A reported sore
throat or cough together with a sub-threshold drift in heart rate, HRV, temperature or oxygen also
raises a finding, because sensors plus symptoms discriminate better than either [59b]. These
thresholds are general public guidance or placeholders and need a flight surgeon's sign-off. Rules
triggered by reports and entered readings are not covered by the false-alert budget. Keel does not
warn of solar particle events: it sees daily dose totals, and shelter decisions need the vehicle's
radiation alarm [47][48]. After two days without any reading the status is "no recent data".

**Implementation parity.** The detector is implemented in Python (research) and TypeScript (device).
`make_parity.py` writes inputs and Python outputs to `shared/parity.json`;
`app/src/core/detect.parity.test.ts` requires the TypeScript outputs to match to 1e-6.

## 6. Evaluation protocol

`research/keel/evaluate.py`, used by `eval_real.py` and `eval_sim.py`.

- **Held-out people.** Real data: 5-fold cross-validation over people, stratified by whether the
  person has an event. Everything fitted (population statistics, *R*, thresholds) uses training folds
  only. Simulation: 60 training missions, 100 separate test missions.
- **Detection.** An event is detected if an alert *starts* in `[onset − 10, onset + 4]` days.
  Lead time = onset − alert start (positive = before onset). "By onset" = lead ≥ 0.
- **Quiet time and false alerts.** Days outside `[onset − 21, onset + 28]` of every event are quiet.
  False alerts = alerts starting on quiet days (plus one per further week open), per person-month of
  scored quiet days.
- **Every event counts.** An event with no score in its window (no baseline yet, no data) is a miss,
  so all methods are compared on the same events.
- **Chance level and detection above luck.** Pseudo-events are placed on random quiet days and scored
  identically. At 1 false alert per person-month a 15-day window catches an alert by luck 30–40% of
  the time, and detectors that alert in more separate bursts get more lucky hits. The headline metric
  is therefore *detection above luck* = detection rate − that method's own chance rate, and methods
  are compared on it.
- **Intervals.** 95% percentile bootstrap, resampling people (real) or missions (simulated, because
  crewmates share a cabin). A person's real events and pseudo-events are resampled together; method
  differences use paired resampling.
- **The window** (−10 to +4 days) was fixed before the first run on real data. The table of other
  windows was computed afterwards.
- **Leakage guards.** Causal baselines; thresholds from training people (unit test
  `test_cv_never_scores_a_person_with_a_model_that_saw_them`); simulator calibrated on a different half
  of the people than the realism check uses; detector selected on training missions.

### 6.1 Real data (`eval_real.py`)

Stanford COVID-19 wearables phase 1 [58] and a phase 2 subset (all 84 positives plus 120 others).
324 people were downloaded (all 120 of phase 1; all 84 positives of phase 2 plus the first 60 Fitbit
and first 60 other-device participants in ID order, which is not a random draw). 73 were left out for
having fewer than 28 nights with a usable resting heart rate, leaving 251 people, 37,234 person-days
and 103 illness episodes (79 COVID-19 with a symptom date, 19 with a test date only, 5 other illness).
Of the 150 people without a dated episode, 64 reported no illness, 80 are phase 2 participants who
were never confirmed healthy, and 6 reported an illness outside their recording. Further analyses:
train on one phase and test on the other, five fold seeds, retrospective against prospective cases,
and the predictive value of an alert at the in-flight illness rate [52b]. Indicators: resting heart rate and daily steps (log scale, low is a concern). Onset =
symptom date where reported, else test date. Episodes within 28 days of each other are one.

### 6.2 Simulated missions (`eval_sim.py`)

Four crew, 30 days pre-flight, 180 days in flight, two random events per mission from six types;
illness sizes follow the real spread, the others a grid of 0.5 to 2 times the nominal size. Nominal
missingness: 4% of nights unworn, 10% of check-ins skipped, occasional multi-day outages. Further
experiments: detection by event type and size, missing data, removal of each sensor, component
ablations (each refitted and recalibrated), a deliberately wrong adaptation prior (×0, ×0.5, ×2),
events placed in the first 25 flight days, quiet missions, and two checks that tie the simulator to
reality: a like-for-like detection comparison on the two channels real data has (simulated people on
the ground against real validation-half episodes), and applying simulation-calibrated thresholds
unchanged to real quiet people (`sim_realism.py`).

### 6.3 Gravity transitions on real analog data (`eval_bedrest.py`)

NASA Life Sciences Data Archive public bed-rest campaigns: daily nurse-taken pulse for 29 volunteers
before, during and after head-down-tilt bed rest. The expected pulse shift at each transition is
estimated on a calibration half; on the other half we count volunteers for whom pulse is ≥ 2 robust SD
above baseline on 2 of 3 consecutive days in the 14 days after a transition, with a plain rolling
baseline, with the baseline restarted, with the band also widened, and with the learned shift added
(the full method), and report an exact paired test.

## 7. From detection to action

`shared/rules.json`, `shared/countermeasures.json`, `app/src/core/analysis.ts`.

Keel computes, for each indicator, the mean `u` over the last three measured days; symptom counts
over three days; the latest entered spot readings; the cabin readings; days since the last phase
change; and days the detector's alert has been open. A fixed, ordered table of 28 rules is evaluated.
Rules have a scope:

- **personal**: evaluated only while the detector has an alert open; the first one whose condition
  holds applies. Their false-alert rate is the detector's budget.
- **vital, symptom, environment, adaptation**: always evaluated (section 5).

Every finding supplies:

- **what changed**: the indicators the rule names first, then the largest deviations, each with its
  value, the person's usual value and band;
- **how unusual**: on how many of the person's last 60 measured days the reading was closer to
  normal, and for how many days it has been out of range;
- **contributing factors** from the person's own recent data: short sleep, sleep timing, low fluids,
  exercise change, a hard session the day before, low food intake, low mood, cabin CO2, reported
  symptoms, a recent gravity change;
- **one recommended action** and follow-up steps, mapped to a countermeasure with its sources
  (DOMAIN.md section 5 and references 63–67);
- **how soon** (now, today, at the next routine opportunity) and **who** (the crew member alone, the
  medical officer, or the medical officer with the flight surgeon consulted when a link exists).
  A rule may raise either when the pattern persists. For personal rules, going beyond
  self-management requires the stricter alert tier or a symptom the person reported.

The rule table is data, not code: it is shown in full in the app (Guide), and each alert displays the
rule ID, its condition, the scores and the thresholds. No language model generates or rephrases any
text. Unit tests check that every rule cites existing countermeasures with opened references, that no
rule text states a diagnosis, that the fixed thresholds fire on a single entered value, and that
every screen's status for a person agrees.

## 8. What the evaluation showed

Numbers are in the app's Validation screen and in `app/public/results/*.json`.

- **Real data, 1 false alert per person-month.** Keel flags 67% of illness episodes; luck gives 36%;
  **+31 points above luck (95% interval 21 to 41)**. A fixed threshold: 40%, luck 24%, +15 (6 to 25).
  Keel's advantage above luck: +15 (2 to 30). Measured false alerts: 1.00 (0.91 to 1.08).
- **At 0.25 per person-month.** Keel 43%, luck 12%, +31 (21 to 41); fixed threshold +12 (5 to 19);
  advantage +19 (8 to 30). Measured false alerts: 0.24.
- **No early warning.** 40% of episodes had an alert start in the ten days up to onset; luck gives 28%.
- **Most alerts are false.** At 0.97 upper-respiratory episodes per person-year [52b], about 1 in 11
  alert-tier alerts and 1 in 41 notices would be such an illness.
- **The simple rule nearly matches.** Two-of-three-days personal z-score: +26 (16 to 36).
- **Steps carry most of the signal** (heart rate alone +14; with steps +31), largely because people
  move less once they feel ill. Adjusting heart rate for the previous day's steps does not help.
- **Robustness.** Train on phase 1, test on phase 2: +29 above luck, 0.87 false alerts per
  person-month; the reverse: +38, 1.10. Five fold seeds: +31 to +33.
- **Simulation, full sensor set.** 67% (61 to 73), luck 40%, +26 (20 to 33). The z-score rule: +31.
- **Mission-phase handling.** False alerts in the first 30 flight days: 0.90 per person-month against
  1.98 without it, and it does not depend on a correct prior (1.06 with no expected shift). Cost:
  events beginning in the first 25 flight days are flagged +19 above luck against +34 without it.
- **NASA bed-rest data.** After getting up, a plain baseline flags 9 of 14 volunteers; restarting the
  baseline, 8; widening the band, 4; adding the learned shift, 4 (exact paired p = 0.06).
- **Simulator against reality.** Like for like on two channels, simulated illness is flagged +13 above
  luck (2 to 23) against +28 (12 to 44) for real validation-half episodes: the simulator is harder.
  Thresholds calibrated in simulation and applied to 144 real quiet people gave 1.39 false alerts per
  person-month against a budget of 1.00, and 0.42 against 0.25. Simulated HRV is 37% more variable
  than real, and simulated sleep carries over from night to night where real sleep does not.

## 9. Crew readiness, sharing and the link

- **Readiness** (`app/src/core/readiness.ts`): three tiers (no Keel flags, minor flags, talk to the
  medical officer first). Never better than the worst area on the crew member's own screens; nausea,
  vomiting or clearly slowed reactions always mean a conversation first. A heuristic for discussion,
  not a validated fitness-for-duty test and not a clearance.
- **Sharing** (`app/src/core/visibility.ts`): per role (medical officer, commander, ground) and per
  area, four levels (private, status, trends, full detail). One function produces everything another
  role may see; unit tests assert that nothing unshared appears, including in the ground summary. The
  commander always sees the readiness tier, never the reasons unless shared. Crew-wide counts are
  shown only when three or more people are affected. With emergency sharing on (the default, and a
  setting the crew member can switch off), an "act now" finding is shown to the medical officer and
  to the commander as backup. Views are logged.
- **Link** (`app/src/core/link.ts`): simulated one-way delay from simplified geometry, scripted
  blackouts, and a manual cut. The ground summary is the output of the sharing gate for the ground
  role, queued while there is no link.

## 10. Limitations

See the app's *How Keel works → Limitations* and the Validation screen's closing section. In short:
ground data stands in for spaceflight data; about a hundred real illness episodes; only illness is
tested on real data and most of that signal is behavioural; early warning is not shown; most alerts
are false; the full-sensor thresholds and all non-illness effect sizes rest on simulation and
probably run over budget on real people; the handling of gravity changes hides real problems for the
first weeks; a personal baseline can normalise a harmful drift; and the action rules, fixed
thresholds and readiness tiers have not had clinical review.
