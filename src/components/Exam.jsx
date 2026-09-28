import { useState, useEffect, useRef, useCallback } from 'react'
import { saveProgress, getProgress, updateLeaderboard, mergeNewest } from '../lib/storage.js'
import { flagCardsForReview, readProgress, cardStatus, questionStatus } from '../lib/review.js'

const CATEGORIES = [
  'All categories','Financial Analysis','Financial-Information Management',
  'Professional Development','Emotional Intelligence','Communications',
  'Information Management','Operations','Economics','Business Law',
  'Risk Management','Customer Relations','Marketing',
  'Human Resources Management','Strategic Management','Entrepreneurship',
]

// Every question is in exactly one bucket:
//   new       never answered
//   incorrect last answer was wrong
//   hard      answered correctly, student tagged it Hard
//   easy      answered correctly, student tagged it Easy
//   review    a linked flashcard was marked Forgot (see lib/review.js)
// Filter chips are toggles: any combination can be on. Default is New + Incorrect + Hard + Review.
const FILTERS = [
  { key: 'new',       label: 'New',       hint: 'Never answered' },
  { key: 'incorrect', label: 'Incorrect', hint: 'Missed last time' },
  { key: 'hard',      label: 'Hard',      hint: 'Right, but felt hard' },
  { key: 'review',    label: 'Review',    hint: 'A related flashcard was marked Forgot' },
  { key: 'easy',      label: 'Easy',      hint: 'Right and felt easy' },
]
const DEFAULT_FILTER = ['new', 'incorrect', 'hard', 'review']
const labelFor = (f) => {
  const arr = Array.isArray(f) ? f : [f]
  if (arr.length === FILTERS.length || arr.includes('all')) return 'all'
  return FILTERS.filter(x => arr.includes(x.key)).map(x => x.label.toLowerCase()).join(' + ')
}

