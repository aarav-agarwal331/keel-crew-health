# DOMAIN.md — Crew health monitoring without a link to Earth

Domain research for an Earth-independent crew health monitoring app (lunar surface and Mars transit).

**How to read this file.** Every factual claim carries a numbered citation `[n]` that resolves to the References list at the end. Only sources actually opened during the research session (2026-11-12) are cited. Where a number could not be confirmed in an opened source it is marked **not verified**. Values marked *derived* are simple arithmetic on cited numbers. This is an independent student/hackathon document; it is not produced, reviewed, or endorsed by NASA or any other agency.

**Source access note.** PubMed and PMC web pages blocked automated reading, so journal abstracts and open-access full texts were read through the NCBI E-utilities endpoints (same NCBI records, text/XML form). No PDF was opened. HRR risk pages are very long; ratings were read from the first 100,000 characters of each page and should be spot-checked before being quoted publicly.

---

## 1. Communication delay and why the crew must be autonomous

| Quantity | Verified value | Source |
|---|---|---|
| Earth–Mars one-way delay, closest approach (~35 million miles) | about 4 minutes | [1] |
| Earth–Mars one-way delay, greatest distance (~250 million miles) | about 24 minutes | [1] |
| Earth–Mars round-trip latency at maximum distance (NASA research abstract) | up to 44 minutes (i.e. ~22 min one-way, *derived*) | [2] |
| NASA HRP public figure for Mars one-way delay | "can reach 20 minutes" | [6] |
| Earth–Moon light time, one-way | 1.27 s average; at least 2.54 s to get a reply | [3] |
| Expected one-way *operational* latency for lunar missions (includes more than light time) | 3 to 14 s | [2] |
| Mars solar conjunction frequency | every two years | [4][5] |
| Command moratorium for NASA's robotic Mars fleet | two weeks in 2023 (Nov 11–25); Aug 28–Sep 7 in 2019 | [4][5] |
| Total loss of contact in 2023 conjunction (Mars fully behind the solar disk) | two days | [4] |

Notes:
- The conjunction figures are from robotic missions, where NASA stops *sending commands* because coronal plasma can corrupt them [4]. The blackout duration that would apply to a crewed mission is **not verified**.
- A Mars mission is roughly three years away from Earth, versus a three-day lunar trip [7]; Mars averages 140 million miles from Earth, the ISS orbits about 240 miles up [6].

**How ISS medicine works today (Earth-dependent).** Flight surgeons and biomedical engineers sit on console in Mission Control and work day-to-day medical issues in real time; private medical conferences run on private audio/video links on a regular schedule and on crew request [8]. In practice that is a weekly one-on-one check-in with each crew member [9]. Ground teams watch exercise sessions, crew fatigue, medical hardware and cabin CO2 [9]. If a crew member needs urgent care they return to Earth in the vehicle they launched on [10]. NASA states plainly that astronauts currently "rely on real-time communication with ground-based medical providers" [11].

**Why that breaks.** NASA's Exploration Medical Capability (ExMC) element describes "Earth-Independent Medical Operations" (EIMO) as a gradual transfer of medical care and decision-making from Earth-based teams to on-board systems, driven by limited resupply, mass, power and data, by communication delays, and by having no emergency evacuation [12]. Its concept of operations expects a medical system built from reference databases, wearable sensors, point-of-care diagnostics and environmental data that supports a Crew Medical Officer when the ground is unavailable or too delayed [12]. An earlier ExMC concept for Mars says delays and blackouts will eliminate reliable real-time telemedicine and require much greater crew autonomy than on the ISS [13]. NASA Ames describes a clinical decision support system that continuously gathers medical data by passive and active monitoring and gives the crew real-time guidance [11]. The HRP risk "Earth-Independent Human-Systems Operations" notes that a flight crew of 4 would be doing work traditionally done by a ground crew of 40+ [14]. NASA-STD-3001 already anticipates this: private medical and psychological communications prefer real time but allow store-and-forward when delays exist [30].

**Design consequence for the app:** detection, triage, and first-line countermeasure advice must run on board; the ground link is a store-and-forward consult channel, not a dependency.

---

## 2. The five hazards and the HRP risk list

NASA's Human Research Program groups spaceflight stressors into five hazards, summarised by the acronym **RIDGE**: space **R**adiation, **I**solation and confinement, **D**istance from Earth, **G**ravity fields, and hostile/closed **E**nvironments [6][7].

| Hazard | What it does (NASA summary) | Monitoring/countermeasures NASA names |
|---|---|---|
| Radiation | Trapped particles, solar energetic particles, galactic cosmic rays (hard to shield); mainly long-term health impact [6] | Shielding, radiation monitoring, operational procedures [6] |
| Isolation and confinement | Behavioral and psychiatric conditions more likely; sleep and circadian disruption (Mars day is 37 min longer) [6] | Actigraphy, LED lighting, a 10-minute vigilance self-test, journaling [6] |
| Distance from Earth | Delay up to 20 min; no resupply of food, equipment, medicine [6] | Medical training, crew ultrasound, onboard lab tests, AI clinical decision support [6] |
| Gravity fields | Bone and muscle loss, headward fluid shift affecting vision, kidney stones, orthostatic intolerance on landing [6] | Aerobic and resistive exercise, compression cuffs, lower-body negative pressure, potassium citrate, bisphosphonates [6] |
| Hostile/closed environment | Microbes change and spread; stress hormones up, immune system altered [6] | Air-quality monitoring, blood/saliva sampling, microbial swabs, quarantine, vaccination [6] |

