import ModeSwitch from '../components/ModeSwitch.jsx'
import { useState } from 'react'
import RolePlay from './RolePlay.jsx'
import StudyCoach from './StudyCoach.jsx'

// Desktop layout: sidebar navigation and a wide content area. Home, Cards,
// Exam and Profile are the same screens as the phone app (passed in from
// App.jsx); Role Play exists only here. Loaded lazily, so phone mode never
// downloads this code.

export const DESKTOP_TABS = [
  { key: 'home',     label: 'Home',      icon: 'home' },
  { key: 'cards',    label: 'Cards',     icon: 'style' },
  { key: 'exam',     label: 'Exam',      icon: 'edit_note' },
  { key: 'roleplay', label: 'Role Play', icon: 'record_voice_over' },
  { key: 'profile',  label: 'Profile',   icon: 'person' },
]

export default function DesktopShell({ user, cards, questions, tab, onTabChange, screens, syncState, syncError, syncTick, mode, onModeChange }) {
  const content = tab === 'roleplay' ? <RolePlay user={user} cards={cards} /> : screens[tab]
  // Leaving the Role Play tab in the middle of a test would lose it.
  const go = (key) => {
    if (key === tab) return
    if (window.__rpBusy && !window.confirm('You are in the middle of a role play test. Leave it? The test will be lost.')) return
    window.__rpBusy = false
    onTabChange(key)
  }
  // AI coach beside Cards and Exam; can be hidden (remembered per device).
  const [coachOpen, setCoachOpen] = useState(() => { try { return localStorage.getItem('deca_coach_open') !== '0' } catch { return true } })
  const toggleCoach = (open) => { setCoachOpen(open); try { localStorage.setItem('deca_coach_open', open ? '1' : '0') } catch {} }
  const coachTab = tab === 'cards' || tab === 'exam'
  // Phone screens are built for a narrow column; give them a comfortable width.
  const width = tab === 'roleplay' ? 'max-w-6xl' : 'max-w-2xl'

  return (
    <div className="flex bg-surface-container-low" style={{ height: '100dvh' }}>
      <aside className="w-60 flex-shrink-0 bg-background border-r border-outline-variant/30 flex flex-col px-4 py-6">
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/30">
            <span className="material-symbols-outlined sym-filled text-white text-[20px]">trending_up</span>
          </div>
          <div>
            <p className="text-sm font-black text-primary leading-tight">DECA Finance</p>
            <p className="text-[11px] text-on-surface-variant">Desktop</p>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {DESKTOP_TABS.map(({ key, label, icon }) => {
            const active = tab === key
            return (
              <button key={key} onClick={() => go(key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                <span className={`material-symbols-outlined text-[22px] ${active ? 'sym-filled' : ''}`}>{icon}</span>
                {label}
              </button>
            )
          })}
        </nav>

        <div className="space-y-3 px-1">
          <ModeSwitch mode={mode} onChange={onModeChange} />
          <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${syncState === 'error' ? 'bg-error' : 'bg-secondary'}`} />
            {user.name} · {syncState === 'error' ? 'not saving to server' : 'progress synced'}
          </p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative">
        {syncState === 'error' && (
          <div className="bg-error-container text-on-error-container text-xs px-4 py-2 text-center">
            Progress is not being saved to the server, so it only stays on this device. ({syncError})
          </div>
        )}
        {coachTab && coachOpen ? (
          // Same frame as Role Play Self study: a centered max-w-6xl area with
          // px-8, the screen on the left and the 380 px coach on the right,
          // starting at the same height as the Self study coach.
          <div className="flex-1 min-h-0" key={syncTick}>
            <div className="mx-auto w-full max-w-6xl h-full px-8 flex gap-5">
              <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden no-scrollbar">
                <div className="mx-auto w-full max-w-2xl min-h-full">{content}</div>
              </div>
              <div className="w-[380px] flex-shrink-0 pt-[84px] pb-6 min-h-0 flex flex-col">
                <StudyCoach key={tab} user={user} kind={tab} cards={cards} questions={questions} onCollapse={() => toggleCoach(false)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar min-w-0" key={syncTick}>
            <div className={`mx-auto w-full ${width} min-h-full`}>{content}</div>
          </div>
        )}
        {coachTab && !coachOpen && (
          <button onClick={() => toggleCoach(true)} className="absolute right-4 bottom-6 z-30 bg-primary text-on-primary font-bold text-sm px-4 py-2.5 rounded-full shadow-lg flex items-center gap-1.5"><span className="material-symbols-outlined text-[20px]">smart_toy</span>AI coach</button>
        )}
      </main>
    </div>
  )
}
