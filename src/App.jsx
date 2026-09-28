import { useState, useEffect } from 'react'
import Login from './components/Login.jsx'
import Home from './components/Home.jsx'
import Flashcards from './components/Flashcards.jsx'
import Exam from './components/Exam.jsx'
import PITracker from './components/PITracker.jsx'
import Profile from './components/Profile.jsx'
import { getProgress, saveProgress, mergeNewest } from './lib/storage.js'

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

  // On login (and on every app start), pull this user's progress from the server
  // and merge it with anything on this device, so a phone, a laptop, and a fresh
  // private window all see the same history. Newest answer per card/question wins.
  const [syncState, setSyncState] = useState('syncing')   // syncing | ok | error
  const [syncError, setSyncError] = useState('')
  const [syncTick, setSyncTick] = useState(0)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setSyncState('syncing')
    const KEY = `deca_progress_${user.key}`
    ;(async () => {
      let local = {}
      try { local = JSON.parse(localStorage.getItem(KEY) || '{}') } catch {}
      try {
        const server = await getProgress(user.key)
        const seen = new Set()
        const exams = [...(server.exams || []), ...(local.exams || [])].filter(e => {
          const k = `${e.date}|${e.score}|${e.total}`; if (seen.has(k)) return false; seen.add(k); return true
        }).sort((a, b) => String(a.date).localeCompare(String(b.date)))
        const merged = {
          ...server, ...local,
          flashcards: mergeNewest(local.flashcards || {}, server.flashcards || {}, 'lastReviewed'),
          questions: mergeNewest(local.questions || {}, server.questions || {}, 'last'),
          exams, totalPoints: exams.reduce((s, e) => s + (e.score || 0), 0),
        }
        delete merged.empty
        localStorage.setItem(KEY, JSON.stringify(merged))
        // Push back anything this device had that the server did not.
        if (Object.keys(local.flashcards || {}).length || Object.keys(local.questions || {}).length || (local.exams || []).length) {
          await saveProgress(user.key, merged)
        }
        if (!cancelled) { setSyncState('ok'); setSyncError('') }
      } catch (e) {
        if (!cancelled) { setSyncState('error'); setSyncError(e.message || 'Server not reachable') }
      }
      if (!cancelled) setSyncTick(t => t + 1)
    })()
    return () => { cancelled = true }
  }, [user?.key])

  useEffect(() => {
    fetch('/flashcards.json').then(r => r.json()).then(setFlashcardsData).catch(() => {})
    fetch('/questions.json').then(r => r.json()).then(setQuestionsData).catch(() => {})
  }, [])

  if (!user) return (
    <Login onLogin={u => { localStorage.setItem('deca_user', JSON.stringify(u)); setUser(u) }} />
  )

  if (syncState === 'syncing' && syncTick === 0) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-on-surface-variant text-sm">Loading your progress…</div>
  )

  const screens = {
    home:    <Home user={user} onTabChange={setTab} cards={flashcardsData} questions={questionsData} />,
    cards:   <Flashcards user={user} data={flashcardsData} questions={questionsData} />,
    exam:    <Exam user={user} data={questionsData} cards={flashcardsData} />,
    pi:      <PITracker user={user} />,
    profile: <Profile user={user} onLogout={() => { localStorage.removeItem('deca_user'); setUser(null) }} />,
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      {syncState === 'error' && (
        <div className="bg-error-container text-on-error-container text-xs px-4 py-2 text-center">
          Progress is not being saved to the server, so it only stays on this device. ({syncError})
        </div>
      )}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" key={syncTick}>
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