**HRP risk list.** The Human Research Roadmap currently lists 22 risks (one inactive) [15]. Each risk page gives a likelihood × consequence (LxC) score per design reference mission. The table compares *in-mission operations* scores for a long lunar orbital + surface mission (30 days–1 year) and a Mars planetary mission (730–1224 days).

| HRP risk (short title) | Lunar orbital + surface, long | Mars planetary | Source |
|---|---|---|---|
| Medical Conditions | 5x4, requires mitigation | 5x4, requires mitigation | [16] |
| Earth-Independent Human-Systems Operations | 5x3 | 5x5 | [14] |
| Food and Nutrition | 5x4 | 5x5 | [22] |
| Muscle and Aerobic | 5x3 | 5x4 | [26] |
| Sensorimotor | 3x5 | 4x5 | [27] |
| Decompression Sickness | 5x3 | 5x3 (2x2 for Mars preparatory) | [24] |
| SANS | 4x3 (long-term health 4x3) | 4x4 (long-term health 4x5) | [19] |
| Cardiovascular | 4x3 | 4x4 | [21] |
| Immune | 4x3 | 4x3 | [23] |
| Renal Stone | 3x4 | 4x4 | [20] |
| Bone Fracture | 3x3 | 4x4 | [25] |
| Sleep | 5x2, requires characterization | 5x2, requires mitigation | [17] |
| Radiation Carcinogenesis | ops 1x1; long-term health 3x2 | ops 1x1; long-term health 3x3 (older 3x4 matrix, update pending) | [18] |
| Behavioral (cognitive/psychiatric) | **not verified** (page did not render the table) | described as "red" for planetary missions | [28] |

Reading of the table: for a lunar surface stay the highest operations scores are Medical Conditions and Food/Nutrition (5x4), followed by autonomy, muscle/aerobic fitness and decompression sickness (5x3) [14][16][22][24][26]. For Mars, autonomy and food reach 5x5 and SANS long-term health reaches 4x5 [14][19][22]. A peer-reviewed NASA-authored summary names four "red" (highest priority) risks for Mars: radiation health effects, SANS, behavioral health and performance, and inadequate food and nutrition [28]. The HRR pages opened gave LxC numbers and dispositions but no colour codes.

---

## 3. Risk → indicator → what a crew can measure → countermeasure

"Onboard measure" lists only realistic hardware: wearable (HR, HRV, SpO2, skin temperature, accelerometer), tablet tests, cabin sensors, a mass device, urine strips, questionnaires.

| Health risk | Indicators that track it | Realistic onboard measurement | Documented countermeasure |
|---|---|---|---|
| Cardiovascular deconditioning, orthostatic intolerance | Heart-rate rise on standing, presyncope; on landing day only 2 of 6 ISS astronauts finished a 10-min tilt test vs 52 of 65 Shuttle astronauts [52c] | Wearable HR during a stand test; exercise HR trend; VO2 proxy from cycle sessions | Aerobic + resistive exercise [6]; gradient compression garments (no presyncope with garment vs 3 of 9 without) [51d]; lower-body negative pressure [6] |
| Arrhythmia | Ectopic beats, irregular rhythm; AF prevalence about 5% in active astronauts; left atrial volume +12 ± 18 mL after 6 months [55b] | Wearable ECG/PPG rhythm check; the ISS Bio-Monitor garment has been used to track sleep apnea, desaturation events and arrhythmia susceptibility in one astronaut [55c] | Private medical conference/consult [8][30]; no specific in-flight protocol verified |
| Sleep loss, circadian misalignment | Sleep duration, sleep timing, reaction speed; about 19% of on-orbit sleep episodes misaligned [17] | Wrist actigraphy with light sensor [40][31]; brief psychomotor vigilance test (PVT-B, flown as the "Reaction Self-Test") [32][33]; sleep diary | Protected 8.5 h sleep period, avoid critical tasks in the 1–7 AM circadian low, light, naps, medication [30]; tunable LED lighting [36]; melatonin, caffeine, CBT [35] |
| Bone loss | Roughly 1%–1.5% bone mineral density per month in weight-bearing bones [6][49]; urinary calcium | Exercise load logs (ARED loads are checked every two weeks [9]); body mass; urine chemistry is limited on board | Resistive exercise on ARED (up to 600 lbf) kept hip/pelvis density at preflight levels in 4–6 month crews [50]; bisphosphonates [6]; standard: hip and spine BMD ≥95% of pre-mission [29] |
| Muscle and aerobic loss | VO2peak fell about 17% early in flight [51b]; strength | Cycle/treadmill HR response; resistive loads | 2.5 h/day scheduled exercise on ARED, T2 treadmill, CEVIS cycle [10]; standards: aerobic capacity and strength ≥80% of baseline [29] |
| Behavioral health, cognition | Mood, conflict, vigilance lapses, workload, stress | NASA "Cognition" battery (10 tests, 15 forms, laptop or iPad) [34]; Reaction Self-Test [32]; questionnaires, journaling [6] | Private psychological conference [30]; psychologist teleconference, family contact [10]; meaningful activities [6] |
| CO2 exposure | Headache, fatigue, "full-headed" feeling, missed procedure steps [38] | Cabin CO2 sensor; clip-on Personal CO2 Monitor (local "pockets" form despite scrubbing) [39][40] | Keep 24-h average ≤4.0 mmHg (ISS limit since 2010), later 3.0 mmHg [38]; scrubbers run continuously [9]; crew-quarters airflow control [35] |
| Radiation | Cumulative dose, dose rate, solar particle event onset | Crew Active Dosimeter (worn, shows mission dose and recent rate) [47]; area monitors that alarm when sheltering is needed, important if ground link is lost [47] | Career limit <600 mSv [29]; build a storm shelter from stowage bags within an hour, stay up to 24 h [48]; end or delay EVA, move to shielded area (ALARA) [47] |
| SANS (neuro-ocular) | Optic disc edema, globe flattening, refractive shift; about 70% of crew show at least one early sign [19] | Tablet visual-acuity/Amsler self-test and symptom questionnaire (app assumption); OCT imaging is the clinical tool but is not small hardware | No proven countermeasure [19]; thigh cuffs and lower-body negative pressure under study [6] |
| Renal stones, hydration | Low urine volume, high urinary calcium [53][54] | Fluid-intake log; urine colour/specific gravity strip (threshold **not verified**); body mass | Fluid intake 2.0–2.5 L/day prescribed; ~3.2 L/day modelled to reach preflight risk [53]; urine output ≥2 L/day [54]; potassium citrate [52f][6] |
| Nutrition, body mass | Body mass −2.8% to −4.4% vs preflight, mostly in first 30 days; intake about 80% of requirement [52d] | Body mass device (SLAMMD/BMMD) [52d]; food log | Provide 100% of calculated energy and nutrient needs [29]; menu variety (acceptability under study) [22] |
| Infection, immune dysregulation, latent virus reactivation | 3.40 medical events per flight-year; rashes 1.12, upper-respiratory symptoms 0.97 per flight-year [52b]; herpesvirus shedding in 61% of ISS astronauts [52e] | Wearable resting HR, respiration rate, HRV, skin temperature against personal baseline [58][60]; symptom checklist | Quarantine, vaccination, hygiene and microbial monitoring [6]; vitamin D and antivirals under study [23] |
| Space motion sickness | Nausea, vomiting, headache in first days | Symptom questionnaire; reduced activity counts | Expect in 60–80% of crew for the first 2–3 days of weightlessness, and in a similar proportion in the first days after return to Earth [52a]; schedule light duty; medication detail **not verified** |
| EVA readiness, decompression sickness | Fitness, fatigue, joint pain or neurological symptoms after decompression | Pre-EVA checklist: sleep, HRV, exercise capacity, symptoms | Medical clearance before every EVA [30]; VO2max ≥36.5 ml/min/kg for surface EVA [29]; prebreathe; planned 8.2 psia / 34% O2 exploration atmosphere [24] |

