import { useState } from 'react'
import { STATUS_LABEL } from '../core/analysis'
import { INDICATORS } from '../core/mission'
import type { Status } from '../core/types'
import { href, StatusTag } from './kit'

export const SYSTEMS: { id: string; label: string; what: string; hazard: string }[] = [
  { id: 'head', label: 'Brain, sleep and mood', what: 'Sleep, body clock, reaction time and mood.', hazard: 'Isolation and confinement, plus a lost day-night cycle, disturb sleep and wear on mood and attention.' },
  { id: 'heart', label: 'Heart and circulation', what: 'Resting heart rate, heart rate variability and blood pressure.', hazard: 'Without gravity, blood shifts toward the head and the heart is loaded differently. Radiation and inactivity add long-term risk.' },
  { id: 'lungs', label: 'Lungs and oxygen', what: 'Blood oxygen, and the cabin air you breathe.', hazard: 'A sealed cabin recycles its own air: carbon dioxide can build up and dust does not settle.' },
  { id: 'gut', label: 'Food and fluids', what: 'Fluid intake, food intake and blood sugar.', hazard: 'Crews eat and drink less than they need in space, which speeds up body mass loss and raises kidney-stone risk.' },
  { id: 'muscle', label: 'Muscle and bone', what: 'Exercise done against your plan.', hazard: 'Weight-bearing bones lose about 1 to 1.5% of their density per month without countermeasures. Daily loading is the defence.' },
  { id: 'core', label: 'Whole body', what: 'Body temperature and body mass.', hazard: 'Immune changes in flight make infections and reactivated viruses more likely; temperature is an early sign.' },
  { id: 'environment', label: 'Cabin and radiation', what: 'Cabin carbon dioxide and your radiation dose.', hazard: 'Beyond Earth\'s magnetic shield, cosmic rays give a steady dose and solar storms an occasional burst.' },
]

export function BodyMap({ systems }: { systems: Record<string, Status> }) {
  const [sel, setSel] = useState<string>(() => {
    const order: Status[] = ['urgent', 'act', 'watch']
    for (const s of order) { const hit = SYSTEMS.find((x) => systems[x.id] === s); if (hit) return hit.id }
    return 'heart'
  })
  const st = (id: string): Status => systems[id] ?? 'learning'
  const cls = (id: string) => `region st-${st(id)} ${sel === id ? 'sel' : ''}`
  const pick = (id: string) => ({ onClick: () => setSel(id), tabIndex: 0, role: 'button', 'aria-label': `${SYSTEMS.find((s) => s.id === id)!.label}: ${STATUS_LABEL[st(id)]}`, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(id) } } })
  const cur = SYSTEMS.find((s) => s.id === sel)!
  const inds = INDICATORS.filter((i) => i.system === sel)
  return (
    <div className="col">
      <div className="bodymap">
        <svg viewBox="0 0 150 300" role="group" aria-label="Body map. Select a region.">
          <rect className={cls('environment')} x="4" y="4" width="142" height="292" rx="26" {...pick('environment')} style={{ fillOpacity: 0.35 }} />
          {/* limbs = muscle and bone */}
          <g className={cls('muscle')} {...pick('muscle')}>
            <path d="M40 92 L24 160 L33 163 L52 104 Z" /><path d="M110 92 L126 160 L117 163 L98 104 Z" />
            <path d="M56 178 L52 280 L70 280 L74 190 Z" /><path d="M94 178 L98 280 L80 280 L76 190 Z" />
          </g>
          <path className={cls('core')} d="M48 84 Q75 74 102 84 L98 182 Q75 192 52 182 Z" {...pick('core')} />
          <circle className={cls('head')} cx="75" cy="44" r="26" {...pick('head')} />
          <path className={cls('lungs')} d="M56 94 Q62 90 70 94 L70 126 Q60 130 54 122 Z M94 94 Q88 90 80 94 L80 126 Q90 130 96 122 Z" {...pick('lungs')} />
          <path className={cls('heart')} d="M75 112 c-5 -8 -16 -3 -13 5 c2 6 9 9 13 13 c4 -4 11 -7 13 -13 c3 -8 -8 -13 -13 -5 Z" {...pick('heart')} />
          <rect className={cls('gut')} x="60" y="140" width="30" height="32" rx="10" {...pick('gut')} />
        </svg>
        <div className="syslist">
          {SYSTEMS.map((s) => (
            <button key={s.id} type="button" aria-pressed={sel === s.id} onClick={() => setSel(s.id)}>
              <span>{s.label}</span>
              <StatusTag status={st(s.id)} label="" size={18} />
            </button>
          ))}
        </div>
      </div>
      <div className="card flat" style={{ padding: 12 }} aria-live="polite">
        <div className="card-h"><h3>{cur.label}</h3><StatusTag status={st(sel)} label={STATUS_LABEL[st(sel)]} size={18} /></div>
        <p className="small">{cur.what}</p>
        <p className="small muted"><strong>Why space matters here:</strong> {cur.hazard}</p>
        <div className="row wrap">
          {inds.map((i) => <a key={i.id} className="chip" href={href('trends', i.id)}>{i.short}</a>)}
          <a className="chip" href={href('guide', sel)}>How to measure</a>
        </div>
      </div>
    </div>
  )
}
