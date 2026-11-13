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

## Round 5 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 7, relevance 8, presentation 7 (37 of 50), "nominate:
yes". The statistician found no high-severity issue; the other three found some.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Flight surgeon | A closure note was keyed by rule and day, so a new dangerous reading of the same kind later that day (or a newly ticked red flag) was hidden: no alert, no emergency share, nothing on the list. | A closure applies only to readings and check-ins older than the note; anything entered after it reopens the item. Unit-tested. |
| 2 | Flight surgeon, astronaut, judge | After glucose 50 then a normal repeat of 85, Today still said "eat or drink something sugary now". | When the latest reading of the day is back on the safe side, the advice says so, the status drops to "act today", and the item stays on the medical officer's list. Later days say "still open, tell them today". Unit- and end-to-end tested. |
| 3 | Flight surgeon | "Stays on the medical officer's list" was false under default sharing for "today" items (fever 38.0 to 39.3 °C, glucose 54 to 69, a change in vision, and more). | Under emergency sharing the medical officer is told of every "now" and "today" item; where its area is not shared, only that an item exists in that area. With emergency sharing off, the alert says the medical officer has not been told. Unit-tested. |
| 4 | Astronaut | The check-in header promised the commander sees only a tier, while an "act now" reading is shown to the commander at once. | The header now says that a serious symptom or a reading past a safety line goes at once to the medical officer and, as backup, the commander. |
| 5 | Judge (also flight surgeon, astronaut) | Two "resting heart rate" values on one screen (overnight 66, typed 170). | The wearable value is "Resting heart rate (overnight)"; the typed field is "Heart rate now, sitting at rest (spot check)". |
| 6 | Judge | Method and Validation disagreed ("most" against "much" of the signal from activity; 1 in 25 against 1 in 27). | Aligned. |

Medium-severity findings fixed in the same pass:

- **Imported data** (judge, recurring since round 4): imports now run on a heart-rate-only model fitted
  and calibrated on the 251 real people, whose cross-validated performance is the "heart rate alone"
  row; the on-board 11-channel model is no longer used for imports. Imported data also shows a banner
  that the advice is written for a crew with a medical officer, and to contact a doctor.
- **A notice that softens without the medical officer** (flight surgeon): once a notice has looked like
  illness it keeps exercise on hold and the medical officer involved until it closes.
- **A confirmed fast heart rate** (flight surgeon): two readings of 120 or more at rest are now "act now".
- **The ground** (flight surgeon): the daily summary carries a count of open urgent items (no details)
  under emergency sharing, and the medical officer's list suggests consulting the flight surgeon.
- **Withdrawing a reading** (flight surgeon) needs a second tap; earlier unanswered "is that what the
  device showed?" questions stay until answered (astronaut); typed fields clear after saving.
- **Radiation and vomiting** (flight surgeon): the line is now 1000 mSv in three days, and the "take
  nothing for nausea" step became "tell the medical officer before taking anything".
- **Wording** (flight surgeon): "no treatment advice" became "no medication advice"; the second step of
  the 15/15 rule was added; "thoughts of harming someone else" added as a red flag; an injury is shown
  to the commander; cough with falling oxygen prompts a fingertip reading now.
- **Areas flagged without a reason** (judge, astronaut): an area is coloured only by readings actually
  involved (entered values, or deviations shown as evidence), not by every indicator a rule mentions.
- **"Act now" and "act today" look alike** (astronaut): the body list now says "Now" or "Today" in words.
- **Private data and the commander's tier** (astronaut): Sharing says the tier uses all readings.
- **Statistician's mediums**: remaining "the app's own configuration" labels removed; the shipped model
  added as a bar; the "7-day activity" proxy (steps against exercise minutes) disclosed; the held-out
  group's lack of test-date-only episodes disclosed; predictive-value caveats in both directions;
  "never fired" corrected to "flagged no episodes (three false alerts)"; the simulator's "three in ten
  with no rise" no longer described as a real-data fact; the demo day's selection disclosed; alerts
  that count as neither detection nor false alert are now counted and reported; the bed-rest cost
  (9.8% to 11.1% of ordinary days) and the pulse-only rule are stated.

Not done from round 5: thresholds for other sensor subsets (for example a failed HRV sensor); a
"typical case" replay beside the easy one; storing source documents on the tablet; a confirm-first
delay before emergency sharing (we chose to share first and allow withdrawal); trend-chart clutter.

