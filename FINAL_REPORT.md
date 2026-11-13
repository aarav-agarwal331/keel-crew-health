# Final report

Written 2026-11-12, two days before the hackathon. This is for the team; nothing here is marketing.

- **Live app:** https://aarav-agarwal331.github.io/keel-crew-health/
- **Code:** https://github.com/aarav-agarwal331/keel-crew-health (public; needed for free GitHub Pages)
- **Submission texts:** `submission/`

## 1. What was built

**Keel** is an offline-first web app for a crew member's tablet. It learns each person's own normal
for eighteen indicators, flags drift, explains what changed, and recommends one action with its
source, how soon and who should know. No server, no language model.

| Area | State |
|---|---|
| Screens | Today, Trends, Alert detail, Check-in (with a reaction self-test), Sharing, Crew readiness, Earth link, Mission replay, Validation, How Keel works, Guide (measurements and every rule), Data sources, More |
| Science | Phase-aware robust personal baselines; four detectors plus a fixed-threshold comparison; thresholds from a false-alert budget; 43 auditable rules with cited countermeasures; fixed safety thresholds and red-flag symptoms that bypass the detector; an append-only reading log and a medical officer's list of open items |
| Data in | Simulated missions (Mars transit, lunar surface); CSV, Fitbit JSON and Apple Health import; live heart-rate strap over Web Bluetooth; manual check-in with medication classes and a photo for the medical officer |
| Real data used | Stanford COVID-19 wearables phases 1 and 2 (detection), LifeSnaps (variability), NASA Life Sciences Data Archive bed-rest campaigns (gravity transitions) |
| Privacy | Per-role, per-area sharing at four levels, a tested privacy gate, access log, switchable emergency sharing, some symptoms shown to the medical officer only |
| Offline | Service worker precache; automated test disables the network and uses every screen |
| Tests | 24 Python and 63 TypeScript unit tests, including Python-to-TypeScript detector parity; 3 offline end-to-end tests; screenshot and review-capture runs |
| Reproducibility | `make all` (data → sim → model → validate → test → build). Remote range-request extraction was verified against the local copies |
| Docs | README with traceability table, `docs/METHOD.md`, `DOMAIN.md` (69 opened sources), `DATA.md`, `REQUIREMENTS.md`, `REVIEW.md`, `DECISIONS.md`, `PLAN.md` |
| Submission | Project page text, 30-second video storyboard, 7-slide deck (HTML), 60-second and 3-minute pitches, 15 judge questions, AI-use disclosure |

## 2. What was cut or not done

- **Image analysis.** A photo can be attached at check-in for the medical officer, but Keel does
  nothing with it.
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
| Keel's method on two sensors, thresholds from the simulator, flags 68% of illness episodes; luck 41%; +28 points above luck (18 to 37), at 1.31 false alerts per person-month (budget 1.00). On people the simulator's fits did not use: +30 (17 to 42). Alert tier: +24 (14 to 34) at 0.41 (budget 0.25) | **Real** people and episodes (251, 107), scored with a two-sensor model and thresholds fitted in **simulation** |
| The 11-channel model file the app ships, given only a real import's channels: 29% flagged, +16 (7 to 25), 0.35 false alerts per person-month; alert tier 14% flagged, +10 (4 to 17), at 0.12 | **Real** data, shipped model |
| With thresholds from other real people: heart rate alone +19 (9 to 28); + 7-day activity +30 (20 to 39), whose alert tier never fires; + daily steps +28 (19 to 38). Fixed threshold +18 (8 to 27) and +7 (−1 to 15) | **Real**, 5-fold cross-validation over people |
| Keel (now the simple personal 2-of-3 rule) against a fixed threshold: +11 (−3 to 25), or +7 (−5 to 20) in the original window; both intervals include zero. The multivariate EWMA scores +34 (24 to 44) against Keel's +28 (19 to 38); paired difference +5 (−2 to 12), not distinguishable | **Real**, paired bootstrap, no correction for multiple comparisons |
| No useful early warning: alerts starting by onset are +12 to +14 above luck at the notice tier (confounded) and +6 (−1 to 13) to +8 (1 to 15) at the alert tier | **Real** |
| Between 1 in 13 and 1 in 22 alert-tier alerts would be a real respiratory illness | **Real** sensitivity combined with a **published** ISS illness rate |
| Thresholds hold across the two Stanford cohorts (+29, +22); five fold seeds agree (+26 to +30) | **Real** |
| Gravity-transition handling: 9 of 14 flags down to 4, about the 35% the same rule reaches by chance (p = 0.06, not significant, no ground truth) | **Real** NASA bed-rest pulse data, 29 volunteers |
| Day-to-day variability, indicator correlations and the illness heart-rate response used by the simulator | **Fitted to real data** on one half of the people, checked on the other; every independent check fails or is off |
| 71% of simulated mission events flagged (+31 above luck, 25 to 36); by type from +57 (sleep restriction) to +14 (illness, interval −6 to 34); missing data, sensor loss, ablations | **Simulation**, with assumed effect sizes for everything except illness heart rate |
| Phase handling cuts alerts after launch by about a third (1.03 against 1.62 per person-month); with luck from the same flight days it shows no cost for early events (+22 against +18) | **Simulation** |
| Alert thresholds for the full sensor set used in the app | **Simulation** (no real dataset has the full set) |
| Every mission, cabin CO2 and radiation reading, link delay and blackout shown in the app | **Simulation**, labelled |

