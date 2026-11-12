# Final report

Written 2026-11-12, two days before the hackathon. This is for the team; nothing here is marketing.

- **Live app:** https://aarav-agarwal331.github.io/keel-crew-health/
- **Code:** https://github.com/aarav-agarwal331/keel-crew-health (public; needed for free GitHub Pages)
- **Submission texts:** `submission/`

## 1. What was built

**Keel** is an offline-first web app for a crew member's tablet. It learns each person's own normal
for seventeen indicators, flags drift, explains what changed, and recommends one action with its
source, how soon and who should know. No server, no language model.

| Area | State |
|---|---|
| Screens | Today, Trends, Alert detail, Check-in (with a reaction self-test), Sharing, Crew readiness, Earth link, Mission replay, Validation, How Keel works, Guide (measurements and every rule), Data sources, More |
| Science | Phase-aware robust personal baselines; four detectors plus a fixed-threshold comparison; thresholds from a false-alert budget; 32 auditable rules with cited countermeasures; fixed safety thresholds and red-flag symptoms that bypass the detector |
| Data in | Simulated missions (Mars transit, lunar surface); CSV, Fitbit JSON and Apple Health import; live heart-rate strap over Web Bluetooth; manual check-in |
| Real data used | Stanford COVID-19 wearables phases 1 and 2 (detection), LifeSnaps (variability), NASA Life Sciences Data Archive bed-rest campaigns (gravity transitions) |
| Privacy | Per-role, per-area sharing at four levels, a tested privacy gate, access log, switchable emergency sharing |
| Offline | Service worker precache; automated test disables the network and uses every screen |
| Tests | 24 Python and 44 TypeScript unit tests, including Python-to-TypeScript detector parity; 2 offline end-to-end tests; screenshot and review-capture runs |
| Reproducibility | `make all` (data → sim → model → validate → test → build). Remote range-request extraction was verified against the local copies |
| Docs | README with traceability table, `docs/METHOD.md`, `DOMAIN.md` (67 opened sources), `DATA.md`, `REQUIREMENTS.md`, `REVIEW.md`, `DECISIONS.md`, `PLAN.md` |
| Submission | Project page text, 30-second video storyboard, 7-slide deck (HTML), 60-second and 3-minute pitches, 15 judge questions, AI-use disclosure |

## 2. What was cut or not done

- **Camera or image input.** The challenge mentions it as an example; Keel has taps, typed values,
  file import and a live sensor only.
- **On-device language model.** Last in the cut order; not started. Advice is rule-based only.
- **Real-data explorer in the app.** The Stanford data has no explicit licence, so per-person real
  series are not shipped; only aggregate results are shown.
- **The official Resources tab.** It opens on 2026-11-13 and could not be read.
- **Device-to-device sync.** Each role's view is computed on the same device in the demo. "Emergency
  sharing" changes what other roles see; nothing is pushed between tablets.
- **Recorded video and exported PDF deck.** The storyboard and the HTML deck are ready; recording and
  export need a person.
- **Clean-clone `make all` end to end.** Each step was run and the download method was verified, but
  the full sequence was not run from an empty directory.
- **Rover environment, hourly features, tuning of the post-launch band.** Listed as future work.

## 3. Which results rest on real data and which on simulation

| Result | Basis |
|---|---|
| Keel flags 66% of illness episodes at 1 false alert per person-month; luck 36%; +30 points above luck (20 to 40); fixed threshold +17 (7 to 27); advantage +14 (0 to 28) | **Real**: 251 people, 107 episodes, heart rate and daily steps, 5-fold cross-validation over people |
| At 0.25 per person-month: +32 (22 to 42) with daily steps, +12 (3 to 20) with the 7-day activity average the app's detector uses | **Real** |
| False alerts 0.99 and 0.25 per person-month against budgets 1.00 and 0.25 with thresholds from other real people | **Real**, held-out people (close to budget by construction) |
| Thresholds calibrated in simulation, applied to real people: 1.38 and 0.39 (two indicators, 72 people); 1.85 and 0.93 (five indicators, 36 people) | **Real** data scored with **simulation** thresholds |
| No early warning (39% with an alert starting by onset; luck 29%) | **Real** |
| Between 1 in 11 and 1 in 28 alert-tier alerts would be a real respiratory illness | **Real** sensitivity combined with a **published** ISS illness rate |
| Thresholds hold across the two Stanford cohorts (+29, +36); five fold seeds agree (+30 to +32) | **Real** |
| Gravity-transition handling: 9 of 14 false flags down to 4 (p = 0.06) | **Real** NASA bed-rest pulse data, 29 volunteers |
| Day-to-day variability, indicator correlations and the illness heart-rate response used by the simulator | **Fitted to real data** on one half of the people, checked on the other; fails 3 of 9 pass marks |
| 67% of simulated mission events flagged (+26 above luck, 20 to 33); results by event type, size, missing data, sensor loss, ablations | **Simulation**, with assumed effect sizes for everything except illness heart rate |
| Phase handling halves post-launch false alerts but hides early events (+20 against +35) | **Simulation** |
| Alert thresholds for the full sensor set used in the app | **Simulation** (no real dataset has the full set) |
| Every mission, cabin CO2 and radiation reading, link delay and blackout shown in the app | **Simulation**, labelled |