## Round 6 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 8, relevance 9, presentation 7 (39 of 50), "nominate:
yes". The statistician again found no high-severity issue; the other three found some.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Flight surgeon | "Your repeat reading is back on the safe side" fired when the repeat still met a lesser rule (blood sugar 50 then 60, temperature 39.6 then 39.0), and with no time for sugar to work. | "Safe" now means the latest reading triggers no fixed rule on that measurement, and for blood sugar the repeat must be at least 15 minutes after the first. Unit-tested for 60 and for a repeat after 2 minutes. |
| 2 | Flight surgeon | The motion-sickness and fluid rules said "tell the medical officer today" for what the red-flag list calls "now" (repeated vomiting, severe flank pain). | Those steps now say to tick the red flag and tell the medical officer now. |
| 3 | Judge, astronaut | One blood sugar of 50 showed three deadlines (Guide "now", Today "today", list "at once"). | After a safe repeat the advice keeps "now" for telling the medical officer and says no more sugar is needed; the list says "a later reading was back on the safe side"; the reading-log text says what the list keeps and what the advice follows. |
| 4 | Judge, statistician | The import card said both "calibrated on 251 real people" and "calibrated on simulated missions". | The stale line is gone. |
| 5 | Astronaut | Sharing and Check-in disagreed on which red flags are hidden from the commander. | Sharing builds its list from the symptom table. "Thoughts of harming someone else" is now shown to the commander (flight surgeon's advice); an injury too. |
| 6 | Astronaut | "Nothing personal" on Earth link and "nothing shown that they have not shared" on Crew contradicted the urgent-item count and the redacted open items. | Both sentences now say exactly what crosses: a count of open urgent items for the ground; the existence of an item in an unshared area for the medical officer; a tier computed from all readings for the commander. |
| 7 | Astronaut | After typing 170 at check-in, the screen did not say what to do and hedged ("if it is past a safety line"). | It now says "Act now: stop, rest, tell the medical officer now" and states plainly whether others can see it; the prompts no longer sit inside the sticky Save bar. |

Medium-severity findings fixed in the same pass:

- **"Shown at once" implied an alarm** (flight surgeon): Today, Check-in and Alert now say the item is
  visible on the other Crew screens and nobody is alerted: tell them yourself.
- **Open items carry their content** (flight surgeon): under emergency consent the medical officer's
  list shows the entered readings and red-flag names for every item, also after a safe repeat.
- **Two heart rates of 120 or more** now hold exercise; the severe low-sugar rule carries the same
  restrictions as the mild one, plus a step for the person with them.
- **Saving a check-in erased the simulated symptoms** (flight surgeon): the form starts from them.
- **Headline** (judge, statistician): the Validation screen now leads with the two models the app runs,
  the heart-rate import model on real data and the on-board model in simulation, with the two-sensor
  simulator-threshold result third; bars show points, not percentages.
- **Held-out group** (statistician): now includes the people whose only episodes are test-date-only;
  "did not use" reworded; predictive value given for the import model; the bed-rest flag rate on
  14-day stretches away from any transition is now computed as a luck baseline; the replay's
  closing figure says it is a two-sensor version, not the replay's model; the import card says the
  watch maker's resting heart rate is not the quantity the model was calibrated on.
- **Smaller fixes**: the value appears in a fixed rule's title ("you entered 170"); a step ruled out
  by the person's own reports is hidden; the thermometer stays available when a different alert leads;
  one label for the "caution" tier ("Worth a look"); body-list labels no longer overflow; the check-in
  header is one line; the "Typing mistake?" withdrawal needs a second tap; the replay says its demo day
  was chosen from the detector's output.

Not done from round 6: trimming prose on every screen; a "typical case" replay; logging notice
closures in the replay; a more distant arrival geometry for the link delay; a raw-sample resting
heart rate for imports.

## Round 7 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 8, creativity 8, validity 7, relevance 9, presentation 7 (39 of 50), "nominate:
yes". The statistician found no high-severity issue for the third round running. The judge, the
astronaut and the flight surgeon all found the same one.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Judge, astronaut, flight surgeon | After a blood sugar of 50 and a repeat of 85 a few seconds later, Check-in said "stop, rest, tell the medical officer" (no sugar), Today said "eat something sugary now", the medical officer's list said the repeat "was back on the safe side", and the reading log promised that advice "follows your latest reading". | The check-in prompt now uses the rule's own action; the medical officer's list applies the same 15-minute rule as the crew member's screen; a repeat that comes too soon says so ("sugar takes about 15 minutes to work"); the reading-log sentence says when a repeat counts; low blood sugar ranks first among "now" items; after a safe repeat the advice says to eat a snack or the next meal. |
| 2 | Astronaut | Check-in and Sharing said urgent items "go at once" to the medical officer, while the alert cards said nobody is alerted. | Both now say the item appears on the Crew screens and nobody is notified; the wording also changes when emergency sharing is off. |

Medium-severity findings fixed in the same pass:

- **"Now" downgraded at midnight** (flight surgeon): an urgent item stays "now" until closed; a red flag
  ticked in the last three days stays even if the next check-in leaves it out.
- **Unlogged retests** (flight surgeon): reaction-test results and manual sleep entries are logged; a
  heart-rate strap reading is a logged spot check and meets the fixed safety lines.
- **No fixed floor for overnight oxygen** (flight surgeon): overnight 90% or lower now asks for a
  fingertip reading (today); two blood pressure readings at 220 upper or 130 lower are "now".
- **Check-in banner by urgency** (flight surgeon): a "today" reading says it is on the medical
  officer's list; a thermometer reading under 35 °C asks for a repeat.
- **Red-flag routing** (flight surgeon): one-sided swelling and tooth or jaw pain now reach the
  commander; only thoughts of self-harm stay with the medical officer.
- **Check-in after save** (astronaut): the Saved box says how many items need action now.
- **Exercise** (astronaut): "No exercise until the medical officer clears you" whenever anything is "now".
- **Medical officer's view** (judge, astronaut): "(entered: 170)" instead of "(you entered 170)"; the
  reading-log explanation appears once.
- **Body list labels** (judge, astronaut): the status words sit under the area name, not beside the icon.
- **Check-in prefill** (astronaut): mood and fluids start from today's recorded values.
- **Statistician**: Today names which configuration its false-alert expectation comes from; the
  simulated +26 says most of it comes from events whose scripted change is itself an input; the
  import-model figure carries the Fitbit and vendor-resting-heart-rate caveats; "a personal baseline
  is probably better than a fixed threshold" is withdrawn (like for like it is +11, −3 to 25); every
  headline bar shows its false-alert rate; the replay's staging is recorded in the mission file and
  stated (no candidate day had two quiet weeks); METHOD corrections (peak day, merge rule, measured
  not constructed false-alert rate, predictive-value bounds).
- **Illness size** (judge): one statement of the real heart-rate rise (a fitted peak of about 3 bpm, or
  4.6 bpm averaged over four days, depending on the measure).
- **Replay headline** (judge): "flagged it with her check-in, on the day symptoms began".

Not done from round 7: a real notification between devices; locking emergency sharing on for red
flags; original-window results for every configuration; trend-chart label clutter.

## Round 8 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 8, relevance 9, presentation 7 (39 of 50), "nominate:
yes", and **no high-severity issue**. The statistician also found none (fourth round running). The
astronaut and the flight surgeon each found one.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Astronaut | With two "act now" items (blood sugar 50, heart rate 170) the top card showed only the sugar step; "stop, rest" for the heart rate sat below the fold, under a temperature card. | Every "act now" action is now listed in the top card; the temperature card moved below the other alerts. |
| 2 | Flight surgeon | The "repeat is back on the safe side" text mentioned sugar for every kind of reading (a temperature or a high blood sugar too), relabelled "today" rules as "at once", and only blood sugar had a waiting time. | The text depends on the rule (sugar only for low blood sugar), keeps the rule's own urgency, and every measurement has a minimum time before a repeat counts (blood sugar 15 minutes, heart rate and oxygen 2, blood pressure 5, temperature 30). Unit-tested. |

Medium-severity findings fixed in the same pass:

- **Withdrawing a reading** (flight surgeon): the button withdraws the reading the question is about,
  not the latest one.
- **A thermometer or strap save erased the simulated symptoms** (flight surgeon): fixed, as at check-in.
- **Closing a detector notice** (flight surgeon): the medical officer can close an illness notice with a
  note on the Crew screen; that lifts the exercise hold and the readiness tier.
- **Headline churn** (flight surgeon, astronaut, judge): once a notice has read as illness it keeps
  that headline until it closes, and it never falls back to the generic "several readings" one.
- **Smoke or chemical exposure** (flight surgeon): its own rule: follow the vehicle emergency procedure
  and alert the whole crew; Keel is not the alarm. The CO2 rule says spikes are the alarm's job.
- **"Call a crewmate to you now"** opens every personal "act now" action (flight surgeon).
- **Commander's view** (astronaut): "Ask Lucía", not "or the medical officer". Sharing says how data
  would travel between tablets in a flight version. The share button names the area it opens.
- **After saving a check-in** (astronaut): the screen scrolls to the result.
- **Presentation** (judge): the Validation screen opens with three lines: what Keel reliably does,
  what it does not do, and the one honest number; the over-budget bar says so in its label; the
  landing text leads with what is shown to work.
- **Statistician**: the bed-rest plain-baseline figure is no longer called "above chance" (p about
  0.1); the bed-rest rule's differences from the app are stated; the import card names the Fitbit
  dependence; predictive value is quoted first for the configurations the app runs; "attributable
  to" instead of "coincide with"; the five-sensor transfer is described as alerts in unlabelled
  people; the replay compares like with like; a sampling interval is computed for the simulated
  illness gap; METHOD states which constants were fixed before the first real-data run.

Not done from round 8: a real alert to the medical officer's device or a one-tap call; locking emergency
sharing on for red flags; handling readings either side of midnight as one sequence; a spot heart rate
of 100 to 119; Trends chart labels.

## Round 9 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 8, relevance 9, presentation 7 (39 of 50), "nominate:
yes", **no high-severity issue**. The statistician found none for the fifth round running. The
astronaut found one and the flight surgeon two, all fixed.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Astronaut | The check-in photo card said "for the medical officer", but under default sharing the medical officer never sees photos. | The card is "Photo (kept on your tablet)" and says live whether the medical officer can see it, with one tap to share Symptoms in full detail. The same for medication classes. |
| 2 | Flight surgeon | The repeat waiting time was measured from the day's first reading, even a normal one, so 92, then 50, then 85 a minute later stood the alarm down. | The clock starts at the first reading that met the rule, on the crew member's screen and on the medical officer's list. Unit-tested with that exact sequence. |
| 3 | Flight surgeon | Two "act now" rules (blood pressure 220/130 twice, blood sugar 300 or more) did not hold exercise, and the more severe blood-pressure rule removed the hold the milder one had set. | Every fixed "act now" rule holds exercise. Unit-tested for four readings. |

Medium-severity findings fixed in the same pass:

- **Closing a notice** (flight surgeon): the medical officer either adds a note and keeps it open, or
  closes it as "cleared for exercise and duties"; closing an illness notice works even when its
  details are not shared.
- **Medical officer's default view** (flight surgeon): status level in every area, including mind and
  mood; run-based "today" rules (mood, overnight oxygen, sleep floor, heart rate on two nights) now reach
  the list.
- **Repeat wording** (flight surgeon, astronaut): "Re-check at 18:48"; "if you have not taken sugar,
  take it now"; the bystander step for low blood sugar shows on Today; fever medicine logged today
  is mentioned after a normal thermometer reading.
- **One tier scale** (astronaut): the commander sees Steady / Worth a look / Talk to the medical
  officer first; "Detector notice" became "Notice from the readings".
- **Check-in prompts** sit next to the result at the top, and the sticky Save bar hides while a
  question is open (astronaut). Mood says it is private unless shared, and that the commander's tier
  uses it.
- **Today** shows the other actions of an open notice; sleep timing reads "2.3 h later than usual";
  the footer is one plain line; the landing banner is three short sentences (astronaut, judge).
- **README** opens with one paragraph and one number (+22) (judge); the replay quotes heart rate alone.
- **Smaller**: smoke exposure names the commander as lead; the heart-rate 150 action says to count the
  pulse by hand; "critical task" instead of "spacewalk" during transit; the blackout no longer claims
  to be a solar conjunction; the illness-size statement uses one number.
- **Statistician**: the realism interval no longer claims "not only sampling noise"; the personal
  against population-baseline contrast is reported at both tiers (mixed); predictive value leads with
  the configurations the app runs and says the range is a spread, not an interval; simulation
  intervals are labelled as seed variation; cabin CO2 events counted per crew member is stated; the
  bed-rest test is described as a simpler version; lenient carry-over marks are stated. New analyses:
  the original wider window for the two headline configurations, the import model on Fitbit's own
  daily resting heart rate (LifeSnaps), and a count of how many calibration-half people are among
  those analysed.

## Round 10 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 7, validity 8, relevance 9, presentation 6 (37 of 50), "nominate:
yes". The statistician found no high-severity issue (sixth round running). The judge found one, the
astronaut two, the flight surgeon one.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Judge | Three figures for the real illness heart-rate rise (4 to 5, 3.3, 4.6 bpm). | One real-data figure everywhere (about 4.6 bpm over the four days from onset); 3.3 bpm is labelled as the simulator's template. |
| 2 | Astronaut | The mood question said "private" while the medical officer sees its status by default. | The label shows the live setting ("Medical officer sees mood: status · commander: a tier only") and links to Sharing. |
| 3 | Astronaut | An "act now" reading alerts nobody, and there is no button. | Every personal "act now" card has a large "Alert the medical officer and commander now" button; the alert shows at the top of their Crew screens until one of them taps "Acknowledge: I am on my way". In the demo this happens on one tablet; a flight version would use the cabin network, with no Earth link needed. |
| 4 | Flight surgeon | Closing an item was the same as clearing the person for duty, a cleared illness notice could not come back if it worsened, and the medical officer could clear a notice whose details they could not see. | Three choices: note and keep open; handled, restrictions stay (exercise stays on hold); cleared for exercise and duties (only when the area is shared). A notice's closure applies to its status and pattern at the time: if it worsens or changes, it reopens. |

Medium-severity findings fixed in the same pass:

- **Yesterday's "act now"** (flight surgeon): becomes "act today: still waits for the medical officer",
  without the "call a crewmate" prefix, and stays on the medical officer's list.
- **Low blood sugar first step** (flight surgeon): "Take sugar now if you can swallow, and call a
  crewmate to you."
- **Blood sugar units** (flight surgeon): a value under 35 asks whether the meter showed mmol/L and gives
  the conversion.
- **Exercise wording** (astronaut): one rule everywhere: "No exercise until the medical officer clears
  you"; the illness action says the same.
- **Today** (astronaut): extra actions from the readings sit under "When you can"; the re-check time
  comes first in a too-soon repeat; sleep timing is described against the schedule and against usual.
- **Guide and import card** (flight surgeon): "No threshold has been reviewed by a clinician"; the list
  is built from the rule table but wording is adapted at run time; imported blood pressure and sugar do
  meet the fixed lines.
- **Presentation** (judge): the Validation chart leads with heart rate alone, highlighted, with the
  over-budget configuration second and not highlighted; Sharing's promise names fixed rules only; the
  replay says it runs past "today".
- **Statistician**: the README calls the +32 row a linking analysis and bolds heart rate alone;
  predictive value on the watch maker's own resting heart rate (about 1 in 30 alert-tier, 1 in 61
  notices); the Method range quotes only configurations the app runs; the early-warning figure names
  its configuration and gives heart rate alone (+16, 7 to 25); device and five-sensor claims softened
  or given their sample size; night-to-night variation read from the results; cohort column renamed
  "Recordings"; METHOD wording and the bed-rest learned shift (+1.0 bpm) stated.