## 4. Known weaknesses

1. **No astronaut data.** Everything real is from people on Earth with consumer watches, mostly with
   COVID-19. Whether any of it transfers to a fit crew in weightlessness is untested.
2. **No useful early warning, and most alerts are false.** Slightly more notice-tier alerts start
   before onset than luck gives (+12 to +14, confounded by testing and isolation); at the alert tier,
   +6 to +8, and the two-sensor version's interval includes zero. A judge who expects "predicts illness days ahead" will be disappointed. Do not claim it. In the scripted
   replay Keel flags the illness on the day symptoms begin, from the crew member's check-in combined
   with drifting readings; the sensors alone show the pattern one day later.
3. **Thresholds do not transfer between sensor sets.** Simulator thresholds for a two-sensor version
   run over budget on real people (1.31 against 1.00, 0.41 against 0.25; about 1.3 to 2.3 times over
   with five sensors), and the headline is quoted at that higher rate. The model the app ships is set for
   eleven channels: given only a watch's heart rate it flags about one illness in three (29%) and stays
   well under budget (0.35 and 0.12 false alerts per person-month). The headline is therefore a two-sensor version of Keel's method, not the
   shipped file. Imports now run on a separate heart-rate-only model calibrated on real people; other
   sensor subsets (for example a failed HRV sensor) still use the full-set thresholds.
4. **The evidence for illness detection is partly behavioural, and "above luck" is likely optimistic.**
   Heart rate alone is +19; activity adds the rest because people move less once they feel ill, and
   that cannot be separated from isolating at home. Pretend dates cannot be matched to the calendar.
   A crew on a fixed exercise schedule may show less.
5. **Neither Keel's detector nor a personal baseline is shown to beat a simpler method.** Like for like, a personal against a population baseline is +11 (−3 to 25) at the notice tier and +17 (7 to 28) at the alert tier: mixed. **Keel now deploys the simple personal rule itself:** a review found the multivariate statistic used correlations of the wrong sign, and after the fix its lead on simulated training missions fell below the pre-set margin. On real data the multivariate EWMA scores +34 against the rule's +28 (no paired interval), and the rule's lead over a
   fixed threshold includes zero in both windows. The detector choice is arbitrary among
   equals and was made by a rule written during review.
6. **Nothing was pre-registered.** The window, the metric, the chance estimate and the headline itself
   changed across seventeen review rounds. Everything is in `DECISIONS.md`. Intervals hold thresholds
   fixed and are not corrected for multiple comparisons.
7. **The simulator's illness response was fitted on episodes from people who are also evaluated** (47 of the 107 episodes belong to its 55 calibration people; the fit used 38 curves with enough baseline). Results on the
   132 people its fits did not use are reported beside it; they rest on 60 episodes.
8. **Simulated detection of illness and low mood is not reliably above luck** (+14, −6 to 34; +17, −3
   to 36). The simulated total (+31) leans on sleep restriction and exercise outage, which the
   detector reads almost directly.
9. **Phase handling is tested only in simulation.** An earlier report of a cost for early events was an artefact of drawing luck from late flight; corrected, there is no measured cost.
10. **The simulator fails every independent realism check:** illness rise half the real one, HRV 37%
    too variable, sleep carry-over, all four threshold transfers, nights under six hours 50% against
    44%, CO2 headache odds ratio 2.4 against about 1.9.
11. **No clinician has reviewed anything.** The flight-surgeon reviews were AI role-play. Fixed
    thresholds are public guidance for adults on Earth, and several (heart rate 120, 150 and 35;
    systolic 180 and 80; diastolic 120; glucose 300; sleep under five hours; CO2 4 mmHg as "now";
    body mass 5%) are provisional values chosen by us. The red-flag list, who is told what, and the
    closure workflow are our design.
12. **Flags are common.** In the simulated mission a crew member has no flag on about half of days.
    The base rates were tuned once during round 3 (tiredness and stuffiness count less); that tuning
    was done on the demo mission itself.
13. **Readiness tier and crew counts are heuristics.** In a crew of four, counts are not anonymous.
14. **Single device.** Each role's view is computed on the same tablet. Closing an item, emergency
    sharing and the ground queue are not synchronised between devices.
15. **Web Bluetooth** works only in Chromium browsers, not Safari or iPadOS. The strap adapter was
    unit-tested on byte parsing but never run against a physical strap. The photo input was tested
    with a file in a headless browser, not with a tablet camera.
16. **The Apple Health and Fitbit importers** were tested on small hand-made samples, not on real
    multi-year exports. Large Apple Health files may be slow.
17. **The one-minute reaction test** is not the validated three-minute test.
18. **`shared/references.json`** was generated once from `docs/DOMAIN.md` and then maintained by hand.
    References 68 and 69 rest on PubMed abstracts only.
19. **Space Apps rules were not checked** (as instructed). The repository and the live site became
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
   Chromium only. While there, take a photo at check-in (More options → Photo) to confirm the camera
   opens on that device.
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
   says ("Keel flagged it with her check-in, on the day symptoms began") matches the deck's last slide and the video's shot 3. The replay is deterministic, but the
   wording there is the claim judges will remember.

## 7. Review rounds

See `docs/REVIEW.md` for every round: what each reviewer found, what was changed, and what was left.
