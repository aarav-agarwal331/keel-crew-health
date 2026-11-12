# Open-data survey: wearable baselines, labeled events, spaceflight and analog data

Access date for everything below: **2026-11-12**. Machine-readable companion: `data/SOURCES.json`
(slug, URLs, licence, bytes and sha256 of every file under `data/raw/`).

> **What Keel ended up using** (added after the build): Stanford COVID-19 wearables phases 1 and 2 for
> detection testing; LifeSnaps for day-to-day variability and correlations between indicators; the
> NASA Life Sciences Data Archive bed-rest daily vitals for gravity-transition handling. `make data`
> fetches exactly these (`research/scripts/fetch_data.py`). PMData, the stress datasets and the other
> entries below were surveyed and downloaded as samples but are not used.
>
> **Counts.** The table below gives people as described by the papers. Our reduced files count
> *recordings*: phase 1 has 120 recordings from 118 people, labelled 32 covid, 76 no reported illness, 11 other illness, 1 other illness (influenza b); phase 2
> (the subset we downloaded) has 84 covid, 120 non positive. The exact cohort that
> enters the evaluation, after exclusions, is in `app/public/results/real_eval.json` under `cohort`.
> The simulator's heart-rate noise is fitted on recordings with no dated illness, which includes
> phase 2 participants who are simply absent from the positives table and were never confirmed healthy.

## 1. What this survey is for

The app learns a personal physiological baseline (resting heart rate, HRV, SpO2, sleep, activity,
symptoms) and flags drift before a health event. Two things are needed from real data:

- **(a) Detection evaluation**: wearable recordings from many people with *dated* events
  (illness onset, sleep loss, stress, exertion), so that detection rate, lead time and false alarms
  per person-month can be measured on held-out people.
- **(b) Simulator realism**: real spaceflight or analog physiology to compare against simulated
  distributions.

## 2. Bottom line

1. **Open astronaut wearable time series do not exist** in any source checked. NASA OSDR has no human
   actigraphy / heart-rate / sleep / cognition assay at all; NASA LSDA holds ISS actigraphy and Standard
   Measures only behind a data request; ESA HREDA lists only "Investigation Data Blank Book" PDFs for
   its bed-rest studies, no measurements. No Inspiration4 wearable data were found in OSDR or SOMA.
2. **The best real analog data found is NASA LSDA's public bed-rest holdings** (UTMB head-down-tilt
   campaigns): subject-level *daily* vitals for 29 subjects across pre / in / post bed rest, with
   symptom-complaint and medication logs. It is a nurse-measured daily series, not a wearable stream.
3. **Illness-onset evaluation is well covered** by the two Stanford COVID-19 wearable cohorts:
   116 COVID-19-positive people with dated tests or symptom onsets, plus 13 people with other dated
   illnesses and 193 comparison participants, all downloaded.
4. **No open dataset has daily RHR + HRV + SpO2 together with dated illness.** The Stanford sets have
   heart rate and steps (sleep for 32 people) but no HRV or SpO2. LifeSnaps has the full signal set but
   no illness labels. Welltory has HRV and symptom onsets, but only 21 people have any measurement
   before onset.

## 3. Ranked recommendation

### 3a. Detection evaluation with held-out people

| Rank | Dataset | Event type | People | Dated events | Local path |
|---|---|---|---|---|---|
| 1 | Stanford COVID-19 wearables, phase 2 (subset) | Illness onset | 204 | 84 COVID-19 positives: 84 test dates, 66 symptom-onset dates | `data/raw/stanford_covid_wearables_phase2/` |
| 2 | Stanford COVID-19 wearables, phase 1 | Illness onset | 118 | 32 COVID-19 (30 symptom, 30 diagnosis dates); 13 people with 15 other-illness rows; 73 unlabelled | `data/raw/stanford_covid_wearables_phase1/` |
| 3 | PMData | Sleep loss, stress, fatigue, exertion, injury | 16 | 1,747 daily wellness reports, 783 training sessions, 77 non-empty injury reports | `data/raw/pmdata/pmdata.zip` |

Stress-specific add-ons, both fully downloaded:

- `data/raw/nurse_stress/` for real-world stress: 15 nurses, 358 survey-labelled intervals
  (179 high, 20 medium, 46 none, 113 "na").
- `data/raw/physionet_wearable_stress_exercise/` for acute stress and exertion under protocol:
  37 stress, 31 aerobic and 32 anaerobic sessions.

Suggested protocol: tune thresholds on phase 1, report on phase 2 (different cohort, different ID
space), and split by participant, never by time. Use the 73 unlabelled phase-1 participants and the
120 non-positive phase-2 participants for false alarms per person-month.

### 3b. Real-versus-simulated distribution comparison