## Round 11 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 8, relevance 8, presentation 7 (38 of 50), "nominate:
yes", **no high-severity issue**. The statistician found none (seventh round running). The astronaut
found one, the flight surgeon two.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Astronaut (judge similar, medium) | The alert button was not on the check-in result, and on Today it looked weaker than "Why, and what next". | A large filled red alert button on the check-in result and at the top of the Today card; "Why" is no longer the primary button while anything is "act now"; the thermometer and non-urgent items fold away until the urgent ones are dealt with. |
| 2 | Flight surgeon | The alert worked once per day; either role's acknowledgement cleared it for both; an unacknowledged alert expired after a day; the banner named only one of two urgent items. | An alert belongs to the set of urgent items, so a new emergency can be raised; each role's acknowledgement is shown with its time; the banner stays until the medical officer acknowledges it, with no expiry; it lists every urgent item; the button names only the medical officer when the item is theirs alone. |
| 3 | Flight surgeon | The smoke or chemical exposure rule began "Call a crewmate to you now", bringing a second person into the hazard. | The crewmate prefix applies only to fixed vital-sign rules (not a fever reading) and serious-symptom ticks, never to exposure. |

Medium-severity findings fixed in the same pass:

- **Blood sugar units** (flight surgeon): a value under 35 is not saved or acted on until the crew
  member says which unit the meter showed; mmol/L is converted.
