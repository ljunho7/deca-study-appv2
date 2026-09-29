import { useState, useEffect } from 'react'
import { getProgress } from '../lib/storage.js'
import { cardStatus, questionStatus } from '../lib/review.js'
import { usageByDay, dayKey } from '../lib/usage.js'

// Read only view of another student's progress, shown on the Debug account's
// Profile. Reads the same server copy the student's devices sync to.

const fmtTime = (sec) => {
  const m = Math.round((sec || 0) / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}
const ago = (iso) => {
  if (!iso) return 'never'
  const min = Math.round((Date.now() - new Date(iso)) / 60000)
  if (min < 2) return 'just now'
  if (min < 60) return `${min} min ago`
  if (min < 48 * 60) return `${Math.round(min / 60)} h ago`
  return new Date(iso).toLocaleDateString()
}

const Stat = ({ label, val, color = 'text-on-surface' }) => (
  <div className="bg-surface-container-low rounded-xl py-2.5 px-1 text-center">
    <p className="text-[9px] font-bold uppercase tracking-wide text-outline mb-0.5">{label}</p>
    <p className={`text-lg font-extrabold ${color}`}>{val}</p>
  </div>
)
const Section = ({ title, children }) => (
  <div className="px-5 py-3.5 border-b border-surface-container last:border-0">
    <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">{title}</p>
    {children}
  </div>
)

export default function StudentProgress({ student, cards, questions }) {
  const [prog, setProg]   = useState(null)
  const [state, setState] = useState('loading')   // loading | ok | error
  const [error, setError] = useState('')

  async function load() {
    setState('loading')
    try { setProg(await getProgress(student.key)); setState('ok') }
    catch (e) { setError(e.message || 'Could not load'); setState('error') }
  }
  useEffect(() => { load() }, [student.key])

  const fc = prog?.flashcards || {}, qp = prog?.questions || {}
  const cardList = cards || [], qList = questions || []
  const cCount = (st) => cardList.filter(c => cardStatus(fc[c.id]) === st).length
  const qCount = (st) => qList.filter(q => questionStatus(qp[q.id]) === st).length
  const marked = (kind, list) => list.filter(x => prog?.bookmarks?.[kind]?.[x.id]?.on).length
  const cKnown = cCount('known'), cStudied = cardList.length - cCount('new')
  const attempts = Object.values(qp).reduce((s, e) => s + (e.attempts || 0), 0)
  const correct  = Object.values(qp).reduce((s, e) => s + (e.correct || 0), 0)

  // Usage and activity for the last 7 days (oldest first).
  const byDay = usageByDay(prog?.usage)
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d })
  const week = days.map(d => ({ d, key: dayKey(d), sec: byDay[dayKey(d)] || 0 }))
  const weekSec = week.reduce((s, x) => s + x.sec, 0)
  const allSec = Object.values(byDay).reduce((s, x) => s + x, 0)
  const maxSec = Math.max(60, ...week.map(x => x.sec))
  const since = Date.now() - 7 * 864e5
  const cardsWeek = Object.values(fc).filter(e => (e.lastReviewed || 0) >= since).length
  const qWeek = Object.values(qp).filter(e => (e.last || 0) >= since).length

  const exams = prog?.exams || []
  const recent = exams.slice(-3).reverse()
  const avg = exams.length ? Math.round(exams.slice(-5).reduce((s, e) => s + (e.pct || 0), 0) / Math.min(exams.length, 5)) : null

  return (
    <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
      <div className="px-5 py-3.5 border-b border-surface-container flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">{student.name}'s progress</p>
          {state === 'ok' && <p className="text-[11px] text-on-surface-variant mt-0.5">Last active {ago(prog?.lastActive)}</p>}
        </div>
        <button onClick={load} aria-label={`Refresh ${student.name}'s progress`} className="text-primary active:opacity-70 flex items-center">
          <span className={`material-symbols-outlined text-[20px] ${state === 'loading' ? 'animate-spin' : ''}`}>refresh</span>
        </button>
      </div>

      {state === 'error' && <p className="px-5 py-3.5 text-xs text-error">Could not load progress ({error}).</p>}
      {state === 'loading' && !prog && <p className="px-5 py-3.5 text-xs text-on-surface-variant">Loading…</p>}

      {prog && (
        <>
          <Section title="Usage time">
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              <Stat label="Today" val={fmtTime(byDay[dayKey()])} />
              <Stat label="7 days" val={fmtTime(weekSec)} />
              <Stat label="All time" val={fmtTime(allSec)} />
            </div>
            <div className="flex items-end gap-1.5 h-16">
              {week.map(x => (
                <div key={x.key} className="flex-1 flex flex-col items-center justify-end h-full" title={`${x.key}: ${fmtTime(x.sec)}`}>
                  <div className="w-full bg-primary/80 rounded-t" style={{ height: `${Math.max(x.sec ? 6 : 2, x.sec / maxSec * 100)}%`, opacity: x.sec ? 1 : 0.2 }} />
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 mt-1">
              {week.map(x => <span key={x.key} className="flex-1 text-center text-[9px] text-outline">{x.d.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>)}
            </div>
            {!allSec && <p className="text-[11px] text-on-surface-variant mt-2">Usage time is counted from Sept 29, 2026 on, while the app is open and in use.</p>}
            <p className="text-[11px] text-on-surface-variant mt-2">Last 7 days: {cardsWeek} cards and {qWeek} questions studied.</p>
          </Section>

          <Section title={`Flashcards · ${cStudied} of ${cardList.length} studied · ★ ${marked('cards', cardList)}`}>
            <div className="grid grid-cols-4 gap-1.5">
              <Stat label="Known"  val={cKnown}            color="text-secondary" />
              <Stat label="Review" val={cCount('review')}  color="text-violet-700" />
              <Stat label="Forgot" val={cCount('forgot')}  color="text-error" />
              <Stat label="New"    val={cCount('new')} />
            </div>
          </Section>

          <Section title={`Exam questions · ${qList.length - qCount('new')} of ${qList.length} answered${attempts ? ` · ${Math.round(correct / attempts * 100)}% correct` : ''} · ★ ${marked('questions', qList)}`}>
            <div className="grid grid-cols-5 gap-1.5">
              <Stat label="Easy"      val={qCount('easy')}      color="text-secondary" />
              <Stat label="Hard"      val={qCount('hard')}      color="text-tertiary-container" />
              <Stat label="Incorrect" val={qCount('incorrect')} color="text-error" />
              <Stat label="Review"    val={qCount('review')}    color="text-violet-700" />
              <Stat label="New"       val={qCount('new')} />
            </div>
          </Section>

          <Section title={`Practice sessions · ${exams.length}${avg != null ? ` · last 5 avg ${avg}%` : ''}`}>
            {recent.length === 0 && <p className="text-xs text-on-surface-variant">No finished sessions yet.</p>}
            {recent.map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <p className="flex-1 text-xs text-on-surface">
                  {e.year && e.year !== 'All years' ? `${e.year} · ` : ''}{e.category}
                  <span className="text-on-surface-variant"> · {new Date(e.date).toLocaleDateString()}</span>
                </p>
                <span className={`text-sm font-black ${e.pct >= 75 ? 'text-secondary' : e.pct >= 60 ? 'text-tertiary-container' : 'text-error'}`}>{e.pct}%</span>
                <span className="text-[11px] text-on-surface-variant">{e.score}/{e.total}</span>
              </div>
            ))}
          </Section>
        </>
      )}
    </div>
  )
}