| Rank | Dataset | Why | Local path |
|---|---|---|---|
| 1 | NASA LSDA public bed-rest data | Only real analog found with subject-level daily series and phase labels; shows the deconditioning shift | `data/raw/nasa_lsda_nlsp_public/CRF/` |
| 2 | LifeSnaps daily table | Same signal set as the app (RHR, RMSSD, SpO2, skin temperature, breathing rate, sleep, steps) for 71 people | `data/raw/lifesnaps/extracted/daily_fitbit_sema_df_unprocessed.csv` |

Supporting: `data/raw/zenodo_hdt_bcg_ecg/` (acute head-down-tilt HR and HRV response, 22 people) and
`data/raw/rki_corona_datenspende/` (population seasonality of RHR, steps and sleep).

### 3c. Quirks of the recommended sets

**Stanford phase 2** (`stanford_covid_wearables_phase2/`)

- This is a **subset**, not the archive: all 84 positives in `covid_positive/<PID>/` and 120 others in
  `non_positive_sample/<PID>/` (first 60 Fitbit and first 60 non-Fitbit IDs in sorted order). The full
  zip is 5.5 GB with 2,123 participants. `EXTRACT_MANIFEST.tsv` maps every file to its zip member.
- Files are `.csv.gz`, re-compressed locally from the zip's members (CRC32 verified).
- **The first line of every CSV is blank**; the header is on line 2.
- Fitbit: `Orig_Fitbit_HR.csv` has `datetime,heartrate` at 5 to 15 s spacing; `Orig_Fitbit_ST.csv` has
  `datetime,steps` per minute.
- Apple Watch and other devices: `Orig_NonFitbit_HR.csv` has `device,datetime,heartrate` at irregular
  spacing of a few seconds to minutes; `Orig_NonFitbit_ST.csv` has
  `device,start_datetime,end_datetime,steps` as intervals. 49 positives are Fitbit, 35 Apple Watch.
- No sleep, HRV or SpO2. Resting heart rate must be derived (the authors use heart rate where steps
  are zero overnight).
- Labels: sheet `SourceData_COVID19_Positives` of `41591_2021_1593_MOESM3_ESM.xlsx`, columns
  `Participant ID`, `COVID-19 Test Date`, `COVID-19 Symptom Onset`, `Retrospective / Prospective`,
  `Device`. Dates are ISO strings; a missing onset is the string `-` (18 cases).
- **Dates are shifted per participant** (years 2025 to 2028 appear). Labels and sensor files share the
  shift: all 84 anchors fall inside the participant's heart-rate span. Calendar season and
  cross-participant alignment are meaningless. Time zone is not stated.
- Baseline before the anchor (onset, else test date): median 84 days, minimum 12; 76 of 84 have at
  least 28 days. Recording span: median 184 days for positives, 122 for the others.
- "Non-positive" means "not in the positives table", **not confirmed healthy**. They may include other
  illness, vaccination or untested infection, so false-alarm rates are an upper bound.

**Stanford phase 1** (`stanford_covid_wearables_phase1/COVID-19-Wearables.zip`, read it in place; it is
3.6 GB uncompressed)

- 280 CSVs named `<ID>_hr.csv`, `<ID>_steps.csv`, `<ID>_sleep.csv`. Columns are
  `user,datetime,heartrate`; `user,datetime,steps`; `user,datetime,stage_duration,stage`.
- Heart-rate spacing differs by participant: 5 to 15 s for some, 60 s for others. Steps are per minute.
  `stage_duration` is in seconds; stages mix the two Fitbit vocabularies (`wake/light/deep/rem` and
  `awake/restless/asleep`).
- Sleep files exist only for the 32 COVID-19 participants.
- Four participants also have `_hr_longterm.csv` / `_steps_longterm.csv`. Participant `AA0HAI1` has
  three episode files (`AA0HAI1_1_hr.csv` ...) that match label rows `AA0HAI1_Illness_1..3`.
- Labels are in `41551_2020_640_MOESM3_ESM.xlsx`. Each sheet has title rows; the header row starts with
  `ParticipantID`.
  - `SuppTable3_Fig2a_COVID-19`: `ParticipantID, Category, Symptom_dates, covid_diagnosis_dates,
    recovery_dates`. Cells are **strings** such as `[Timestamp('2026-07-14 00:00:00')]`; 8 cells hold
    several dates; missing is `[NaT]`.
  - `SuppTable4_Fig2a_Illnesses`: 32 self-reported illness episodes for 18 people with
    `shift_sick_start`, `shift_sick_end`, severity and symptoms.
  - `SuppTable5_Fig2a_DailySymptoms`: 1,461 daily symptom rows for 37 people.
  - `SuppTable13`, `24` to `27`: the authors' own detection days relative to symptom onset, usable as a
    published lead-time baseline.
- Dates are shifted per participant ("Dates have been shifted to obscure PHI"). For 28 of 32 COVID-19
  participants the symptom or diagnosis anchor lies inside the heart-rate file's span; median 44.5 days
  of data precede it. Check each participant before use.

**PMData** (`pmdata/pmdata.zip`, 3.2 GB uncompressed; 40% of that is food photos)