- **Early illness notice** (flight surgeon): its own wording ("take your temperature, skip hard
  exercise, tell the medical officer if 38.0 °C or you feel unwell"), not a failed text edit.
- **Clearance after an in-person exam** (flight surgeon, astronaut): the medical officer can clear a
  notice whose readings are not shared, by recording an examination.
- **Medication during an emergency** (flight surgeon): today's medication classes reach the medical
  officer's emergency view.
- **Thermometer baseline** (flight surgeon): in-flight readings only, last 30 days.
- **Heart-rate strap** (flight surgeon): needs two minutes; the short HRV reading is stored apart from
  the overnight value; the save message says when a fixed line is crossed.
- **Body figure and charts** (astronaut): the outer frame is labelled "Cabin"; out-of-range chart points
  are rings, so the diamond means only "act today".
- **Commander's tier** (astronaut): items marked "medical officer only" never change it, and Sharing says so.
- **Exercise ring** (astronaut): paused while exercise is on hold.
- **Presentation** (judge): "When Earth can't answer, Keel tells you what to do and who to tell"; a
  label legend on the Crew screen; Check-in says "past a fixed safety line" when it is.
- **Statistician**: the short version gives the tablet model's own figures (simulation illness +11;
  +9 on a watch's heart rate) and states +19 to +22 for the window; the simulation tile leads with
  illness, not the all-event figure; predictive value for the import model on both inputs, unknown for
  the tablet model, and "upper bound" conditional on Earth false-alert rates; METHOD names the
  hand-set exercise cut as a second route from real data into the on-board thresholds; the replay no
  longer compares a template peak with a four-day mean.

## Round 12 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 8, relevance 8, presentation 6 (38 of 50), "nominate:
yes", with one high-severity issue. The astronaut found three, the flight surgeon one, and the
statistician one (the first since round 3).

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Judge | The finished replay ended on a green "Steady" while the same screen said nobody had closed the notice. | The replay ends four days after onset, while the notice is still open, and says what happens next. |
| 2 | Astronaut | After a dangerous reading Check-in said "they are not alerted", and nobody was until the button was pressed. | An automatic alert after 10 seconds, with a cancel button for typing mistakes; leaving the screen sends it at once. |
| 3 | Astronaut | The act-now block and alert button appeared about two screens above the measurements just typed. | Prompts sit next to the save button; the sticky save bar hides while a prompt waits. |
| 4 | Astronaut | Sharing promised something the Crew screen did not do. | Sharing text rewritten to match what each role sees, generated from the same settings. |
| 5 | Flight surgeon | Imported CSV blood sugar had no unit check, and same-day readings were averaged. | Blood pressure, blood sugar and oxygen keep the most extreme reading of the day; a file mostly under 35 is converted from mmol/L, otherwise values under 35 are dropped and listed; imported values past a safety line say they are from a file and point to a doctor, not to a crewmate. |
| 6 | Statistician | The Method screen still said phase handling makes early problems "much harder to see" and that bed rest "roughly halves false flags". | Rewritten to match the results: no measured cost in simulation, bed rest not significant and at about chance level. |

Medium-severity findings fixed in the same pass:

- **Stale urgent items** (flight surgeon): an "act now" item from an earlier day becomes "waiting for the
  medical officer" only 12 hours after the reading was entered.
- **Commander as backup** (flight surgeon): the commander can record "handled, restrictions stay" but not
  medical clearance; for an alert about the medical officer, the commander's acknowledgement counts.
- **Medical-officer-only items** (flight surgeon): they put the commander's tier on hold again, with the
  reason shown only as "a private matter for the medical officer"; the commander's alert banner stays
  hidden for alerts about such items. Sharing says so.
- **Emergency consent** (flight surgeon): the medical officer sees what every open item is and its
  readings, since they may be asked to clear it.
- **Items from a run of days** (flight surgeon): a week of low mood or nights of high heart rate stay on
  the medical officer's list after the run ends, keyed by the day the rule first held.
- **Blood sugar under 35** (flight surgeon): saved at once and treated as a dangerous low, with the
  unit question kept on Check-in and Today until answered (it was held unsaved, and readings under 10 were
  refused outright, so a typical 5.5 mmol/L could not be entered at all).
- **Unanswered alert** (flight surgeon): after five minutes without the medical officer's acknowledgement,
  a button alerts the whole crew.
- **Red-flag order** (flight surgeon): "Call out to the medical officer now, then save."
- **Early warning by configuration** (statistician): the early-warning figures name the configuration and
  add heart rate alone (+16 and +8, both counting the day of onset).
- **Predictive value for imports** (statistician): leads with the watch maker's own resting heart rate
  (about 1 in 30 at the alert tier), the input imports actually carry.
- **"Headline"** (statistician): the over-budget two-sensor configuration is called the linking analysis
  everywhere.

Low-severity items fixed: METHOD.md upper-bound direction and bed-rest wording, the simulator's illness
spread cap disclosed, the simulated-illness tier flip reported, "caught" replaced by the detection window,
the diastolic CSV column. Not done, with reasons: grams of sugar and hand-washing before a repeat reading
(the sources Keel cites do not say either; no source was found and opened), new red-flag symptoms
(black or bloody stool, sudden hearing loss: these change the indicator file and the research code version;
listed for a clinician), removing "Same as usual" for fluids, and limiting light exercise to detector-only
notices (both judgement calls for a clinician).

## Round 13 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 8, relevance 8, presentation 6 (37 of 50), "nominate:
yes", with one high-severity issue. The astronaut found three, the flight surgeon two, the
statistician one. Two of them (judge 1, astronaut 1) are the same finding.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Judge, astronaut (flight surgeon medium) | Five places still said nobody is alerted, while the round-12 automatic alert did alert them. | One rule, stated the same way on Check-in, Today, Alert detail and Sharing: an urgent save alerts the medical officer and commander after ten seconds unless cancelled; with emergency sharing off the alert says only that the person needs help. |
| 2 | Astronaut | Sharing said the medical officer sees same-day items in private areas only as "an item is open", and two paragraphs later that they see what it is. | The "always visible" list now matches the code: every open safety item, with what it is and its readings. The page opens with the three exceptions to "your data is yours". |
| 3 | Astronaut | With the extras open, the act-now instruction and countdown appeared above the extras, far from the measurement just typed. | The save result sits directly under whichever Save button was pressed, right after the measurements. |
| 4 | Flight surgeon | The Check-in alert button did not mark "medical officer only" alerts, so a self-harm tick could reach the commander's screen. | Alerts carry structured fields (`cmoOnly`, and the commander's text without private items) from one helper used by every alert path; unit-tested. |
| 5 | Flight surgeon | "Handled, not cleared" did not change the commander's tier and lapsed after a day; notice closures were never checked at all; two days without data turned an open item into "Not enough recent data". | A restriction is person-level and lasts until the medical officer records a clearance; it holds exercise and puts the tier on "Talk to the medical officer first"; open safety items or a restriction override "not enough data". Unit-tested. |
| 6 | Statistician | "Mostly on or after the first day of symptoms" was wrong for heart rate alone (30% of episodes had an alert start at least a day before). | The sentence was removed; the figure is given from the JSON where needed. |