Reference keys such as [52c] point to one paper inside a multi-record NCBI page; see References.

---

## 4. Published parameter values for the physiological simulator

| Parameter | Published value | Notes | Source |
|---|---|---|---|
| Sleeping heart rate, preflight | 53.3 ± 7.3 bpm (7 astronauts) | Unchanged in flight; 59.6 ± 8.9 bpm after landing | [55a] |
| Daytime heart rate in flight | Unchanged from preflight during daily activities | Postflight night HR +4 ± 3 bpm | [55d] |
| Heart rate in space vs posture on Earth | Equal to preflight supine, lower than preflight standing | 11 astronauts, up to 6 months | [55e] |
| HRV in flight | Reduced during sleep across time-domain and spectral measures, partly recovering after landing | A second group reports *increased* total power (154.9 → 532.7 ms²) late in flight; literature is mixed | [55a][55f] |
| Circadian amplitude of heart rate | 15.4 ± 3.93 bpm (active day) vs 7.94 ± 1.91 bpm (sedentary day) | Ground study, 16 healthy students; astronaut value **not verified** | [56] |
| SpO2 | Normal 95%–100%; contact clinician at ≤92%; urgent at ≤88% | Terrestrial clinical guidance; in-flight baseline **not verified** | [57] |
| In-flight sleep duration | ISS 6.09 ± 0.67 h; Shuttle 5.96 ± 0.56 h (actigraphy) | Postflight 6.95 h (ISS); scheduled 8.5 h | [31] |
| Nights under 6 h sleep | ISS 43.8%; Shuttle 47.1% | | [31] |
| Sleep medication use | Shuttle: 78% of crew, 52% of nights. ISS: 75% of crew (12/16 answering), 11% of sleep logs | | [31] |
| Self-reported in-flight sleep | about 6.5 h; <6 h linked to slower PVT response, more stress | 24 astronauts, 2,856 tests | [32] |
| ISS cabin CO2 range | 1 to 9 mmHg | Range reported in the 2014 study period | [37] |
| CO2 and headache | Each +1 mmHg doubles the odds of a headache report; 7-day average must stay below 2.5 mmHg to keep headache risk under 1% | | [37] |
| CO2 symptom bands | 2.3–2.7 mmHg fatigue/full-headed; 2.7–3.0 missed steps; 3.0–3.4 headache | Crew reports; large individual variation | [38] |
| ISS CO2 operational limit | 4.0 mmHg 24-h average since 2010; 3.0 mmHg adopted later; 0.5–2.0 mmHg suggested as better | | [38] |
| Radiation, ISS | 731 µSv/day (523 µSv/day from cosmic rays) in early 2019 | 30–120 mGy absorbed per 6–12 month mission | [45][28] |
| Radiation, lunar surface | 1,369 µSv/day (57.1 ± 10.6 µSv/h); 13.2 ± 1 µGy/h absorbed in silicon | Chang'E-4 LND; about 2.6× ISS cosmic-ray dose | [45] |
| Radiation, Mars transit | 1.8 mSv/day inside MSL; 0.66 ± 0.12 Sv for the shortest round trip | About 3% of cruise dose from solar particles | [44][41] |
| Radiation, Mars surface | 0.67 mSv/day (Aug 2012–Jun 2013); ~1 Sv total with a 500-day stay | Press-release figure for Hassler et al. | [43][42] |
| NASA career dose limit | <600 mSv effective dose, all ages and sexes | Based on 3% risk of exposure-induced death | [29][46] |
| Design limits | Solar particle event <250 mSv; cosmic rays <1.3 mSv/day in free space, <0.9 mSv/day on a surface | 600 mSv ÷ 1.8 mSv/day ≈ 333 days (*derived*) | [29] |
| Bone loss | about 1%–1.5% per month in weight-bearing bones without countermeasures | | [6][49] |
| Body mass loss | −4.4% (BMMD) or −2.8% (SLAMMD) vs preflight; mostly in first 30 days | 25 crew | [52d] |
| VO2peak | about −17% early in flight, partial recovery in flight, recovered by 30 days after return | NASA standard assumes 15%–25% decline | [51b][29] |
| Fluid intake | 2.0–2.5 L/day prescribed in flight; 2.5–2.7 L/day proposed with a 1.75 L/day urine target | | [53] |
| Renal stone history | 14 symptomatic events in 5,434.5 astronaut person-years to 2008 (7 preflight, 7 postflight, 0 in flight) | | [53] |
| Space motion sickness | 60%–80% of travellers, first 2–3 days | Similar proportion after return to gravity | [52a] |
| In-flight medical events | 3.40 per flight-year; 46% of crew had a notable event; 40% of those were rashes/hypersensitivity | 46 ISS crew, 20.57 flight-years | [52b] |
| Latent virus shedding | VZV 65%, EBV 96%, CMV 61% of ISS astronauts | Higher than on Shuttle flights | [52e] |
| SANS | about 70% show early optic disc edema on 4–6 month flights; signs as early as day 10 | | [19][28] |
| Infection, resting HR | Median +7 bpm; signal a median 4 days before symptom onset | 32 COVID-19 cases; 63% detectable before onset in real time | [58] |
| Infection, alarm background rate | about 0.66 alarms per month in healthy wearers | Same algorithm | [58] |
| Infection, fever effect on HR | 8.5 bpm per 1 °C | Quoted in [60] from an earlier reference that was not opened | [60] |
| Infection, HRV and respiration | Respiration rate and HR up, RMSSD down; respiration shows the largest effect; magnitudes given only as z-scores | Day-before-onset sensitivity 21% at 90% specificity | [60] |
| Infection, combined model | Sensors + symptoms AUC 0.80 vs 0.71 for symptoms alone | 30,529 participants | [59b] |
| Infection, pre-symptomatic influenza | Accuracy up to 92% for H1N1 and 88% for rhinovirus from a wristband before symptoms | Viral challenge study, 31 and 18 participants | [59c] |
| Population flu tracking | Fitbit resting HR and sleep raised state-level flu prediction correlation by 0.12 on average | 47,249 users | [59a] |