- Per participant `pNN/`: `fitbit/heart_rate.json` (5 s `bpm` with `confidence`),
  `resting_heart_rate.json` (daily, with `error`), `sleep.json`, `sleep_score.csv`, `steps.json`
  (per minute, value is a string), and `pmsys/wellness.csv`, `srpe.csv`, `injury.csv`,
  `googledocs/reporting.csv`.
- `wellness.csv` scales: fatigue, mood, sleep_quality, soreness and stress are 1 to 5 where **3 is
  normal and 1 to 2 are below normal**; readiness is 0 to 10; `sleep_duration_h` is self-reported hours.
- PMSys timestamps are UTC (`...Z`). Fitbit timestamps are local time without zone. The `reporting.csv`
  date is `DD/MM/YYYY`.
- No illness field. Injuries are body-part maps such as `{'right_hand': 'minor'}`; most rows are `{}`.
- Missing data: `p12` and `p13` have no `resting_heart_rate.json`; `p12` has one sleep-score row; `p04`
  has 35 resting-HR days.
- Recording runs November 2019 to March 2020, so the last weeks overlap the first COVID-19 lockdown.

**NASA LSDA bed rest** (`nasa_lsda_nlsp_public/`)

- One CSV per subject per table. Daily vitals: `CRF/UTMB_Bedrest_Campaign_3_Daily_Vitals/` (23 subjects,
  2,451 rows, median 115 days each), `..._Campaign_1_Daily_Vitals/` (3 subjects, 504 rows),
  `CRF/CRF_CFT70_VITALS_DATA/` (3 subjects, 237 rows; the 70-day Campaign 11 study).
- Columns include `Subject, Date, Test_Phase, BR_Day, Pulse, Blood Pressure systolic/diastolic,
  Respiration rate, Vitals collection time, Weight, Temperature body (Celsius)`.
  **Column names differ between campaigns** (`Pulse` versus `Pulse (bpm)`, `SysBP (mmHg)` and so on).
- `Test_Phase` is `PRE_TEST`, `IN_TEST`, `POST_TEST`. `BR_Day` restarts in each phase and counts *down*
  before bed rest. Dates are `M/D/YYYY` and are real (2004 to 2013), not shifted.
- One measurement per day, usually near 06:00; the time is empty in about 70% of Campaign 3 rows and
  body temperature is filled in about 28%.
- Events: `CRF/UTMB_Bedrest_Campaign_3_Symptom_Complaint/` has 921 dated complaints (headache about
  200, pain about 210, sleeping difficulty about 60, constipation about 40); the complaint is free text.
  `CRF/CRF_CFT70_SYMPTOMS_DATA/` has 132 coded rows. Medication logs sit alongside.
- Measured Campaign 3 pulse: 69.6 bpm before, 71.2 during, 77.3 after bed rest (SD 12 to 14). That
  post-bed-rest rise is the kind of shift a simulator should reproduce.
- Also present: nightly actigraphy sleep for 3 subjects (`BRSMAct/`, 207 nights), tilt-test
  haemodynamics for 27 subjects (`MR001G/`), cognition test scores for 3 subjects (`BRSMPT/`).
- These are healthy volunteers lying at 6 degrees head-down. No HRV, SpO2 or continuous heart rate.

**LifeSnaps** (`lifesnaps/extracted/`)

- `daily_fitbit_sema_df_unprocessed.csv`: 7,410 user-days, 71 users, 2021-04-08 to 2022-01-22.
- Coverage is uneven: `resting_hr` 4,422 days (71 users), `rmssd` 2,475 (43), `spo2` 1,270 (28),
  `nightly_temperature` 3,359 (64), `full_sleep_breathing_rate` 2,495 (43), `steps` 4,777 (71).
- `sleep_duration` is in **milliseconds**. `nightly_temperature` is skin temperature in Celsius.
- Mood columns (`TENSE/ANXIOUS`, `TIRED`, `ALERT`, `HAPPY` ...) are 0/1 from phone prompts on 2,290 days.
- `hourly_fitbit_sema_df_unprocessed.csv` has the hourly version. The raw 9.7 GB Fitbit export is
  `mongo_rais_anonymized/fitbit.bson` inside the zip (MongoDB dump; not inspected).

## 4. Method and limits

- Every candidate was fetched with `curl -L` or Python `urllib`, anonymously, with a generic
  User-Agent (`Mozilla/5.0`). Zenodo's API answered 403 to that bare string, so `curl/8.7.1` was used
  for Zenodo only.
- No accounts were created and no agreements accepted. Anything needing either is marked NOT OPEN.
- Archives over the size limit were sampled with HTTP range requests (central directory plus selected
  members), never downloaded whole.
- Files were inspected read-only (`unzip -l`, `head`, Python with `-I`). Nothing from a download was
  executed. Notebooks, `.m` scripts, `.pkl` and `.bson` files were not opened.
- **No PDF was read** (project rule). Where the only documentation is a PDF, the description below
  relies on file contents and landing-page text, and says so.
