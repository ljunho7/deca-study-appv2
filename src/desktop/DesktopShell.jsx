import ModeSwitch from '../components/ModeSwitch.jsx'
import RolePlay from './RolePlay.jsx'

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

export default function DesktopShell({ user, tab, onTabChange, screens, syncState, syncError, syncTick, mode, onModeChange }) {
  const content = tab === 'roleplay' ? <RolePlay user={user} /> : screens[tab]
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
              <button key={key} onClick={() => onTabChange(key)}
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

      <main className="flex-1 flex flex-col min-w-0">
        {syncState === 'error' && (
          <div className="bg-error-container text-on-error-container text-xs px-4 py-2 text-center">
            Progress is not being saved to the server, so it only stays on this device. ({syncError})
          </div>
        )}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar" key={syncTick}>
          <div className={`mx-auto w-full ${width} min-h-full`}>{content}</div>
        </div>
      </main>
    </div>
  )
}