---

## 5. Countermeasures an alert can map to

"Official" means the action appears in a NASA standard, NASA program page or NASA operations document that was opened. "Literature" means peer-reviewed evidence only.

| Alert | Suggested crew action | Basis | Type |
|---|---|---|---|
| Short or misaligned sleep | Protect an 8.5 h sleep period; keep critical tasks out of the 1–7 AM circadian low; nap | NASA-STD-3001 V1 §6 [30] | Official |
| Circadian shift needed | Lighting schedule: 4500 K general, 2700 K pre-sleep, 6500 K phase-shift | ISS solid-state lighting [36] | Official |
| Persistent poor sleep | Sleep hygiene, CBT techniques, melatonin or caffeine; medication only after other options | NASA sleep guidance [35] | Official (doses **not verified**) |
| Slow reaction test | Re-test, rest before safety-critical work | Reaction Self-Test purpose [33]; sleep <6 h slows response [32] | Official tool, literature thresholds |
| Missed or reduced exercise | Resume prescription: 2.5 h/day scheduled, resistive + aerobic, six days a week | NASA FAQ [10]; flight surgeon description [9] | Official |
| Falling aerobic or strength index | Adjust prescription to stay ≥80% of baseline | NASA-STD-3001 V1 §4 [29] | Official |
| Low fluid intake, dark urine | Drink toward 2.0–2.5 L/day (model supports up to 3.2 L/day); aim for ≥2 L/day urine | [53][54] | Literature |
| High stone risk | Potassium citrate | NASA HRP page [6]; trial [52f] | Official mention, literature |
| CO2 above personal threshold or headache | Check scrubber status, raise local ventilation, move location; log symptoms | ISS limits and symptom bands [38]; CO2 pockets [39]; scrubbers [9] | Official limits; the move/ventilate step is our inference from the pocket finding |
| Solar particle event warning | Stop EVA, move to the most shielded area, build shelter within an hour, stay up to 24 h | Orion plan [48]; SRAG procedures [47] | Official |
| Cumulative dose trend | Track against 600 mSv career limit; prefer shielded areas for rest | [29][47] | Official |
| Orthostatic symptoms after a gravity transition | Compression garment, slow posture change, fluids | [51c][51d][6] | Literature plus official mention |
| Infection signature on wearable | Symptom check, rest, isolate where practical, consult | [58][60]; hygiene measures [6] | Literature |
| Mood, stress or conflict flag | Private psychological conference (store-and-forward if delayed); family contact | NASA-STD-3001 V1 §6 [30]; NASA FAQ [10] | Official |
| Any medical concern | Private medical conference; real time preferred, store-and-forward when delayed | NASA-STD-3001 V1 §6 [30] | Official |
| Vision change | Self-test, report at next medical conference | No proven countermeasure [19] | Official statement of gap |
| Before EVA | Medical clearance check | NASA-STD-3001 V1 §6.4 [30] | Official |