- The NASA LSDA and ESA HREDA portals are JavaScript applications. Their public JSON endpoints were
  found by loading the pages in a browser and reading the network log, then called with curl.
- Counts below are measured from the downloaded files unless a source is named.
- Total on disk: 4.85 GB (4,853,542,680 bytes) under `data/raw/`; the limit was about 6 GB.

## 5. Spaceflight and analog sources

### 5.1 NASA Open Science Data Repository (OSDR)

- **What was checked**: study search API (`https://osdr.nasa.gov/osdr/data/search?term=&from=0&size=1000&type=cgene`,
  HTTP 200, 577 studies) and the assay table for all 647 datasets
  (`https://visualization.osdr.nasa.gov/biodata/api/v2/query/metadata/?...`, HTTP 200, 51,792 sample rows).
- **Finding**: 119 human accessions, almost all omics. The only non-omics human assays are Complete
  Blood Count (OSD-569), Comprehensive Metabolic Panel and Multiplex immunoassay (OSD-575, OSD-656) and
  cell or tissue assays (OSD-815, 816, 817, 936). **No human actigraphy, heart-rate, sleep, wearable or
  cognition assay exists in OSDR.** The search term `actigraphy` returns 0 hits.
- **Downloaded**: `data/raw/nasa_osdr_inspiration4_clinical/` (5 files, 75 KB).
  - What: Inspiration4 blood tests. 4 crew (`C001` to `C004`), 7 time points (`L-92, L-44, L-3, R+1,
    R+45, R+82, R+194`), none in flight.
  - Fields seen (long format): `ANALYTE, VALUE, RANGE_MIN, RANGE_MAX, UNITS, TEST_TYPE, SUBJECT_ID, SEX,
    TEST_DATE`; 23 CBC analytes. The `_TRANSFORMED` files are wide, one row per sample.
  - URL pattern: `https://osdr.nasa.gov/geode-py/ws/studies/OSD-569/download?source=datamanager&file=<name>`
    (HTTP 200 after redirect to S3).
  - Licence: no licence field in the study metadata. NASA's page
    `https://science.nasa.gov/biological-physical/data/` describes OSDR as "open access".
  - Verdict: (a) none. (b) only for pre/post-flight blood values; no vital-sign series.
- **Inspiration4 family** (OSD-569 to 575, 630, 656, 687): file listings fetched; they hold sequencing,
  proteomics, metabolomics, microbiome, CBC, CMP and cytokines. No Apple Watch, cognition or
  physiological monitoring tables. The SOMA portal (`https://soma.weill.cornell.edu/`, HTTP 200) links
  back to OSDR and offers no wearable download.

### 5.2 NASA Life Sciences Data Archive via the NASA Life Sciences Portal (NLSP)

- **What was checked**: `https://nlsp.nasa.gov/api/v1/data/experiments?...&limit=500&page=1..6`
  (HTTP 200, 2,676 experiments), then `.../experiments/<uuid>/full` for 82 public human experiments
  with physiological variables.
- **Availability by status string** (all species): 306 experiments "All datasets are publicly
  available", 156 partly public, 581 "available via data request", 1,463 not held by LSDA.
- **Human experiments with heart-rate, sleep, actigraphy or cognition variables**:

  | Setting | Experiments | Fully public | Partly public | By request | Not in LSDA / in progress |
  |---|---|---|---|---|---|
  | ISS expeditions | 61 | 1 | 3 | 22 | 35 |
  | Bed rest | 48 | 5 | 1 | 23 | 19 |
  | HERA | 26 | 0 | 1 | 14 | 11 |
  | NEEMO | 9 | 1 | 1 | 2 | 5 |
  | Antarctic | 1 | 0 | 0 | 1 | 0 |

- **NOT OPEN (data request)**: ISS Sleep-Wake Actigraphy and Light Exposure (`9802394`, `Sleep_ISS12`),
  Spaceflight Standard Measures actigraphy / cognition / sleep quality (`SSM_*`), `Cognition`,
  `Reaction` (PVT on ISS), and the HERA studies. Not requested.
- **Open but not useful**: NEEMO 5 actigraphy and physiologic monitoring, Skylab crew health, in-flight
  Holter (DSO 463) expose only figure images, timetables and small summary tables.
