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
const ci = (v: number[] | undefined) => (v ? `${Math.round(v[0] * 100)} to ${Math.round(v[1] * 100)}%` : '')
const bk = (b: number) => (Number.isInteger(b) ? b.toFixed(1) : String(b)) // result files key budgets as '1.0', '0.25'
const f2 = (v: number | null | undefined, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? '–' : v.toFixed(d))
const SHORT: Record<string, string> = { fixed: 'One threshold for all', zscore: 'Personal, simple rule', cusum: 'Personal + CUSUM', mewma: 'Personal + multivariate', fusion: 'Personal, fused' }
const LONG: Record<string, string> = { fixed: 'Fixed threshold, the same for everyone', zscore: 'Personal baseline with a simple 2-of-3-days rule', cusum: 'Personal baseline + CUSUM change detection', mewma: 'Personal baseline + multivariate EWMA', fusion: 'Personal baseline, CUSUM and multivariate fused' }

function Stat({ big, label, sub }: { big: string; label: string; sub?: ReactNode }) {
  return <div className="col" style={{ gap: 2 }}><span className="num" style={{ fontSize: '2rem', fontWeight: 750, lineHeight: 1.1 }}>{big}</span><strong>{label}</strong>{sub && <span className="small muted">{sub}</span>}</div>
}

function MethodTable({ main, methods, deployed, budget }: { main: J; methods: string[]; deployed: string; budget: string }) {
  return (
    <table>
      <thead><tr><th>Method</th><th className="n">Detected</th><th className="n">95% interval</th><th className="n">By luck</th><th className="n">Alert open by onset day</th><th className="n">False alerts per person-month</th></tr></thead>
      <tbody>{methods.map((m) => { const s = main[m][budget]; return (
        <tr key={m}><td>{m === deployed ? <strong>{LONG[m]} (Keel)</strong> : LONG[m]}</td><td className="n">{pct(s.detection_rate)}</td><td className="n">{ci(s.detection_rate_ci)}</td><td className="n">{pct(s.chance_detection_rate)}</td><td className="n">{pct(s.by_onset_rate)}</td><td className="n">{f2(s.fa_per_person_month)}{s.fa_per_person_month_ci ? ` (${f2(s.fa_per_person_month_ci[0])} to ${f2(s.fa_per_person_month_ci[1])})` : ''}</td></tr>
      ) })}</tbody>
    </table>
  )
}

function bars(main: J, methods: string[], deployed: string, budget: string): BarRow[] {
  return methods.map((m) => ({ label: m === deployed ? `Keel: ${SHORT[m].toLowerCase()}` : SHORT[m], value: main[m][budget].detection_rate, lo: main[m][budget].detection_rate_ci[0], hi: main[m][budget].detection_rate_ci[1], highlight: m === deployed, note: `by luck ${pct(main[m][budget].chance_detection_rate)}` }))
}

function curves(main: J, budgets: number[], deployed: string) {
  const s = (m: string, label: string, key = 'detection_rate') => ({ label, x: budgets.map((b) => main[m][bk(b)].fa_per_person_month), y: budgets.map((b) => main[m][bk(b)][key]) })
  return [s(deployed, 'Keel'), s('fixed', 'Fixed threshold'), { ...s(deployed, 'By luck (Keel thresholds)', 'chance_detection_rate'), dashed: true }]
}