const statusOf = questionStatus

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Exam({ user, data, cards }) {
  const [mode,      setMode]      = useState('menu')
  const [category,  setCategory]  = useState('All categories')
  const [filter,    setFilter]    = useState(DEFAULT_FILTER)
  const [qprog,     setQprog]     = useState({})     // per-question status
  const [queue,     setQueue]     = useState([])
  const [cur,       setCur]       = useState(0)
  const [selected,  setSelected]  = useState(null)
  const [session,   setSession]   = useState({ correct: 0, wrong: 0, bycat: {} })
  const [history,   setHistory]   = useState([])
  const [sync,      setSync]      = useState('saved')
  const [notice,    setNotice]    = useState('')
  const [openCard,  setOpenCard]  = useState(null)
  const pendingRef = useRef(null)
  const sessionRef = useRef(session)
  const PROG_KEY   = `deca_progress_${user.key}`

  useEffect(() => { sessionRef.current = session }, [session])

  // Load progress: localStorage first, then server
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(PROG_KEY) || '{}')
      setHistory(s.exams || [])
      setQprog(s.questions || {})
    } catch {}
    getProgress(user.key).then(s => {
      if (!s) return
      if (s.exams) setHistory(s.exams)
      if (s.questions) {
        // Never let an older server copy erase answers already saved on this device.
        let local = {}
        try { local = JSON.parse(localStorage.getItem(PROG_KEY) || '{}').questions || {} } catch {}
        const merged = mergeNewest(local, s.questions, 'last')
        setQprog(merged)
        try {
          const st = JSON.parse(localStorage.getItem(PROG_KEY) || '{}')
          st.questions = merged
          localStorage.setItem(PROG_KEY, JSON.stringify(st))
        } catch {}
      }
    }).catch(() => {})
  }, [])

  // Background sync: every 30 s and on tab hide / close
  useEffect(() => {
    const timer = setInterval(() => {
      if (pendingRef.current) { push(pendingRef.current); pendingRef.current = null }
    }, 30000)
    const flush = () => {
      if (pendingRef.current) {
        const p = JSON.stringify({ user: user.key, data: buildFull(pendingRef.current) })
        navigator.sendBeacon?.('/api/progress', new Blob([p], { type: 'application/json' }))
        pendingRef.current = null
      }
    }
    const onVis = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(timer)
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [user.key])

  function buildFull(qp) {
    try { const s = JSON.parse(localStorage.getItem(PROG_KEY) || '{}'); return { ...s, questions: qp } }
    catch { return { questions: qp } }
  }

  async function push(qp) {
    setSync('saving')
    try { await saveProgress(user.key, buildFull(qp)); setSync('saved') }
    catch { setSync('unsaved') }
  }

  const persist = useCallback((newProg) => {
    try {
      const s = JSON.parse(localStorage.getItem(PROG_KEY) || '{}')
      s.questions = newProg
      localStorage.setItem(PROG_KEY, JSON.stringify(s))
    } catch {}
    // Save to the server right away after every answer. If it fails, the
    // 30 s timer and the tab-hide beacon retry with the latest progress.
    pendingRef.current = newProg
    push(newProg).then(() => { if (pendingRef.current === newProg) pendingRef.current = null })
  }, [PROG_KEY])

  // ── Pools and counts ─────────────────────────────────────────────────
  const catQuestions = (cat) => !data ? [] : (cat === 'All categories' ? data : data.filter(q => q.category === cat))
  const poolFor = (cat, f, prog) => catQuestions(cat).filter(q => f.includes(statusOf(prog[q.id])))
  const countBy = (list, st) => list.filter(q => statusOf(qprog[q.id]) === st).length

  const catList = catQuestions(category)
  const counts = {
    new: countBy(catList, 'new'), incorrect: countBy(catList, 'incorrect'),
    hard: countBy(catList, 'hard'), easy: countBy(catList, 'easy'),
    review: countBy(catList, 'review'), all: catList.length,
  }
  const cardById = {}
  for (const c of (cards || [])) cardById[c.id] = c
  const startCount = filter.reduce((n, k) => n + counts[k], 0)
  const toggleFilter = (k) => setFilter(f => f.includes(k) ? f.filter(x => x !== k) : [...f, k])

  // ── Session flow ─────────────────────────────────────────────────────
  function start() {
    const q = shuffle(poolFor(category, filter, qprog))
    setQueue(q); setCur(0); setSelected(null)
    setSession({ correct: 0, wrong: 0, bycat: {} })
    setMode(q.length === 0 ? 'results' : 'exam')
  }

  function pick(opt) {
    if (selected) return
    const q = queue[cur]
    setSelected(opt)
    const right = opt === q.answer
    setSession(s => {
      const bc = { ...s.bycat }
      bc[q.category] = bc[q.category] || { correct: 0, total: 0 }
      bc[q.category] = { correct: bc[q.category].correct + (right ? 1 : 0), total: bc[q.category].total + 1 }
      return { correct: s.correct + (right ? 1 : 0), wrong: s.wrong + (right ? 0 : 1), bycat: bc }
    })
    // Wrong answers are filed right away. Right answers wait for the Hard / Easy tag.
    if (!right) record(q, 'incorrect')
  }

  function record(q, status) {
    // Mapping: a wrong or hard question sends every linked flashcard to "For review".
    // Flag first (local only); persist() below then saves everything in one push.
    if ((status === 'incorrect' || status === 'hard') && q.cards?.length) {
      flagCardsForReview(user.key, q.cards, `question:${q.id}`)
      setNotice(`${q.cards.length} related flashcard${q.cards.length > 1 ? 's' : ''} marked for review`)
    }
    const prev = qprog[q.id] || {}
    const newProg = { ...qprog, [q.id]: {
      status,
      attempts: (prev.attempts || 0) + 1,
      correct: (prev.correct || 0) + (status === 'incorrect' ? 0 : 1),
      last: Date.now(),
    } }
    setQprog(newProg)
    persist(newProg)
    return newProg
  }

  // Endless: when the queue runs out, rebuild it from the same filter.
  // Questions that no longer match the filter drop out on their own.
  function advance(newProg) {
    setNotice(''); setOpenCard(null)
    if (cur + 1 < queue.length) { setCur(c => c + 1); setSelected(null); return }
    const q = shuffle(poolFor(category, filter, newProg || qprog))
    if (q.length === 0) { finish(); return }
    setQueue(q); setCur(0); setSelected(null)
  }

  function next(tag) {
    const q = queue[cur]
    let np = null
    if (tag) np = record(q, tag)   // 'hard' or 'easy' after a correct answer
    advance(np)
  }

  async function finish() {
    const s = sessionRef.current
    const total = s.correct + s.wrong
    setMode('results')
    if (total === 0) return
    const result = {
      date: new Date().toISOString(), score: s.correct, total,
      category, filter, type: 'practice', pct: Math.round(s.correct / total * 100),
    }
    setSync('saving')
    try {
      const st = JSON.parse(localStorage.getItem(PROG_KEY) || '{}')
      st.exams = [...(st.exams || []), result]
      st.totalPoints = st.exams.reduce((a, e) => a + e.score, 0)
      st.questions = pendingRef.current || st.questions || qprog
      pendingRef.current = null
      localStorage.setItem(PROG_KEY, JSON.stringify(st))
      setHistory(st.exams)
      await saveProgress(user.key, st)
      await updateLeaderboard(user.name, { totalPoints: st.totalPoints, lastExamPct: result.pct })
      setSync('saved')
    } catch { setSync('unsaved') }
  }

  const syncDot = sync === 'saved' ? 'bg-secondary' : sync === 'saving' ? 'bg-amber-500' : 'bg-error'
  const syncLabel = sync === 'saved' ? 'Saved' : sync === 'saving' ? 'Saving…' : 'Pending'
  const filterLabel = labelFor(filter)

  // ── MENU ──────────────────────────────────────────────────────────────
  if (mode === 'menu') {
    const recent = history.slice(-3).reverse()
    return (
      <div className="bg-surface-container-low min-h-full pb-4">
        <div className="bg-background px-5 pt-12 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-on-surface tracking-tight">Practice Exam</h1>
              <p className="text-sm text-on-surface-variant mt-0.5">{data ? `${data.length.toLocaleString()} questions available` : 'Loading…'}</p>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-on-surface-variant">
              <span className={`w-2 h-2 rounded-full ${syncDot}`} />{syncLabel}
            </div>
          </div>
        </div>

        <div className="px-5 mt-3 space-y-3">
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-2">Category</p>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border-0 mb-4">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>

            <div className="grid grid-cols-5 gap-1.5 mb-4">
              {[
                { label: 'Total',     val: counts.all,       color: 'text-on-surface' },
                { label: 'Incorrect', val: counts.incorrect, color: 'text-error' },
                { label: 'Hard',      val: counts.hard,      color: 'text-tertiary-container' },
                { label: 'Review',    val: counts.review,    color: 'text-violet-700' },
                { label: 'Easy',      val: counts.easy,      color: 'text-secondary' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-surface-container-low rounded-xl py-2.5 px-1 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-outline mb-0.5">{label}</p>
                  <p className={`text-lg font-extrabold ${color}`}>{val}</p>
                </div>
              ))}
            </div>

            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-2">Which questions</p>
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {FILTERS.map(f => {
                const active = filter.includes(f.key)
                return (
                  <button key={f.key} onClick={() => toggleFilter(f.key)} title={f.hint}
                    className={`rounded-xl py-2.5 text-center transition-all active:scale-95 border
                      ${active ? 'bg-primary text-on-primary border-primary shadow-md shadow-primary/20' : 'bg-surface-container-low text-on-surface border-transparent'}`}>
                    <p className="text-[10px] font-bold">{f.label}</p>
                    <p className={`text-[11px] font-semibold ${active ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{counts[f.key]}</p>
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-on-surface-variant">Tap to turn each group on or off. No timer, no limit: questions keep coming until you tap Finish or run out. Review = a linked flashcard was marked Forgot.</p>
              <button onClick={() => setFilter(DEFAULT_FILTER)} className="text-xs font-bold text-primary whitespace-nowrap ml-3 active:opacity-70">Reset</button>
            </div>

            <button onClick={start} disabled={!data || startCount === 0}
              className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:shadow-none">
              <span className="material-symbols-outlined sym-filled text-[20px]">play_arrow</span>
              {!data ? 'Loading questions…' : filter.length === 0 ? 'Pick at least one group' : startCount > 0 ? `Start ${startCount} ${filterLabel} questions` : 'No questions in this filter'}
            </button>
          </div>

          {/* Per-category status */}
          {data && (
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-3 mt-1">All categories</p>
              <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
                {CATEGORIES.slice(1).map((cat, i) => {
                  const list = catQuestions(cat)
                  const tot = list.length
                  const inc = countBy(list, 'incorrect')
                  const hd  = countBy(list, 'hard')
                  const ez  = countBy(list, 'easy')
                  const rv  = countBy(list, 'review')
                  const nw  = tot - inc - hd - ez - rv
                  const pRev  = tot ? (rv / tot * 100) : 0
                  const pEasy = tot ? (ez / tot * 100) : 0
                  const pHard = tot ? (hd / tot * 100) : 0
                  const pInc  = tot ? (inc / tot * 100) : 0
                  return (
                    <button key={cat} onClick={() => setCategory(cat)}
                      className={`w-full text-left px-5 py-3.5 active:bg-surface-container-low transition-colors
                        ${category === cat ? 'bg-primary/5' : ''} ${i < CATEGORIES.length - 2 ? 'border-b border-surface-container' : ''}`}>
                      <div className="flex justify-between items-center mb-1.5 gap-2">
                        <span className="text-sm font-semibold text-on-surface truncate">{cat}</span>
                        <span className="text-xs text-on-surface-variant whitespace-nowrap">
                          <span className="font-semibold text-on-surface">{tot}</span> total
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-[11px] text-on-surface-variant mb-1.5">
                        <span><span className="font-semibold text-on-surface">{nw}</span> new</span>
                        <span><span className="font-semibold text-error">{inc}</span> incorrect</span>
                        <span><span className="font-semibold text-tertiary-container">{hd}</span> hard</span>
                        <span><span className="font-semibold text-violet-700">{rv}</span> review</span>
                        <span><span className="font-semibold text-secondary">{ez}</span> easy</span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden flex">
                        <div className="h-full bg-secondary" style={{ width: `${pEasy}%` }} />
                        <div className="h-full bg-tertiary-container" style={{ width: `${pHard}%` }} />
                        <div className="h-full bg-violet-500" style={{ width: `${pRev}%` }} />
                        <div className="h-full bg-error" style={{ width: `${pInc}%` }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
              <div className="px-5 py-3 border-b border-surface-container">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">Recent sessions</p>
              </div>
              {recent.map((e, i) => (
                <div key={i} className={`px-5 py-3.5 flex items-center gap-3 ${i < recent.length - 1 ? 'border-b border-surface-container' : ''}`}>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-on-surface">{e.category}{e.filter ? ` · ${labelFor(e.filter)}` : e.type === 'full' ? ' · Full' : ' · Drill'}</p>
                    <p className="text-xs text-on-surface-variant">{new Date(e.date).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-lg font-black ${e.pct >= 75 ? 'text-secondary' : e.pct >= 60 ? 'text-tertiary-container' : 'text-error'}`}>{e.pct}%</span>
                  <span className="text-xs text-on-surface-variant">{e.score}/{e.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── RESULTS ───────────────────────────────────────────────────────────
  if (mode === 'results') {
    const total = session.correct + session.wrong
    const pct   = total ? Math.round(session.correct / total * 100) : 0
    return (
      <div className="bg-surface-container-low min-h-full pb-4">
        <div className="bg-background px-5 pt-12 pb-6 text-center">
          {total === 0 ? (
            <>
              <div className="text-5xl mb-3">📭</div>
              <p className="text-xl font-black text-on-surface">No {filterLabel} questions left</p>
              <p className="text-on-surface-variant mt-1 text-sm">Pick another filter or category to keep going.</p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-3">{pct >= 75 ? '🎉' : pct >= 60 ? '📈' : '💪'}</div>
              <p className={`text-6xl font-black tracking-tighter ${pct >= 75 ? 'text-secondary' : pct >= 60 ? 'text-tertiary-container' : 'text-error'}`}>{pct}%</p>
              <p className="text-on-surface-variant mt-1">{session.correct} / {total} correct</p>
            </>
          )}
          <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant mt-2">
            <span className={`w-2 h-2 rounded-full ${syncDot}`} />{syncLabel}
          </div>
        </div>
        <div className="px-5 mt-3">
          {total > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)] mb-4">
              <div className="px-5 py-3.5 border-b border-surface-container">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">Breakdown by category</p>
              </div>
              {Object.entries(session.bycat).sort((a, b) => b[1].total - a[1].total).map(([cat, { correct, total }]) => {
                const p = Math.round(correct / total * 100)
                return (
                  <div key={cat} className="px-5 py-3.5 border-b border-surface-container last:border-0">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm font-semibold text-on-surface">{cat}</span>
                      <span className="text-xs text-on-surface-variant">{correct}/{total}</span>
                    </div>
                    <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${p >= 75 ? 'bg-secondary' : p >= 60 ? 'bg-tertiary-container' : 'bg-error'}`} style={{ width: `${p}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <button onClick={() => setMode('menu')} className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl active:scale-95 transition-all mb-3">← Back to menu</button>
          {total > 0 && <button onClick={start} className="w-full bg-secondary text-on-secondary font-bold py-4 rounded-xl active:scale-95 transition-all">Go again</button>}
        </div>
      </div>
    )
  }

  // ── ACTIVE PRACTICE ───────────────────────────────────────────────────
  const q = queue[cur]
  if (!q) return null
  const answered = session.correct + session.wrong
  const right = selected && selected === q.answer

  return (
    <div className="bg-background min-h-full flex flex-col">
      <div className="bg-background/80 backdrop-blur-md px-5 pt-12 pb-2 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <button onClick={finish} className="flex items-center gap-1 text-primary font-bold text-sm active:opacity-70">
            <span className="material-symbols-outlined text-[18px]">stop_circle</span>
            Finish
          </button>
          <div className="bg-surface-container-high px-3 py-1 rounded-full max-w-[55%] truncate">
            <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">{q.category}</span>
          </div>
          <span className="text-on-surface-variant font-medium text-sm">{cur + 1} / {queue.length}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-on-surface-variant mb-2">
          <span>{filterLabel} · {answered} answered · <span className="text-secondary font-semibold">{session.correct} right</span> · <span className="text-error font-semibold">{session.wrong} wrong</span></span>
          <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${syncDot}`} />{syncLabel}</span>
        </div>
        <div className="h-1 bg-surface-container rounded-full overflow-hidden">
          <div className="h-full bg-secondary transition-all duration-300" style={{ width: `${(cur / queue.length) * 100}%` }} />
        </div>
      </div>

      {selected && (
        <div className="px-5 pt-4 pb-3 bg-surface-container-low border-b border-surface-container">
          {right ? (
            <>
              <p className="text-center text-xs font-semibold text-on-surface-variant mb-2">✓ Correct. How did that feel?</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => next('hard')}
                  className="py-3.5 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-2xl font-bold text-sm active:scale-95 transition-all">Hard</button>
                <button onClick={() => next('easy')}
                  className="py-3.5 bg-secondary text-on-secondary rounded-2xl font-bold text-sm shadow-lg shadow-secondary/20 active:scale-95 transition-all">Easy ✓</button>
              </div>
            </>
          ) : (
            <button onClick={() => next(null)}
              className="w-full bg-primary text-on-primary font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20">
              ✗ Incorrect. Next question
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          )}
        </div>
      )}

      <div className="px-5 pt-6 pb-6 flex-1">
        <div className="flex items-center gap-2 mb-3">
          {statusOf(qprog[q.id]) !== 'new' && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
              ${statusOf(qprog[q.id]) === 'incorrect' ? 'bg-error-container/40 text-on-error-container' :
                statusOf(qprog[q.id]) === 'hard' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' :
                statusOf(qprog[q.id]) === 'review' ? 'bg-violet-50 text-violet-800' : 'bg-secondary-container/30 text-on-secondary-container'}`}>
              {statusOf(qprog[q.id]) === 'review' ? 'For review: a related flashcard was forgotten' : `Last time: ${statusOf(qprog[q.id])}`}
            </span>
          )}
        </div>
        <h2 className="text-xl font-bold text-on-surface leading-snug mb-7">{q.question}</h2>
        <div className="space-y-3">
          {['A','B','C','D'].map(opt => {
            const val = q[opt]
            if (!val) return null
            let state = null
            if (selected) { state = opt === q.answer ? 'correct' : opt === selected ? 'wrong' : null }
            return (
              <button key={opt} onClick={() => pick(opt)} disabled={!!selected}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98] relative overflow-hidden text-left
                  ${state === 'correct' ? 'bg-secondary-container/30 border-2 border-secondary' :
                    state === 'wrong'   ? 'bg-error-container/20 border-2 border-error/30' :
                    'bg-surface-container-lowest border border-outline-variant/10 shadow-sm'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm
                  ${state === 'correct' ? 'bg-secondary text-on-secondary' :
                    state === 'wrong'   ? 'bg-error text-on-error' :
                    'bg-surface-container text-on-surface'}`}>
                  {opt}
                </div>
                <span className={`flex-1 text-sm font-medium
                  ${state === 'correct' ? 'text-on-secondary-container font-semibold' :
                    state === 'wrong'   ? 'text-on-error-container' :
                    'text-on-surface-variant'}`}>
                  {val}
                </span>
                {state === 'correct' && <span className="material-symbols-outlined sym-filled text-secondary text-[22px]">check_circle</span>}
                {state === 'wrong'   && <span className="material-symbols-outlined sym-filled text-error   text-[22px]">cancel</span>}
              </button>
            )
          })}
        </div>

        {selected && q.explanation && (
          <div className="mt-5 p-4 bg-surface-container-low rounded-2xl border-l-4 border-secondary">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined sym-filled text-secondary text-[16px]">lightbulb</span>
              <span className="text-secondary font-bold text-[11px] uppercase tracking-widest">Scholar's Insight</span>
            </div>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              <span className={`font-bold ${right ? 'text-secondary' : 'text-error'}`}>
                {right ? '✓ Correct.' : '✗ Incorrect.'}
              </span>{' '}
              {q.explanation}
            </p>
          </div>
        )}

        {selected && notice && <p className="mt-3 text-xs text-center text-violet-800">↻ {notice}</p>}

        {selected && q.cards?.length > 0 && (
          <div className="mt-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-surface-container flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[16px]">style</span>
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">Related flashcards</span>
            </div>
            {q.cards.map(cid => {
              const c = cardById[cid]
              if (!c) return null
              const st = cardStatus(readProgress(user.key).flashcards?.[cid])
              const open = openCard === cid
              return (
                <button key={cid} onClick={() => setOpenCard(open ? null : cid)}
                  className="w-full text-left px-4 py-3 border-b border-surface-container last:border-0 active:bg-surface-container-low">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-primary">{c.term}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap
                      ${st === 'known' ? 'bg-secondary-container/30 text-on-secondary-container' :
                        st === 'forgot' ? 'bg-error-container/40 text-on-error-container' :
                        st === 'review' ? 'bg-violet-50 text-violet-800' : 'bg-surface-container text-on-surface-variant'}`}>{st}</span>
                  </div>
                  {open
                    ? <p className="text-[13px] text-on-surface-variant leading-relaxed mt-1.5">{c.definition}</p>
                    : <p className="text-[11px] text-outline mt-0.5">Tap to see the definition</p>}
                </button>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
