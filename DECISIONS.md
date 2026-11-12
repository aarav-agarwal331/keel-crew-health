# Decision log

Reversible decisions made without asking, newest last.

| # | Date | Decision | Why | How to reverse |
|---|------|----------|-----|----------------|
| 1 | 2026-11-12 | Product name **Keel**. | A keel keeps a ship steady with nobody steering from shore: the personal-baseline idea in one word. Short, pronounceable, and a web search found no NASA product, mission or program with that name. | Rename in `app/index.html`, `app/public/manifest.webmanifest`, README. |
| 2 | 2026-11-12 | Challenge text taken from the server payload embedded in the official page because the page renders client-side and the first fetch failed on a certificate error. | Wording is identical to what the browser shows. | Re-copy from the live page. |
| 3 | 2026-11-12 | No raw PDF is read anywhere in this project (repo rule in `CLAUDE.md`). All citations are to HTML pages that were opened. | The rule is explicit. Cost: some NASA documents that exist only as PDF (for example evidence reports) are cited through their HTML landing or abstract pages, or not at all. | Convert PDFs to text by hand and extend `docs/DOMAIN.md`. |
| 4 | 2026-11-12 | Hand-written service worker with a build-time precache list instead of `vite-plugin-pwa`. | Zero dependency risk on a brand-new Vite major version; about 60 lines; the offline test proves it. | Swap in the plugin. |
| 5 | 2026-11-12 | Detection maths implemented twice (Python for research, TypeScript for the device) with a parity test, rather than exporting to ONNX or WebAssembly. | The detectors are rolling robust statistics, CUSUM and a Mahalanobis distance: a few hundred lines. A parity test on shared vectors is simpler and more auditable than a runtime. | Export via ONNX if a learned model is added. |
| 6 | 2026-11-12 | Charts are drawn by the app from results JSON (inline SVG), not shipped as images from Python. | One visual system, works offline, colorblind-safe palette in one place, every figure can link to its method and script. | Add matplotlib outputs. |
| 7 | 2026-11-12 | Daily resolution is the unit of detection. Intraday data (minute heart rate, strap RR intervals) is reduced to daily features first. | The labeled events in open datasets are dated to the day; the health changes of interest develop over days; a daily cadence keeps the false-alarm budget interpretable (alerts per person-month). | Add intraday detectors later. |
| 8 | 2026-11-12 | Readiness tier (three levels, no reasons) is always visible to the commander; everything behind it is opt-in by the crew member. | A commander must be able to assign a spacewalk safely; the crew member keeps control of the why. The app shows the crew member exactly what each role sees. | Change the floor in `shared/sharing.json`. |
