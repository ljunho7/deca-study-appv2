import { useState, useMemo } from 'react'
import { cardStatus, questionStatus } from '../lib/review.js'
import { attemptsFor } from '../lib/attempts.js'

// Detailed performance for the Debug account's view of a student. Read only:
// everything is computed on screen from the progress record that
// StudentProgress already loaded (GET /api/progress); nothing is ever saved.
//
// Per question the record keeps status, attempts, correct (answers that were
// right, rated Hard or Easy) and last (time of the latest answer), so accuracy
// = correct / attempts. There is no answer by answer history.

const pct = (a, b) => (b ? Math.round(a / b * 100) : null)
const tone = (p) => p == null ? 'text-outline' : p >= 75 ? 'text-secondary' : p >= 60 ? 'text-tertiary-container' : 'text-error'
const ago = (t) => {
  if (!t) return 'never'
  const d = Math.floor((Date.now() - t) / 864e5)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : new Date(t).toLocaleDateString()
}
const MIN_ATTEMPTS = 5   // fewer attempts than this: accuracy shown but not ranked

function Bar({ parts, total }) {
  return (
    <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden flex mt-1.5">
      {parts.map(([n, cls], i) => n > 0 && <div key={i} className={`h-full ${cls}`} style={{ width: `${n / total * 100}%` }} />)}
    </div>
  )
}

// Questions grouped by a key (category or year).
function groupQuestions(questions, qp, bm, keyOf) {
  const groups = new Map()
  for (const q of questions) {
    const k = keyOf(q)
    if (!groups.has(k)) groups.set(k, { name: k, total: 0, answered: 0, attempts: 0, correct: 0, easy: 0, hard: 0, incorrect: 0, review: 0, starred: 0, last: 0 })
    const g = groups.get(k), e = qp[q.id], st = questionStatus(e)
    g.total++
    if (bm?.[q.id]?.on) g.starred++
    if (!e) continue
    g.answered++
    g.attempts += e.attempts || 0
    g.correct += e.correct || 0
    g.last = Math.max(g.last, e.last || 0)
    if (g[st] != null) g[st]++
  }
  return [...groups.values()].map(g => ({ ...g, acc: pct(g.correct, g.attempts) }))
}

function QuestionRows({ rows, sort }) {
  const sorted = [...rows].sort(sort === 'weak'
    ? (a, b) => (a.attempts >= MIN_ATTEMPTS ? a.acc : 101) - (b.attempts >= MIN_ATTEMPTS ? b.acc : 101) || b.attempts - a.attempts
    : sort === 'name' ? (a, b) => (typeof a.name === 'number' && typeof b.name === 'number' ? b.name - a.name : String(a.name).localeCompare(String(b.name)))
    : (a, b) => b.answered - a.answered)
  return sorted.map(g => (
    <div key={g.name} className="py-2.5 border-b border-surface-container last:border-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-on-surface truncate">{g.name}</p>
        <p className="text-xs whitespace-nowrap">
          <span className={`font-black text-sm ${tone(g.acc)}`}>{g.acc == null ? '–' : `${g.acc}%`}</span>
          <span className="text-on-surface-variant"> correct{g.attempts ? ` (${g.correct}/${g.attempts})` : ''}</span>
        </p>
      </div>
      <p className="text-[11px] text-on-surface-variant mt-0.5">
        {g.answered}/{g.total} answered
        {g.incorrect > 0 && <> · <span className="text-error font-semibold">{g.incorrect} incorrect</span></>}
        {g.hard > 0 && <> · <span className="text-tertiary-container font-semibold">{g.hard} hard</span></>}
        {g.review > 0 && <> · <span className="text-violet-700 font-semibold">{g.review} review</span></>}
        {g.starred > 0 && <> · ★ {g.starred}</>}
        {' · '}last {ago(g.last)}
        {g.attempts > 0 && g.attempts < MIN_ATTEMPTS && <span className="text-outline"> · few attempts</span>}
      </p>
      <Bar total={g.total} parts={[[g.easy, 'bg-secondary'], [g.hard, 'bg-tertiary-container'], [g.review, 'bg-violet-500'], [g.incorrect, 'bg-error']]} />
    </div>
  ))
}

