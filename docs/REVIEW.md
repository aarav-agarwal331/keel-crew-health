# Review rounds

Each round used four fresh AI reviewers who had not seen the project brief. Each was given the
deployed app (as per-screen text and screenshots captured from the live site by
`app/e2e/review.spec.ts`) and the documents, and asked for issues by severity. These are role-played
reviews by an AI model, not reviews by a practising flight surgeon, statistician or astronaut.

Severity: **High** = unsafe, wrong, materially overstated, or would stop a nomination. **Medium** =
fix before submission. **Low** = polish.

## Round 1 (2026-11-12)

Judge's scores: impact 8, creativity 8, validity 8, relevance 8, presentation 7 (39 of 50).

### High-severity findings and what was done

| # | Reviewer | Finding | Fix |
|---|---|---|---|
| 1 | Astronaut, judge, flight surgeon | The same person had different statuses on different screens: "Ready" for the commander but "Act today" for the medical officer; heart "worth a look" on Today but "act" in Sharing; sleep of 3.8 h shown green. | One status function now feeds every screen. An area can be at most "worth a look" without an open finding; "act" always comes from a finding. Readiness is never better than the person's own worst area. A unit test walks the whole demo mission and checks the screens agree. |
| 2 | Flight surgeon | No absolute safety thresholds: a temperature of 40 °C or oxygen of 80% entered at check-in produced no response. | Fixed rules that bypass the detector, with sourced reference values: thermometer ≥ 38.0 °C and ≥ 39.4 °C, fingertip oxygen ≤ 92%, blood sugar < 70 and ≥ 200 mg/dL, systolic pressure < 90 and ≥ 140 mmHg, resting heart rate > 100 on two nights, very low mood for days, body mass ≥ 5% below pre-flight. Marked as public guidance and placeholders needing clinical sign-off. Unit-tested and exercised in the offline end-to-end test. |
| 3 | Flight surgeon | Red-flag list too narrow (three symptoms); "vision change" did nothing. | Thirteen red-flag symptoms in a separate, clearly marked group; rules for vision change and rash; a "Report a symptom now" button on Today; a static line for thoughts of self-harm. |
| 4 | Flight surgeon | The solar-storm alert could not work: a daily dose total is far too slow for a shelter decision. | Keel no longer claims to warn of solar storms. The rule now records the dose after the fact, asks the crew to confirm sheltering and to log nausea, and the Guide and Method say the vehicle alarm does the warning. |
| 5 | Flight surgeon | The illness rule advised a "light session" before fever was excluded, and mixed wrist skin temperature with thermometer readings. | Action is now "take your temperature with the thermometer and hold exercise until you have"; no exercise with fever or chest symptoms. Skin temperature and thermometer temperature are separate series. Congestion alone no longer corroborates illness. |
| 6 | Astronaut | "Steady" with a green cabin tick while CO2 sat above the app's own headache line. | Cabin status turns amber at 2.5 mmHg, Today says so, and a headache reported with CO2 above 2.5 raises its own finding. The CO2 limit rule now uses the 24-hour mean, as its source does. |
| 7 | Astronaut | The privacy promise ("nothing leaves this device unless you allow it") was contradicted by the commander always seeing a readiness tier, and "anonymous" crew counts are not anonymous in a crew of four. | Sharing now opens with what is always visible and why. Counts are shown only for three or more people and no longer called anonymous. Emergency sharing is an explicit, switchable consent. The privacy gate has new tests. |
| 8 | Astronaut | The "one-minute" check-in took three minutes or more. | Four quick answers and Save come first; the reaction test, exercise and measurements moved under optional extras; fluids start at the recent average; a "No symptoms" answer exists; the Save button stays in reach. |
| 9 | Statistician | The check tying the simulator to reality was neither held-out nor like-for-like. | The real side now uses only symptom-dated episodes of people the simulator's calibration never saw, and both sides use the same two channels (heart rate and 7-day activity), each with its own chance rate. The result reversed: simulated illness is harder to detect than real illness (+13 against +28 above luck), and the text says so. |
| 10 | Statistician | Methods were compared on raw detection although each has a different chance rate; the 25-point lead over a fixed threshold shrank to about 13 net of chance. | Every comparison is now made on detection above luck, with paired bootstrap intervals. The headline is "+31 points above luck (21 to 41)" and the advantage over a fixed threshold "+15 (2 to 30)". The detector is selected on a chance-corrected criterion with a parsimony margin. |

