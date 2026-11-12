# Keel — build plan

Keel is a crew health monitor that keeps working when Earth cannot answer. Plan written 2026-11-12,
before any product code.

## Milestones (each ends in passing tests and a commit)

| # | Milestone | Done means | Budget (h) |
|---|-----------|------------|-----------:|
| 0 | Ground: challenge, domain, data survey, plan | `docs/CHALLENGE.md`, `REQUIREMENTS.md`, `DOMAIN.md`, `DATA.md`, this file | 2.0 |
| 1 | Thin slice | Simulator emits one indicator; personal baseline band; Today screen shows it; unit tests | 3.0 |
| 2 | Real data in | Open datasets downloaded by `make data`, parsed to one tidy daily schema, explored | 3.0 |
| 3 | Full science core | All indicators, phase-aware baselines, 3 detectors + fixed-threshold baseline, Python/TypeScript parity test | 4.5 |
| 4 | Evaluation | Real-data detection, lead time, false alarms per person-month with intervals on held-out people; simulated-mission sweeps; ablations; simulator realism | 4.5 |
| 5 | Alert to action | Auditable rule table, cited countermeasures, escalation tiers, action log | 2.5 |
| 6 | Crew and link | Sharing controls with access log, readiness view, link delay/blackout with queued summary | 3.0 |
| 7 | Demo surface | Mission replay, Web Bluetooth strap, CSV/wearable import, body map, design pass | 3.5 |
| 8 | Ship | Offline end-to-end test, deploy, screenshots, submission package | 2.5 |
| R | Review rounds | Four blind reviewer personas; fix every high and medium issue | 1.5 |
|   | **Total** | | **30.0** |

## Architecture in one paragraph

Python (`research/`) owns the simulator, model fitting and every evaluation; it writes static JSON to
`app/public/` (missions, model thresholds, validation results). The app (`app/`, Vite + React +
TypeScript) is an installable offline-first web app: IndexedDB for crew data, a web worker running the
same baseline and detection maths in TypeScript, a hand-written service worker that precaches every
asset. `shared/` holds the single source of truth both sides read: indicator definitions, the
alert-to-action rule table and the fitted model. A parity test feeds Python-generated vectors through
the TypeScript detector so the numbers in the validation tables describe the code that actually runs
on the device.

## Risks and mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| No open astronaut wearable time series | High | Say so plainly. Evaluate on ground wearables with labeled events; use spaceflight literature values and any open spaceflight tables only for simulator realism. |
| Labeled illness dataset is small or its event dates are noisy | High | Held-out people, bootstrap intervals over people, report the simple baseline next to ours, no tuning on test folds. |
| Too-good numbers from leakage (thresholds tuned on test people, baseline windows overlapping events) | Medium | Thresholds fit only on training folds; baseline uses a trailing window with a gap; leakage checklist in `docs/METHOD.md`. |
| Python and TypeScript detectors drift apart | Medium | Shared JSON config plus parity vectors checked in CI (`make test`). |
| Web Bluetooth unavailable (Safari, iPad) | High | It is the first item in the cut order; the app states browser support and falls back to manual entry and simulated stream. |
| Deploy needs credentials | Medium | Build is a static folder; one command documented if authentication fails. |
| Scope: nine screens in 30 hours | High | Thin slice first, shared chart and card components, cut order below. |

## Cut order (first cut first)

1. Live heart-rate strap adapter
2. Crew readiness view
3. Optional on-device language model (not planned unless everything else is done)

Never cut: real-data evaluation, offline operation, mission replay.

## Reproducibility contract

`make all` on a clean clone runs `data → sim → model → validate → test → build`. Random seeds are
fixed and recorded in each results file together with the script path and the git commit.

## Outcome (2026-11-12)

All milestones M0 to M8 and four review rounds were completed in one working session. Nothing on the
cut list had to be cut except the optional language model, which was never started. What changed
against this plan:

- The planned CUSUM-plus-multivariate fusion was not deployed; a selection rule written during review (and
  applied to training missions only) chose the multivariate detector, and the four personal detectors turned out to be
  hard to tell apart (DECISIONS.md 13 and 21).
- The simulator was re-fitted to real data three times as the evaluation exposed optimistic
  assumptions: noise levels, the illness response, and the correlation between indicators
  (DECISIONS.md 12, 14 and 23).
- Review round 1 added a class of fixed safety rules that the plan did not have (DECISIONS.md 22).

Open items for a person are in FINAL_REPORT.md section 5.
