import { useEffect, useState, type ReactNode } from 'react'
import { BarCI, Figure, XYChart, type BarRow } from '../ui/charts'
import { Card, href, Simulated } from '../ui/kit'

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = any

function useResults() {
  const [d, setD] = useState<Record<string, J> | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    const names = ['real_eval', 'sim_eval', 'realism', 'calibration', 'bedrest']
    Promise.all(names.map((n) => fetch(`${import.meta.env.BASE_URL}results/${n}.json`).then((r) => { if (!r.ok) throw new Error(n); return r.json() })))
      .then((v) => setD(Object.fromEntries(names.map((n, i) => [n, v[i]]))))
      .catch((e) => setErr(String(e)))
  }, [])
  return { d, err }
}

const pct = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? '–' : `${Math.round(v * 100)}%`)
const pts = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? '–' : `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))}`)
const ci = (v: number[] | undefined) => (v ? `${Math.round(v[0] * 100)} to ${Math.round(v[1] * 100)}` : '')
const bk = (b: number) => (Number.isInteger(b) ? b.toFixed(1) : String(b)) // result files key budgets as '1.0', '0.25'
const f2 = (v: number | null | undefined, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? '–' : v.toFixed(d))
const SHORT: Record<string, string> = { fixed: 'One threshold for all', zscore: 'Personal, 2-of-3-days rule', cusum: 'Personal + CUSUM', mewma: 'Personal + multivariate', fusion: 'Personal, fused' }
const LONG: Record<string, string> = { fixed: 'Fixed threshold, the same for everyone', zscore: 'Personal baseline with a simple 2-of-3-days rule', cusum: 'Personal baseline + CUSUM change detection', mewma: 'Personal baseline + multivariate EWMA', fusion: 'Personal baseline, CUSUM and multivariate fused' }

function Stat({ big, label, sub }: { big: string; label: string; sub?: ReactNode }) {
  return <div className="col" style={{ gap: 2 }}><span className="num" style={{ fontSize: '2rem', fontWeight: 750, lineHeight: 1.1 }}>{big}</span><strong>{label}</strong>{sub && <span className="small muted">{sub}</span>}</div>
}

function MethodTable({ main, methods, deployed, budget }: { main: J; methods: string[]; deployed: string; budget: string }) {
  return (
    <table>
      <thead><tr><th>Method</th><th className="n">Detected</th><th className="n">By luck</th><th className="n">Above luck (95% interval)</th><th className="n">Above luck, versus fixed threshold</th><th className="n">False alerts per person-month</th></tr></thead>
      <tbody>{methods.map((m) => { const s = main[m][budget]; return (
        <tr key={m}><td>{m === deployed ? <strong>{LONG[m]} (Keel)</strong> : LONG[m]}</td><td className="n">{pct(s.detection_rate)}</td><td className="n">{pct(s.chance_detection_rate)}</td><td className="n">{pts(s.net_detection)} ({ci(s.net_detection_ci)})</td><td className="n">{s.net_diff === undefined ? '–' : `${pts(s.net_diff)} (${ci(s.net_diff_ci)})`}</td><td className="n">{f2(s.fa_per_person_month)}{s.fa_per_person_month_ci ? ` (${f2(s.fa_per_person_month_ci[0])} to ${f2(s.fa_per_person_month_ci[1])})` : ''}</td></tr>
      ) })}</tbody>
    </table>
  )
}

function netBars(main: J, methods: string[], deployed: string, budget: string): BarRow[] {
  return methods.map((m) => ({ label: m === deployed ? `Keel: ${SHORT[m].toLowerCase()}` : SHORT[m], value: main[m][budget].net_detection, lo: main[m][budget].net_detection_ci[0], hi: main[m][budget].net_detection_ci[1], highlight: m === deployed, note: `detected ${pct(main[m][budget].detection_rate)}, by luck ${pct(main[m][budget].chance_detection_rate)}` }))
}

function curves(main: J, budgets: number[], deployed: string) {
  const s = (m: string, label: string, key = 'detection_rate') => ({ label, x: budgets.map((b) => main[m][bk(b)].fa_per_person_month), y: budgets.map((b) => main[m][bk(b)][key]) })
  return [s(deployed, 'Keel'), { ...s(deployed, 'Keel, by luck', 'chance_detection_rate'), dashed: true }, s('fixed', 'Fixed threshold'), { ...s('fixed', 'Fixed, by luck', 'chance_detection_rate'), dashed: true }]
}

function Section({ title, id, children, open = false }: { title: ReactNode; id: string; children: ReactNode; open?: boolean }) {
  return <details className="card" id={id} open={open}><summary><h2 style={{ display: 'inline' }}>{title}</h2></summary><div className="col" style={{ gap: 14, marginTop: 10 }}>{children}</div></details>
}

