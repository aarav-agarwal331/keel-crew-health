import { fmtDelay } from './core/link'
import { dayLabel } from './core/mission'
import { Alert } from './screens/Alert'
import { CheckIn } from './screens/CheckIn'
import { Crew } from './screens/Crew'
import { DataSources } from './screens/DataSources'
import { Guide } from './screens/Guide'
import { LinkScreen } from './screens/Link'
import { Method } from './screens/Method'
import { More } from './screens/More'
import { Replay } from './screens/Replay'
import { Sharing } from './screens/Sharing'
import { Today } from './screens/Today'
import { Trends } from './screens/Trends'
import { Validation } from './screens/Validation'
import { useApp } from './state'
import { href, Icon, KeelMark, Simulated, useRoute } from './ui/kit'

const NAV = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'trends', label: 'Trends', icon: 'trends' },
  { id: 'checkin', label: 'Check-in', icon: 'checkin' },
  { id: 'crew', label: 'Crew', icon: 'crew' },
  { id: 'more', label: 'More', icon: 'more' },
]
const MORE = ['more', 'sharing', 'link', 'replay', 'validation', 'method', 'data', 'guide']

export default function App() {
  const route = useRoute()
  const { mission, day, link, today, me } = useApp()
  const page = route[0]
  const a = today()
  const crew = mission.crew.find((c) => c.id === me)
  const active = MORE.includes(page) ? 'more' : page === 'alert' ? 'today' : page
  let screen
  switch (page) {
    case 'trends': screen = <Trends focus={route[1]} />; break
    case 'alert': screen = <Alert alertKey={route[1]} />; break
    case 'checkin': screen = <CheckIn />; break
    case 'crew': screen = <Crew />; break
    case 'sharing': screen = <Sharing />; break
    case 'link': screen = <LinkScreen />; break
    case 'replay': screen = <Replay />; break
    case 'validation': screen = <Validation />; break
    case 'method': screen = <Method section={route[1]} />; break
    case 'data': screen = <DataSources />; break
    case 'guide': screen = <Guide focus={route[1]} />; break
    case 'more': screen = <More />; break
    default: screen = <Today />
  }
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href={href('today')} aria-label="Keel, go to Today"><KeelMark /> Keel</a>
          <a className={`chip ${link.available ? '' : 'down'}`} href={href('link')} data-testid="link-chip" aria-label={link.available ? `Earth link available, one-way delay ${fmtDelay(link.delayS)}` : 'No Earth link. Keel is running on board.'}>
            <span className="dot" aria-hidden="true" />
            {link.available ? (day < mission.pre_days ? 'Earth link: direct' : `Earth link: ${fmtDelay(link.delayS)} delay`) : 'No Earth link · running on board'}
          </a>
          <span className="spacer" />
          <span className="chip num" title={crew?.role_label}>{crew?.name.split(' ')[0]} · {dayLabel(mission, day)}</span>
          <Simulated real={!mission.simulated} source={mission.source?.name} />
        </div>
      </header>
      <main id="main" data-screen={page}>{screen}</main>
      <nav className="nav" aria-label="Main">
        <div className="nav-in">
          {NAV.map((n) => (
            <a key={n.id} href={href(n.id)} aria-current={active === n.id ? 'page' : undefined} data-testid={`nav-${n.id}`}>
              <Icon name={n.icon} />
              {n.label}
              {n.id === 'today' && a && (a.status === 'act' || a.status === 'urgent') && <span className="badge" aria-label="Action recommended" />}
            </a>
          ))}
        </div>
      </nav>
    </div>
  )
}