Medium-severity findings fixed in the same pass:

- **One alert service** (flight surgeon): Check-in and the thermometer box on Today use the same hook;
  it sends after ten seconds unless cancelled, sends at once if the screen is left, sends a no-reason
  alert when sharing is off, and alerts the whole crew automatically if the medical officer has not
  acknowledged within five minutes (while the app is open). The cancel button says "Cancel the alert".
- **Imports** (flight surgeon): a `temperature` or `body_temperature` column and Apple Health body
  temperature are thermometer readings checked against the fever lines (`skin_temp` stays the wrist
  sensor); a day with both a low and a very high sugar is listed; a value under 35 in a mg/dL file is
  kept and treated as dangerously low; ambiguous slash dates are refused, unambiguous ones read in the
  file's own order. Unit-tested.
- **Early warning for heart rate alone** (statistician): its by-onset results exclude zero at both tiers;
  the text now says so and why it is still not claimed (counts the day of onset, no luck-adjusted
  figure for alerts strictly before onset, test-date anchors). Computing that strictly-before figure
  needs a pipeline change and is listed as not done.
- **Vendor predictive values** (statistician): "assuming detection carries over unchanged (not measured)".
- **Realism cause** (statistician): "mainly" became "possibly", with the smaller simulated heart-rate rise
  and onset-date error in the spread named.