---

## 6. Alarm fatigue is an operational hazard

- In intensive care, 72% to 99% of patient-monitor alarms are technically false or clinically irrelevant [61].
- The consequences are desensitisation, delayed or dismissed alarms, mis-set thresholds and, ultimately, patient harm; a systematic review found few systems that rank alarms by clinical relevance and none that learn thresholds from data [61].
- Wearable illness detection has the same problem: the smartwatch algorithm that caught 63% of infections early also alarmed about 0.66 times per month in healthy people, and seasonal behaviour ("holiday bump") produced sustained false elevations [58].
- Spaceflight example: on 24 March 2021 several alarms triggered on the ISS and Crew Dragon; the crew went into emergency procedures with the ground and determined the alarms were false, with a likely radiation upset as the cause [62].
- On the ISS a ground team works medical and environmental issues in real time [8][9]; with a 4–24 minute delay [1] that filter is gone, and a crew of four takes on work done by 40+ people on the ground [14].

Design implications: alert on deviation from each person's own baseline [58]; use two tiers (advisory, then confirmed after persistence, as in the yellow/red scheme of [58]); combine independent signals before escalating (sensor data plus symptom reports discriminated better than symptoms alone [59b]); attach one concrete action to every alert (Section 5); and report the expected false-alert rate.

---

## 7. What we could not verify

- **Crewed-mission blackout length at solar conjunction.** Only robotic command moratoria (about two weeks) and a two-day loss of contact were confirmed [4][5].
- **Behavioral risk LxC ratings** and the red/yellow/green colours on the HRR pages; only the Patel et al. "red risk" list was confirmed [28].
- **In-flight resting heart rate change in bpm** beyond "unchanged" and the sleeping values in [55a]; **magnitude of HRV change** (and the two studies disagree on direction) [55a][55f].
- **Circadian heart-rate amplitude in astronauts**; only a ground value was found [56].
- **In-flight SpO2 baseline**; only terrestrial clinical ranges [57].
- **Typical (mean) ISS CO2 level**, Earth-ambient CO2 in mmHg, the official SMAC table, and the current flight rule. Only the 1–9 mmHg range and the 4.0/3.0 mmHg operational limits were confirmed [37][38].
- **Exact paper values 1.84 mSv/day (cruise) and 0.64 mSv/day (Mars surface)**; the abstracts opened do not contain them. The press-release figures 1.8 and 0.67 mSv/day are used instead [43][44].
- **Bone loss per month from primary literature**; the 1%–1.5% figure is from NASA public pages [6][49].
- **Exercise time**: NASA pages give both 2.5 h/day [10] and "two hours" [9][49]; the difference (setup time vs exercise time) was not confirmed in an opened source.
- **Urine specific gravity threshold**, **melatonin dose and timing**, **motion-sickness medication**, and **ISS prebreathe durations**.
- **Fever-to-heart-rate conversion (8.5 bpm/°C)** is second-hand [60].
- **A quantified study of alarm fatigue on the ISS**; only a false-alarm event report was found [62].
- Two abstract values were excluded as implausible or ambiguous on reading: a 53.9% VO2max decrease, and blood-pressure values in a 2010 compression-garment study [51].

---

## References

All URLs opened 2026-11-12. NCBI E-utilities URLs return the PubMed abstract or PMC full text for the listed record(s).

