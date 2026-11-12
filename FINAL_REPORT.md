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
| Science | Phase-aware robust personal baselines; four detectors plus a fixed-threshold comparison; thresholds from a false-alert budget; 28 auditable rules with cited countermeasures; fixed safety thresholds and red-flag symptoms that bypass the detector |
| Data in | Simulated missions (Mars transit, lunar surface); CSV, Fitbit JSON and Apple Health import; live heart-rate strap over Web Bluetooth; manual check-in |
| Real data used | Stanford COVID-19 wearables phases 1 and 2 (detection), LifeSnaps (variability), NASA Life Sciences Data Archive bed-rest campaigns (gravity transitions) |
| Privacy | Per-role, per-area sharing at four levels, a tested privacy gate, access log, switchable emergency sharing |
| Offline | Service worker precache; automated test disables the network and uses every screen |
| Tests | 23 Python and 44 TypeScript unit tests, including Python-to-TypeScript detector parity; 2 offline end-to-end tests; screenshot and review-capture runs |
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
| Keel flags 67% of illness episodes at 1 false alert per person-month; luck 36%; +31 points above luck (21 to 41); fixed threshold +15; advantage +15 (2 to 30) | **Real**: 251 people, 103 episodes, heart rate and steps, 5-fold cross-validation over people |
| Measured false-alert rates 1.00 and 0.24 per person-month against budgets 1.00 and 0.25 | **Real**, held-out people |
| No early warning (40% with an alert starting by onset; luck 28%) | **Real** |
| About 1 alert-tier alert in 11 would be a real respiratory illness | **Real** sensitivity combined with a **published** ISS illness rate |
| Thresholds hold across the two Stanford cohorts; five fold seeds agree | **Real** |
| Gravity-transition handling: 9 of 14 false flags down to 4 (p = 0.06) | **Real** NASA bed-rest pulse data, 29 volunteers |
| Day-to-day variability, indicator correlations and the illness heart-rate response used by the simulator | **Fitted to real data** on one half of the people, checked on the other |
| 67% of simulated mission events flagged (+26 above luck); results by event type, size, missing data, sensor loss, ablations | **Simulation**, with assumed effect sizes for everything except illness heart rate |
| Phase handling halves post-launch false alerts but hides early events (+19 against +34) | **Simulation** |
| Alert thresholds for the full sensor set used in the app | **Simulation** (no real dataset has the full set). Transferred to real people on two channels they ran 40 to 70% over budget |
| Every mission, cabin CO2 and radiation reading, link delay and blackout shown in the app | **Simulation**, labelled |

## 4. Known weaknesses

1. **No astronaut data.** Everything real is from people on Earth with consumer watches, mostly with
   COVID-19. Whether any of it transfers to a fit crew in weightlessness is untested.
2. **No early warning, and most alerts are false.** This is stated in the app, but a judge who
   expects "predicts illness days ahead" will be disappointed. Do not claim it.
3. **The evidence for illness detection is mostly behavioural.** Heart rate alone is +14 points above
   luck; steps add the rest because people move less once they feel ill. A crew on a fixed exercise
   schedule may not show that.
4. **The four personal detectors cannot be told apart.** The deployed one (multivariate EWMA) won a
   pre-set rule on training missions by 4 points, was slightly behind the simple rule on test
   missions, and ahead on real data. The choice flipped once during development when the simulator
   was corrected. It is defensible but not a strong result.
5. **Simulated thresholds probably run over budget in reality** (40 to 70% over on two channels).
6. **Phase handling has a measured blind spot** in the first weeks after a gravity change.
7. **The simulator is imperfect where it was checked:** HRV is about 37% too variable, sleep carries
   over between nights where real sleep does not, and two independent published values are missed
   (nights under six hours: 48% against 44%; CO2 headache odds ratio 1.3 against about 1.9).
8. **No clinician has reviewed anything.** The flight-surgeon review was an AI role-play. Fixed
   thresholds are public guidance for adults on Earth. Body temperature may run higher in flight
   (a reviewer's point that was not verified against a source).
9. **Readiness tier and crew counts are heuristics.** In a crew of four, counts are not anonymous.
10. **Web Bluetooth** works only in Chromium browsers, not Safari or iPadOS. The strap adapter was
    unit-tested on byte parsing but never run against a physical strap.
11. **The Apple Health and Fitbit importers** were tested on small hand-made samples, not on real
    multi-year exports. Large Apple Health files may be slow.
12. **The one-minute reaction test** is not the validated three-minute test.
13. **`shared/references.json`** was generated once from `docs/DOMAIN.md` by an ad-hoc script and then
    hand-cleaned; it is not regenerated by `make`.
14. **Space Apps rules were not checked** (as instructed). The repository and the live site became
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

See `docs/REVIEW.md`. Round 1 found ten high-severity issues across four reviewers; all were fixed,
and several changed the science (chance-corrected comparisons, a more realistic simulator, fixed
safety rules). Round 2 is summarised at the end of that file.
