import { useEffect } from 'react'
import simParams from '../../../shared/sim_params.json'
import { CM, REFS, RULES, TIER_LABEL } from '../core/analysis'
import { INDICATORS } from '../core/mission'
import { useApp } from '../state'
import { Card, href } from '../ui/kit'

const PARAMS = (simParams as { params: Record<string, { value: number; unit: string; basis: string; ref: string | null; note?: string }> }).params
const SECTIONS = [
  ['idea', 'The idea'], ['indicators', 'What is measured'], ['data', 'Data and adapters'], ['simulator', 'The simulator'], ['baseline', 'Personal baselines'],
  ['detection', 'Detection'], ['evaluation', 'How it was tested'], ['action', 'From alert to action'], ['readiness', 'Crew readiness and privacy'],
  ['limits', 'Limitations'], ['sources', 'Sources'],
] as const

export function Method({ section }: { section?: string }) {
  const { model } = useApp()
  useEffect(() => {
    if (section) document.getElementById(`m-${section}`)?.scrollIntoView({ block: 'start' })
  }, [section])
  const p = model.params
  const counts = Object.values(PARAMS).reduce<Record<string, number>>((a, v) => ({ ...a, [v.basis]: (a[v.basis] ?? 0) + 1 }), {})
  return (
    <>
      <h1>How Keel works</h1>
      <p className="muted">Written for a careful reader who is not a specialist. The full version with every equation is <code>docs/METHOD.md</code> in the repository.</p>
      <nav className="row wrap" aria-label="Sections">{SECTIONS.map(([id, label]) => <a key={id} className="chip" href={href('method', id)}>{label}</a>)}</nav>

      <Card id="m-idea" title="The idea">
        <div className="prose">
          <p>On the International Space Station a flight surgeon on Earth watches crew health in near real time. On the way to Mars the signal takes minutes each way and sometimes there is no link at all, so the crew has to notice and act on health changes themselves.</p>
          <p>Keel learns what is normal <em>for each person</em>, notices when their readings drift away from that, says what changed in plain words, and points to one documented action. All of it runs on the device. The crew member owns the data and chooses what the medical officer, the commander and the ground can see.</p>
          <p><strong>Keel is decision support, not a medical device.</strong> It never states a diagnosis. It says "this is unusual for you" and "this is what the documented countermeasure is".</p>
        </div>
      </Card>

      <Card id="m-indicators" title="What is measured, and why">
        <div className="tablewrap"><table>
          <thead><tr><th>Indicator</th><th>Unit</th><th>Comes from</th><th>In the automatic alert?</th><th>Risk it tracks</th></tr></thead>
          <tbody>{INDICATORS.map((i) => <tr key={i.id}><td><a href={href('trends', i.id)}>{i.label}</a></td><td>{i.unit}</td><td>{{ wearable: 'Wearable', checkin: 'Daily check-in', spot: 'Weekly measurement', env: 'Cabin sensor' }[i.source]}</td><td>{i.detect ? 'Yes' : i.source === 'env' ? 'Own rule' : 'Shown only'}</td><td className="small">{i.why}</td></tr>)}</tbody>
        </table></div>
        <p className="small muted">Bone loss and eye changes (SANS) cannot be measured daily with small hardware. Keel tracks the countermeasure instead (exercise done) and asks about vision at check-in.</p>
      </Card>

      <Card id="m-data" title="Data and adapters">
        <div className="prose">
          <ul>
            <li><strong>Real open data.</strong> Stanford COVID-19 wearables, phases 1 and 2 (heart rate, steps, dated illness): detection testing. LifeSnaps (Fitbit Sense, 71 people): day-to-day variability. NASA Life Sciences Data Archive public bed-rest campaigns (daily vitals of 29 volunteers): gravity-transition handling.</li>
            <li><strong>Your own files.</strong> CSV, Fitbit export JSON, Apple Health export. Parsed in the browser, never uploaded.</li>
            <li><strong>A live heart-rate strap</strong> over Web Bluetooth (standard heart-rate service), giving a resting heart rate and HRV reading.</li>
            <li><strong>The simulator</strong>, for everything a real dataset does not exist for. Simulated numbers are always labelled.</li>
          </ul>
          <p>There is no open astronaut wearable time series. NASA's in-flight actigraphy, cognition and standard-measures data are available on request only; we did not request them.</p>
          <p>Daily features from raw wearable data: resting heart rate is the median heart rate between midnight and 07:00 over minutes with no steps in the previous 12 minutes (at least 30 such minutes); steps are the daily total on days with 10 hours of wear; sleep is hours in non-wake stages.</p>
        </div>
      </Card>

      <Card id="m-simulator" title="The simulator">
        <div className="prose">
          <p>Each simulated crew member has personal set points. Each day's reading is the set point, plus a shift for the mission phase, plus the effect of hidden drivers (sleep debt, exercise load, an illness, a cabin CO2 rise, low fluid intake, a low-mood period), plus day-to-day noise that carries over partly to the next day.</p>
          <div className="eq">{`x[i,t] = set_point[i] + flight_shift[i] * a(t) + SUM_k beta_k * driver_k[i,t] + noise[i,t]
a(t)   = 1 - exp(-(t - launch) / tau)                        adaptation to weightlessness
noise  = rho * noise[t-1] + e,   e ~ N(0, sd_i^2 (1 - rho^2))   sd_i differs between people`}</div>
          <p>Of {Object.keys(PARAMS).length} parameters, {counts.published ?? 0} are taken from published sources, {counts.calibrated ?? 0} are fitted to real data (one half of the people; the other half checks the result on the Validation screen), and {counts.assumption ?? 0} are our assumptions. The illness response in heart rate and the day-to-day noise are fitted to real data. Effect sizes for HRV, temperature, oxygen, mood, reaction time, and every non-illness event are assumptions.</p>
        </div>
        <details>
          <summary>Every simulator parameter and where it comes from</summary>
          <div className="tablewrap"><table>
            <thead><tr><th>Parameter</th><th className="n">Value</th><th>Unit</th><th>Basis</th><th>Note</th></tr></thead>
            <tbody>{Object.entries(PARAMS).map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td className="n">{v.value}</td><td>{v.unit}</td><td>{v.basis}{v.ref ? ` [${v.ref}]` : ''}</td><td className="small">{v.note ?? ''}</td></tr>)}</tbody>
          </table></div>
        </details>
      </Card>

      <Card id="m-baseline" title="Personal baselines">
        <div className="prose">
          <p>For each person and indicator, "normal" is the median of their own last {p.window} days, leaving out the most recent {p.gap} so that a change that is just starting cannot hide inside its own baseline. Spread is the median absolute deviation, which a few bad sensor readings cannot inflate. A baseline needs {p.min_n} valid days.</p>
          <div className="eq">{`m[t] = median( x[t-${p.gap}-${p.window} .. t-${p.gap}-1] )
s[t] = max( floor, 1.4826 * MAD( same window ) )
z[t] = clip( (x[t] - m[t]) / s[t], -${p.z_clip}, +${p.z_clip} )`}</div>
          <p><strong>Time of day and activity.</strong> Daily features are built so these cancel out: resting heart rate uses only still minutes at night, HRV is overnight. Adjusting heart rate for the previous day's activity was tested on real data and did not help, so it is switched off.</p>
          <p><strong>Mission phase.</strong> At launch or landing the body changes on purpose. The window never looks back across a phase change. Until {p.n_full} days of new data exist, the baseline is a blend of the old baseline moved along the expected adaptation curve and the person's own new data, and the band is widened:</p>
          <div className="eq">{`prior[t] = m_before + shift * (1 - exp(-(t - t0)/tau))
w        = min(1, n_new / ${p.n_full})
m[t]     = (1 - w) * prior[t] + w * median(new data)
s[t]     = (1 - w) * s_before * (1 + 1.5 * exp(-(t - t0)/tau)) + w * s_new`}</div>
          <p>On NASA bed-rest data this roughly halves false flags when volunteers get up after weeks in bed; in simulation it halves false alerts in the first month of flight (Validation, sections 2 and 4).</p>
        </div>
      </Card>

      <Card id="m-detection" title="Detection">
        <div className="prose">
          <p>Four ways of turning daily z-scores into an alert were compared with a simple baseline that uses one threshold for everybody:</p>
          <ul>
            <li><strong>Fixed threshold</strong> (comparison): population mean and spread, alert when {p.kofn_k} of {p.kofn_n} days exceed it.</li>
            <li><strong>Personal z-score</strong>: the same {p.kofn_k}-of-{p.kofn_n} rule on the person's own z.</li>
            <li><strong>CUSUM</strong> (change-point): adds up evidence day by day, <code>S[t] = max(0, S[t-1] + z[t] - {p.cusum_k})</code>, and resets after {p.cusum_calm} normal days.</li>
            <li><strong>Multivariate EWMA</strong>: smooths all indicators together and asks how unusual the combination is, so several small changes in a worrying direction count.</li>
            <li><strong>Fusion</strong>: whichever of the last two is closer to its threshold.</li>
          </ul>
          <div className="eq">{`y[t] = ${p.ewma_lambda} * z[t] + ${(1 - p.ewma_lambda).toFixed(1)} * y[t-1]            (a missing reading counts as 0)
y+   = y clipped to the direction of concern (e.g. only high heart rate, only low HRV)
T2   = y+' * inverse( ${p.ewma_lambda}/(2-${p.ewma_lambda}) * R ) * y+          R = correlation of z between indicators`}</div>
          <p>The app runs <strong>{{ mewma: 'the multivariate EWMA', zscore: 'the personal z-score rule', cusum: 'CUSUM', fusion: 'the fusion' }[model.deployed ?? 'fusion']}</strong>. That choice was made on simulated <em>training</em> missions only; test missions and real data had no vote.</p>
          <p><strong>Alarm fatigue is a hazard, so thresholds are set from a false-alert budget.</strong> A notice may fire at most {model.budgets?.notice ?? 1} time per person-month by mistake; an alert, which is the only tier that can recommend involving the medical officer without a reported symptom, at most {model.budgets?.alert ?? 0.25}. An alert that stays open counts again every {p.realert_days} days, so one endless alert cannot hide inside the budget. Runs separated by {p.merge_gap} days or fewer are one alert.</p>
          <p>Cabin CO2, radiation and red-flag symptoms do not go through the detector: they have their own fixed rules, because they are not about a personal baseline.</p>
        </div>
      </Card>

      <Card id="m-evaluation" title="How it was tested">
        <div className="prose">
          <ul>
            <li><strong>Held-out people.</strong> Real data: five-fold cross-validation over people. Population statistics, correlations and thresholds come from the training folds; each person is scored once by a model that never saw them. Simulation: separate training and test missions.</li>
            <li><strong>Detection.</strong> An episode counts as detected if an alert <em>starts</em> between 10 days before and 4 days after onset. Lead time is onset minus alert start.</li>
            <li><strong>False alerts.</strong> Alerts that start more than 21 days before or 28 days after any labeled onset, per person-month of such quiet time.</li>
            <li><strong>Luck.</strong> At one false alert per month an alert lands in a two-week window by chance fairly often. We place pretend events on random quiet days and report that rate next to every detection rate.</li>
            <li><strong>Intervals.</strong> Bootstrap over people (real) or missions (simulated), 95%.</li>
            <li><strong>Leakage checks.</strong> Baselines only look backwards (unit-tested). Thresholds never see test people (unit-tested). The simulator is calibrated on one half of the real people and checked against the other. The deployed detector was picked on training missions.</li>
          </ul>
          <p>Results: <a href={href('validation')}>Validation</a>.</p>
        </div>
      </Card>

      <Card id="m-action" title="From alert to action">
        <div className="prose">
          <p>When the detector has an alert open, Keel looks at which indicators moved over the last three days and walks down a fixed table of {RULES.length} rules. The first rule that matches supplies the wording, the single recommended action, the follow-up steps and the escalation level. Each rule cites a countermeasure with its source. No language model writes or rephrases any of it.</p>
          <p>Escalation has three levels: {Object.values(TIER_LABEL).map((t) => t.toLowerCase()).join('; ')}. A rule can raise the level when a pattern persists. Going beyond self-management needs either the stricter alert tier or a symptom the crew member reported, so a single noisy night cannot summon the medical officer.</p>
        </div>
        <details>
          <summary>The complete rule table</summary>
          <div className="tablewrap"><table>
            <thead><tr><th>Rule</th><th>Says</th><th>Recommended action</th><th>Starts at</th><th>Source</th></tr></thead>
            <tbody>{RULES.map((r) => <tr key={r.id}><td><code>{r.id}</code></td><td>{r.title}</td><td className="small">{r.action}</td><td className="small">{TIER_LABEL[r.tier]}</td><td className="small">{r.cm.map((c) => `${CM[c]?.title} [${CM[c]?.refs.join(', ')}]`).join('; ')}</td></tr>)}</tbody>
          </table></div>
        </details>
      </Card>

      <Card id="m-readiness" title="Crew readiness and privacy">
        <div className="prose">
          <p>The commander sees one of three readiness tiers per person for a demanding task tomorrow, derived from open alerts, reaction time and recent sleep. The tier is always visible; the reasons are visible only where the crew member has shared that area. Crew-wide patterns are shown as counts, and only when at least two people are affected.</p>
          <p>Sharing is set per role and per area at four levels: private, status, trends, full detail. One function decides what any other role may see, and it is unit-tested to leak nothing that was not shared. Every view by another role is written to the crew member's access log. Cabin readings are not personal and are visible to all.</p>
          <p>The summary queued for the ground contains only what the crew member shares with the flight surgeon, and is a few hundred bytes.</p>
        </div>
      </Card>

      <Card id="m-limits" title="Limitations">
        <div className="prose">
          <ul>
            <li><strong>Ground data stands in for spaceflight data.</strong> The people in the real evaluation were on Earth, wore consumer watches and mostly had COVID-19. Astronauts are fitter, live on a schedule and are in a different physiological state.</li>
            <li><strong>Early warning is not demonstrated.</strong> On real data the alert usually arrives on or after the day symptoms start.</li>
            <li><strong>Small samples.</strong> About a hundred illness episodes; 29 bed-rest volunteers; 71 people for variability.</li>
            <li><strong>Only illness is tested on real data.</strong> Sleep loss, CO2, deconditioning, dehydration and low mood are tested in simulation with assumed effect sizes.</li>
            <li><strong>Sensors differ.</strong> Overnight heart rate from a wrist watch varies by about 3.5 bpm from night to night; flight hardware may be better or worse. Apple Watch data in the real set performed poorly.</li>
            <li><strong>What is simulated:</strong> every mission in the app, the cabin CO2 and radiation readings, the link delay and blackouts, and thresholds for the full indicator set.</li>
            <li><strong>Assumed, not verified:</strong> the size of in-flight changes in heart rate and HRV (sources say "unchanged" or disagree), typical cabin CO2, crewed-mission blackout lengths.</li>
            <li><strong>The readiness tier and the action rules have not been reviewed by a clinician.</strong> Thresholds such as 38.0 °C or 92% oxygen are general public guidance, not flight rules.</li>
            <li><strong>The one-minute reaction test</strong> is shorter than the validated three-minute test and depends on the touchscreen.</li>
          </ul>
          <p><strong>What a clinician would need to review before any real use:</strong> the rule table and its wording; escalation thresholds; which red-flag symptoms bypass the detector; the false-alert budgets; behaviour during medication use; and whether personal baselines might normalise a slow, harmful drift.</p>
        </div>
      </Card>

      <Card id="m-sources" title="Sources">
        <p className="small muted">Every source below was opened while researching. The full research notes are in <code>docs/DOMAIN.md</code>, the data survey in <code>docs/DATA.md</code>.</p>
        <ol className="list small" style={{ listStyle: 'none' }}>
          {Object.entries(REFS).filter(([k]) => /^\d+$/.test(k)).map(([k, r]) => <li key={k}><span className="muted">[{k}]</span> {r.text} {r.url && <a href={r.url} target="_blank" rel="noreferrer">Link</a>}</li>)}
        </ol>
        <p className="small">Data: Mishra et al. 2020 and Alavi et al. 2022 (Stanford COVID-19 wearables); Yfantidou et al. 2022, LifeSnaps (CC BY 4.0); NASA Life Sciences Data Archive, public bed-rest campaigns.</p>
      </Card>
    </>
  )
}