1. NASA. "Space Communications: 7 Things You Need to Know." nasa.gov (year not shown on fetch). https://www.nasa.gov/missions/tech-demonstration/space-communications-7-things-you-need-to-know
2. Karasinski JA, Landon LB, Parisi ME, et al. "Assessment of the State of Communication Delay Research in Preparation for Missions Beyond Low Earth Orbit." NASA Technical Reports Server, 2025. https://ntrs.nasa.gov/citations/20250000703
3. European Space Agency. "Ten things you didn't know about the Moon – Moon calling Earth." ESA, 2021. https://www.esa.int/ESA_Multimedia/Images/2021/09/Ten_things_you_didn_t_know_about_the_Moon_-_Moon_calling_Earth
4. NASA Jet Propulsion Laboratory. "NASA's Mars Fleet Will Still Conduct Science While Lying Low." JPL, 2023. https://www.jpl.nasa.gov/news/nasas-mars-fleet-will-still-conduct-science-while-lying-low/
5. NASA Jet Propulsion Laboratory. "What's Mars Solar Conjunction, and Why Does It Matter?" JPL, 2019. https://www.jpl.nasa.gov/news/whats-mars-solar-conjunction-and-why-does-it-matter/
6. NASA Human Research Program. "The Human Body in Space." nasa.gov, 2021 (updated 2026). https://www.nasa.gov/hrp/bodyinspace/
7. NASA Human Research Program. "5 Hazards of Human Spaceflight." nasa.gov (updated 2026). https://www.nasa.gov/hrp/hazards/
8. Jones JA. "International Space Station Medical Operations." NASA Technical Reports Server, 2008. https://ntrs.nasa.gov/citations/20080010877
9. NASA. "Mission Control: Crew Health Consoles." Houston We Have a Podcast, Ep. 377, 2025. https://www.nasa.gov/podcasts/houston-we-have-a-podcast/mission-control-crew-health-consoles
10. NASA. "FAQ: The Real Story About Astronaut Health Care in Space." nasa.gov, 2024. https://www.nasa.gov/missions/station/faq-the-real-story-about-astronaut-health-care-in-space/
11. NASA Ames Research Center. "A Clinical Decision Support System for Earth-independent Medical Operations." nasa.gov, 2024. https://www.nasa.gov/centers-and-facilities/ames/ames-science/ames-space-biosciences/a-clinical-decision-support-system-for-earth-independent-medical-operations/
12. Parker M, Krihak M, Laing C, et al. "Earth-Independent Medical Operations (EIMO) Concept of Operations." NASA Technical Reports Server, 2025. https://ntrs.nasa.gov/citations/20250000009
13. Urbina M, Rubin D, Hailey M, Reyes D, Antonsen E. "Medical System Concept of Operations for Mars Exploration Missions." NASA Technical Reports Server, 2017. https://ntrs.nasa.gov/citations/20170000500 (abstract record also opened: https://ntrs.nasa.gov/citations/20160013234)
14. NASA Human Research Roadmap. "Risk of Adverse Mission Outcomes Due to Earth Independent Human-Systems Operations." 2025. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=175
15. NASA Human Research Roadmap. "Risks" (index). 2025. https://humanresearchroadmap.nasa.gov/Risks/
16. NASA Human Research Roadmap. "Risk of Adverse Health Outcomes and Decrements in Performance Due to Medical Conditions that occur in Mission." 2025. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=95
17. NASA Human Research Roadmap. "Risk of Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss, Circadian Desynchronization, and Work Overload." 2025. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100
18. NASA Human Research Roadmap. "Risk of Radiation Carcinogenesis." 2026. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=96
19. NASA Human Research Roadmap. "Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)." 2025. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=105
20. NASA Human Research Roadmap. "Risk of Renal Stone Formation." 2025. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=81
21. NASA Human Research Roadmap. "Risk of Cardiovascular Adaptations Contributing to Adverse Mission Performance and Health Outcomes." 2025. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=179
22. NASA Human Research Roadmap. "Risk of Performance Decrement and Crew Illness Due to Inadequate Food and Nutrition." 2025. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=176
23. NASA Human Research Roadmap. "Risk of In Mission Impacts, Adverse Health Events or Long-Term Health Impacts due to Altered Immune Response." 2025. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=85
24. NASA Human Research Roadmap. "Risk of Mission Impacts and Long-Term Health Issues due to Decompression Sickness." 2025. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=168
25. NASA Human Research Roadmap. "Risk of Bone Fracture due to Spaceflight-induced Changes to Bone." 2025. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=77
26. NASA Human Research Roadmap. "Risk of Mission Performance Decrements and Adverse Health Outcomes Resulting from Reduced Cardiorespiratory and Musculoskeletal Fitness." 2025. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=180
27. NASA Human Research Roadmap. "Risk of Altered Sensorimotor/Vestibular Function Impacting Critical Mission Tasks." 2025. https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=88
28. Patel ZS, Brunstetter TJ, Tarver WJ, et al. "Red risks for a journey to the red planet: The highest priority human health risks for a mission to Mars." npj Microgravity 6:33, 2020. https://pmc.ncbi.nlm.nih.gov/articles/PMC7645687/
29. NASA. "NASA-STD-3001 Volume 1, Section 4.0 Human Performance." nasa.gov (updated 2026). https://www.nasa.gov/reference/4-0-human-performance/
30. NASA. "NASA-STD-3001 Volume 1, Section 6.0 Medical Operations." nasa.gov (updated 2026). https://www.nasa.gov/reference/6-0-medical-operations/
31. Barger LK, Flynn-Evans EE, Kubey A, et al. "Prevalence of Sleep Deficiency and Hypnotic Use Among Astronauts Before, During and After Spaceflight: An Observational Study." Lancet Neurology 13(9):904–912, 2014. https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=4188436
32. Jones CW, Basner M, Mollicone DJ, et al. "Sleep deficiency in spaceflight is associated with degraded neurobehavioral functions and elevated stress in astronauts on six-month missions aboard the International Space Station." Sleep 45(3), 2022. https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=8919197
33. Dinges DF, Mollicone D, Ecker A. "Psychomotor Vigilance Self Test on ISS (Reaction Self Test on Expeditions 21 and 22)." NASA Technical Reports Server, 2009. https://ntrs.nasa.gov/citations/20090029851
34. Basner M, Savitt A, Moore TM, et al. "Development and Validation of the Cognition Test Battery for Spaceflight." Aerosp Med Hum Perform 86(11):942–952, 2015; and Moore TM, Basner M, Nasrini J, et al. "Validation of the Cognition Test Battery for Spaceflight in a Sample of Highly Educated Adults." Aerosp Med Hum Perform 88(10):937–946, 2017. https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=26564759,28923143&rettype=abstract&retmode=text
35. NASA. "Seven Ways Astronauts Improve Sleep May Help You Snooze Better on Earth." nasa.gov, 2016 (updated 2023). https://www.nasa.gov/missions/station/seven-ways-astronauts-improve-sleep-may-help-you-snooze-better-on-earth/
36. Maida JC. "Introduction to the Solid State Based Interior Lighting System for ISS." NASA Technical Reports Server, 2014. https://ntrs.nasa.gov/citations/20160005080
37. Law J, Van Baalen M, Foy M, et al. "Relationship between carbon dioxide levels and reported headaches on the International Space Station." J Occup Environ Med 56(5):477–483, 2014. https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=24806559&rettype=abstract&retmode=text
38. Law J, Alexander D. "CO2 on the International Space Station: An Operations Update." NASA Technical Reports Server, 2016. https://ntrs.nasa.gov/citations/20150019624
39. NASA. "ISS Daily Summary Report – 10/04/2016" (Personal CO2 Monitor). nasa.gov, 2016. https://www.nasa.gov/blogs/stationreport/2016/10/04/iss-daily-summary-report-10-04-2016/
40. NASA. "Wearable Tech for Space Station Research." nasa.gov, 2024. https://www.nasa.gov/missions/station/iss-research/wearable-tech-for-space-station-research/
41. Zeitlin C, Hassler DM, Cucinotta FA, et al. "Measurements of energetic particle radiation in transit to Mars on the Mars Science Laboratory." Science 340(6136):1080–1084, 2013. https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=23723233,24324275,24806559&rettype=abstract&retmode=text
42. Hassler DM, Zeitlin C, Wimmer-Schweingruber RF, et al. "Mars' surface radiation environment measured with the Mars Science Laboratory's Curiosity rover." Science 343(6169):1244797, 2014. Same URL as [41] (abstract contains no dose values).
43. Southwest Research Institute. "SwRI scientists publish first radiation measurements from the surface of Mars." SwRI press release, 2013. https://www.swri.org/press-release/swri-scientists-publish-first-radiation-measurements-surface-mars
44. NASA Jet Propulsion Laboratory. "Data From NASA Rover's Voyage to Mars Aids Planning." JPL, 2013. https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/
45. Zhang S, Wimmer-Schweingruber RF, Yu J, et al. "First measurements of the radiation dose on the lunar surface." Science Advances 6(39):eaaz1334, 2020. https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=7518862
46. National Academies of Sciences, Engineering, and Medicine. "NASA Should Update Astronaut Radiation Exposure Limits, Improve Communication of Cancer Risks." News release, 2021. https://www.nationalacademies.org/news/nasa-should-update-astronaut-radiation-exposure-limits-improve-communication-of-cancer-risks
47. NASA Space Radiation Analysis Group. "How do we protect the astronauts from space radiation?" NASA Johnson Space Center, 2025. https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm
48. NASA. "Scientists and Engineers Evaluate Orion Radiation Protection Plan." nasa.gov, 2016 (updated 2023). https://www.nasa.gov/missions/artemis/orion/scientists-and-engineers-evaluate-orion-radiation-protection-plan/
49. NASA. "Counteracting Bone and Muscle Loss in Microgravity." nasa.gov, 2023. https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/
50. Smith SM, Heer MA, Shackelford LC, et al. "Benefits for bone from resistance exercise and nutrition in long-duration spaceflight: Evidence from biochemistry and densitometry." J Bone Miner Res 27(9):1896–1906, 2012. https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=22549960&rettype=abstract&retmode=text
51. Multi-record PubMed abstract page: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=33299095,24970852,26630198,28153941,28985128,24337701,23713210,20824997&rettype=abstract&retmode=text
   - 51b. Moore AD Jr, Downs ME, Lee SM, et al. "Peak exercise oxygen uptake during and following long-duration spaceflight." J Appl Physiol 117(3):231–238, 2014.
   - 51c. Stenger MB, Lee SM, Ribeiro LC, et al. "Gradient compression garments protect against orthostatic intolerance during recovery from bed rest." Eur J Appl Physiol 114(3):597–608, 2014.
   - 51d. Stenger MB, Brown AK, Lee SM, Locke JP, Platts SH. "Gradient compression garments as a countermeasure to post-spaceflight orthostatic intolerance." Aviat Space Environ Med 81(9):883–887, 2010.
