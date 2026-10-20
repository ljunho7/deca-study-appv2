import { useState, useEffect } from 'react'
import { getProgress } from '../lib/storage.js'
import { cardStatus, questionStatus } from '../lib/review.js'
import { usageByDay, dayKey } from '../lib/usage.js'
import { attemptsFor } from '../lib/attempts.js'
import PerformanceDetail from './PerformanceDetail.jsx'
import { loadRpCards, rpStatus } from '../desktop/rpcardsData.js'

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

// Cards for RP (desktop tab): studied / known overall, for core cards, and the
// weakest topic groups. Read only, like everything in this panel.
function RpCardsSummary({ prog }) {
  const [data, setData] = useState(null)
  useEffect(() => { loadRpCards().then(setData).catch(() => {}) }, [])
  if (!data?.cards.length) return null
  const rp = prog?.rpcards || {}
  const studied = (list) => list.filter(c => (rp[c.id]?.reviews || 0) > 0)
  const known = (list) => list.filter(c => rpStatus(rp[c.id]) === 'known')
  const core = data.cards.filter(c => c.frequency === 3)
  const groups = [...new Set(data.cards.map(c => c.group))].map(g => {
    const list = data.cards.filter(c => c.group === g), st = studied(list)
    return { g, total: list.length, studied: st.length, known: known(list).length }
  }).filter(x => x.studied >= 3).sort((a, b) => a.known / a.studied - b.known / b.studied).slice(0, 3)
  return (
    <Section title={`Cards for RP · ${studied(data.cards).length} of ${data.cards.length} studied`}>
      <div className="grid grid-cols-3 gap-1.5">
        <Stat label="Known" val={known(data.cards).length} color="text-secondary" />
        <Stat label="★★★ core studied" val={`${studied(core).length}/${core.length}`} />
        <Stat label="★★★ core known" val={known(core).length} color="text-secondary" />
      </div>
      {groups.length > 0 && <p className="text-[11px] text-on-surface-variant mt-2">Weakest groups: {groups.map(x => `${x.g} (${x.known}/${x.studied} known)`).join(', ')}</p>}
    </Section>
  )
}

// New cards / New exam (our own 2026-27 practice content, ids NF27-...).
function NewContentSummary({ prog }) {
  const [d, setD] = useState(null)
  useEffect(() => {
    Promise.all([fetch('/new_flashcards.json').then(r => r.json()), fetch('/new_questions.json').then(r => r.json())])
      .then(([cards, questions]) => setD({ cards, questions })).catch(() => {})
  }, [])
  if (!d) return null
  const fc = prog?.flashcards || {}, qp = prog?.questions || {}
  const studied = d.cards.filter(c => (fc[c.id]?.reviews || 0) > 0).length
  const known = d.cards.filter(c => cardStatus(fc[c.id]) === 'known').length
  const answered = d.questions.filter(q => questionStatus(qp[q.id]) !== 'new')
  const att = answered.reduce((s, q) => s + (qp[q.id].attempts || 0), 0), cor = answered.reduce((s, q) => s + (qp[q.id].correct || 0), 0)
  const sessions = (prog?.exams || []).filter(e => e.set === 'new').length
  return (
    <Section title="New cards and New exam">
      <div className="grid grid-cols-4 gap-1.5">
        <Stat label="Cards studied" val={`${studied}/${d.cards.length}`} />
        <Stat label="Cards known" val={known} color="text-secondary" />
        <Stat label="Qs answered" val={`${answered.length}/${d.questions.length}`} />
        <Stat label="Correct" val={att ? `${Math.round(cor / att * 100)}%` : 'n/a'} color="text-secondary" />
      </div>
      <p className="text-[11px] text-on-surface-variant mt-2">{sessions} New exam session{sessions === 1 ? '' : 's'} finished.</p>
    </Section>
  )
}

export default function StudentProgress({ student, cards, questions, onViewAs }) {
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
  const cKnown = cCount('known')
  // Studied = answered by the student; cascade-only "review" entries are not studied.
  const cStudied = cardList.filter(c => (fc[c.id]?.reviews || 0) > 0).length
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
        <div className="flex items-center gap-3">
        {onViewAs && (
          <button onClick={() => onViewAs(student)} className="text-xs font-bold text-primary flex items-center gap-1 active:opacity-70">
            <span className="material-symbols-outlined text-[18px]">visibility</span>View as {student.name}
          </button>
        )}
        <button onClick={load} aria-label={`Refresh ${student.name}'s progress`} className="text-primary active:opacity-70 flex items-center">
          <span className={`material-symbols-outlined text-[20px] ${state === 'loading' ? 'animate-spin' : ''}`}>refresh</span>
        </button>
        </div>
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

          <NewContentSummary prog={prog} />

          <RpCardsSummary prog={prog} />

          <Section title="Performance detail">
            <PerformanceDetail prog={prog} cards={cardList} questions={qList} />
          </Section>

          <Section title={`Practice sessions · ${exams.length}${avg != null ? ` · last 5 avg ${avg}%` : ''}`}>
            {recent.length === 0 && <p className="text-xs text-on-surface-variant">No finished sessions yet.</p>}
            {recent.map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <p className="flex-1 text-xs text-on-surface">
                  {e.set === 'new' ? 'New exam · ' : ''}{e.year && e.year !== 'All years' ? `${e.year} · ` : ''}{e.category}
                  <span className="text-on-surface-variant"> · {new Date(e.date).toLocaleDateString()}</span>
                </p>
                <span className={`text-sm font-black ${e.pct >= 75 ? 'text-secondary' : e.pct >= 60 ? 'text-tertiary-container' : 'text-error'}`}>{e.pct}%</span>
                <span className="text-[11px] text-on-surface-variant">{e.score}/{e.total}</span>
              </div>
            ))}
          </Section>

          {(() => {
            // Role play tests (desktop), kept permanently in the progress record.
            const rps = attemptsFor(prog.roleplays)
            const scored = rps.filter(a => a.grade)
            const avgRp = scored.length ? Math.round(scored.slice(0, 5).reduce((s, a) => s + a.grade.total, 0) / Math.min(scored.length, 5)) : null
            return (
              <Section title={`Role play tests · ${rps.length}${avgRp != null ? ` · last 5 avg ${avgRp}/100` : ''}`}>
                {rps.length === 0 && <p className="text-xs text-on-surface-variant">No role play tests yet (desktop only).</p>}
                {rps.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-center gap-3 py-1">
                    <p className="flex-1 text-xs text-on-surface min-w-0 truncate" title={a.title}>
                      {a.title}<span className="text-on-surface-variant"> · {new Date(a.at).toLocaleDateString()}</span>
                    </p>
                    <span className={`text-sm font-black ${!a.grade ? 'text-outline' : a.grade.total >= 75 ? 'text-secondary' : a.grade.total >= 60 ? 'text-tertiary-container' : 'text-error'}`}>{a.grade ? a.grade.total : 'n/a'}</span>
                  </div>
                ))}
              </Section>
            )
          })()}
        </>
      )}
    </div>
  )
}
