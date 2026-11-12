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

## Round 3

See the end of this file once the third round has run.