- **Downloaded**: `data/raw/nasa_lsda_nlsp_public/` (472 data files plus `DOWNLOAD_MANIFEST.tsv`, 9.0 MB, CSV/XLS; PDFs and images skipped).
  - URL pattern: `https://nlsp.nasa.gov/api/v1/files/<file key>/download` (HTTP 200, `text/csv`); the
    exact URL of every file is in `DOWNLOAD_MANIFEST.tsv` and `data/SOURCES.json`.
  - What: UTMB Flight Analogs Research Unit 6-degree head-down-tilt bed rest, campaigns 1 (2004),
    3 (2005 to 2010) and 11 / CFT70 (70 days, 2011 onward).
  - People and duration: 23 + 3 + 3 subjects with daily vitals; about 87 to 120 days per subject in
    Campaign 3.
  - Sensors: nurse-taken pulse, blood pressure, respiration rate, oral temperature, weight; wrist
    actigraphy sleep summaries (3 subjects); tilt-test stroke volume, cardiac output, blood pressure
    and heart rate (27 subjects); ARES cognition scores (3 subjects).
  - Labeled events: 921 symptom complaints (Campaign 3) and 132 (CFT70), medication logs (7,234 and
    576 rows), protocol deviations; phase labels on every row.
  - Licence: no licence text on the portal; records state "All datasets are publicly available".
  - Verdict: (a) limited: daily cadence, 29 people, events are mostly headache, pain and sleep
    complaints, but usable as a small analog test of symptom-day detection. (b) **best available**:
    real analog distributions, within-person day-to-day variance and a pre/in/post shift.
  - The other small tables (`9401663` Mir sleep summary, `LMLSTP3.4` chamber sleep, `ASTP005` illness
    reports, `DSO_484`, `skych`, NEEMO timetables) are legacy `.xls` summary sheets; they were saved
    but not parsed.
- More public bed-rest tables exist and were not fetched: aerobic capacity (`MR080G`, 1,505 files),
  WinSCAT cognition (`MR085G`), clinical labs (`MR010G`), immune and virus-reactivation measures.

### 5.3 ESA Human and Robotic Exploration Data Archive (HREDA)

- **What was checked**: public TAP service
  `https://hreda.esac.esa.int/hreda-sl-tap/tap/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=...`
  (HTTP 200) on `hreda.v_investigation` and `hreda.v_file_metadata`.
- **Finding**: 3,177 investigations, 141 with data. Analogues (Mars105/Mars500, Concordia, SIRIUS and
  others): 0 of 96 with data. Bed rest / immersion: 9 of 109 (AGBRESA, BRACE 2023, RSL, MNX, MEP, NUC,
  Cocktail, BRAG, Hemo), and their only listed files have product type "Investigation Data Blank Book"
  (one or two PDFs of 0.6 to 1.9 MB per study), not measurement files. Not downloaded, not read.
- **NOT OPEN** for physiological time series. DOI `10.57780/esa-53fc9ab` (space-analog cardiovascular
  variability) resolves to a 404 page.

### 5.4 Other analog candidates

| Candidate | What happened | Status |
|---|---|---|
| Mars-500, SIRIUS, HI-SEAS, HERA, Antarctic stations | DataCite and Zenodo dataset searches returned no human physiological series | NOT FOUND |
| AGBRESA, VaPER, WISE bed rest | Only HREDA blank-book PDFs (AGBRESA); VaPER and WISE not found | NOT OPEN |
| data.nasa.gov | `package_search` for "actigraphy" and "crew sleep": 0 results; "astronaut heart rate" timed out | NOTHING |
| TRISH EXPAND database | `expand.trish.org` failed TLS; BCM page 404 | NOT REACHABLE |
| Zenodo 10653443, parabolic flight | Plasma proteomics tables only | NOT USEFUL |
| Zenodo 10592101, head-down tilt variability | `access_right: restricted`, 0 files | NOT OPEN |

### 5.5 Graded head-down tilt, ballistocardiography and ECG (Zenodo 22116030)

- Path: `data/raw/zenodo_hdt_bcg_ecg/` (10 files, 12 MB). URL pattern
  `https://zenodo.org/api/records/22116030/files/<name>/content`, HTTP 200. Licence: CC BY 4.0 (Zenodo
  record API).
- What: 22 healthy participants, one 60-minute session in 12 five-minute segments at 0, -5, -10, -15,
  0, -20, 0 degrees.
- Fields seen: `ECG_parameters.csv` has `subject, training_group, segment, phase, tilt_deg, modality,
  n_intervals, hr_bpm, rmssd_ms, sdnn_ms, lf_ms2, hf_ms2, lf_hf`; `ECG_IBI.csv` has per-beat `ibi_s`
  with `valid_for_analysis` (84,013 rows).
- Verdict: (a) none (no health events). (b) useful for the *acute* fluid-shift response of HR and HRV;
  it says nothing about multi-day adaptation.

## 6. Ground wearable datasets with labels

### 6.1 Stanford COVID-19 wearables, phase 1 (Mishra et al. 2020)

- Download: `https://storage.googleapis.com/gbsc-gcp-project-ipop_public/COVID-19/COVID-19-Wearables.zip`,
  HTTP 200, 378,380,920 bytes. Labels:
  `https://static-content.springer.com/esm/art%3A10.1038%2Fs41551-020-00640-6/MediaObjects/41551_2020_640_MOESM3_ESM.xlsx`,
  HTTP 200, 4,041,311 bytes.
- People: 118. Duration: 50 to 189 days for the COVID-19 group (median 87.5). Sensors: Fitbit heart
  rate, steps, sleep stages.
