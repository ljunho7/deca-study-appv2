import { useState, useEffect } from 'react'
import Login from './components/Login.jsx'
import Home from './components/Home.jsx'
import Flashcards from './components/Flashcards.jsx'
import Exam from './components/Exam.jsx'
import PITracker from './components/PITracker.jsx'
import Profile from './components/Profile.jsx'

const TABS = [
  { key: 'home',    label: 'Home',    icon: 'home' },
  { key: 'cards',   label: 'Cards',   icon: 'style' },
  { key: 'exam',    label: 'Exam',    icon: 'edit_note' },
  { key: 'pi',      label: 'PIs',     icon: 'fact_check' },
  { key: 'profile', label: 'Profile', icon: 'person' },
]

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('deca_user') || 'null') } catch { return null }
  })
  const [tab, setTab] = useState('home')
  const [flashcardsData, setFlashcardsData] = useState(null)
  const [questionsData, setQuestionsData] = useState(null)

  useEffect(() => {
    fetch('/flashcards.json').then(r => r.json()).then(setFlashcardsData).catch(() => {})
    fetch('/questions.json').then(r => r.json()).then(setQuestionsData).catch(() => {})
  }, [])

  if (!user) return (
    <Login onLogin={u => { localStorage.setItem('deca_user', JSON.stringify(u)); setUser(u) }} />
  )

  const screens = {
    home:    <Home user={user} onTabChange={setTab} cards={flashcardsData} questions={questionsData} />,
    cards:   <Flashcards user={user} data={flashcardsData} />,
    exam:    <Exam user={user} data={questionsData} cards={flashcardsData} />,
    pi:      <PITracker user={user} />,
    profile: <Profile user={user} onLogout={() => { localStorage.removeItem('deca_user'); setUser(null) }} />,
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {screens[tab]}
      </div>

      {/* Bottom Nav */}
      <nav className="flex justify-around items-center px-2 pt-2 pb-safe bg-white/70 backdrop-blur-xl border-t border-outline-variant/20 shadow-[0px_-4px_20px_rgba(26,27,33,0.05)] rounded-t-2xl z-50 flex-shrink-0"
           style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        {TABS.map(({ key, label, icon }) => {
          const active = tab === key
          return (
            <button key={key} onClick={() => setTab(key)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150 active:scale-90 min-w-0
                ${active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant opacity-70'}`}>
              <span className={`material-symbols-outlined text-[22px] ${active ? 'sym-filled' : ''}`}>{icon}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
