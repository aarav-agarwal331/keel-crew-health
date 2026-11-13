import { useEffect } from 'react'
import simParams from '../../../shared/sim_params.json'
import { CM, REFS, RULES, URGENCY_LABEL, WHO_LABEL } from '../core/analysis'
import { INDICATORS } from '../core/mission'
import { useApp } from '../state'
import type { ReactNode } from 'react'
import { href } from '../ui/kit'

function Card({ id, title, children, open }: { id: string; title: string; children: ReactNode; open?: boolean }) {
  return <details className="card" id={id} open={open}><summary><h2 style={{ display: 'inline' }}>{title}</h2></summary><div className="col" style={{ marginTop: 10 }}>{children}</div></details>
}

const PARAMS = (simParams as { params: Record<string, { value: number; unit: string; basis: string; ref: string | null; note?: string }> }).params
const SECTIONS = [
  ['idea', 'The idea'], ['indicators', 'What is measured'], ['data', 'Data and adapters'], ['simulator', 'The simulator'], ['baseline', 'Personal baselines'],
  ['detection', 'Detection'], ['evaluation', 'How it was tested'], ['action', 'From alert to action'], ['readiness', 'Crew readiness and privacy'],
  ['limits', 'Limitations'], ['sources', 'Sources'],
] as const