- Labeled events: 32 COVID-19 (30 with symptom date, 30 with diagnosis date, 26 with recovery date);
  15 other-illness rows for 13 people; 32 self-reported illness episodes with start and end; 1,461
  daily symptom reports.
- Licence: none stated. The article's Data availability section says the de-identified data "can be
  downloaded from the study data repository". Treat as public research data, cite the paper.
- Verdict: (a) strong. (b) usable for healthy-adult heart-rate and step distributions.
- Note: the bucket also holds `COVID-19-Wearables_OLD.zip` (253,837,815 bytes), not downloaded.

### 6.2 Stanford COVID-19 wearables, phase 2 (Alavi et al. 2022)

- Download: `https://storage.googleapis.com/gbsc-gcp-project-ipop_public/COVID-19-Phase2/COVID-19-Phase2-Wearables.zip`,
  HTTP 206 on range requests, 5,537,624,129 bytes total, 8,497 members, 36.3 GB uncompressed.
  **Not downloaded whole**; 408 member files for 204 participants were extracted (652 MB as gzip).
  Labels: `...s41591-021-01593-2/MediaObjects/41591_2021_1593_MOESM3_ESM.xlsx`, HTTP 200, 25,369 bytes.
- People in the full archive: 2,123 (1,027 Fitbit, 1,096 other devices). Sensors: heart rate and steps.
- Labeled events: 84 COVID-19 positives (50 retrospective, 34 prospective); 66 with symptom onset.
  The workbook also has the authors' alert days (`SourceData_Fig4A_Presymp`, `Fig4B_Asymp`).
- Licence: none stated for the data. The article is CC BY 4.0 and calls the link "publicly available".
- Verdict: (a) **strongest available**. (b) usable for heart-rate distributions across devices.
- To add more comparison participants, re-run the range extraction for further IDs; member names
  follow `COVID-19-Phase2-Wearables/<PID>/Orig_{Fitbit,NonFitbit}_{HR,ST}.csv`.

### 6.3 PMData (Simula)

- Download: `https://datasets.simula.no/downloads/pmdata.zip`, HTTP 200, 1,416,129,266 bytes; 911 files.
- People: 16. Duration: about 5 months (2019-11-01 to 2020-03-30). Sensors: Fitbit Versa 2.
- Labeled events: daily wellness (per person 72 to 147 reports), 783 training sessions with perceived
  exertion, 77 non-empty injury reports (the landing page counts 225 submitted). No illness field.
- Licence: "Creative Commons Attribution 4.0 International (CC BY 4.0)" under Terms of use on
  `https://datasets.simula.no/pmdata/`.
- Verdict: (a) good for sleep-loss, stress, fatigue and exertion drift, with only 16 people (use
  leave-one-person-out). (b) good for athletic adults' resting heart rate and sleep.

### 6.4 LifeSnaps (Zenodo 7229547)

- Download: `https://zenodo.org/api/records/7229547/files/rais_anonymized.zip/content`, HTTP 200,
  615,037,493 bytes (9.7 GB uncompressed, mostly one `.bson`).
- People: 71. Duration: up to about 4 months each. Sensors: Fitbit Sense.
- Labeled events: none dated. Phone mood prompts on 2,290 user-days and periodic surveys (STAI, PANAS).
- Licence: CC BY 4.0 (Zenodo record API licence field).
- Verdict: (a) weak (mood only; `TIRED` and `TENSE/ANXIOUS` are soft labels). (b) strong.

### 6.5 Welltory COVID-19 HRV (GitHub)

- Download: 13 files from `https://raw.githubusercontent.com/Welltory/hrv-covid19/7598150d18292a1b6e74e35bfaddd8d5fabc4b8b/<path>`,
  HTTP 200, 24 MB. Path: `data/raw/welltory_hrv_covid19/`.
- People: 185. Duration: 2019-12-31 to 2020-06-19. Sensors: phone-camera or chest-strap HRV spot
  measurements; daily summaries from connected wearables.
- Fields seen: `hrv_measurements.csv` (`bpm, meanrr, sdnn, rmssd, pnn50, lf, hf, ..., rr_data`);
  `wearables.csv` (`resting_pulse, average_spo2_value, body_temperature_avg, steps_count, ...`);
  `participants.csv` (`symptoms_onset` as `M/D/YYYY`); `surveys.csv` (COVID-19 symptom scales).
- Labeled events: 147 participants with a symptom-onset date.
- Limits: median 4 HRV measurements per person; only 49 of the 147 have 10 or more, 20 have 30 or
  more. **Only 21 of the 147 have any HRV measurement before their onset date, and 10 have seven or
  more** (732 measurements before onset, 2,084 after). SpO2 is present for 3 users, temperature for 1,
  resting pulse for 56. There is no healthy comparison group. Some onset dates are implausible (the
  range runs from 1967 to 2022) and need filtering.
- Licence: CC0 1.0 Universal (`LICENSE` file in the repository).
- Verdict: (a) weak: the only open set with HRV around dated illness, but almost all of it is recorded
  after onset, so it cannot support lead-time claims. (b) usable for short-recording HRV value ranges
  during and after illness.