### Medium-severity findings that changed the science

- **Simulated illness was larger and earlier than real illness** (statistician). The size multiplier now
  has mean 1 with the real, noise-corrected spread, so three in ten simulated illnesses have no
  heart-rate response, as in the data; the template was refitted (peak about two days after onset).
- **Indicators were simulated as independent** (found by our own new realism check after the
  statistician asked for one). Real overnight heart rate and HRV correlate at −0.64 within a person.
  The simulator now shares a fitted factor across indicators; the correlations match on held-out
  people.
- **Phase handling was tested only where it could not fail** (statistician). New experiments: a wrong
  adaptation prior (it barely matters) and events in the first 25 flight days (the widened band hides
  them: +19 against +34 above luck). Reported as a cost, not tuned away.
- **The bed-rest gain was attributed to the "learned shift"** (statistician). An ablation shows it comes
  from widening the band; the learned shift adds nothing. An exact paired test (p = 0.06) is reported.
- **Missing analyses** (statistician): predictive value of an alert at in-flight illness rates (about 1
  in 11 at the alert tier), train-on-one-cohort test-on-the-other, repeated fold seeds, cohort flow,
  retrospective against prospective cases, a common event set for all methods, per-device wear rule
  (the first version discarded 96% of non-Fitbit step days), thresholds transferred from simulation
  to real people (40 to 70% over budget), pass marks for the realism checks written in advance.
- **Crew-facing text oversold early infection detection** (flight surgeon). Replaced with our own
  measured result.
- **ISS medical operations were overstated** (flight surgeon): "watches crew health in near real time"
  became "a flight surgeon is seconds away by voice, speaks with each crew member weekly, and the
  ground follows exercise and cabin-air data; routine vital signs are not streamed".
- **Escalation mixed urgency with audience** (flight surgeon). Every finding now says how soon (now,
  today, routine) and who, separately.
- **Personal baselines legitimise harmful norms** (flight surgeon). Trends show the standard beside
  "your usual"; body mass is compared with pre-flight.

### Medium and low findings fixed in the interface