export function Method({ section }: { section?: string }) {
  const { model } = useApp()
  useEffect(() => {
    const el = section ? document.getElementById(`m-${section}`) : null
    if (el) { el.setAttribute('open', ''); el.scrollIntoView({ block: 'start' }) }
  }, [section])
  const p = model.params
  const counts = Object.values(PARAMS).reduce<Record<string, number>>((a, v) => ({ ...a, [v.basis]: (a[v.basis] ?? 0) + 1 }), {})
  return (
    <>
      <h1>How Keel works</h1>
      <p className="muted">Written for a careful reader who is not a specialist. The full version with every equation is <code>docs/METHOD.md</code> in the repository.</p>
      <nav className="row wrap" aria-label="Sections">{SECTIONS.map(([id, label]) => <a key={id} className="chip" href={href('method', id)}>{label}</a>)}</nav>

      <Card id="m-idea" title="The idea" open>
        <div className="prose">
          <p>On the International Space Station a flight surgeon is seconds away by voice, speaks privately with each crew member about once a week, and the ground team follows exercise and cabin-air data. On the way to Mars the signal takes minutes each way and sometimes there is no link at all, so the crew has to notice and act on health changes themselves.</p>
          <p>Keel learns what is normal <em>for each person</em>, notices when their readings drift away from that, says what changed in plain words, and points to one documented action. All of it runs on the device. The crew member owns the data and chooses what the medical officer, the commander and the ground can see.</p>
          <p><strong>Keel is decision support, not a medical device.</strong> It never states a diagnosis. It says "this is unusual for you" and "this is what the documented countermeasure is".</p>
        </div>
      </Card>

      <Card id="m-indicators" title="What is measured, and why">
        <div className="tablewrap"><table>
          <thead><tr><th>Indicator</th><th>Unit</th><th>Comes from</th><th>In the automatic alert?</th><th>Risk it tracks</th></tr></thead>
          <tbody>{INDICATORS.map((i) => <tr key={i.id}><td><a href={href('trends', i.id)}>{i.label}</a></td><td>{i.unit}</td><td>{{ wearable: 'Wearable', checkin: 'Daily check-in', spot: 'Spot measurement', env: 'Cabin sensor', dosimeter: 'Personal dosimeter' }[i.source]}</td><td>{i.detect ? 'Yes' : ['co2', 'rad', 'temp_oral', 'sbp', 'glucose', 'mass'].includes(i.id) ? 'Own fixed rule' : 'Shown only'}</td><td className="small">{i.why}</td></tr>)}</tbody>
        </table></div>
        <p className="small muted">Bone loss and eye changes cannot be measured daily with small hardware. Keel tracks the countermeasure instead (exercise done) and asks about vision at check-in. Skin temperature from the wearable and thermometer readings are kept as separate series.</p>
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
          <p>What testing showed, in simulation only: this cuts alerts of any cause in the first month of flight by about a third (1.62 to 1.03 per person-month), and no cost was detected for problems that begin in the first 25 flight days (compared with luck from the same flight days; the paired difference and equivalence were not tested; Validation, section 2). An earlier analysis that reported a cost was wrong: its luck came from late flight. On NASA bed-rest data, a pulse-only version flagged 4 of 14 volunteers after they got up against 9 with a plain baseline. That is not significant, nobody knows whether those flags were false, and the chance level for that variant with its widened band was not measured (Validation, section 4). The benefit comes from restarting the baseline and widening the band; the expected shift itself adds little.</p>
          <p><strong>Your usual is not the standard.</strong> A personal baseline gets used to whatever you do. Someone who always eats 84% of the plan or sleeps six hours will be "normal" at that level. Trends therefore also show the standard (100% of plan, an 8.5-hour sleep period, at least 2 litres), and body mass is compared with pre-flight, not with last month.</p>
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
          <p>The app runs <strong>{({ mewma: 'the multivariate EWMA', zscore: 'the personal 2-of-3-days rule', cusum: 'CUSUM', fusion: 'the fusion' } as Record<string, string>)[model.deployed ?? ''] ?? 'an unknown detector'}</strong>. The choice is made on simulated <em>training</em> missions only: take the simplest detector unless a more complex one flags at least 3 points more events <em>above luck</em>. That rule was written during review, after the first results, and the choice has flipped twice: once when the simulator was corrected, and once when a review found that the multivariate statistic used correlations of the wrong sign (scores were turned to their direction of concern, the correlations were not). After that correction the multivariate EWMA led the simple rule by about two points on the training missions, under the margin, so the simple rule runs. Test missions had no vote. Real data had none directly, but the simulator's illness response is fitted on real episodes from people who are also evaluated, so the choice is not fully independent of them. In testing the four personal detectors could not be told apart at the notice tier; at the alert tier they spread more widely. Treat the choice as arbitrary among equals.</p>
          <p><strong>Alarm fatigue is a hazard, so thresholds are set from a false-alert budget.</strong> A notice may fire at most {model.budgets?.notice ?? 1} time per person-month by mistake; an alert, which is the only tier that can recommend involving the medical officer without a reported symptom, at most {model.budgets?.alert ?? 0.25}. An alert that stays open counts again every {p.realert_days} days, so one endless alert cannot hide inside the budget. Runs with at most {p.merge_gap - 1} days below the threshold between them are one alert.</p>
          <p><strong>Some things never wait for the detector.</strong> Fixed rules react at once to a red-flag symptom, to a single entered reading beyond a safety threshold (thermometer 38.0 °C, fingertip oxygen 92%, blood sugar below 70 mg/dL, upper blood pressure below 90 mmHg, a resting heart rate of 120 or more), to very low mood for days, to three nights under five hours, to a symptom lasting three days, to body mass 5% under pre-flight, and to cabin CO2 at 3.0 and 4.0 mmHg. Every entered reading is kept with its time, and a rule looks at all readings of the most recent day, so a later normal reading does not erase an abnormal one. Anything that needs attention now or today stays on the medical officer's list until they close it with a note. These thresholds are general public guidance, or provisional values chosen by us, and none has been reviewed by a flight surgeon. If nothing has been measured for two days, Keel shows "No recent data", not "Steady".</p>
          <p>Keel does not warn of solar storms. It sees a daily dose total, far too slow for a shelter decision; that is the job of the vehicle's radiation alarm.</p>
        </div>
      </Card>

      <Card id="m-evaluation" title="How it was tested">
        <div className="prose">
          <ul>
            <li><strong>Held-out people.</strong> Real data: five-fold cross-validation over people. Population statistics, correlations and thresholds come from the training folds; each person is scored once by a model that never saw them. Simulation: separate training and test missions.</li>
            <li><strong>Detection.</strong> An episode counts as detected if an alert <em>starts</em> between 10 days before and 4 days after onset. Lead time is onset minus alert start. The window was narrowed from an original −14 to +7 days; results for both are on the Validation screen.</li>
            <li><strong>False alerts.</strong> Alerts that start more than 21 days before or 28 days after any labeled onset, per person-month of such quiet time.</li>
            <li><strong>Luck.</strong> At one false alert per month an alert lands in a two-week window by chance about a third of the time. We place pretend events on random quiet days, score them the same way, and report detection <em>above luck</em>. Methods are compared on that, because a detector that alerts in more separate bursts gets more lucky hits. On real data the pretend windows handle missing data the same way as real ones (quiet-time gaps, not the extra unworn days illness brings) and are weighted to the device mix of the real episodes. They cannot be matched to the calendar, because the data owners shifted every person's dates; travel, testing and isolation near a real onset are therefore not reproduced, and detection above luck is likely optimistic about what physiology alone explains.</li>
            <li><strong>Thresholds from the simulator.</strong> The app cannot calibrate on real people in flight, so its model and thresholds come from the simulator. We fit Keel's method on simulated people with the two channels the real data has and apply it unchanged to real people; this is the linking analysis (it runs over its false-alert budget, so it is not the headline), with the result on people the simulator's calibration did not use beside it. We also feed the eleven-channel model file the app ships with only the channels a real import would give it: calibrated for all eleven, it then alerts about a third as often as its budget at the notice tier and about half at the alert tier, and flags fewer episodes, which shows that thresholds must match the sensors a person has. Imported watch data therefore runs on a heart-rate-only model fitted and calibrated on all 251 real people; its cross-validated performance is the "heart rate alone" result.</li>
            <li><strong>Sensitivity checks.</strong> The original wider window; counting an alert that is already open in the window; luck estimated four other ways; five other fold splits; training on one cohort and testing on the other.</li>
            <li><strong>Same events for every method.</strong> An episode a method cannot score (no baseline yet) counts as a miss.</li>
            <li><strong>Intervals.</strong> Bootstrap over people (real) or missions (simulated), 95%, with thresholds held fixed. Four detectors, two tiers and several windows were looked at with no correction for multiple comparisons.</li>
            <li><strong>Leakage checks.</strong> Baselines only look backwards (unit-tested). Thresholds never see test people (unit-tested). The simulator is calibrated on one half of the real people and checked against the other; that calibration half includes the people behind 47 of the 107 evaluated episodes (the fit itself used 38 curves with enough baseline), which is why results on the other people are shown separately. The deployed detector was picked on training missions.</li>
          </ul>
          <p>Results: <a href={href('validation')}>Validation</a>.</p>
        </div>
      </Card>

      <Card id="m-action" title="From alert to action">
        <div className="prose">
          <p>A fixed table of {RULES.length} rules turns what Keel sees into wording, one recommended action, follow-up steps, how soon and who. When the detector has an alert open, Keel looks at which indicators moved over the last three days and takes the first matching pattern rule. Each rule cites a countermeasure with its source. No language model writes or rephrases any of it.</p>
          <p>Each recommendation says <strong>how soon</strong> (now, today, or at the next routine opportunity) and <strong>who</strong> should know (you alone, the medical officer, or the medical officer with the flight surgeon consulted when a link exists). A rule can raise either when a pattern persists. For detector-driven rules, going beyond self-management needs the stricter alert tier or a symptom the crew member reported, so a single noisy night cannot summon the medical officer.</p>
          <p>Rules triggered by a reported symptom or an entered reading are not covered by the false-alert budget: they fire as often as people report those things.</p>
        </div>
        <details>
          <summary>The complete rule table</summary>
          <div className="tablewrap"><table>
            <thead><tr><th>Rule</th><th>Says</th><th>Recommended action</th><th>How soon, who</th><th>Source</th></tr></thead>
            <tbody>{RULES.map((r) => <tr key={r.id}><td><code>{r.id}</code></td><td>{r.title}</td><td className="small">{r.action}</td><td className="small">{URGENCY_LABEL[r.urgency]}; {WHO_LABEL[r.tier].toLowerCase()}</td><td className="small">{r.cm.map((c) => `${CM[c]?.title} [${CM[c]?.refs.join(', ')}]`).join('; ')}</td></tr>)}</tbody>
          </table></div>
        </details>
      </Card>

      <Card id="m-readiness" title="Crew readiness and privacy">
        <div className="prose">
          <p>The commander sees one of three tiers per person before a demanding task: no Keel flags, minor flags, or talk to the medical officer first. It is "Talk to the medical officer first" for anything urgent or anything that involves the medical officer, "Worth a look" for a self-managed item or a flagged area, and nausea or clearly slowed reactions always mean a conversation first. The tier is always visible; the reasons only where the crew member has shared that area. Crew-wide patterns are shown as counts, and only when at least three people are affected. It is not a clearance.</p>
          <p>Sharing is set per role and per area at four levels: private, status, trends, full detail. One function decides what any other role may see, and it is unit-tested to leak nothing that was not shared. Every view by another role is written to the crew member's access log. Cabin readings are not personal and are visible to all. One exception, agreed before flight and switchable: a red-flag symptom or an "act now" reading is shown at once to the medical officer and to the commander as backup.</p>
          <p>The summary queued for the ground contains only what the crew member shares with the flight surgeon, and is a few hundred bytes.</p>
        </div>
      </Card>

      <Card id="m-limits" title="Limitations" open>
        <div className="prose">
          <ul>
            <li><strong>Ground data stands in for spaceflight data.</strong> The people in the real evaluation were on Earth, wore consumer watches and mostly had COVID-19. Astronauts are fitter, live on a schedule and are in a different physiological state.</li>
            <li><strong>Useful early warning is not demonstrated.</strong> At the notice tier somewhat more alerts start before symptom onset than luck would give, but the gain is small and confounded by testing and isolation, and it counts the day of onset itself. At the alert tier it is about zero for the two-sensor linking analysis and small for heart rate alone, the model imports run on (Validation, section 1).</li>
            <li><strong>Most alerts are false.</strong> At in-flight illness rates for the import model about one in 16 to one in 20 alert-tier alerts, and one in 67 to 70 notices, would be a real respiratory illness (likely optimistic, if false-alert rates hold as measured on Earth); for the tablet's own model on real data it is not measured; the shipped model file fed only import channels gives about 1 in 16 alert-tier alerts and 1 in 29 notices, the closest available figure. Keel is a prompt to look, not a verdict.</li>
            <li><strong>Small samples.</strong> About a hundred illness episodes; 29 bed-rest volunteers, 14 or 15 per transition; 10 to 73 people per indicator in the half used to check variability.</li>
            <li><strong>The alert tier sits close to a ceiling.</strong> The 2-of-3 score uses z-scores capped at 4 and the alert threshold is about 3.5, so with some sensor sets the alert tier cannot fire at all (it never fired for heart rate with 7-day activity on real data, nor in simulation without phase handling). A flight version would score on uncapped values or raise the cap.</li>
            <li><strong>The on-board model's simulated result barely depends on heart rate</strong> (removing it changes overall detection by about a point); it rests on sleep, exercise and check-in channels whose effects in the simulator are assumed.</li>
            <li><strong>Only illness is tested on real data,</strong> and much of that signal (about a third above luck, judged from two separate runs; the paired difference was not estimated) may come with people moving less around illness, which cannot be separated from isolating at home. Sleep loss, CO2, deconditioning, dehydration and low mood are tested in simulation with assumed effect sizes.</li>
            <li><strong>Sensors differ.</strong> Overnight heart rate from a wrist watch varies by about 3.3 to 3.5 bpm from night to night; flight hardware may be better or worse. Non-Fitbit data in the real set did worse, in a small sample. Wearable sleep detection is not validated in weightlessness.</li>
            <li><strong>Thresholds for the full sensor set are calibrated in simulation.</strong> When simulated thresholds were applied to real people, false alerts ran about 30% over budget at the notice tier and 45% over at the alert tier with two indicators on the 72 quiet people from the half the simulator was not fitted on (on all 251 people, 31% and 64% over), and about 35% and 135% over with five (16 people, 29 person-months, no interval). The full set would need recalibrating on real crew data.</li>
            <li><strong>Handling of gravity changes</strong> showed no measured cost for events right after launch once luck was taken from the same flight days, but the app's version was tested only in simulation (bed-rest data tested a simpler pulse-only version), where the size of the adaptation is assumed.</li>
            <li><strong>Thresholds are set per sensor set only twice:</strong> the full on-board set (from simulation) and overnight heart rate alone (from real people, used for imports). Any other combination, such as a crew member whose HRV sensor fails, runs on the full-set thresholds; in simulation it then alerts less than its budget, which may not hold on real data.</li>
            <li><strong>A personal baseline can normalise a slow, harmful drift.</strong> Showing the standard next to "your usual" and comparing body mass with pre-flight only partly addresses this.</li>
            <li><strong>Not modelled:</strong> sleep aids, anti-nausea and other medication; menstrual-cycle effects on temperature and heart rate; resting core temperature, which one ISS study found had risen about 1 °C over the first two and a half months [68], so the medical officer should judge a thermometer reading against the person's own in-flight readings; respiratory rate, the strongest wearable illness signal in one of our sources.</li>
            <li><strong>What is simulated:</strong> every mission in the app, the cabin CO2 and radiation readings, the link delay and blackouts.</li>
            <li><strong>Assumed, not verified:</strong> the size of in-flight changes in heart rate and HRV (sources say "unchanged" or disagree), typical cabin CO2, crewed-mission blackout lengths.</li>
            <li><strong>No clinician has reviewed the rules, the fixed thresholds or the readiness tier.</strong> Some thresholds come from general public guidance for adults on Earth and others (heart rate 35, 120 and 150, and the severe blood-pressure and blood-sugar lines) are provisional values we chose; none are flight rules.</li>
            <li><strong>The one-minute reaction test</strong> is shorter than the validated three-minute test and depends on the touchscreen.</li>
          </ul>
          <p><strong>What a clinician would need to review before any real use:</strong> every rule's wording, urgency and audience; each fixed threshold; the red-flag list; the false-alert budgets; what emergency sharing covers; behaviour during medication use; and how long the band stays widened after a gravity change.</p>
        </div>
      </Card>

      <Card id="m-sources" title="Sources">
        <p className="small muted">Every source below was opened while researching. The full research notes are in <code>docs/DOMAIN.md</code>, the data survey in <code>docs/DATA.md</code>.</p>
        <ol className="list small" style={{ listStyle: 'none' }}>
          {Object.entries(REFS).filter(([, r]) => !r.text.startsWith('PubMed abstract records')).sort(([a], [b]) => parseInt(a) - parseInt(b) || a.localeCompare(b)).map(([k, r]) => <li key={k}><span className="muted">[{k}]</span> {r.text} {r.url && <a href={r.url} target="_blank" rel="noreferrer">Link</a>}</li>)}
        </ol>
        <p className="small">Data: Mishra et al. 2020 and Alavi et al. 2022 (Stanford COVID-19 wearables); Yfantidou et al. 2022, LifeSnaps (CC BY 4.0); NASA Life Sciences Data Archive, public bed-rest campaigns.</p>
      </Card>
    </>
  )
}