export function Validation() {
  const { d, err } = useResults()
  if (err) return <Card title="Validation results are not available"><p className="muted">The results files could not be loaded ({err}). Run <code>make validate</code> and rebuild.</p></Card>
  if (!d) return <p role="status">Loading results…</p>
  const R = d.real_eval, S = d.sim_eval, Z = d.realism, B = d.bedrest, C = d.calibration
  const dep: string = R.deployed
  const r1 = R.main[dep]['1.0'], r25 = R.main[dep]['0.25'], fx1 = R.main.fixed['1.0']
  const s1 = S.main[S.deployed]['1.0']
  const diff = R.diff_vs_fixed['1.0'][dep]
  const leads: (number | null)[] = R.leads['1.0']
  const leadDays = Array.from({ length: 15 }, (_, i) => 10 - i) // +10 .. -4 days before onset
  const leadCounts = leadDays.map((k) => leads.filter((l) => l === k).length)
  const missed = leads.filter((l) => l === null).length
  const fq = R.false_alerts_quiet
  const tr = (k: string) => B.transitions[k]

  return (
    <>
      <h1>Does it work?</h1>
      <p className="muted">Every number on this page was produced by a script in the repository from data described here. Real data is used wherever it exists; everything else is simulated and labelled. Intervals are 95% bootstrap intervals over people. Nothing was tuned on the people it was tested on.</p>

      <section className="card" data-testid="validation-headline">
        <h2>The short version</h2>
        <div className="grid3">
          <Stat big={pct(r1.detection_rate)} label="of real illness episodes flagged" sub={<>within 10 days before to 4 days after symptom onset, at one false alert per person-month. Interval {ci(r1.detection_rate_ci)}. A fixed threshold: {pct(fx1.detection_rate)}. By luck alone: {pct(r1.chance_detection_rate)}.</>} />
          <Stat big={f2(r1.fa_per_person_month)} label="false alerts per person-month" sub={<>measured on held-out people against a budget of 1.00. At the stricter alert tier: {f2(r25.fa_per_person_month)} against 0.25, with {pct(r25.detection_rate)} detected.</>} />
          <Stat big={pct(s1.detection_rate)} label="of simulated mission events flagged" sub={<>six event types, full sensor set, same budget (interval {ci(s1.detection_rate_ci)}; by luck {pct(s1.chance_detection_rate)}). <Simulated /></>} />
        </div>
        <div className="banner strong">
          <strong>What these results do not show.</strong> On real data Keel mostly flags illness on or just after the day symptoms start, not days before: only {pct(r1.by_onset_rate)} of episodes had an alert open by the onset day, and a good part of that is luck. The real data is from people on Earth with a heart-rate watch, not astronauts. Detection of anything other than illness is tested in simulation only.
        </div>
      </section>

      <h2 id="real">1. Real wearable data with dated illness</h2>
      <p className="small muted">{R.data}. {R.cohort.n_people} people with at least 28 nights of data, {R.cohort.person_days.toLocaleString()} person-days, {R.cohort.n_events} illness episodes ({R.cohort.by_kind.covid_symptom} COVID-19 with a symptom date, {R.cohort.by_kind.covid_test_only} with only a test date, {R.cohort.by_kind.other_illness} other illness), {Math.round(R.cohort.quiet_person_months)} quiet person-months. Indicators available: {R.indicators.toLowerCase()}. No HRV, oxygen or temperature exists in this data.</p>

      <div className="grid2">
        <Figure title="Detection at one false alert per person-month" method="evaluation" script={R.script}
          caption={<>Share of illness episodes with an alert starting between {R.windows.det_pre} days before and {R.windows.det_post} days after onset. Bars show 95% intervals. Keel's detector beats one threshold for everyone by {Math.round(diff.detection_rate_diff * 100)} points (interval {Math.round(diff.detection_rate_diff_ci[0] * 100)} to {Math.round(diff.detection_rate_diff_ci[1] * 100)}). The simple personal rule does about as well as Keel's detector here.</>}
          table={<MethodTable main={R.main} methods={R.methods} deployed={dep} budget="1.0" />}>
          <BarCI rows={bars(R.main, R.methods, dep, '1.0')} max={1} pct ariaLabel="Detection rate by method on real data at one false alert per person-month" />
        </Figure>
        <Figure title="Detection against false alerts" method="evaluation" script={R.script}
          caption={<>Each point is a false-alert budget ({R.budgets.join(', ')} per person-month); the horizontal position is the rate actually measured on held-out people. The dashed line is how often an alert lands in the window by luck. The gap between the solid and dashed lines is the real signal.</>}
          table={<MethodTable main={R.main} methods={R.methods} deployed={dep} budget="0.25" />}>
          <XYChart series={curves(R.main, R.budgets, dep)} xLabel="False alerts per person-month (measured)" yLabel="Episodes detected" yPct yMin={0} yMax={1} ariaLabel="Detection rate against false alert rate on real data" />
        </Figure>
        <Figure title="When the alert came, relative to symptom onset" method="evaluation" script={R.script}
          caption={<>Keel at one false alert per person-month. Left of the line, the alert came before symptoms; right of it, after. {missed} of {leads.length} episodes had no alert in the window. The cluster just after onset is the real response; alerts a week or more before onset are mostly coincidence.</>}>
          <XYChart series={[{ label: 'Episodes', x: leadDays.map((k) => -k), y: leadCounts }]} xLabel="Days from symptom onset to alert (negative = alert came first)" yLabel="Episodes" ariaLabel="Histogram of alert timing relative to symptom onset" xDecimals={0} yDecimals={0} yMin={0} step vline={{ x: 0, label: 'Onset' }} />
        </Figure>
        <Figure title="What real illness looks like in resting heart rate" method="simulator" script={R.script}
          caption={<>Mean change from each person's own earlier level, {R.event_aligned_rhr.n_events} dated episodes, with a 95% band. The rise is small before symptoms and peaks about a day after onset. This is why early warning from heart rate alone is hard.</>}>
          <XYChart series={[{ label: 'Mean change', x: R.event_aligned_rhr.rel_day, y: R.event_aligned_rhr.mean, lo: R.event_aligned_rhr.lo, hi: R.event_aligned_rhr.hi }]} xLabel="Days from symptom onset" yLabel="Resting heart rate change, bpm" ariaLabel="Event-aligned resting heart rate around illness onset" xDecimals={0} yDecimals={1} vline={{ x: 0, label: 'Onset' }} />
        </Figure>
      </div>

      <Card title="False alerts over long quiet periods">
        <p className="small">People with no reported illness ({fq['1.0'].n_people} people, {Math.round(fq['1.0'].quiet_person_months)} person-months). At the notice tier Keel raised {f2(fq['1.0'].fa_per_person_month)} false alerts per person-month (interval {f2(fq['1.0'].fa_per_person_month_ci[0])} to {f2(fq['1.0'].fa_per_person_month_ci[1])}) and an alert was open on {pct(fq['1.0'].quiet_days_in_alert_frac)} of quiet days. At the alert tier: {f2(fq['0.25'].fa_per_person_month)} per person-month, open on {pct(fq['0.25'].quiet_days_in_alert_frac)} of days, and {pct(fq['0.25'].share_of_people_with_zero)} of people never saw one. False alerts are uneven: the noisiest fifth of people produced {pct(fq['0.25'].share_of_alerts_from_top_fifth)} of alert-tier false alerts.</p>
        <BarCI rows={fq['1.0'].hist_edges.map((e: string, i: number) => ({ label: `${e} per month`, value: fq['1.0'].per_person_rate_hist[i] }))} decimals={0} unit="people" ariaLabel="People by their personal false alert rate at the notice tier" />
        <p className="figcap">People grouped by their own false-alert rate at the notice tier. The "non-positive" group in phase 2 was never confirmed healthy, so some of these alerts may be real illness. <a href={href('method', 'evaluation')}>How this was measured</a> · <code>{R.script}</code></p>
      </Card>

      <Card title="Which indicators and components earn their place (real data)">
        <div className="tablewrap"><table>
          <thead><tr><th>Variant</th><th className="n">Detected, Keel</th><th className="n">Interval</th><th className="n">Detected, fixed threshold</th></tr></thead>
          <tbody>
            {['rhr', 'rhr_steps', 'rhr_rhrday_steps'].filter((k) => R.ablation[k]).map((k) => <tr key={k}><td>{R.ablation[k].label}</td><td className="n">{pct(R.ablation[k][dep]['1.0'].detection_rate)}</td><td className="n">{ci(R.ablation[k][dep]['1.0'].detection_rate_ci)}</td><td className="n">{pct(R.ablation[k].fixed['1.0'].detection_rate)}</td></tr>)}
            <tr><td>{R.ablation.rhr_steps_adjusted.label}</td><td className="n">{pct(R.ablation.rhr_steps_adjusted[dep]['1.0'].detection_rate)}</td><td className="n">{ci(R.ablation.rhr_steps_adjusted[dep]['1.0'].detection_rate_ci)}</td><td className="n">–</td></tr>
            {R.ablation.sleep_subset && <tr><td>Adding sleep duration ({R.ablation.sleep_subset.n_people} people who have it): without → with</td><td className="n">{pct(R.ablation.sleep_subset.without_sleep.detection_rate)} → {pct(R.ablation.sleep_subset.with_sleep.detection_rate)}</td><td className="n">{ci(R.ablation.sleep_subset.with_sleep.detection_rate_ci)}</td><td className="n">–</td></tr>}
          </tbody>
        </table></div>
        <ul className="list small">
          <li><strong>Steps earn their place.</strong> Activity falls to about half after symptoms start, and adding it to heart rate raises detection.</li>
          <li><strong>Adjusting heart rate for the previous day's activity does not.</strong> It changed detection by {Math.round((R.ablation.rhr_steps_adjusted[dep]['1.0'].detection_rate - R.ablation.rhr_steps[dep]['1.0'].detection_rate) * 100)} points, so the app leaves it off.</li>
          <li><strong>Sleep is undecided.</strong> Too few people have sleep data to tell.</li>
          <li><strong>Device matters.</strong> Fitbit: {pct(R.breakdown['1.0'].device_Fitbit.deployed.detection_rate)} detected. Apple Watch: {pct(R.breakdown['1.0'].device_AppleWatch.deployed.detection_rate)} of {R.breakdown['1.0'].device_AppleWatch.deployed.n_events} episodes; its overnight heart-rate samples are sparse in this release.</li>
          <li><strong>The window matters.</strong> {Object.entries(R.window_sensitivity).map(([k, v]: [string, any]) => `${k} days: ${pct(v.detection_rate)} detected, ${pct(v.chance)} by luck`).join('; ')}.</li>
          <li><strong>Published comparison.</strong> The dataset's authors reported {pct(R.published.presymptomatic_detection)} of 32 cases detectable before symptoms with about {R.published.false_alarms_per_month_healthy} alarms per month, using hourly data and their own algorithm on phase 1. Our daily-feature result is weaker on early warning and we did not reproduce theirs.</li>
        </ul>
      </Card>

      <h2 id="sim">2. Simulated missions <Simulated /></h2>
      <p className="small muted">{S.design.test_missions} test missions of {S.design.crew} crew and {S.design.flight_days} days with {S.design.n_test_events} injected events of six kinds; the model and thresholds were fitted on {S.design.train_missions} separate training missions. The simulator's day-to-day noise and its illness response are calibrated to real data (section 3); the other event types use assumed effect sizes.</p>
      <div className="grid2">
        <Figure title="Detection by method, simulated missions" method="evaluation" script={S.script} caption="Full indicator set, one false alert per person-month. Intervals are over missions, because crewmates share a cabin." table={<MethodTable main={S.main} methods={S.methods} deployed={S.deployed} budget="1.0" />}>
          <BarCI rows={bars(S.main, S.methods, S.deployed, '1.0')} max={1} pct ariaLabel="Detection rate by method on simulated missions" />
        </Figure>
        <Figure title="Detection against false alerts, simulated missions" method="evaluation" script={S.script} caption="Same reading as the real-data chart. Thresholds trained on other missions hold their budget on test missions." table={<MethodTable main={S.main} methods={S.methods} deployed={S.deployed} budget="0.25" />}>
          <XYChart series={curves(S.main, S.budgets, S.deployed)} xLabel="False alerts per person-month (measured)" yLabel="Events detected" yPct yMin={0} yMax={1} ariaLabel="Detection rate against false alert rate on simulated missions" />
        </Figure>
      </div>
      <Card title="By event type and size">
        <div className="tablewrap"><table>
          <thead><tr><th>Event</th>{S.dose.illness.sizes.map((z: number) => <th key={z} className="n">size {z}×</th>)}<th className="n">Typical delay</th></tr></thead>
          <tbody>{Object.entries(S.dose).map(([k, v]: [string, any]) => <tr key={k}><td>{v.label}</td>{v['1.0'].map((x: number, i: number) => <td key={i} className="n">{pct(x)}</td>)}<td className="n">{S.by_type['1.0'][k].median_delay_days === null ? '–' : `${f2(S.by_type['1.0'][k].median_delay_days, 0)} d`}</td></tr>)}</tbody>
        </table></div>
        <p className="figcap">Share detected at the notice tier, by event size (1× is the average size; for illness that is the average real heart-rate response). Typical delay is days from the event's start to the alert. Cabin CO2 events are the hardest for the personal detector, which is why Keel also watches the cabin sensor directly. <a href={href('method', 'simulator')}>How events are simulated</a> · <code>{S.script}</code></p>
      </Card>
      <div className="grid2">
        <Figure title="Missing data" method="evaluation" script={S.script} caption="Detection when the wearable is not worn or check-ins are skipped. Thresholds are not re-tuned, so both detection and false alerts fall as data thins out."
          table={<table><thead><tr><th>Condition</th><th className="n">Detected</th><th className="n">False alerts / person-month</th></tr></thead><tbody>{S.missing.map((m: J) => <tr key={m.label}><td>{m.label}</td><td className="n">{pct(m['1.0'].detection_rate)}</td><td className="n">{f2(m['1.0'].fa_per_person_month)}</td></tr>)}</tbody></table>}>
          <BarCI rows={S.missing.map((m: J, i: number) => ({ label: m.label, value: m['1.0'].detection_rate, lo: m['1.0'].detection_rate_ci[0], hi: m['1.0'].detection_rate_ci[1], highlight: i === 0 }))} max={1} pct ariaLabel="Detection rate under missing data" />
        </Figure>
        <Figure title="Losing a sensor" method="evaluation" script={S.script} caption="Detection with one input removed for the whole mission. The exercise log, sleep tracking and the check-ins carry the most weight in this simulation."
          table={<table><thead><tr><th>Condition</th><th className="n">Detected</th><th className="n">False alerts / person-month</th></tr></thead><tbody>{S.dropout.map((m: J) => <tr key={m.label}><td>{m.label}</td><td className="n">{pct(m['1.0'].detection_rate)}</td><td className="n">{f2(m['1.0'].fa_per_person_month)}</td></tr>)}</tbody></table>}>
          <BarCI rows={S.dropout.map((m: J, i: number) => ({ label: m.label, value: m['1.0'].detection_rate, lo: m['1.0'].detection_rate_ci[0], hi: m['1.0'].detection_rate_ci[1], highlight: i === 0 }))} max={1} pct ariaLabel="Detection rate with one sensor removed" />
        </Figure>
      </div>
      <Card title="Which design choices earn their place (simulated)">
        <div className="tablewrap"><table>
          <thead><tr><th>Variant</th><th className="n">Detected</th><th className="n">Interval</th><th className="n">False alerts / person-month</th><th className="n">… in the first 30 flight days</th></tr></thead>
          <tbody>{S.ablation.map((a: J, i: number) => <tr key={a.label}><td>{i === 0 ? <strong>{a.label}</strong> : a.label}</td><td className="n">{pct(a['1.0'].detection_rate)}</td><td className="n">{ci(a['1.0'].detection_rate_ci)}</td><td className="n">{f2(a['1.0'].fa_per_person_month)}</td><td className="n">{f2(a.first_30_flight_days_fa_per_person_month)}</td></tr>)}</tbody>
        </table></div>
        <ul className="list small">
          <li><strong>Mission-phase handling earns its place:</strong> without it, false alerts in the first month of flight rise from {f2(S.ablation[0].first_30_flight_days_fa_per_person_month)} to {f2(S.ablation[1].first_30_flight_days_fa_per_person_month)} per person-month, because adaptation to weightlessness looks like a problem.</li>
          <li><strong>Check-ins earn their place:</strong> wearable-only detection is {pct(S.ablation[S.ablation.length - 1]['1.0'].detection_rate)}.</li>
          <li><strong>Some defaults are not optimal.</strong> A shorter baseline window or faster smoothing did slightly better here. We kept the values chosen before testing rather than tune on the test missions.</li>
          <li><strong>Quiet missions.</strong> In {Math.round(S.quiet['1.0'].quiet_person_months)} person-months with no event at all: {f2(S.quiet['1.0'].fa_per_person_month)} false alerts per person-month at the notice tier and {f2(S.quiet['0.25'].fa_per_person_month)} at the alert tier.</li>
        </ul>
        <p className="figcap"><a href={href('method', 'evaluation')}>How this was measured</a> · <code>{S.script}</code></p>
      </Card>

      <h2 id="realism">3. Is the simulator realistic?</h2>
      <p className="small muted">{Z.note} The simulator is tuned on one half of the real people and compared here with the other half.</p>
      <Card title="Like-for-like check: simulated against real illness detection">
        <p>On the two channels the real illness data has (resting heart rate and activity), with similar wear time, Keel detects <strong>{pct(S.like_for_like['1.0'].detection_rate)}</strong> of simulated illnesses (interval {ci(S.like_for_like['1.0'].detection_rate_ci)}) against <strong>{pct(R.breakdown['1.0'].covid_symptom.deployed.detection_rate)}</strong> of real symptom-dated episodes (interval {ci(R.breakdown['1.0'].covid_symptom.deployed.detection_rate_ci)}). At the alert tier: {pct(S.like_for_like['0.25'].detection_rate)} simulated against {pct(R.breakdown['0.25'].covid_symptom.deployed.detection_rate)} real. Where the two can be compared, the simulator is about as hard as reality, or slightly easier.</p>
        <p className="figcap"><code>{S.script}</code> and <code>{R.script}</code></p>
      </Card>
      <div className="grid2">
        {Z.variability.map((v: J) => (
          <Figure key={v.id} title={`Day-to-day variability: ${v.label}`} method="simulator" script={Z.script}
            caption={<>How much one person's reading moves from day to day ({v.unit}). Real median {f2(v.real_sd_median, 3)} (middle half {f2(v.real_sd_iqr[0], 2)} to {f2(v.real_sd_iqr[1], 2)}; {v.n_real_people} people, {v.source}). Simulated median {f2(v.sim_sd_median, 3)} (middle half {f2(v.sim_sd_iqr[0], 2)} to {f2(v.sim_sd_iqr[1], 2)}). Day-to-day carry-over: real {f2(v.real_ar1_median)}, simulated {f2(v.sim_ar1_median)}.</>}>
            <XYChart series={[{ label: 'Real people', x: v.edges.slice(0, -1), y: v.real_hist }, { label: 'Simulated crew', x: v.edges.slice(0, -1), y: v.sim_hist }]} xLabel={`Within-person standard deviation, ${v.unit}`} yLabel="Share of people" yPct yMin={0} step height={190} ariaLabel={`Distribution of within-person variability, real versus simulated, ${v.label}`} />
          </Figure>
        ))}
        <Figure title="Illness response: real against simulated" method="simulator" script={Z.script}
          caption={<>Mean resting heart rate change around symptom onset. Real: {Z.illness.real.n} episodes from the validation half. Simulated: {Z.illness.sim.n} episodes with the real spread of sizes. The simulated response is smoother and wider than the real one, which peaks more sharply a day after onset.</>}>
          <XYChart series={[{ label: 'Real', x: Z.illness.rel_day, y: Z.illness.real.mean, lo: Z.illness.real.lo, hi: Z.illness.real.hi }, { label: 'Simulated', x: Z.illness.rel_day, y: Z.illness.sim.mean, lo: Z.illness.sim.lo, hi: Z.illness.sim.hi }]} xLabel="Days from symptom onset" yLabel="Change, bpm" xDecimals={0} yDecimals={1} vline={{ x: 0, label: 'Onset' }} ariaLabel="Event-aligned resting heart rate, real versus simulated" />
        </Figure>
      </div>
      <Card title="Published in-flight values the simulator should reproduce">
        <div className="tablewrap"><table>
          <thead><tr><th>Quantity</th><th className="n">Published</th><th className="n">Simulated</th><th>Note</th></tr></thead>
          <tbody>{Z.anchors.map((a: J) => <tr key={a.what}><td>{a.what}</td><td className="n">{a.published === null ? '–' : `${a.published} ${a.unit}`}</td><td className="n">{f2(a.simulated, a.unit === 'h' ? 2 : 1)} {a.unit}</td><td className="small muted">{a.note} [{a.ref}]</td></tr>)}</tbody>
        </table></div>
        <p className="figcap">Fitted illness response: peak {f2(C.illness.peak_bpm, 1)} bpm on average, with real episodes ranging from no rise (lower quartile {f2(C.illness.per_episode_quartiles[0], 1)}) to {f2(C.illness.per_episode_quartiles[2], 1)} bpm (upper quartile), from {C.illness.n_events} episodes. Reference numbers refer to <a href={href('method', 'sources')}>the source list</a>. <code>{Z.script}</code>, <code>{C.script}</code></p>
      </Card>

      <h2 id="bedrest">4. Gravity transitions on real NASA analog data</h2>
      <Card>
        <p className="small muted">{B.data}. {B.n_subjects} volunteers; the expected pulse shift was learned from {B.n_calibration} of them and tested on the other {B.n_validation}. Bed rest with the head tilted down is NASA's standard ground stand-in for weightlessness.</p>
        <div className="tablewrap"><table>
          <thead><tr><th>Transition</th><th className="n">Volunteers</th><th className="n">Flagged by a plain rolling baseline</th><th className="n">Flagged by Keel's phase-aware baseline</th></tr></thead>
          <tbody>{Object.keys(B.transitions).map((k) => <tr key={k}><td>{B.labels[k]}</td><td className="n">{tr(k).n}</td><td className="n">{tr(k).naive_flagged}</td><td className="n">{tr(k).aware_flagged}</td></tr>)}</tbody>
        </table></div>
        <p className="small">A flag here means {B.flag_rule}. Getting up after weeks in bed raises the pulse, and a plain personal baseline calls that a problem in most volunteers. Telling the baseline that a transition happened removes about half of those flags. The numbers are small and this is pulse only, taken once a day by a nurse.</p>
        <p className="figcap"><a href={href('method', 'baseline')}>How phase changes are handled</a> · <code>{B.script}</code></p>
      </Card>

      <Card title="Limits you should know before trusting any of this">
        <ul className="list small">
          <li>No open dataset has astronaut wearable time series. The real evaluation uses people on Earth; spaceflight physiology is represented only by published summary values and the bed-rest analog.</li>
          <li>The real illness data has two indicators. Claims about HRV, oxygen, temperature, mood, reaction time, fluids and food rest on simulation with assumed effect sizes.</li>
          <li>{R.cohort.n_events} real episodes is a small sample; intervals are wide. Symptom dates are self-reported and shifted for privacy.</li>
          <li>Thresholds for the full indicator set are calibrated on simulated missions, because no real data has the full set.</li>
          <li>The detector that the app runs was chosen among four on simulated training missions; it also happened to be the best on real data, which we saw only afterwards.</li>
        </ul>
        <a className="btn" href={href('method', 'limits')}>Full limitations and what a clinician would need to review</a>
      </Card>
    </>
  )
}