52. Multi-record PubMed abstract page: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=16935570,27843335,25197887,30792698,26630196,19765769&rettype=abstract&retmode=text
   - 52a. Heer M, Paloski WH. "Space motion sickness: incidence, etiology, and countermeasures." Auton Neurosci 129:77–79, 2006.
   - 52b. Crucian B, Babiak-Vazquez A, Johnston S, et al. "Incidence of clinical symptoms during long-duration orbital spaceflight." Int J Gen Med 9:383–391, 2016.
   - 52c. Lee SMC, Feiveson AH, Stein S, et al. "Orthostatic Intolerance After ISS and Space Shuttle Missions." Aerosp Med Hum Perform 86(12 Suppl):A54–A67, 2015.
   - 52d. Zwart SR, Launius RD, Coen GK, et al. "Body mass changes during long-duration spaceflight." Aviat Space Environ Med 85:897–904, 2014.
   - 52e. Rooney BV, Crucian BE, Pierson DL, et al. "Herpes Virus Reactivation in Astronauts During Spaceflight and Its Application on Earth." Front Microbiol 10:16, 2019.
   - 52f. Whitson PA, Pietrzyk RA, Jones JA, et al. "Effect of potassium citrate therapy on the risk of renal stone formation during spaceflight." J Urol 182:2490–2496, 2009.