### 6.6 Nurse stress (Zenodo 5514277, copy of Dryad 10.5061/dryad.5hqbzkh6f)

- Download: `https://zenodo.org/api/records/5514277/files/Stress_dataset.zip/content` (1,156,939,542
  bytes) and `.../SurveyResults.xlsx/content` (49,048 bytes), HTTP 200. Path: `data/raw/nurse_stress/`.
- People: 15 nurses. Duration: shifts between 2020-04-14 and 2020-12-13. Sensors: Empatica E4.
- Structure: `<nurse>/<nurse>_<unix start>.zip`, 609 session zips, each with `ACC, BVP, EDA, HR, IBI,
  TEMP, tags .csv`.
- Labeled events: `SurveyResults.xlsx`, 358 rows with `ID, Start time, End time, duration, date,
  Stress level` (0, 1, 2 or `na`) and 13 cause flags. 4 to 46 rows per nurse.
- Quirks: E4 files start with the session's Unix time (UTC) and the sample rate; survey times are
  clock times with a separate date and no stated zone, so alignment must be checked. Stress periods
  were confirmed by survey after an algorithm flagged them, so unlabelled time is not proven calm.
- Licence: CC0 (Zenodo record API licence field).
- Verdict: (a) good for real-world stress with held-out nurses. (b) limited (hospital shifts only).

### 6.7 PhysioNet open-access sets (all fetched anonymously, HTTP 200)

| Path under `data/raw/` | What | People | Labels | Licence (where read) | (a) / (b) |
|---|---|---|---|---|---|
| `physionet_wearable_stress_exercise/` (73 MB zip, full) | Empatica E4 during induced stress and structured exercise | 46 in `subject-info.csv` | 37 stress, 31 aerobic, 32 anaerobic sessions; stage tags; self-rated stress per stage | ODC-By 1.0 (`LICENSE.txt`) | good for acute stress and exertion / fair |
| `physionet_wearable_exam_stress/` (86 MB zip, full) | E4 during three real exams | 10 | 30 exam sessions with grades | ODC-By 1.0 (`LICENSE.txt`) | fair / fair |
| `physionet_qol_stress/` (2.2 MB zip, full) | Fitbit Charge 6 heart rate, ECG, EDA in relax and stress phases | 66 | phase label and STAI score per phase | CC BY 4.0 (`LICENSE.txt`) | fair, short sessions / fair |
| `physionet_noneeg/` (3.9 MB zip, full) | Wrist SpO2, heart rate, EDA, temperature, accelerometer | 20 | relax, physical, cognitive, emotional stress stages (`.atr`) | ODC-By 1.0 (PhysioNet API) | fair; only stress set with SpO2 / fair |
| `physionet_mmash/` (24 MB zip, full) | Beat-to-beat intervals, actigraphy, sleep, saliva hormones, questionnaires | 22 | activity diary; one stress score each | ODbL 1.0 (`LICENSE.txt`) | weak (24 h each) / good for 24 h RR and sleep |
| `physionet_sleep_dep_hemo_cog/` (89 MB zip, full) | fNIRS and CANTAB cognition before and after 24 h without sleep | 21 CANTAB rows | before / after | CC BY-NC-SA 4.0 (`LICENSE.txt`) | weak: not wearable / none |
| `physionet_resp_oximetry_apnoea/` (39 MB zip, full) | Neck pulse-oximeter photodiode waveforms during breath holds | 24 demographic rows | apnoea versus normal trials | CC BY 4.0 (`LICENSE.txt`) | weak: raw light signals, not SpO2 % / weak |
| `physionet_big_ideas_glycemic_sample/` (200 MB, **sample**: participant 001) | E4 plus Dexcom glucose; participant 001 spans 9 days | 16 (1 sampled) | food log | ODC-By 1.0 (`LICENSE.txt`) | weak / fair for multi-day E4 HR and skin temperature |
| `physionet_sleep_accel_sample/` (0.3 MB, **sample**: 1 subject) | Apple Watch heart rate and steps with PSG sleep stages | 31 (1 sampled) | 30 s sleep stages for one night | ODC-By 1.0 (`LICENSE.txt`) | weak / fair for sleep-stage heart rate |

Format notes:

- E4 files (`HR.csv`, `EDA.csv`, `TEMP.csv`, `BVP.csv`, `ACC.csv`): row 1 is the start time, row 2 the
  sample rate in Hz, then one value per row. HR is 1 Hz, EDA and TEMP 4 Hz, BVP 64 Hz, ACC 32 Hz.
  `IBI.csv` has seconds-since-start and interval length. In the exam and nurse sets row 1 is Unix time
  (UTC); in the stress-and-exercise set it is a date string that was altered for de-identification.
- The stress-and-exercise set ships `data_constraints.txt` listing bad recordings (duplicated signals
  for `S02`, sensor covered for `f07`); read it before use. Its bundled notebook was not opened.