export function Validation() {
  const { d, err } = useResults()
  if (err) return <Card title="Validation results are not available"><p className="muted">The results files could not be loaded ({err}). Run <code>make validate</code> and rebuild.</p></Card>
  if (!d) return <p role="status">Loading results…</p>
  const R = d.real_eval, S = d.sim_eval, Z = d.realism, B = d.bedrest, C = d.calibration
  const dep: string = R.deployed
  const r1 = R.main[dep]['1.0'], r25 = R.main[dep]['0.25'], fx1 = R.main.fixed['1.0']
  const s1 = S.main[S.deployed]['1.0']
  const leads: (number | null)[] = R.leads['1.0']
  const leadDays = Array.from({ length: 15 }, (_, i) => 10 - i)
  const leadCounts = leadDays.map((k) => leads.filter((l) => l === k).length)
  const missed = leads.filter((l) => l === null).length
  const fq = R.false_alerts_quiet
  const tr = (k: string) => B.transitions[k]
  const A = R.ablation
  const lr = A.like_for_like_real, lsim = S.like_for_like
  const seeds = Object.values(R.fold_seeds).map((v: any) => v['1.0'].net_detection as number)
  const one = (x: number) => `about 1 in ${Math.max(2, Math.round(1 / x))}`
  const co = R.cohort

  return (
    <>
      <h1>Does it work?</h1>
      <p className="muted">Every number here was produced by a script in the repository. Real data is used wherever it exists; everything else is simulated and labelled. Intervals are 95% bootstrap intervals over people. Nothing was tuned on the people it was tested on.</p>

      <section className="card" data-testid="validation-headline">
        <h2>The short version</h2>
        <div className="grid3">
          <Stat big={`${pts(r1.net_detection)} points`} label="above luck, on real illness" sub={<>Keel flagged {pct(r1.detection_rate)} of {r1.n_events} real illness episodes at one false alert per person-month. Luck alone gives {pct(r1.chance_detection_rate)}. Interval for the gap: {ci(r1.net_detection_ci)} points.</>} />
          <Stat big={`${pts(fx1.net_detection)} points`} label="for one threshold for everyone" sub={<>A fixed threshold flagged {pct(fx1.detection_rate)}, with {pct(fx1.chance_detection_rate)} by luck. Keel's advantage: {pts(r1.net_diff)} points (interval {ci(r1.net_diff_ci)}).</>} />
          <Stat big={f2(r1.fa_per_person_month)} label="false alerts per person-month" sub={<>Measured on held-out people against a budget of 1.00. At the stricter alert tier: {f2(r25.fa_per_person_month)} against 0.25, and {pts(r25.net_detection)} points above luck.</>} />
        </div>
        <div className="banner strong">
          <strong>What these results do not show.</strong> Keel does not give early warning: on real data the alert mostly starts on or after the day symptoms begin ({pct(r1.by_onset_rate)} of episodes had an alert start in the ten days up to onset; luck gives {pct(r1.chance_by_onset_rate)}). Most alerts are false: at the in-flight rate of respiratory illness, {one(R.ppv['0.25'].share_of_alerts_that_are_real)} alert-tier alerts would be a real illness. The data is from people on Earth with consumer watches. Everything except illness is tested in simulation only.
        </div>
        <p className="small muted">Jump to: <a href="#real" onClick={(e) => { e.preventDefault(); document.getElementById('real')?.setAttribute('open', ''); document.getElementById('real')?.scrollIntoView() }}>real data</a> · <a href="#sim" onClick={(e) => { e.preventDefault(); document.getElementById('sim')?.setAttribute('open', ''); document.getElementById('sim')?.scrollIntoView() }}>simulated missions</a> · <a href="#realism" onClick={(e) => { e.preventDefault(); document.getElementById('realism')?.setAttribute('open', ''); document.getElementById('realism')?.scrollIntoView() }}>simulator realism</a> · <a href="#bedrest" onClick={(e) => { e.preventDefault(); document.getElementById('bedrest')?.setAttribute('open', ''); document.getElementById('bedrest')?.scrollIntoView() }}>NASA bed-rest data</a> · <a href={href('method', 'limits')}>limitations</a></p>
      </section>

      <div className="grid2">
        <Figure title="Detection above luck, real data" method="evaluation" script={R.script}
          caption={<>Share of illness episodes flagged, minus the share an alert would hit by luck, at one false alert per person-month. Bars show 95% intervals. The four personal-baseline methods cannot be told apart; all sit above the fixed threshold.</>}
          table={<MethodTable main={R.main} methods={R.methods} deployed={dep} budget="1.0" />}>
          <BarCI rows={netBars(R.main, R.methods, dep, '1.0')} max={0.6} pct ariaLabel="Detection above chance by method on real data" />
        </Figure>
        <Figure title="Detection against false alerts, real data" method="evaluation" script={R.script}
          caption={<>Each point is a false-alert budget ({R.budgets.join(', ')} per person-month), placed at the rate actually measured on held-out people. Dashed lines show how often an alert falls in the window by luck. The gap between a solid line and its dashed line is the real signal. At loose budgets alerts are open so often that fewer new ones start inside the window, so the curves flatten.</>}
          table={<MethodTable main={R.main} methods={R.methods} deployed={dep} budget="0.25" />}>
          <XYChart series={curves(R.main, R.budgets, dep)} xLabel="False alerts per person-month (measured)" yLabel="Episodes flagged" yPct yMin={0} yMax={1} ariaLabel="Detection rate against false alert rate on real data" />
        </Figure>
      </div>

      <Section id="real" title="1. Real wearable data with dated illness" open>
        <p className="small muted">{R.data}. Indicators available: {R.indicators.toLowerCase()}. No HRV, oxygen or temperature exists in this data.</p>
        <div className="tablewrap"><table>
          <thead><tr><th>Who is in the test</th><th className="n">People</th></tr></thead>
          <tbody>
            <tr><td>Downloaded (all 120 of phase 1; all 84 positives and 120 others of phase 2)</td><td className="n">{co.n_downloaded}</td></tr>
            <tr><td>Left out: fewer than 28 nights with a usable resting heart rate</td><td className="n">−{co.excluded_under_28_nights}</td></tr>
            <tr><td><strong>Analysed</strong> ({Object.entries(co.by_device).map(([k, v]) => `${v} ${k}`).join(', ')})</td><td className="n"><strong>{co.n_people}</strong></td></tr>
            <tr><td>… with a dated illness episode inside their recording ({co.n_events} episodes: {co.by_kind.covid_symptom} COVID-19 with a symptom date, {co.by_kind.covid_test_only} with a test date only, {co.by_kind.other_illness} other illness)</td><td className="n">{co.n_with_event}</td></tr>
            {Object.entries(co.quiet_people).map(([k, v]) => <tr key={k}><td>… without one: {k}</td><td className="n">{v as number}</td></tr>)}
          </tbody>
        </table></div>
        <p className="small muted">{co.person_days.toLocaleString()} person-days; {Math.round(co.quiet_person_months_scored)} person-months of scored quiet time. {co.sampling_note} Every episode counts for every method: an episode Keel could not score (no baseline yet) is a miss.</p>

        <div className="grid2">
          <Figure title="When the alert came, relative to symptom onset" method="evaluation" script={R.script}
            caption={<>Keel at one false alert per person-month. Left of the line, the alert started before symptoms; right of it, after. {missed} of {leads.length} episodes had no alert in the window. The cluster just after onset is the real response; alerts a week before onset are mostly coincidence.</>}>
            <XYChart series={[{ label: 'Episodes', x: leadDays.map((k) => -k), y: leadCounts }]} xLabel="Days from symptom onset to alert start (negative = alert first)" yLabel="Episodes" ariaLabel="Histogram of alert timing relative to symptom onset" xDecimals={0} yDecimals={0} yMin={0} step vline={{ x: 0, label: 'Onset' }} />
          </Figure>
          <Figure title="What real illness looks like in resting heart rate" method="simulator" script={R.script}
            caption={<>Mean change from each person's own earlier level, {R.event_aligned_rhr.n_events} dated episodes, with a 95% band. The rise is small before symptoms and peaks a day or two after onset. Night-to-night variation is about 3.5 bpm, so a single person's rise is hard to see.</>}>
            <XYChart series={[{ label: 'Mean change', x: R.event_aligned_rhr.rel_day, y: R.event_aligned_rhr.mean, lo: R.event_aligned_rhr.lo, hi: R.event_aligned_rhr.hi }]} xLabel="Days from symptom onset" yLabel="Resting heart rate change, bpm" ariaLabel="Event-aligned resting heart rate around illness onset" xDecimals={0} yDecimals={1} vline={{ x: 0, label: 'Onset' }} />
          </Figure>
        </div>

        <Card title="What an alert is worth">
          <p className="small">ISS crews report about one episode of upper-respiratory symptoms per person-year. At that rate, and with the detection above luck measured here, {one(R.ppv['0.25'].share_of_alerts_that_are_real)} alert-tier alerts and {one(R.ppv['1.0'].share_of_alerts_that_are_real)} notices would coincide with such an illness. The other conditions Keel watches for would raise those shares, by an amount we cannot measure on real data. This is why a notice asks for a look, not for the medical officer.</p>
          <p className="figcap">{R.ppv.assumption} <a href={href('method', 'evaluation')}>How this was measured</a> · <code>{R.script}</code></p>
        </Card>

        <Card title="False alerts over long quiet periods">
          <p className="small">People with no dated illness in their recording ({fq['1.0'].n_people} people, {Math.round(fq['1.0'].quiet_person_months)} scored person-months; many were never confirmed healthy, so some alerts may be real). Notice tier: {f2(fq['1.0'].fa_per_person_month)} false alerts per person-month (interval {f2(fq['1.0'].fa_per_person_month_ci[0])} to {f2(fq['1.0'].fa_per_person_month_ci[1])}), with an alert open on {pct(fq['1.0'].quiet_days_in_alert_frac)} of quiet days. Alert tier: {f2(fq['0.25'].fa_per_person_month)} per person-month, open on {pct(fq['0.25'].quiet_days_in_alert_frac)} of days; {pct(fq['0.25'].share_of_people_with_zero)} of people never saw one. The noisiest fifth of people produced {pct(fq['0.25'].share_of_alerts_from_top_fifth)} of alert-tier false alerts, which is what pure chance would give ({pct(fq['0.25'].top_fifth_if_constant_rate)}): we found no evidence that some people are systematically noisier.</p>
          <BarCI rows={fq['1.0'].hist_edges.map((e: string, i: number) => ({ label: `${e} per month`, value: fq['1.0'].per_person_rate_hist[i] }))} decimals={0} unit="people" ariaLabel="People by their personal false alert rate at the notice tier" />
          <p className="figcap">People with at least 30 scored quiet days ({fq['1.0'].n_people_30_days}), by their own false-alert rate at the notice tier. <a href={href('method', 'evaluation')}>How this was measured</a> · <code>{R.script}</code></p>
        </Card>

        <Card title="Which indicators and components earn their place (real data)">
          <div className="tablewrap"><table>
            <thead><tr><th>Variant</th><th className="n">Flagged</th><th className="n">By luck</th><th className="n">Above luck (interval)</th></tr></thead>
            <tbody>
              {['rhr', 'rhr_steps', 'rhr_act7', 'rhr_rhrday_steps', 'rhr_steps_adjusted'].filter((k) => A[k]).map((k) => { const v = A[k][dep]['1.0']; return <tr key={k}><td>{A[k].label}</td><td className="n">{pct(v.detection_rate)}</td><td className="n">{pct(v.chance_detection_rate)}</td><td className="n">{pts(v.net_detection)} ({ci(v.net_detection_ci)})</td></tr> })}
              {A.sleep_subset && <tr><td>Adding sleep duration, in the {A.sleep_subset.n_people} people who have it: without → with</td><td className="n">{pct(A.sleep_subset.without_sleep.detection_rate)} → {pct(A.sleep_subset.with_sleep.detection_rate)}</td><td className="n">–</td><td className="n">–</td></tr>}
            </tbody>
          </table></div>
          <ul className="list small">
            <li><strong>Steps add most of the signal, and that is a caution.</strong> Heart rate alone is {pts(A.rhr[dep]['1.0'].net_detection)} points above luck; with steps, {pts(A.rhr_steps[dep]['1.0'].net_detection)}. People's steps halve once they feel ill and stay home. A crew on a fixed exercise schedule may not show that.</li>
            <li><strong>Adjusting heart rate for the previous day's activity does not help</strong> ({pts(A.rhr_steps_adjusted[dep]['1.0'].net_detection)} against {pts(A.rhr_steps[dep]['1.0'].net_detection)}), so the app leaves it off.</li>
            <li><strong>Sleep is undecided.</strong> Too few people have sleep data.</li>
            <li><strong>Device matters.</strong> Fitbit: {pct(R.breakdown['1.0'].device_Fitbit.detection_rate)} flagged ({pts(R.breakdown['1.0'].device_Fitbit.net_detection)} above luck, {R.breakdown['1.0'].device_Fitbit.n_events} episodes). Other devices, mostly Apple Watch: {pct(R.breakdown['1.0'].device_other.detection_rate)} ({pts(R.breakdown['1.0'].device_other.net_detection)}, {R.breakdown['1.0'].device_other.n_events} episodes); their overnight heart-rate samples are sparse in this release.</li>
            <li><strong>It holds across cohorts.</strong> Trained on phase 1 and tested on phase 2: {pct(R.cross_phase.train_phase1_test_phase2['1.0'].detection_rate)} flagged, {pts(R.cross_phase.train_phase1_test_phase2['1.0'].net_detection)} above luck, {f2(R.cross_phase.train_phase1_test_phase2['1.0'].fa_per_person_month)} false alerts per person-month. The reverse: {pct(R.cross_phase.train_phase2_test_phase1['1.0'].detection_rate)}, {pts(R.cross_phase.train_phase2_test_phase1['1.0'].net_detection)}, {f2(R.cross_phase.train_phase2_test_phase1['1.0'].fa_per_person_month)}. Five different fold splits gave {pts(Math.min(...seeds))} to {pts(Math.max(...seeds))} above luck.</li>
            <li><strong>Retrospective and prospective phase 2 cases</strong> (the prospective ones were enrolled under the original study's own alerting): {pts(R.breakdown['1.0'].phase2_retrospective.net_detection)} and {pts(R.breakdown['1.0'].phase2_prospective.net_detection)} above luck.</li>
            <li><strong>The window.</strong> {Object.entries(R.window_sensitivity).map(([k, v]: [string, any]) => `${k} days: ${pct(v.detection_rate)} flagged, ${pct(v.chance)} by luck`).join('; ')}. The −10 to +4 window was fixed before the first run on real data; it also turned out to have the largest gap.</li>
            <li><strong>Published comparison.</strong> The dataset's authors reported {pct(R.published.presymptomatic_detection)} of 32 cases detectable before symptoms with about {R.published.false_alarms_per_month_healthy} alarms per month, using hourly data and their own algorithm on phase 1. We did not reproduce early detection with daily features.</li>
          </ul>
        </Card>
      </Section>

      <Section id="sim" title={<>2. Simulated missions <Simulated /></>}>
        <p className="small muted">{S.design.test_missions} test missions of {S.design.crew} crew and {S.design.flight_days} days, {S.design.n_test_events} person-events of six kinds; model and thresholds fitted on {S.design.train_missions} separate training missions. The simulator's day-to-day noise, its correlations between indicators and its illness response are fitted to real data (section 3). All other effect sizes are assumptions, so these numbers show how the method behaves, not how well it would work in flight.</p>
        <div className="grid2">
          <Figure title="Detection above luck, simulated missions" method="evaluation" script={S.script} caption={<>Full indicator set, one false alert per person-month. Keel flagged {pct(s1.detection_rate)} against {pct(s1.chance_detection_rate)} by luck. Intervals are over missions, because crewmates share a cabin. The detector Keel runs was chosen on the training missions; on these test missions the simple rule did slightly better.</>} table={<MethodTable main={S.main} methods={S.methods} deployed={S.deployed} budget="1.0" />}>
            <BarCI rows={netBars(S.main, S.methods, S.deployed, '1.0')} max={0.6} pct ariaLabel="Detection above chance by method on simulated missions" />
          </Figure>
          <Figure title="Detection against false alerts, simulated missions" method="evaluation" script={S.script} caption="Same reading as the real-data chart. Thresholds trained on other missions stay close to their budget on test missions." table={<MethodTable main={S.main} methods={S.methods} deployed={S.deployed} budget="0.25" />}>
            <XYChart series={curves(S.main, S.budgets, S.deployed)} xLabel="False alerts per person-month (measured)" yLabel="Events flagged" yPct yMin={0} yMax={1} ariaLabel="Detection rate against false alert rate on simulated missions" />
          </Figure>
        </div>
        <Card title="By event type and size">
          <div className="tablewrap"><table>
            <thead><tr><th>Event</th>{S.dose.illness.sizes.map((z: number) => <th key={z} className="n">size {z}×</th>)}<th className="n">Alert before the event began</th><th className="n">Typical delay after it began</th></tr></thead>
            <tbody>{Object.entries(S.dose).map(([k, v]: [string, any]) => <tr key={k}><td>{v.label}</td>{v['1.0'].map((x: number, i: number) => <td key={i} className="n">{pct(x)}</td>)}<td className="n">{pct(S.by_type['1.0'][k].share_alert_before_onset)}</td><td className="n">{S.by_type['1.0'][k].median_delay_days === null ? '–' : `${f2(S.by_type['1.0'][k].median_delay_days, 0)} d`}</td></tr>)}</tbody>
          </table></div>
          <p className="figcap">Share flagged at the notice tier by event size ({S.dose.illness.n[0]} events per cell, so each figure is good to about ±10 points; 1× is the average size, and for illness that is the average real heart-rate response). "Alert before the event began" is mostly luck and is the simulated counterpart of the real-data finding that there is no early warning. A slow cabin CO2 rise is the hardest for the personal detector, which is why Keel also watches the cabin sensor directly. <a href={href('method', 'simulator')}>How events are simulated</a> · <code>{S.script}</code></p>
        </Card>
        <div className="grid2">
          <Figure title="Missing data" method="evaluation" script={S.script} caption="Detection when the wearable is not worn or check-ins are skipped. Thresholds are not re-tuned, so false alerts fall along with detection; the table shows both."
            table={<table><thead><tr><th>Condition</th><th className="n">Flagged</th><th className="n">False alerts / person-month</th></tr></thead><tbody>{S.missing.map((m: J) => <tr key={m.label}><td>{m.label}</td><td className="n">{pct(m['1.0'].detection_rate)}</td><td className="n">{f2(m['1.0'].fa_per_person_month)}</td></tr>)}</tbody></table>}>
            <BarCI rows={S.missing.map((m: J, i: number) => ({ label: m.label, value: m['1.0'].detection_rate, lo: m['1.0'].detection_rate_ci[0], hi: m['1.0'].detection_rate_ci[1], highlight: i === 0, note: `${f2(m['1.0'].fa_per_person_month)} false alerts per person-month` }))} max={1} pct ariaLabel="Detection rate under missing data" />
          </Figure>
          <Figure title="Losing a sensor" method="evaluation" script={S.script} caption="Detection with one input removed for the whole mission. Fewer inputs also mean fewer false alerts (see the table), so part of each drop is the detector simply saying less."
            table={<table><thead><tr><th>Condition</th><th className="n">Flagged</th><th className="n">False alerts / person-month</th></tr></thead><tbody>{S.dropout.map((m: J) => <tr key={m.label}><td>{m.label}</td><td className="n">{pct(m['1.0'].detection_rate)}</td><td className="n">{f2(m['1.0'].fa_per_person_month)}</td></tr>)}</tbody></table>}>
            <BarCI rows={S.dropout.map((m: J, i: number) => ({ label: m.label, value: m['1.0'].detection_rate, lo: m['1.0'].detection_rate_ci[0], hi: m['1.0'].detection_rate_ci[1], highlight: i === 0, note: `${f2(m['1.0'].fa_per_person_month)} false alerts per person-month` }))} max={1} pct ariaLabel="Detection rate with one sensor removed" />
          </Figure>
        </div>
        <Card title="Which design choices earn their place (simulated)">
          <div className="tablewrap"><table>
            <thead><tr><th>Variant</th><th className="n">Flagged</th><th className="n">Interval</th><th className="n">False alerts / person-month</th><th className="n">… in the first 30 flight days</th></tr></thead>
            <tbody>{S.ablation.map((a: J, i: number) => <tr key={a.label}><td>{i === 0 ? <strong>{a.label}</strong> : a.label}</td><td className="n">{pct(a['1.0'].detection_rate)}</td><td className="n">{ci(a['1.0'].detection_rate_ci)}%</td><td className="n">{f2(a['1.0'].fa_per_person_month)}</td><td className="n">{f2(a.first_30_flight_days_fa_per_person_month)}</td></tr>)}</tbody>
          </table></div>
          <ul className="list small">
            <li><strong>Mission-phase handling halves false alerts after launch,</strong> from {f2(S.ablation[1].first_30_flight_days_fa_per_person_month)} to {f2(S.ablation[0].first_30_flight_days_fa_per_person_month)} per person-month in the first 30 flight days. It does not depend on knowing the expected shift: told to expect no shift at all it still gives {f2(S.ablation[2].first_30_flight_days_fa_per_person_month)}. The benefit comes from restarting the baseline and widening the band.</li>
            <li><strong>It has a cost.</strong> Events that begin in the first 25 flight days are flagged {pts(S.early_events['phase-aware'].net_detection)} points above luck with phase handling against {pts(S.early_events.naive.net_detection)} without it. The widened band hides real problems for the first weeks. We have not tuned this trade-off.</li>
            <li><strong>Check-ins earn their place:</strong> wearable-only detection is {pct(S.ablation[S.ablation.length - 1]['1.0'].detection_rate)}.</li>
            <li><strong>Some defaults are not optimal.</strong> Faster smoothing did better here. We kept the values chosen before testing rather than tune on the test missions.</li>
            <li><strong>Quiet missions.</strong> In {Math.round(S.quiet['1.0'].quiet_person_months)} person-months with no event at all: {f2(S.quiet['1.0'].fa_per_person_month)} false alerts per person-month at the notice tier and {f2(S.quiet['0.25'].fa_per_person_month)} at the alert tier, slightly over the budgets of 1.00 and 0.25.</li>
          </ul>
          <p className="figcap"><a href={href('method', 'evaluation')}>How this was measured</a> · <code>{S.script}</code></p>
        </Card>
      </Section>

      <Section id="realism" title="3. Is the simulator realistic?">
        <p className="small muted">{Z.note} Pass marks were written down before the last run: {Z.criteria.variability}; {Z.criteria.carry_over}; correlation {Z.criteria.correlation}; {Z.criteria.transfer}.</p>
        <Card title="Two checks that tie the simulator to reality">
          <p><strong>Like for like.</strong> Simulated people on the ground, illness only, using the two channels the real illness data has (resting heart rate and 7-day activity): Keel flags {pct(lsim['1.0'].detection_rate)}, {pts(lsim['1.0'].net_detection)} points above luck (interval {ci(lsim['1.0'].net_detection_ci)}). The same analysis on real symptom-dated episodes of people the simulator's calibration never saw ({lr['1.0'].n_events} episodes): {pct(lr['1.0'].detection_rate)}, {pts(lr['1.0'].net_detection)} above luck (interval {ci(lr['1.0'].net_detection_ci)}). At the alert tier: {pts(lsim['0.25'].net_detection)} simulated against {pts(lr['0.25'].net_detection)} real. <strong>On these channels simulated illness is harder to detect than real illness,</strong> mainly because the simulated crew cuts exercise by 30% when ill while real people's steps halve.</p>
          <p><strong>Threshold transfer.</strong> Alert thresholds calibrated only on simulated people, applied unchanged to {Z.transfer.n_real_people} real people with no dated illness, gave {f2(Z.transfer.budgets['1.0'].real_fa_per_person_month)} false alerts per person-month against a budget of 1.00 ({Z.transfer.budgets['1.0'].pass ? 'pass' : 'fail'}) and {f2(Z.transfer.budgets['0.25'].real_fa_per_person_month)} against 0.25 ({Z.transfer.budgets['0.25'].pass ? 'pass' : 'fail'}). Real data is noisier than the simulator expects, by about 40 to 70%. Thresholds for the full sensor set, which can only be calibrated in simulation, should be expected to run over budget by a similar amount.</p>
          <p className="figcap"><code>{S.script}</code>, <code>{R.script}</code>, <code>{Z.script}</code></p>
        </Card>
        <Card title="Day-to-day behaviour: simulated crew against real people">
          <div className="tablewrap"><table>
            <thead><tr><th>Indicator</th><th className="n">Real variability</th><th className="n">Simulated</th><th>Within 25%?</th><th className="n">Carry-over, real / simulated</th><th>Within 0.15?</th></tr></thead>
            <tbody>{Z.variability.map((v: J) => <tr key={v.id}><td>{v.label} ({v.unit})</td><td className="n">{f2(v.real_sd_median)} ({f2(v.real_sd_iqr[0])} to {f2(v.real_sd_iqr[1])})</td><td className="n">{f2(v.sim_sd_median)} ({f2(v.sim_sd_iqr[0])} to {f2(v.sim_sd_iqr[1])})</td><td>{v.sd_pass ? 'Pass' : 'Fail'}</td><td className="n">{f2(v.real_ar1_median)} / {f2(v.sim_ar1_median)}</td><td>{v.ar1_pass ? 'Pass' : 'Fail'}</td></tr>)}</tbody>
          </table></div>
          <div className="tablewrap"><table>
            <thead><tr><th>Link between two indicators within a person</th><th className="n">Real</th><th className="n">Simulated</th><th>Within 0.15?</th></tr></thead>
            <tbody>{Z.correlation.map((c: J) => <tr key={c.label}><td>{c.label}</td><td className="n">{f2(c.real_median)} ({c.n_real_people} people)</td><td className="n">{f2(c.sim_median)}</td><td>{c.pass ? 'Pass' : 'Fail'}</td></tr>)}</tbody>
          </table></div>
          <p className="figcap">Variability is the standard deviation of one person's daily values around their own slow trend (median across people, with the middle half in brackets). Carry-over is how much of today's deviation remains tomorrow. Real figures come from the validation half ({Z.variability[0].n_real_people} to {Z.variability[1].n_real_people} people per row). The simulator is tuned on the other half, so agreement shows the tuning carried over, not that the simulator is right in ways we did not measure. <a href={href('method', 'simulator')}>How the simulator is built</a> · <code>{Z.script}</code></p>
        </Card>
        <div className="grid2">
          <Figure title="Illness response: real against simulated" method="simulator" script={Z.script}
            caption={<>Mean resting heart rate change around symptom onset. Real: {Z.illness.real.n} episodes from the validation half. Simulated: {Z.illness.sim.n} episodes with the real spread of sizes, including the three in ten that show no rise. Over the four days from onset the mean rise is {f2(Z.illness.peak_window_mean.real, 1)} bpm real and {f2(Z.illness.peak_window_mean.sim, 1)} simulated; in the five days before onset the real curve sits higher.</>}>
            <XYChart series={[{ label: 'Real', x: Z.illness.rel_day, y: Z.illness.real.mean, lo: Z.illness.real.lo, hi: Z.illness.real.hi }, { label: 'Simulated', x: Z.illness.rel_day, y: Z.illness.sim.mean, lo: Z.illness.sim.lo, hi: Z.illness.sim.hi }]} xLabel="Days from symptom onset" yLabel="Change, bpm" xDecimals={0} yDecimals={1} vline={{ x: 0, label: 'Onset' }} ariaLabel="Event-aligned resting heart rate, real versus simulated" />
          </Figure>
          <Figure title="Published in-flight values" method="simulator" script={Z.script} caption={<>Fitted illness response: mean peak {f2(C.illness.peak_bpm, 1)} bpm, from {C.illness.n_events} episodes whose individual responses range from none (lower quartile {f2(C.illness.per_episode_quartiles[0], 1)}) to {f2(C.illness.per_episode_quartiles[2], 1)} bpm (upper quartile). Reference numbers refer to <a href={href('method', 'sources')}>the source list</a>.</>}>
            <div className="tablewrap"><table>
              <thead><tr><th>Quantity</th><th className="n">Published</th><th className="n">Simulated</th><th>Kind of check</th></tr></thead>
              <tbody>{Z.anchors.map((a: J) => <tr key={a.what}><td>{a.what} <span className="muted">[{a.ref}]</span></td><td className="n">{a.published === null ? 'about 1.9' : `${a.published} ${a.unit}`}</td><td className="n">{f2(a.simulated, a.unit === 'h' ? 2 : 1)} {a.unit}</td><td className="small">{a.input ? 'Input (shows only that the code does what it says)' : 'Independent, and the simulator is off'}</td></tr>)}</tbody>
            </table></div>
          </Figure>
        </div>
      </Section>

      <Section id="bedrest" title="4. Gravity transitions on real NASA analog data">
        <p className="small muted">{B.data}. {B.n_subjects} volunteers; anything learned comes from {B.n_calibration} of them and is tested on the other {B.n_validation}. Bed rest with the head tilted down is NASA's standard ground stand-in for weightlessness.</p>
        <div className="tablewrap"><table>
          <thead><tr><th>Transition</th><th className="n">Volunteers</th><th className="n">Plain rolling baseline</th><th className="n">Baseline restarted</th><th className="n">… and band widened</th><th className="n">… and learned shift (Keel)</th></tr></thead>
          <tbody>{Object.keys(B.transitions).map((k) => <tr key={k}><td>{B.labels[k]}</td><td className="n">{tr(k).n}</td><td className="n">{tr(k).naive_flagged}</td><td className="n">{tr(k).reset_flagged}</td><td className="n">{tr(k).reset_widen_flagged}</td><td className="n">{tr(k).aware_flagged}</td></tr>)}</tbody>
        </table></div>
        <p className="small">Number of volunteers flagged, where a flag means {B.flag_rule}. After getting up from weeks in bed the pulse rises, and a plain personal baseline flags {tr('IN_TEST>POST_TEST').naive_flagged} of {tr('IN_TEST>POST_TEST').n} volunteers; Keel flags {tr('IN_TEST>POST_TEST').aware_flagged}. The gain comes from widening the band after a known transition, not from the learned shift, which is only {f2(B.expected_shift_bpm['IN_TEST>POST_TEST'].median, 1)} bpm. With {tr('IN_TEST>POST_TEST').n} volunteers the difference is suggestive, not established (exact paired test p = {f2(tr('IN_TEST>POST_TEST').p_naive_vs_aware)}). Away from transitions, {pct(B.days_outside_transitions.naive.share_of_days_at_or_above_2sd)} of days exceed the same level with either baseline: nurse-taken pulse is noisy. Whether the wider band would also hide a real problem after a transition is not tested here; the simulation above says it would.</p>
        <p className="figcap"><a href={href('method', 'baseline')}>How phase changes are handled</a> · <code>{B.script}</code></p>
      </Section>

      <Card title="Limits you should know before trusting any of this">
        <ul className="list small">
          <li>No open dataset has astronaut wearable time series. The real evaluation uses people on Earth; spaceflight physiology is represented only by published summary values and the bed-rest analog.</li>
          <li>The real illness data has two indicators. Claims about HRV, oxygen, temperature, mood, reaction time, fluids and food rest on simulation with assumed effect sizes.</li>
          <li>{co.n_events} real episodes is a small sample; intervals are wide. Symptom dates are self-reported and shifted for privacy.</li>
          <li>Thresholds for the full indicator set are calibrated on simulated missions and probably run over budget on real people.</li>
          <li>The four personal-baseline detectors perform alike. Keel runs the one a pre-set rule picked on simulated training missions.</li>
        </ul>
        <a className="btn" href={href('method', 'limits')}>Full limitations and what a clinician would need to review</a>
      </Card>
      <p className="tiny muted">Result files: code version {R.code_version}. Scripts: <code>research/scripts/</code>.</p>
    </>
  )
}