First-run strip on Today with a one-line description and a button to the replay (judge); the replay's
result card states the real-data numbers and labels unrelated alerts as false alerts; alert markers
only on charts that were part of the alert; chart label collisions, clipped labels, overflowing
sparklines and the exercise ring; link status no longer styled like a health alarm; "Cut the link" is
replaced by an explanation and a jump to a link-up day during a scripted blackout; all four sharing
levels explained with the readings each area contains; developer wording removed; larger touch
targets and a real back button; "FD" spelled as "Day"; counts instead of percentiles ("further from
your normal than on 52 of your last 53 days"); a browsable list of every rule with its sources
(Guide); reference list cleaned; Validation and Method collapsed into sections; a per-screen error
boundary so a fault on one screen cannot blank the app.

### Not done

- Camera or image input (challenge consideration; listed in the README as not done).
- A more anatomical body figure and richer gamification (judge, low): the figure and the streak,
  ring and shared crew goal are deliberately simple.
- Urgent findings are not pushed between tablets; "emergency sharing" changes what the other roles see
  when they open Keel. There is no device-to-device sync.
- Tuning of the post-transition band, hourly features, and a rover environment.

## Round 2 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 8, relevance 8, presentation 7 (38 of 50), no
high-severity issue. The other three reviewers found five high-severity issues between them.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Flight surgeon, astronaut | The advice said "take your temperature" but a thermometer reading could not be entered: the check-in field was still bound to wrist skin temperature, so the fever rules could never fire, and "1.0 °C above your usual thermometer reading" referred to a number the app never showed. | The check-in field now writes the thermometer indicator; the action card itself has a reading field and Keel picks the next step; the personal +1.0 °C rule uses the person's own earlier readings when three exist. An end-to-end test enters 38.4, 39.6 and 36.8 and checks each result. A save-ordering race found while writing that test was also fixed. |
| 2 | Flight surgeon | Fixed vital rules were mis-tiered at the extremes: systolic 220 was "worth a look", glucose 450 "repeat tomorrow", while an asymptomatic glucose of 68 was "now". | Severe tiers added (glucose under 54 and 300 or more, systolic under 80 or under 90 with dizziness, 180 or more); 54 to 69 moved to "today". The 180, 300 and 80 values are labelled placeholders. Unit-tested. |
| 3 | Astronaut, flight surgeon, judge | "Open for 7 days, since Day 115" under an illness alert whose pattern began on Day 121, which also triggered the four-day escalation at once. | Persistence is counted from the day the current pattern began; the alert shows both dates and the earlier notice's reason; escalation uses the pattern's own clock. |
| 4 | Statistician | The alert-tier headline (+31) and "1 in 11" used daily steps, while the app's detector uses a 7-day activity average, for which the alert tier is +12 and about 1 in 28. | Both are shown everywhere the figure appears: headline tile, ablation table (both tiers), predictive value as a range, README, submission texts. |

Medium-severity findings fixed in the same pass:

- **Cohort label error** (statistician): four other-illness episodes dated inside the recording had
  been dropped. Fixed and everything re-run: 107 episodes; headline +30 (20 to 40), fixed threshold
  +17, advantage +14 (0 to 28).
- **Provenance claims** (statistician): "a rule fixed in advance" and "window fixed before the first
  run" are not supported by the commit history. Reworded to say the selection rule was written during
  review and flipped once, and that the original window gives +27.
- **Simulated intervals** were over people, not missions as stated; now over missions. The
  like-for-like and transfer checks use the validation half only; pass marks tightened to ±25%, which
  the transfer and the simulated illness response now fail, and the screen says so. A five-indicator
  transfer test on LifeSnaps was added (up to nearly four times over budget).
- **Exercise advice** contradicted itself; one instruction now ("no exercise until you have taken your
  temperature"), cough split from sore throat, and "light session" needs no fever, no cough, no
  unusual tiredness and the medical officer's agreement.
- **Closure**: entered readings stay in force for a week or until a newer one replaces them; red
  flags stay for three days unless a later check-in omits them; long-open alerts can be marked
  "reviewed with the medical officer".
- **Medical officer as patient**: role-aware wording and a different commander label.
- **More red flags** (allergic swelling, seizure, bleeding, painful red eye, stiff neck, smoke or
  chemicals, tooth pain, thoughts of self-harm), now collapsed behind one tile so they do not crowd
  the ordinary symptoms; fluids start empty.
- **Readiness** no longer flags nearly everyone (an area needs a 3-day mean of 2 SD or a 3 SD day);
  commander summary reworded without a double negative.
- **For the medical officer**: each shared alert expands to what the crew member was told, the
  shared readings, and the source.
- **Skin temperature** now sits at wrist-skin level (fitted to LifeSnaps) and is labelled "not a
  fever reading"; thermometer readings are a separate series.
- **Evidence tags** on every changed reading ("tested on real data", "simulation only", "fixed
  reference values"); a "sensors alone" line and the with/without-check-in distinction in the replay;
  notices in the last 30 days against the budget on Today; README leads with the live link and a
  screenshot; named indicators (blood pressure with both numbers, blood sugar, thermometer) reachable
  from Today's routine.

Not done from round 2: a richer anatomical figure; a CO2 "now" tier; respiratory rate; tuning the
post-transition band; recalibrating full-set thresholds on real multi-sensor data (the LifeSnaps test
shows it is needed).

## Round 3 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 7, relevance 8, presentation 7 (37 of 50), "nominate:
yes, conditional on fixing the replay claim". Six high-severity issues across the four reviewers.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Judge (also flight surgeon, astronaut, statistician) | The replay's result card said "flagged it 1 day before symptoms began" and "the sensors alone showed the pattern on Day 119", but the only Day 119 entry was a low-mood notice with a different action. The illness advice came on Day 120 with her own symptom tick. | Only a notice whose rule matches the scripted event now counts as flagging it. The card reads: flagged on the day symptoms began, from her check-in combined with drifting readings; sensors alone one day after; the Day 119 mood notice is named and not counted. The log shows when one open notice changes its reading. The scripted-event note says the case is an easy one (a 7 bpm rise, above the upper quartile of real episodes) with a four-day simulated run-up. |
| 2 | Judge | The README said a flight surgeon "watches crew health in near real time" on the ISS, contradicting the app. | Replaced with the app's wording: seconds away by voice, weekly private conference, routine vitals not streamed. |
| 3 | Astronaut | Check-in said "Everything stays on this tablet unless you share it", while the commander always sees a readiness tier and a serious symptom is shown to others at once. | The line now says what other roles see by default and links to Sharing. |
| 4 | Flight surgeon | The thermometer box answered any reading under 38.0 °C with "a light session is reasonable", against the rule's own conditions. | The box reports what the rule table now says. A normal reading "does not clear you for exercise", and the highest reading of the day still counts. End-to-end tested. |
| 5 | Flight surgeon | Extreme readings (heart rate 170, glucose under 30) were refused, and the refusal aborted the whole save, including ticked red-flag symptoms. | Symptoms and every valid value are always saved. A value far outside the usual range is saved after one confirmation tap; only a physically impossible number is rejected, and only that field. New rules treat an extreme heart rate as "now". Unit and end-to-end tested. |
| 6 | Flight surgeon | A repeat reading overwrote the first: glucose 50 then 85 erased the 50, closed the alert and left no record. | Readings are kept in an append-only log with times; a fixed rule looks at every reading of the most recent day; "now" and "today" findings from the crew member's own entries stay on the medical officer's list until closed with a note. Unit and end-to-end tested. |

Medium-severity findings fixed in the same pass:

- **Headline was not the deployed configuration** (statistician, judge, flight surgeon). New analysis:
  the simulator-fitted model and thresholds applied unchanged to real people. That is now the
  headline (+32 above luck, 22 to 41, at 1.40 false alerts per person-month), with the result on
  never-fitted people beside it. The cross-validated daily-steps figure is a supporting row.
- **Chance correction** (statistician). Pretend events now carry real missing data and are weighted
  to the device mix of the episodes; three other estimates are tabulated (the earlier method gives
  +30 where the new one gives +34); the limit that dates cannot be calendar-matched is stated as
  making the figure an upper bound; heart rate alone gets equal prominence.
- **Superiority claims** (statistician). Paired intervals added for Keel against the simple rule
  (+5, −2 to 12: not distinguishable), for the app's activity feature, for the original window (+10,
  −3 to 23 over a fixed threshold) and for "an open alert also counts". The text now says a personal
  baseline is probably, not provably, better, with no correction for multiple looks.
- **Stale and mismatched numbers** (statistician, judge): calibration text in METHOD, three figures
  on the Method screen, README counts. Calibration is now idempotent, so all five result files share
  one code version.
- **Simulator realism reported too kindly** (statistician). The text now says the pass marks were set
  during review, that what passes was fitted on the other half of the same data, and that every
  independent check fails or is off. The five-sensor transfer test uses the validation half only.
- **Simulated results depend on the event mix** (statistician). Detection above luck is now given by
  event type with intervals; for illness and low mood they include zero.
- **Bed rest** (statistician): README now says "flags", "not significant", "from widening the band".
- **Detector selection** (statistician): described as arbitrary among equals; the dependence of the
  simulator on 38 of the evaluated episodes is disclosed.
- **Rules** (flight surgeon): cough and a fever reading corroborate a sensor notice; merging two
  illness findings keeps the more serious urgency; exercise advice is suppressed beside an illness or
  fever finding; the medical officer as patient is sent to the commander in every rule; wording that
  assumed gravity was changed; new fixed rules for a single fast heart rate, diastolic pressure,
  cabin CO2 at 4 mmHg, a sleep floor, a symptom lasting three days and vomiting after a high dose;
  the Guide's "when to involve someone else" list is generated from the rule table; the red-flag
  rule no longer promises a ground summary that is not sent; some red flags go to the medical officer
  only; one-sided swelling added as a red flag [69]; body temperature in flight cited [68]; a weekly
  thermometer baseline is prompted.
- **Medical officer's needs** (flight surgeon): a worklist with closure notes, the reading log,
  medication classes, photos.
- **Everyone flagged** (judge, astronaut): a single tick of tiredness or stuffiness no longer turns an
  area amber. Crew members with no flag rose from 12% to 48% of simulated person-days; on the demo
  day two of four are clear.
- **Today** (astronaut): "Steady" is shown only when no area is amber; statistics moved off the main
  screen; the share button says exactly which setting changes; the body figure carries a shape on
  each flagged area; link-aware wording for the message home.
- **Earth link** (judge, astronaut): cutting the link explains why nothing is queued yet and offers
  the next day; a blackout shows which day of how many and when the link is expected back.
- **Inputs** (judge): a photo for the medical officer can be taken at check-in.
- **Check-in** (astronaut): one Save bar with an opaque background; a "None" answer for food; a tick
  on selected answers.

Not done from round 3: one list of body areas shared by Today and Sharing (the first sharing area
was renamed "Heart, oxygen and temperature" instead); a separate tick for a blistering rash;
respiratory rate; allergies and pre-flight baselines; entering vitals for an incapacitated crew
member; default sharing still hides symptom names from the medical officer; a demo mode that hides
script names and code versions on the Validation and Data sources screens (the brief requires every
figure to link to its script); the body figure is still schematic; treatment or medication guidance
(excluded on purpose); a calendar-matched chance level (impossible with shifted dates); correction
for multiple comparisons.

Where we did not follow a reviewer: the flight surgeon asked for tiredness to corroborate a sensor
notice outright. In the simulated crew that made flags nearly universal, so tiredness counts only
when reported on two of the last three days. The sleep floor was set at five hours, not five and a
half, for the same reason.

## Round 4 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 7, relevance 9, presentation 7 (38 of 50), "nominate:
yes". All four reviewers found at least one high-severity issue.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Judge, astronaut | After an urgent blood sugar (50) and heart rate (170), "Food and fluids" stayed green on the body figure and on the medical officer's card; heart showed only "act today". | An area now shows the worst open finding that rests on any of its indicators, fixed-threshold rules included. Unit-tested. |
| 2 | Judge | The alert said "since Day 121"; the replay logged "Act today" on Day 120. | The merged illness finding dates from whichever part began first, and a symptom-led finding from the first day its rule held. |
| 3 | Astronaut, flight surgeon | Exercise advice contradicted itself: "Exercise: 0 of 120 min today" beside "Stop, rest"; "Do today's session" beside the urgent CO2 rule and other stop-or-rest rules; "light session only today" after a normal temperature. | One list of rules that hold exercise; while any is open, the exercise rule is suppressed and the routine says "on hold until the medical officer agrees". End-to-end tested. |
| 4 | Astronaut | "Your answers stay on this tablet" and "Nothing goes to the ground automatically" contradicted the daily ground summary and the one-tablet demo. | Reworded on Check-in, Sharing and Earth link to say what is stored where and what leaves. |
| 5 | Flight surgeon | Saving a strap reading erased the day's check-in, including red flags; unticking a red flag removed it from the medical officer's list. | The strap reading merges into the day's entry; ticked red flags are append-only for the day. Unit-tested. |
| 6 | Statistician | The headline "Keel as the app runs it" was a two-sensor stand-in, not the shipped model. | Relabelled everywhere as Keel's method on two sensors with simulator thresholds. The shipped 11-channel model was scored on a real import's channels: 12% flagged, +9 above luck, 0.08 false alerts per person-month, alert tier never fired. That result is on the Validation screen and the import card. |

Medium-severity findings fixed in the same pass:

- **Early warning** (statistician): alerts starting by onset are above luck at the notice tier (+15
  to +18) but about zero at the alert tier. The text now says "no useful early warning shown" and
  gives the numbers and the confounders.
- **Phase-handling cost was an artefact** (statistician): luck now comes from the same flight days of
  event-free missions. With phase handling +24 (14 to 33), without +15 (6 to 25). The earlier "it hides
  early events" claim is withdrawn everywhere.
- **Predictive value for the headline configuration** (statistician): 1 in 27 at the alert tier.
- **Luck matched on time since the recording began** (statistician): 31%, gap +35; added to the
  sensitivity table.
- **"Nothing was fitted on"** (statistician) became "the simulator's calibration did not use".
- **Calibration CV capped at 2.0** and an unsupported chart caption (statistician): fixed.
- **Readings** (flight surgeon, astronaut): spot heart rate and oxygen are stored apart from the
  overnight series; out-of-range or "act now" values are saved at once and can be withdrawn as typing
  mistakes, kept struck through; a value typed again is logged again; closing an item removes its
  finding; an urgent reading from an earlier day becomes "act today" and says it awaits the medical
  officer; no time limit on the medical officer's list.
- **One reading, one finding** (flight surgeon, astronaut): the lesser of two rules on the same
  reading is dropped; the heart-rate rule is split into fast and slow.
- **Ordering** (flight surgeon): heart rate, oxygen and blood pressure rank above blood sugar; every
  other "act now" item is named in the action card; "if you are awake and can swallow" added.
- **Emergency sharing content** (flight surgeon): the medical officer sees the symptom names and
  readings with times, and "X was told: …".
- **Notice that keeps changing its reading** (judge, astronaut): a notice keeps its reading while that
  rule still holds unless a higher rule applies.
- **Radiation and vomiting** (flight surgeon): the rule now needs at least 100 mSv in three days (a
  provisional value) and says motion sickness is far more likely.
- **Sleep below a floor** (judge, astronaut): a night under five hours turns the sleep area amber
  whatever is usual for the person, so the medical officer no longer sees "Steady" at 4.5 h.
- **Why not ship the simple rule** (judge): one sentence on the Validation screen.
- **Wording and layout** (all): reading labels and 24-hour times, red-flag tiles in two columns,
  space under the Save bar, a structured "When to involve someone else" list, CO2 3.0 labelled the
  same everywhere, "act now" in the sharing key, the temperature-in-flight claim limited to what the
  abstract says, "early sign" removed, chart labels shortened, Save reading made the primary button,
  the duplicate thermometer prompt hidden, emergency sharing confirmed on Today.

Not done from round 4: thresholds per sensor set (so imported watch data alerts at its budget); a
demo mode; an overnight oxygen floor; a free-text field for "something else"; recording a true zero
fluid intake; difference intervals for device and feature contrasts; a base rate for the bed-rest
flags outside transitions; treatment guidance (excluded on purpose).

## Round 5

See the end of this file once the fifth round has run.