- MMASH and the exam set contain a nested zip (`MMASH.zip`, `Data.zip`).
- `noneeg` is in WFDB binary format; reading it needs the `wfdb` package.
- `sleep-accel` times are seconds relative to PSG start (negative before); heart rate lines are
  `seconds,bpm`; labels are `seconds stage`.

PhysioNet sets that are **NOT OPEN**: CovIdentify (credentialed; `get-zip` returned HTTP 403), GLOBEM
(credentialed), mcPHASES, DREAMT, BigIdeasLab_STEP and OpenOximetry (restricted, need a signed
agreement). Access policies were read from `https://physionet.org/api/v1/project/published/`.

### 6.8 WESAD, wrist subset

- Source: `https://uni-siegen.sciebo.de/s/HGdUkoNlW1Ub0Gx/download`, 2,249,444,501 bytes, HTTP 206 on
  range requests. **Not downloaded whole.** The 45 small members were extracted: per subject
  `SX_E4_Data.zip`, `SX_quest.csv`, `SX_readme.txt` (23 MB). Path: `data/raw/wesad_wrist_subset/`.
- People: 15. Duration: about 100 minutes of protocol each. Sensors kept: Empatica E4 wrist. Not kept: chest RespiBAN
  text files and the synchronised `.pkl` files (pickles are not safe to open from an untrusted source).
- Labels: `SX_quest.csv` gives condition order with start and end in `minutes.seconds` (`Base`, `TSST`
  = stress, `Medi 1`, `Fun` = amusement, `Medi 2`) plus PANAS, STAI and SAM answers; semicolon-separated.
- Licence: not an open licence. The dataset page says: "You may use this data for scientific,
  non-commercial purposes, provided that you give credit to the owners".
- Verdict: (a) fair for acute stress with leave-one-subject-out; non-commercial only. (b) weak.

### 6.9 RKI Corona-Datenspende vital data (Zenodo 8229284)

- Download: `https://zenodo.org/api/records/8229284/files/Corona-Datenspende_Teildatensatz_Vitaldaten.tsv/content`,
  HTTP 200, 24,897,539 bytes. Path: `data/raw/rki_corona_datenspende/`.
- Fields seen: `date, nuts_level, nuts_code, heartrate_mean, heartrate_standard_error, steps_mean,
  steps_standard_error, sleep_duration_mean, sleep_duration_standard_error`.
- 451,896 rows, 456 German regions, daily from 2020-04-15 to 2022-12-31. **Regional means only, no
  individuals.** Sleep duration appears to be in minutes (first national value 435.8).
- Licence: CC BY 4.0 (Zenodo record API). Documentation is a PDF, not read.
- Verdict: (a) none. (b) useful for seasonal and weekly structure of population resting heart rate.

### 6.10 Other candidates that are not open or could not be fetched

| Candidate | URL tried | Result | Status |
|---|---|---|---|
| Duke / DARPA viral-challenge E4 data (Grzesiak 2021) | DataCite and Zenodo search | No dataset record or download found | NOT FOUND |
| College students in the 2020 lockdown, Oura + Samsung watch (Dryad 10.7280/D1WH6T) | `https://datadryad.org/api/v2/files/2819162/download` | HTTP 401 "must have current bearer token"; web stream URL 403; archive is 8.6 GB | CC0 but NOT downloadable anonymously |
| Wearable fever / COVID detection (UC San Diego, 10.6075/J0KD1XSQ) | `https://library.ucsd.edu/dc/object/bb91891486` | Bot-check page; not bypassed | NOT VERIFIED |
| Home Testing of Respiratory Illness (Synapse syn22803188) | Synapse REST metadata, HTTP 200 | Files need an account and conditions of use | NOT OPEN |
| Shift-work or sleep-deprivation Fitbit sets | DataCite title search | Only a Newcastle actigraphy record surfaced; not fetched | NOT FOUND |

## 7. What is not available

- Continuous or daily wearable data from astronauts in flight: heart rate, HRV, SpO2, actigraphy,
  sleep. Not in OSDR; in LSDA only by data request.
- Inspiration4 Apple Watch, cognition and in-flight physiological data.
- Subject-level physiology from Mars-500, SIRIUS, HERA, HI-SEAS and Antarctic stations.
- ESA bed-rest (AGBRESA and others) measurements.
- Any open dataset combining daily RHR, HRV and SpO2 with dated illness onset.
- Any open wearable dataset with experimentally imposed multi-day sleep restriction.
- Open, anonymously downloadable versions of CovIdentify, GLOBEM, DREAMT, mcPHASES and the Synapse
  flu-monitoring studies.

Consequence for the project: illness lead time can be measured on real heart-rate and step data only.
Claims about HRV-, SpO2- or sleep-driven detection, and about performance in microgravity, rest on the
simulator, whose realism can be checked against bed-rest daily vitals and ground Fitbit distributions
but not against flight data.