53. Goodenow-Messman DA, Gokoglu SA, Kassemi M, et al. "Numerical characterization of astronaut CaOx renal stone incidence rates to quantify in-flight and post-flight relative risk." npj Microgravity 8, 2022. https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=8799707
54. Whitson PA, Pietrzyk RA, Sams CF, Pak CYC, Jones JA. "Renal Stone Risk During Space Flight." NASA Technical Reports Server, 1999. https://ntrs.nasa.gov/citations/20000020539
55. Multi-record PubMed abstract pages: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=28050606,23637139,23291736,22764612,19833299,29991811,26137491,25392280,15113425&rettype=abstract&retmode=text and https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=41360141,29752376,27748006&rettype=abstract&retmode=text
   - 55a. Xu D, Shoemaker JK, Blaber AP, et al. "Reduced heart rate variability during sleep in long-duration spaceflight." Am J Physiol Regul Integr Comp Physiol 305(2):R164–170, 2013.
   - 55b. Khine HW, Steding-Ehrenborg K, Hastings JL, et al. "Effects of Prolonged Spaceflight on Atrial Size, Atrial Electrophysiology, and Risk of Atrial Fibrillation." Circ Arrhythm Electrophysiol 11(5):e005959, 2018.
   - 55c. Mastrandrea CJ, Rabineau J, Greaves D, et al. "Bio-Monitor Detects Reduced Obstructive Sleep Apnea and Susceptibility to Arrhythmia in Spaceflight." Aerosp Med Hum Perform 96(12):1084–1089, 2025.
   - 55d. Fraser KS, Greaves DK, Shoemaker JK, et al. "Heart rate and daily physical activity with long-duration habitation of the International Space Station." Aviat Space Environ Med 83(6):577–584, 2012.
   - 55e. Verheyden B, Liu J, Beckers F, et al. "Adaptation of heart rate and blood pressure to short and long duration space missions." Respir Physiol Neurobiol 169 Suppl 1:S13–16, 2009.
   - 55f. Otsuka K, Cornelissen G, Furukawa S, et al. "Long-term exposure to space's microgravity alters the time structure of heart rate variability of astronauts." Heliyon 2(12):e00211, 2016.
56. Miyagi R, Sasawaki Y, Shiotani H. "The influence of short-term sedentary behavior on circadian rhythm of heart rate and heart rate variability." Chronobiol Int 36(3):374–380, 2019. https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=40286232,38942206,30501447,30165244,26915140,23685233,16799244,15944873,8443845,2346954&rettype=abstract&retmode=text
57. MedlinePlus. "Pulse Oximetry." U.S. National Library of Medicine, 2024. https://medlineplus.gov/lab-tests/pulse-oximetry/
58. Mishra T, Wang M, Metwally AA, et al. "Pre-symptomatic detection of COVID-19 from smartwatch data." Nat Biomed Eng 4(12):1208–1220, 2020. https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=9020268
59. Multi-record PubMed abstract page: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=33208926,33334565,33122860,34586364&rettype=abstract&retmode=text
   - 59a. Radin JM, Wineinger NE, Topol EJ, et al. "Harnessing wearable device data to improve state-level real-time surveillance of influenza-like illness in the USA: a population-based study." Lancet Digit Health 2(2):e85–e93, 2020.
   - 59b. Quer G, Radin JM, Gadaleta M, et al. "Wearable sensor data and self-reported symptoms for COVID-19 detection." Nat Med 27(1):73–77, 2021.
   - 59c. Grzesiak E, Bent B, McClain MT, et al. "Assessment of the Feasibility of Using Noninvasive Wearable Biometric Monitoring Sensors to Detect Influenza and the Common Cold Before Symptom Onset." JAMA Netw Open 4(9):e2128534, 2021.
60. Natarajan A, Su HW, Heneghan C. "Assessment of physiological signs associated with COVID-19 measured using wearable devices." NPJ Digit Med 3(1):156, 2020. https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=7705652
61. Chromik J, Klopfenstein SAI, Pfitzner B, et al. "Computational approaches to alleviate alarm fatigue in intensive care medicine: A systematic literature review." Frontiers in Digital Health 4, 2022. https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2022.843747/full
62. NASA. "ISS Daily Summary Report – 3/24/2021." nasa.gov, 2021. https://www.nasa.gov/blogs/stationreport/2021/03/24/iss-daily-summary-report-3-24-2021
63. MedlinePlus Medical Encyclopedia. "Fever." U.S. National Library of Medicine, reviewed 2024. https://medlineplus.gov/ency/article/003090.htm
64. MedlinePlus Medical Encyclopedia. "Low blood sugar." U.S. National Library of Medicine, reviewed 2026. https://medlineplus.gov/ency/article/000386.htm
65. MedlinePlus Medical Encyclopedia. "Low blood pressure." U.S. National Library of Medicine, reviewed 2025. https://medlineplus.gov/ency/article/007278.htm
66. MedlinePlus Medical Encyclopedia. "Blood sugar test." U.S. National Library of Medicine, reviewed 2025. https://medlineplus.gov/ency/article/003482.htm
67. MedlinePlus Medical Encyclopedia. "High blood pressure in adults - hypertension." U.S. National Library of Medicine, reviewed 2025. https://medlineplus.gov/ency/article/000468.htm

References 63 to 67 were added on 2026-11-12 after the clinical review round, for the fixed safety thresholds in `shared/rules.json`: an adult probably has a fever above 37.2 to 37.5 °C by mouth and should seek care if it stays at or above 39.4 °C or lasts more than 48 to 72 hours [63]; blood sugar below 70 mg/dL is low and below 54 mg/dL can cause unclear thinking or seizure [64]; fasting 70 to 99 mg/dL is normal and a random value of 200 mg/dL or more often means diabetes [66]; normal adult blood pressure is between 90/60 and 120/80 mmHg [65], and 140/90 or higher is stage 2 high blood pressure territory in the staging described in [67]. These are terrestrial public guidance, not flight rules.
