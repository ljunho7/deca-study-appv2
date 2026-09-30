import { useState, useEffect, lazy, Suspense } from 'react'
import Login from './components/Login.jsx'
import Home from './components/Home.jsx'
import Flashcards from './components/Flashcards.jsx'
import Exam from './components/Exam.jsx'
import Profile from './components/Profile.jsx'
import ReportBug from './components/ReportBug.jsx'
import { getProgress, saveProgress, mergeNewest } from './lib/storage.js'
import { setReportContext } from './lib/report.js'
import { mergeUsage, startUsageTracking } from './lib/usage.js'
import { mergeBookmarks, seedBookmarks } from './lib/bookmarks.js'
import ModeSwitch from './components/ModeSwitch.jsx'
import { readMode, saveMode, applyModeClass } from './lib/mode.js'

// Desktop layout (with the Role Play tab) loads only in desktop mode.
const DesktopShell = lazy(() => import('./desktop/DesktopShell.jsx'))

const TABS = [
  { key: 'home',    label: 'Home',    icon: 'home' },
  { key: 'cards',   label: 'Cards',   icon: 'style' },
  { key: 'exam',    label: 'Exam',    icon: 'edit_note' },
  { key: 'profile', label: 'Profile', icon: 'person' },
]

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('deca_user') || 'null') } catch { return null }
  })
  const [tab, setTab] = useState('home')

  // App (phone) or Desktop layout, remembered per device. Role Play is desktop
  // only, so switching to App from that tab goes to Home.
  const [mode, setMode] = useState(readMode)
  useEffect(() => { applyModeClass(mode) }, [mode])
  const changeMode = (m) => {
    saveMode(m); setMode(m)
    if (m === 'app' && !TABS.some(t => t.key === tab)) setTab('home')
  }
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
          usage: mergeUsage(server.usage, local.usage),
          bookmarks: mergeBookmarks(server.bookmarks, local.bookmarks),
        }
        delete merged.empty
        const seeded = seedBookmarks(merged)
        localStorage.setItem(KEY, JSON.stringify(merged))
        // Push back anything this device had that the server did not.
        if (seeded || Object.keys(local.flashcards || {}).length || Object.keys(local.questions || {}).length || (local.exams || []).length) {
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

  // Count active study time once this device has synced with the server.
  useEffect(() => {
    if (!user || syncTick === 0) return
    return startUsageTracking(user.key)
  }, [user?.key, syncTick > 0])

  // Keep the bug report context current. Cards and Exam set the item themselves.
  useEffect(() => { setReportContext({ user: user?.key || null }) }, [user?.key])
  useEffect(() => { setReportContext({ screen: user ? tab : 'login', item: null }) }, [tab, !!user])
  useEffect(() => {
    if (flashcardsData && questionsData) setReportContext({ content: `${flashcardsData.length} cards, ${questionsData.length} questions` })
  }, [flashcardsData, questionsData])

  useEffect(() => {
    fetch('/flashcards.json').then(r => r.json()).then(setFlashcardsData).catch(() => {})
    fetch('/questions.json').then(r => r.json()).then(setQuestionsData).catch(() => {})
  }, [])

  const modeSwitch = (
    <ModeSwitch mode={mode} onChange={changeMode} className="absolute left-3 z-40"
      style={{ top: 'calc(env(safe-area-inset-top) + 6px)' }} />
  )

  if (!user) return (
    <div className={mode === 'desktop' ? 'min-h-screen bg-surface-container-low' : ''}>
      <div className={`relative ${mode === 'desktop' ? 'max-w-[430px] mx-auto bg-background shadow-xl' : ''}`}>
        <Login onLogin={u => { localStorage.setItem('deca_user', JSON.stringify(u)); setUser(u) }} />
        {modeSwitch}
        <ReportBug />
      </div>
    </div>
  )

  if (syncState === 'syncing' && syncTick === 0) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-on-surface-variant text-sm relative">
      Loading your progress…
      <ReportBug wide={mode === 'desktop'} />
    </div>
  )

  const screens = {
    home:    <Home user={user} onTabChange={setTab} cards={flashcardsData} questions={questionsData} />,
    cards:   <Flashcards user={user} data={flashcardsData} questions={questionsData} />,
    exam:    <Exam user={user} data={questionsData} cards={flashcardsData} />,
    profile: <Profile user={user} cards={flashcardsData} questions={questionsData} onLogout={() => { localStorage.removeItem('deca_user'); setUser(null) }} />,
  }

  if (mode === 'desktop') return (
    <div className="relative">
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-on-surface-variant text-sm">Loading desktop…</div>}>
        <DesktopShell user={user} tab={tab} onTabChange={setTab} screens={screens}
          syncState={syncState} syncError={syncError} syncTick={syncTick}
          mode={mode} onModeChange={changeMode} />
      </Suspense>
      <ReportBug wide />
    </div>
  )

  return (
    <div className="flex flex-col relative" style={{ height: '100dvh' }}>
      <ReportBug />
      {tab === 'home' && modeSwitch}
      {syncState === 'error' && (
        <div className="bg-error-container text-on-error-container text-xs px-4 py-2 text-center">
          Progress is not being saved to the server, so it only stays on this device. ({syncError})
        </div>
      )}
      {/* Scrolls by touch, wheel and trackpad; the scroll bar itself is hidden (as in the USABO app). */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar" key={syncTick}>
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