export default function PerformanceDetail({ prog, cards, questions }) {
  const [view, setView] = useState('category')   // category | year | chapter | roleplay
  const [sort, setSort] = useState('weak')
  const qp = prog?.questions || {}, fc = prog?.flashcards || {}

  const byCategory = useMemo(() => groupQuestions(questions || [], qp, prog?.bookmarks?.questions, q => q.category || 'Other'), [prog, questions])
  const byYear = useMemo(() => groupQuestions(questions || [], qp, prog?.bookmarks?.questions, q => q.year || 'Unknown'), [prog, questions])

  const byChapter = useMemo(() => {
    const m = new Map()
    for (const c of cards || []) {
      const k = c.chapter || 'Other'
      if (!m.has(k)) m.set(k, { name: k, total: 0, studied: 0, known: 0, forgot: 0, review: 0, flagged: 0, starred: 0, last: 0 })
      const g = m.get(k), e = fc[c.id], st = cardStatus(e)
      g.total++
      // A card counts as studied only if the student answered it (reviews > 0).
      // Entries created only by the review cascade (a missed or Hard linked
      // question) are "flagged for review", not studied.
      if (e && (e.reviews || 0) > 0) { g.studied++; if (st === 'known') g.known++; else if (st === 'forgot') g.forgot++; else if (st === 'review') g.review++ }
      else if (st === 'review') g.flagged++
      if (prog?.bookmarks?.cards?.[c.id]?.on) g.starred++
      g.last = Math.max(g.last, fc[c.id]?.lastReviewed || 0)
    }
    return [...m.values()].map(g => ({ ...g, knownPct: pct(g.known, g.studied) }))
  }, [prog, cards])

  const roleplay = useMemo(() => {
    const all = attemptsFor(prog?.roleplays).filter(a => a.grade?.items?.length)
    // Tests shorter than a minute are microphone checks, not real attempts: listed, not averaged.
    const scored = all.filter(a => (a.duration || 0) >= 60)
    const short = all.length - scored.length
    const parts = {}, items = []
    for (const a of scored) for (const it of a.grade.items) {
      const k = it.kind === 'pi' ? 'Performance indicators' : it.kind === 'skill' ? '21st century skills' : 'Overall impression and judge questions'
      parts[k] = parts[k] || { score: 0, max: 0 }
      parts[k].score += it.score; parts[k].max += it.max
      if (it.kind === 'pi') items.push({ label: it.label, p: pct(it.score, it.max), level: it.level, title: a.title, at: a.at })
    }
    return { scored, short, parts, weakest: items.sort((a, b) => a.p - b.p).slice(0, 6) }
  }, [prog])

  // Headline: weakest and strongest categories with enough attempts.
  const ranked = byCategory.filter(g => g.attempts >= MIN_ATTEMPTS).sort((a, b) => a.acc - b.acc)
  const tabs = [['category', 'Exam by category'], ['year', 'Exam by year'], ['chapter', 'Cards by chapter'], ['roleplay', 'Role play']]

  return (
    <div>
      {ranked.length >= 2 && (
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          <div className="bg-error-container/40 rounded-xl p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wide text-on-error-container">Weakest</p>
            {ranked.slice(0, 2).map(g => <p key={g.name} className="text-xs font-semibold truncate">{g.name} · {g.acc}%</p>)}
          </div>
          <div className="bg-secondary-container/30 rounded-xl p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wide text-on-secondary-container">Strongest</p>
            {ranked.slice(-2).reverse().map(g => <p key={g.name} className="text-xs font-semibold truncate">{g.name} · {g.acc}%</p>)}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {tabs.map(([k, t]) => (
          <button key={k} onClick={() => setView(k)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${view === k ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`}>{t}</button>
        ))}
      </div>

      {(view === 'category' || view === 'year') && (
        <>
          <div className="flex items-center gap-2 text-[11px] text-on-surface-variant mb-1">
            Sort:
            {[['weak', 'weakest first'], ['answered', 'most answered'], ['name', view === 'year' ? 'newest year' : 'name']].map(([k, t]) => (
              <button key={k} onClick={() => setSort(k)} className={`font-semibold ${sort === k ? 'text-primary underline' : ''}`}>{t}</button>
            ))}
          </div>
          <QuestionRows rows={view === 'category' ? byCategory : byYear} sort={sort} />
          <p className="text-[10px] text-outline mt-2">Correct = right answers (rated Hard or Easy) out of all attempts. Categories with fewer than {MIN_ATTEMPTS} attempts are listed last when sorting by weakest. Bar: green easy, brown hard, violet review, red incorrect, empty new.</p>
        </>
      )}

      {view === 'chapter' && [...byChapter].sort((a, b) => (a.knownPct ?? 101) - (b.knownPct ?? 101) || b.flagged - a.flagged).map(g => (
        <div key={g.name} className="py-2.5 border-b border-surface-container last:border-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-on-surface truncate">{g.name}</p>
            <p className="text-xs whitespace-nowrap"><span className={`font-black text-sm ${tone(g.knownPct)}`}>{g.knownPct == null ? '–' : `${g.knownPct}%`}</span><span className="text-on-surface-variant"> known</span></p>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            {g.studied}/{g.total} studied{g.studied > 0 && <> · <span className="text-secondary font-semibold">{g.known} known</span></>}
            {g.forgot > 0 && <> · <span className="text-error font-semibold">{g.forgot} forgot</span></>}
            {g.review > 0 && <> · <span className="text-violet-700 font-semibold">{g.review} review</span></>}
            {g.flagged > 0 && <> · <span className="text-violet-700">{g.flagged} flagged by exam questions</span></>}
            {g.starred > 0 && <> · ★ {g.starred}</>} · last {ago(g.last)}
          </p>
          <Bar total={g.total} parts={[[g.known, 'bg-secondary'], [g.review + g.flagged, 'bg-violet-500'], [g.forgot, 'bg-error']]} />
        </div>
      ))}

      {view === 'roleplay' && (
        roleplay.scored.length === 0 ? <p className="text-xs text-on-surface-variant py-2">No scored role play tests of a minute or longer yet.{roleplay.short ? ` ${roleplay.short} shorter test${roleplay.short > 1 ? 's' : ''} (microphone check${roleplay.short > 1 ? 's' : ''}) not counted.` : ''}</p> : (
          <>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {Object.entries(roleplay.parts).map(([k, v]) => (
                <div key={k} className="bg-surface-container-low rounded-xl p-2.5 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-outline leading-tight">{k}</p>
                  <p className={`text-lg font-extrabold ${tone(pct(v.score, v.max))}`}>{pct(v.score, v.max)}%</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mt-3 mb-1">Lowest scoring performance indicators</p>
            {roleplay.weakest.map((w, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <p className="flex-1 text-xs min-w-0 truncate" title={`${w.label} (${w.title})`}>{w.label}<span className="text-on-surface-variant"> · {new Date(w.at).toLocaleDateString()}</span></p>
                <span className={`text-sm font-black ${tone(w.p)}`}>{w.p}%</span>
              </div>
            ))}
            <p className="text-[10px] text-outline mt-2">From {roleplay.scored.length} scored test{roleplay.scored.length > 1 ? 's' : ''} of a minute or longer; each part as a share of its points.{roleplay.short ? ` ${roleplay.short} shorter test${roleplay.short > 1 ? 's' : ''} not counted.` : ''}</p>
          </>
        )
      )}
    </div>
  )
}