## 4. Known weaknesses

1. **No astronaut data.** Everything real is from people on Earth with consumer watches, mostly with
   COVID-19. Whether any of it transfers to a fit crew in weightlessness is untested.
2. **No early warning, and most alerts are false.** This is stated in the app, but a judge who
   expects "predicts illness days ahead" will be disappointed. Do not claim it. In the scripted
   replay the automatic detector alone does not reach its illness pattern until after symptoms; the
   flag on the day of onset comes from the crew member's check-in combined with drifting readings.
3. **The evidence for illness detection is partly behavioural.** Heart rate alone is +17 points above
   luck; steps add the rest because people move less once they feel ill, and this cannot be separated
   from isolation at home. A crew on a fixed exercise schedule may not show it. At the strict tier the
   app's own activity feature (a 7-day average) gives only +12.
4. **The four personal detectors cannot be told apart, and the choice among them is not
   pre-registered.** The selection rule was rewritten during review; under it the choice flipped once
   (simple rule, then multivariate EWMA) when the simulator was corrected. The simple rule's edge over
   a fixed threshold is +11 with an interval that includes zero.
5. **Analysis choices moved during the work.** The detection window was narrowed (the original gives
   +27), the metric changed to detection above luck, and a cohort labelling error was fixed (103 →
   107 episodes). Everything is in `DECISIONS.md`, but it is not a pre-planned analysis.
6. **Simulated thresholds run over budget in reality** (38% over with two indicators, up to nearly
   four times over with five). The thresholds the app actually uses are simulated.
7. **Phase handling has a measured blind spot** in the first weeks after a gravity change.
8. **The simulator fails three of its nine pass marks:** HRV is 37% too variable, sleep carries over
   between nights where real sleep does not, and the simulated illness heart-rate rise over the first
   four days is half the real one. Two independent published values are also missed (nights under six
   hours: 48% against 44%; CO2 headache odds ratio 1.3 against about 1.9).
9. **No clinician has reviewed anything.** The flight-surgeon reviews were AI role-play. Fixed
   thresholds are public guidance for adults on Earth, and four of them (systolic 180 and 80, glucose
   300, body mass 5%) are placeholders with no cited source. Body temperature may run higher in flight
   (a reviewer's point that was not verified against a source).
10. **Readiness tier and crew counts are heuristics.** In a crew of four, counts are not anonymous.
11. **Web Bluetooth** works only in Chromium browsers, not Safari or iPadOS. The strap adapter was
    unit-tested on byte parsing but never run against a physical strap.
12. **The Apple Health and Fitbit importers** were tested on small hand-made samples, not on real
    multi-year exports. Large Apple Health files may be slow.
13. **The one-minute reaction test** is not the validated three-minute test.
14. **`shared/references.json`** was generated once from `docs/DOMAIN.md` by an ad-hoc script and then
    hand-cleaned; it is not regenerated by `make`.
15. **Space Apps rules were not checked** (as instructed). The repository and the live site became
    public on 2026-11-12, before the event.

## 5. Steps that need a human

- Check the challenge's **Resources tab** (from 2026-11-13) and add anything relevant to
  `docs/REQUIREMENTS.md` section D and the project page.
- **Record the 30-second video** from `submission/DEMO_VIDEO.md`, and **export the deck**
  (`submission/deck.html` → print to PDF, landscape).
- **Register the team and create the project page**; paste from `submission/PROJECT_PAGE.md`.
- Decide whether the **public GitHub repository under `aarav-agarwal331`** is where the team wants
  this, and whether publishing before the event is within the rules. To take it down:
  `gh repo delete aarav-agarwal331/keel-crew-health`.
- Fill in **team member names** and replace "The Keel team" in `LICENSE` if wanted.
- If a **heart-rate strap** is available, test the live sensor screen in Chrome on a laptop.
- Optional: run `make all` from a clean clone on another machine (downloads about 1.7 GB).

## 6. Five things to verify by hand before submitting

1. **Open the live site on the tablet or phone you will demo with, switch on airplane mode after the
   first load, reload, and tap through every screen.** The automated test does this in desktop
   Chromium only.
2. **Read the "What these results do not show" box on the Validation screen and make sure the pitch,
   the video captions and the project page say nothing stronger.** In particular: no "early warning",
   no "predicts", and always "simulated" for mission data.
3. **Spot-check five citations** in `docs/DOMAIN.md` by opening the links: Mars delay (ref 1), solar
   conjunction (ref 4), in-flight sleep (ref 31), CO2 and headache (ref 37), NASA-STD-3001 medical
   operations (ref 30). The Human Research Roadmap risk ratings were read from long pages and are the
   most likely to contain a transcription error.
4. **Check the data terms.** The Stanford wearables releases carry no explicit licence. Keel shows
   only aggregate results and cites the papers; confirm the team is comfortable with that and that the
   project page credits all four data sources.
5. **Run the replay once yourself** (More → Mission replay → Play) and confirm what the result card
   says matches the deck's last slide and the video's shot 3. The replay is deterministic, but the
   wording there is the claim judges will remember.

## 7. Review rounds

See `docs/REVIEW.md` for every round: what each reviewer found, what was changed, and what was left.