- **Headline wording** (judge, astronaut): R-ILL is now "Readings like those often seen early in an
  infection"; its other readings are listed openly, not folded; the "After the above" fold names its
  items; a repeated reading says which one still counts ("50, then 85; 50 still counts").
- **Tier names** (judge): "notice tier" and "alert tier" everywhere.
- **Area names** (astronaut): each sharing area names the body-figure regions it covers.
- **Text density** (judge): the duplicate lead paragraph on Validation was removed and the emergency-sharing
  detail folded.

Low-severity items fixed: duplicated sugar wording, the automatic alert named as such on the Crew screen,
bed-rest "Keel" renamed to "pulse-only rule with phase handling" and "gain" to "fewer flags", a caption
limited to the personal detectors, the protocol change from DATA.md listed in METHOD.md. Not done: urgent
items ordered by clinical priority (the rule table's priority already puts low sugar first), lunar mission
on Today, a bone note, matched operating points for the +32 comparison (needs a pipeline run), threshold
changes the flight surgeon suggested (180/120 repeated as "now", fever line in flight), and source checks
on two notes (the CO2 figure was checked against the PubMed abstract in round 9 and is correct).

## Round 14 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 7, relevance 9, presentation 7 (38 of 50), "nominate:
yes", with three high-severity issues. The astronaut found three, the flight surgeon one, the
statistician none. All the highs were in the urgent-reading flow and overlapped:

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Judge, astronaut, flight surgeon | "Entered: 50, then 85; 85 still counts" named the normal repeat as the reading in force (round 13 picked the reading furthest from the first). | The title names the first reading past the rule's line ("the 50 still counts"); unit-tested. |
| 2 | Judge, astronaut (flight surgeon medium) | Today showed a 10-second countdown and "Cancel" directly above "Alert sent", and the medical officer got the alert twice. | Leaving Check-in sends the alert; Today's countdown started before that record was in state and sent a second copy. Actions now show at once, the hook re-checks the log before sending and hides its countdown once an alert exists; an end-to-end test checks for one alert and no second countdown. |
| 3 | Judge, astronaut | Sharing said only the medical officer is alerted and sees urgent details; the commander also is, as backup. | Sharing's summary and the emergency-sharing text say what the commander sees (what it is, the value entered, the action; never "medical officer only" items or the reading log); four exceptions listed, including the ground's count. |

Medium-severity findings fixed in the same pass:

- **Self-managed notices** (flight surgeon): a "worth a look" illness notice asks the person to skip hard
  exercise but no longer sets a hold that nobody could lift.
- **Clearance scope** (flight surgeon): the clearance buttons say they lift every restriction on the person.
- **Escalation** (flight surgeon): renamed "alert them again", since it reaches the same two people; the
  code comment says a flight version would escalate from the receiving tablets.
- **Sharing off** (flight surgeon): the medical officer sees "an item, details private" so it can be
  closed after they have talked; unit-tested.
- **R-V-HR1 step** (flight surgeon): says a second *typed* reading escalates, which is what the rules do.
- **Ask to be seen** (astronaut): "act today" items needing the medical officer have a one-tap request
  that appears on the medical officer's Crew screen until acknowledged.
- **Check-in after a dangerous reading** (astronaut): the card leads with "Act now: …" in large type;
  the Check-in intro is one sentence.
- **R-ILL title** (judge, flight surgeon, statistician): "Several readings have moved the way they can
  during an infection".
- **Illness heart-rate figures** (judge): the countermeasure text gives 4 to 5 bpm, 4.6 in the people the
  simulator was not fitted on.
- **Validation** (judge): the short version is three lines (by design; on real illness; everything else
  simulated).
- **Early-warning sentence** (statistician): no longer calls heart rate alone "the one result" above luck;
  the two-sensor notice-tier figure also excludes zero.
- **Bed-rest chance** (statistician): the claim that 4 of 14 is "about chance" was dropped everywhere; the
  chance level with the widened band was never measured.
- **Illness-rise baselines** (statistician): METHOD.md says the fit and the check use different baselines
  (real days −14 to −9 sit 0.68 bpm above the check's baseline against 0.10 simulated).
- **"Never saw"** (statistician): "not used by the simulator's fits", and the hand-set 30% unworn-night
  rate for simulated ground people is disclosed.

Not done, with reasons: an onset-excluded, luck-adjusted early-warning figure, a bed-rest chance level
with the widened band, one baseline for fit and check, a heart-rate-alone device split and window
sensitivity (all need pipeline changes and a full rerun; disclosed instead); larger body-figure regions;
the strap countdown text and strap readings bypassing the automatic alert; a repeated sub-35 °C rule;
the Earth–Mars delay rounding (about 4 to 24 minutes is what the cited source gives).

## Round 15 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 8, relevance 9, presentation 6 (38 of 50), "nominate:
yes", **no high-severity issue**. The flight surgeon and the statistician found none either. The
astronaut found one:

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Astronaut (judge medium) | "Ten seconds after you save, unless you cancel" was not true: leaving Check-in, even by its own "See Today" button, sends the alert at once. | Every place that states the window adds "at once if you leave this screen"; the countdown bar is pinned to the top of the screen and says so. |

The most consequential finding was a statistician **medium**: the multivariate EWMA turned each score to
its direction of concern but used a correlation matrix estimated on the unturned scores, so a joint
"heart rate up, HRV down" move was scored about 2.8 times too high. Fixed in `fit_model` (the matrix is
now D·R·D, D = sign of concern) and the whole pipeline rerun. After the correction the multivariate
detector led the simple 2-of-3 rule by 2.2 points on the simulated training missions, under the pre-set
3-point margin, so **the app now deploys the simple personal rule**. Every result reported for "Keel's
detector" changed with it (heart rate alone +22 → +19 (9 to 28); the two-sensor linking analysis
+32 → +28; the shipped model on import channels +9 → +16 at 0.35 false alerts a month; simulation
+26 → +31; the 7-day-activity configuration never fires at the alert tier, because its threshold lands on
the z-score cap). All documents were updated from the result files; the multivariate EWMA is reported
beside the rule (+34 on real data, paired difference +5, −2 to 12). The demo day now lists the
persistent-headache item before the readings-based notice, since reported items come first.

Medium-severity findings fixed in the same pass:

- **Alerts keyed per item** (flight surgeon): an item counts as alerted and acknowledged if any alert
  covered it, so a change in the set of urgent items no longer resets "Alert sent" or re-sends; unit-tested.
- **Clearance** (flight surgeon): items close one by one ("resolved, no restriction" or "not cleared");
  "Clear for exercise and duties" is a separate person-level action that says what it lifts. When the
  patient is the medical officer, the commander records a clearance passed on by the flight surgeon or a
  named backup; the medical officer cannot close their own notices.
- **Repeat reading on the card** (flight surgeon): urgent blood sugar, oxygen and heart-rate cards have
  a repeat box; end-to-end tested.
- **"Back below this line"** (flight surgeon): "back on the safe side of this line" for every rule.
- **Receiving-side escalation** (flight surgeon): an alert unacknowledged for five minutes says so on the
  Crew screen, for whoever reads it.
- **Shingles** (flight surgeon): the rash rule fires on the first day and leads with "painful or
  blistering, in a band on one side: tell the medical officer today".
- **Guided demo** (judge): "Demo: enter a dangerous reading" on the landing banner fills in a blood sugar
  of 50 for the person to save; end-to-end tested.
- **What triggered a notice** (judge): Today says whether reported symptoms were part of it.
- **Sharing** (judge, astronaut): a who-sees-what table (always / your choice) at the top; five
  exceptions listed, matching the box below.
- **One primary button** (astronaut): "Ask the medical officer to see me today" is the only primary
  button on an act-today card, and it is also on Alert detail; "Why, and what next" is secondary.
- **Readings label, share button, Crew area rows** (astronaut): "Readings behind the first item" when
  several items are urgent; "Share symptoms, medicines and photos"; area rows carry a status word.
- **Statistician wording**: simulated illness "through physiology and assumed drops in exercise, food and
  sleep"; "likely optimistic" instead of "upper bound"; missing data "handled the same way", not "the
  same"; the over-budget bar labelled with its rate; the bed-rest field fixed.

Not done, with reasons: a mission-wide glucose unit setting, a repeated sub-35 °C rule, a fever line
relative to in-flight baseline, R-MOOD's audience (judgement calls for a clinician); a nested bootstrap
that refits thresholds, a physiology-only simulated-illness ablation (pipeline work, disclosed).

## Round 16 (2026-11-12, fresh reviewers, redeployed build after the detector change)

Judge's scores: impact 6, creativity 8, validity 7, relevance 8, presentation 6 (35 of 50), "nominate:
yes", with one high-severity issue. The astronaut found two, the statistician one, the flight surgeon
none.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Judge, astronaut (flight surgeon medium) | Sharing promised the medical officer sees every same-day safety item with what it is, but a symptom item ("the same symptom three days running") reached them as "Notice from the readings in symptoms (details not shared)". | Under emergency consent a fixed-rule "act today" item reaches the medical officer with its title in any area (unit-tested); an untitled item from a fixed rule says "An item in …", not "Notice from the readings"; Alert detail and the ask button say exactly what the medical officer sees. |
| 2 | Astronaut (judge, flight surgeon medium) | The pinned countdown bar was see-through and printed over the Save button and the page heading. | The bar is back in the page flow under the Save button, with a solid background. |
| 3 | Statistician | Data sources said the import model ran "about twice its budget at the alert tier" on Fitbit's own resting heart rate; after the rerun it is about a fifth over. | Corrected; it was the last hand-typed result on that screen. |

Medium-severity findings fixed in the same pass:

- **Self-managed "act today"** (astronaut): a self-managed item (late sleep, missed exercise) now puts the
  commander's tier on "Worth a look", not "Talk to the medical officer first"; the Guide, Crew legend
  and Method say so; unit test updated.
- **Headline order** (flight surgeon): at the same urgency, an item that stops exercise leads, so the
  infection-like pattern comes before a persistent-symptom item.
- **Backup for "medical officer only" alerts** (flight surgeon): after five minutes without the medical
  officer's acknowledgement the commander is alerted with no content ("needs the medical officer
  urgently … the reason is not shown"); the commander's card for a private hold says "A private medical
  matter; the medical officer is handling it. Please do not ask them about it."
- **Cancel** (flight surgeon): the 10-second cancel withdraws the reading as a typing mistake, and
  disappears once the reading is confirmed.
- **Meter unit** (flight surgeon): the blood-sugar unit is set once per tablet ("My meter shows: mg/dL |
  mmol/L"); mmol/L input is converted; "LO" and "HI" meter readouts can be entered and count as past the
  lines; the unit question appears only while the unit is unknown.
- **Still-open items** (flight surgeon): the ask button says "Open for N days without a conversation: ask
  today" after two days; the low-mood rule no longer says "you decide what is shared".
- **Persisting symptom named** (judge, astronaut): the summary names the symptom that persisted.
- **Validation** (judge, statistician): the over-budget tile is marked not comparable; the window
  sentence is corrected (for heart rate alone the pre-specified window gives +13 against +19); the
  smoothing rows are labelled as not applying to the deployed rule; the false-alert concentration
  sentence is computed from the values; "halves" became "about a third"; METHOD.md gives the paired
  EWMA-vs-rule difference.
- **Small**: fluids pre-fill labelled; the trigger line names the symptoms; a restriction shows a warning
  icon, not a tick; the review capture deletes old screenshots first (two stale parts had survived).

Not done, with reasons: one status vocabulary and one set of areas across body figure, Sharing and Trends
(a redesign); a repeat box for every urgent item and for blood pressure and temperature; sudden-vision
red flags and a ketone step (indicator and rule changes for a clinician); a nested bootstrap.

## Round 17 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 7, relevance 8, presentation 6 (36 of 50), "nominate:
yes", with one high-severity issue. The astronaut found three, the flight surgeon one, the statistician
one.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Judge (astronaut medium) | "Out of your range for N days" disagreed with the charts: the text counted a day at 1.2 robust spreads, the chart's band is 2. | The text uses the chart's own band, counts consecutive days with a reading, and says when the latest reading is back inside; a unit test checks text and band agree. |
| 2 | Astronaut, flight surgeon | One "Cancel" withdrew every dangerous reading (sugar 50 and heart rate 170) and cancelled the alert. | One "Withdraw … : typing mistake" button per reading; the alert still goes for what remains, built from the urgent items as they are when it fires (so a unit correction or a withdrawal is respected). |
| 3 | Astronaut | Ticking a "medical officer only" item did not say the commander's tier would change. | The tick shows: only the medical officer is told what it is; the commander's tier shows "Talk to the medical officer first" with no reason. |
| 4 | Astronaut | Sharing said the ground always gets a count of open urgent items; Earth link said only under emergency sharing. | Sharing now says "with emergency sharing on". |
| 5 | Statistician | The heart rate + 7-day activity alert tier never fires (its threshold sits on the z-score cap), but Validation reported its +0 and −4 as findings about the activity feature. | The screen detects a tier with no alerts at all and says it could not be calibrated, naming the cap; the like-for-like alert-tier comparison is withheld. |

Medium-severity findings fixed in the same pass:

- **Emergency context** (flight surgeon): while an urgent item is open under emergency sharing, the
  medical officer sees heart, oxygen and temperature and symptoms at trend level; Sharing says so.
- **Overdue items** (flight surgeon, astronaut): an item that needs the medical officer and has been open
  two days or more is flagged "Overdue … please see them today" on the medical officer's card.
- **Repeat boxes** (flight surgeon, astronaut): every urgent item on Today has its own repeat box.
- **Dizziness after landing** (flight surgeon): R-SMS leads with sit or lie down, do not stand alone,
  compression garment, fluids, blood pressure, tell the medical officer today; new sourced countermeasure
  CM-ORTHO (refs 6, 51c, 51d).
- **Trivial contributors** (judge, astronaut, flight surgeon): sleep, fluids, exercise and food are listed
  as contributors only when the difference is large enough to matter.
- **Pre-specified window first** (judge, statistician): the README and the Validation short version lead
  with heart rate alone in the window set before the analysis (+13, 4 to 24), then the narrower +19.
- **False-alert concentration** (statistician): both tiers given; the follow-on sentence no longer
  contradicts it.
- **Data sources** (flight surgeon, statistician): the import and strap texts say exactly what is kept,
  what feeds the detector and what is checked against fixed lines.
- **Meter unit control** (astronaut): aligned, and says when the unit is not set yet.

Not done, with reasons: a clinician's review (needs a person; FINAL_REPORT lists it), ranking contested
readings below unchallenged ones, one status vocabulary across screens, a crew challenge for gamification,
fixing the calibration cap in the research code (needs a rerun; disclosed on screen and in METHOD.md),
rendering the Method screen's few typed figures from the JSON, a dispersion test for false alerts.

## Round 18 (2026-11-12, fresh reviewers, redeployed build)

Judge's scores: impact 7, creativity 8, validity 7, relevance 8, presentation 6 (36 of 50), "nominate:
yes", with one high-severity issue. The astronaut found one, the flight surgeon one, the statistician
none.

| # | Reviewer | High-severity finding | Fix |
|---|---|---|---|
| 1 | Judge | Today said heart rate and skin temperature were back inside the usual range; the medical officer's Crew screen still called them out of range (it used the 3-day average). | Crew uses the same band test as Today; an area at "act now" names the reading behind it ("because of heart rate reading at rest is 150 or more (entered: 170)"). |
| 2 | Astronaut | The round-17 emergency context let the medical officer see an infection notice's title, beyond what Sharing promises. | The emergency context is limited to whether readings are in range; Sharing and the Check-in message say exactly that. |
| 3 | Flight surgeon | Blood-sugar repeats gave wrong advice: "treat it as low" was added to high-sugar rules, and a low followed by a high (sugar on the fingertip after treatment) kept "take sugar now" beside a high card. | Low and high rules are kept apart; a high is re-checked at once with a clean finger and a normal repeat says so; a high after a treated low says "take no more sugar, wash and repeat"; unit-tested. |

Medium-severity findings fixed in the same pass:

- **Triage order** (judge, astronaut): an unchallenged reading (heart rate 170) leads a contested one
  (sugar 50 then 85); each urgent item's repeat box asks for its own reading.
- **Exercise card** (judge, astronaut): while exercise is held it reads "Exercise: paused" and does not
  show progress against the plan; exercise advice is also suppressed while a "not cleared" restriction
  stands (flight surgeon).
- **Body figure** (astronaut): a readings notice lights only the areas whose readings moved notably;
  every flagged area shows its status word.
- **"Unless you cancel"** (astronaut): the wording is "unless you withdraw a typing mistake"; a red-flag
  symptom alert has no cancel at all (flight surgeon).
- **Repeat low** (flight surgeon): a new rule, R-V-GLU-LO-R, makes a second reading below 70 "act now".
- **Merged illness item** (flight surgeon): when the readings notice absorbs the fixed symptom rule, the
  medical officer still sees it as that fixed rule.
- **Overdue** (astronaut): the ask button says the medical officer's screen already marks the item overdue.
- **Statistician wording**: "halves" became "about a third"; threshold transfer given for both
  populations; "no direct vote"; the fixed-threshold comparison's differences named; the tile shows both
  windows (+13 to +19); the predictive-value card names its window; METHOD.md's notice range is 42 to 70.

Not done, with reasons: time-based (not day-based) repeat windows across midnight, a symptom branch for
very high blood pressure, treating "vomited more than twice" as vomiting in three rules, separating the
team's own analysis from the "published research" badge, clipping the fixed comparator (needs a rerun),
a "what the medical officer may do next" line per rule (needs clinical input).

## Round 19

See the end of this file once the nineteenth round has run.
