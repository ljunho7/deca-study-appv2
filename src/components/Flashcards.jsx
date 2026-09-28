import { useState, useEffect, useCallback, useRef } from 'react'
import { saveProgress, getProgress, mergeNewest } from '../lib/storage.js'
import { flagQuestionsForReview, cardStatus, questionStatus, readProgress } from '../lib/review.js'

function mark(prev, quality) {
  return {
    status: quality === 2 ? 'known' : 'forgot',
    reviews: (prev.reviews || 0) + 1,
    lastReviewed: Date.now(),
  }
}

// Filter chips are toggles: any combination can be on. Default is New + Forgot + For review.
const FILTERS = [
  { key: 'new',    label: 'New',    hint: 'Not reviewed yet' },
  { key: 'forgot', label: 'Forgot', hint: 'Marked Forgot last time' },
  { key: 'review', label: 'Review', hint: 'A related exam question was missed or felt hard' },
  { key: 'known',  label: 'Known',  hint: 'Marked Got it last time' },
]
const DEFAULT_FILTER = ['new', 'forgot', 'review']
const filterLabel = (f) => f.length === FILTERS.length ? 'all' : FILTERS.filter(x => f.includes(x.key)).map(x => x.label.toLowerCase()).join(' + ')

const statusOf = cardStatus

const CHAPTERS = [
  'All chapters', 'Financial Analysis', 'Financial-Information Management',
  'Risk Management', 'Professional Development', 'Emotional Intelligence',
  'Communications', 'Economics', 'Business Law', 'Information Management',
  'Operations', 'Customer Relations', 'Human Resources Management',
  'Marketing & Strategy', 'PI & 2025 Updates',
]

export default function Flashcards({ user, data, questions }) {
  const [cards, setCards]         = useState([])
  const [progress, setProgress]   = useState({})
  const [chapter, setChapter]     = useState('All chapters')
  const [filter, setFilter]       = useState(DEFAULT_FILTER)
  const [queue, setQueue]         = useState([])
  const [idx, setIdx]             = useState(0)
  const [flipped, setFlipped]     = useState(false)
  const [mode, setMode]           = useState('menu')
  const [session, setSession]     = useState({ known: 0, forgot: 0, rounds: 0 })
  const [sync, setSync]           = useState('saved')
  const [notice, setNotice]       = useState('')
  const [openQ, setOpenQ]         = useState(null)
  const pendingRef                = useRef(null)
  const PROG_KEY                  = `deca_progress_${user.key}`

  useEffect(() => {
    if (!data) return
    setCards(data)
    try {
      const stored = JSON.parse(localStorage.getItem(PROG_KEY) || '{}')
      setProgress(stored.flashcards || {})
    } catch {}
    getProgress(user.key).then(s => {
      if (!s?.flashcards) return
      // Never let an older server copy erase answers already saved on this device.
      let local = {}
      try { local = JSON.parse(localStorage.getItem(PROG_KEY) || '{}').flashcards || {} } catch {}
      const merged = mergeNewest(local, s.flashcards, 'lastReviewed')
      setProgress(merged)
      try {
        const stored = JSON.parse(localStorage.getItem(PROG_KEY) || '{}')
        stored.flashcards = merged
        localStorage.setItem(PROG_KEY, JSON.stringify(stored))
      } catch {}
    }).catch(() => {})
  }, [data])

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
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', flush) }
  }, [user.key])

  function buildFull(fc) {
    try { const s = JSON.parse(localStorage.getItem(PROG_KEY) || '{}'); return { ...s, flashcards: fc } }
    catch { return { flashcards: fc } }
  }

  async function push(fc) {
    setSync('saving')
    try { await saveProgress(user.key, buildFull(fc)); setSync('saved') }
    catch { setSync('unsaved') }
  }

  const persist = useCallback((newProg) => {
    try {
      const s = JSON.parse(localStorage.getItem(PROG_KEY) || '{}')
      s.flashcards = newProg
      localStorage.setItem(PROG_KEY, JSON.stringify(s))
    } catch {}
    // Save to the server right away after every answer. If it fails, the
    // 30 s timer and the tab-hide beacon retry with the latest progress.
    pendingRef.current = newProg
    push(newProg).then(() => { if (pendingRef.current === newProg) pendingRef.current = null })
  }, [PROG_KEY])

  function chapterCards(ch) {
    return ch === 'All chapters' ? cards : cards.filter(c => c.chapter === ch)
  }

  function poolFor(ch, f, prog) {
    return chapterCards(ch).filter(c => f.includes(statusOf(prog[c.id])))
  }

  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function start() {
    const q = shuffle(poolFor(chapter, filter, progress))
    setQueue(q); setIdx(0); setFlipped(false)
    setSession({ known: 0, forgot: 0, rounds: 1 })
    setMode(q.length === 0 ? 'done' : 'study')
  }

  // Endless study: when the queue runs out, rebuild it from the same filter
  // (cards that no longer match the filter drop out) and keep going.
  function nextRound(newProg) {
    const q = shuffle(poolFor(chapter, filter, newProg))
    if (q.length === 0) { setMode('done'); return }
    setQueue(q); setIdx(0); setFlipped(false)
    setSession(s => ({ ...s, rounds: s.rounds + 1 }))
  }

  function respond(quality) {
    const card = queue[idx]
    const newProg = { ...progress, [card.id]: mark(progress[card.id] || {}, quality) }
    // Mapping: forgetting a card sends every linked exam question to "For review".
    // Flag first (local only), then persist, so one server save carries both.
    if (quality !== 2 && card.questions?.length) {
      flagQuestionsForReview(user.key, card.questions, `card:${card.id}`)
      setNotice(`${card.questions.length} related exam question${card.questions.length > 1 ? 's' : ''} marked for review`)
    } else setNotice('')
    setProgress(newProg)
    persist(newProg)
    setSession(s => ({ ...s, known: s.known + (quality === 2 ? 1 : 0), forgot: s.forgot + (quality === 2 ? 0 : 1) }))
    setOpenQ(null)
    if (idx + 1 >= queue.length) nextRound(newProg)
    else { setIdx(i => i + 1); setFlipped(false) }
  }

  const countBy = (list, st) => list.filter(c => statusOf(progress[c.id]) === st).length
  const qById = {}
  for (const q of (questions || [])) qById[q.id] = q
  const allKnown   = countBy(cards, 'known')
  const chCards    = chapterCards(chapter)
  const chTotal    = chCards.length
  const chKnown    = countBy(chCards, 'known')
  const chForgot   = countBy(chCards, 'forgot')
  const chReview   = countBy(chCards, 'review')
  const chNew      = chTotal - chKnown - chForgot - chReview
  const filterCount = { new: chNew, forgot: chForgot, review: chReview, known: chKnown }
  const startCount = filter.reduce((n, k) => n + filterCount[k], 0)
  const toggleFilter = (k) => setFilter(f => f.includes(k) ? f.filter(x => x !== k) : [...f, k])
  const pct        = queue.length ? Math.round(idx / queue.length * 100) : 0

  const syncColor = sync === 'saved' ? 'bg-secondary' : sync === 'saving' ? 'bg-amber-500' : 'bg-error'
  const syncLabel = sync === 'saved' ? 'Saved' : sync === 'saving' ? 'Saving…' : 'Pending'

  if (mode === 'done') return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 text-center">
      <div className="text-6xl mb-5">🎉</div>
      <h2 className="text-2xl font-black text-on-surface mb-2">Session complete!</h2>
      <p className="text-on-surface-variant text-sm mb-8 max-w-xs">
        {session.known + session.forgot === 0
          ? `No ${filterLabel(filter)} cards left in this chapter. Change the filter to keep going.`
          : `Reviewed ${session.known + session.forgot} cards: ${session.known} known, ${session.forgot} forgot. Nothing left in this filter for now.`}
      </p>
      <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-6">
        <span className={`w-2 h-2 rounded-full ${syncColor}`} />
        Progress {syncLabel.toLowerCase()}
      </div>
      <button onClick={() => setMode('menu')}
        className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl active:scale-95 transition-all">
        ← Back to chapters
      </button>
    </div>
  )

  if (mode === 'study') {
    const card = queue[idx]
    if (!card) return null
    return (
      <div className="min-h-screen bg-surface-container-low flex flex-col">
        {/* Header */}
        <div className="bg-background px-5 pt-12 pb-3 flex items-center justify-between">
          <button onClick={() => setMode('menu')}
            className="flex items-center gap-1.5 text-primary font-bold text-sm active:opacity-70">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary-container/20 rounded-full">
              <span className={`w-2 h-2 rounded-full ${syncColor}`} />
              <span className="text-[11px] font-bold text-on-secondary-container uppercase tracking-wide">{syncLabel}</span>
            </div>
            <span className="text-sm font-bold text-on-surface-variant">{idx + 1} / {queue.length}{session.rounds > 1 ? ` · round ${session.rounds}` : ''}</span>
          </div>
        </div>
        <div className="text-sm text-on-surface-variant px-5 pb-2 bg-background">
          Chapter · {card.chapter}
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-surface-container">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        {/* Chapter selector pill */}
        <div className="px-5 pt-5 pb-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest rounded-full shadow-sm border border-outline-variant/15 active:scale-95 transition-all">
            <span className="text-xs font-bold text-primary tracking-wider uppercase">{card.chapter.split(' ')[0]}</span>
            <span className="material-symbols-outlined text-[16px] text-primary">expand_more</span>
          </button>
        </div>

        {/* Card */}
        <div className="px-5 flex-1">
          <button onClick={() => setFlipped(f => !f)}
            className="w-full rounded-3xl bg-surface-container-lowest shadow-[0px_20px_40px_rgba(26,27,33,0.06)] p-8 flex flex-col items-center justify-between text-center relative overflow-hidden min-h-[320px]">
            {/* Top accent bar */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-primary-container to-secondary opacity-80" />
            {!flipped ? (
              <>
                <div className="space-y-1.5 mt-2">
                  <span className="text-[11px] font-extrabold text-on-surface-variant tracking-[0.15em] uppercase">TERM</span>
                  <div className="w-8 h-0.5 bg-outline-variant/30 mx-auto rounded-full" />
                </div>
                <div className="space-y-3 py-4">
                  <h1 className="text-3xl font-extrabold text-primary tracking-tighter leading-tight">{card.term}</h1>
                  <div className="inline-flex items-center px-3 py-1 bg-primary-fixed rounded-lg">
                    <span className="text-[10px] font-bold text-primary tracking-wide uppercase">{card.chapter}</span>
                  </div>
                  {card.type === 'pi' && <div className="text-[10px] font-bold bg-amber-50 text-amber-800 px-3 py-1 rounded-full">★ PI topic</div>}
                  {card.type === 'trend' && <div className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full">🌐 2025/26 trend</div>}
                  {card.type === 'exam2026' && <div className="text-[10px] font-bold bg-yellow-50 text-yellow-800 px-3 py-1 rounded-full">★ New from 2026 exams</div>}
                  {statusOf(progress[card.id]) === 'review' && <div className="text-[10px] font-bold bg-violet-50 text-violet-800 px-3 py-1 rounded-full">↻ For review: a related question was missed or felt hard</div>}
                </div>
                <p className="text-sm italic text-on-surface-variant/70 font-medium">Tap to reveal definition</p>
              </>
            ) : (
              <>
                <span className="text-[11px] font-extrabold text-on-surface-variant tracking-[0.15em] uppercase mt-2">{card.term}</span>
                <p className="text-[15px] text-on-surface leading-relaxed text-left flex-1 mt-4">{card.definition}</p>

              </>
            )}
          </button>
        </div>

        {/* Stats row */}
        {notice && <p className="px-5 mt-3 text-xs text-center text-violet-800">↻ {notice}</p>}

        <div className="grid grid-cols-4 gap-2 px-5 mt-3">
          {[
            { label: 'Known',  val: chKnown,  color: 'text-secondary' },
            { label: 'Forgot', val: chForgot, color: 'text-error' },
            { label: 'Review', val: chReview, color: 'text-violet-700' },
            { label: 'New',    val: chNew,    color: 'text-on-surface-variant' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-surface-container-low rounded-xl p-2.5 text-center">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${color} mb-1`}>{label}</p>
              <p className="text-lg font-extrabold text-on-surface">{val}</p>
            </div>
          ))}
        </div>

        {/* Response buttons */}
        {flipped && (
          <div className="grid grid-cols-2 gap-3 px-5 mt-3 pb-4">
            <button onClick={() => respond(0)} className="py-4 bg-error-container text-on-error-container rounded-2xl font-bold text-sm active:scale-95 transition-all">Forgot</button>
            <button onClick={() => respond(2)} className="py-4 bg-secondary text-on-secondary rounded-2xl font-bold text-sm shadow-lg shadow-secondary/20 active:scale-95 transition-all">Got it ✓</button>
          </div>
        )}
        {!flipped && <div className="pb-4" />}
        {flipped && card.questions?.length > 0 && (() => {
          const qp = readProgress(user.key).questions || {}
          return (
            <div className="px-5 pb-6">
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-container flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[16px]">edit_note</span>
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">Related exam questions ({card.questions.length})</span>
                </div>
                {card.questions.map(qid => {
                  const q = qById[qid]
                  if (!q) return null
                  const st = questionStatus(qp[qid])
                  const open = openQ === qid
                  return (
                    <button key={qid} onClick={() => setOpenQ(open ? null : qid)}
                      className="w-full text-left px-4 py-3 border-b border-surface-container last:border-0 active:bg-surface-container-low">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-on-surface leading-snug">{q.question}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap
                          ${st === 'easy' ? 'bg-secondary-container/30 text-on-secondary-container' :
                            st === 'incorrect' ? 'bg-error-container/40 text-on-error-container' :
                            st === 'hard' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' :
                            st === 'review' ? 'bg-violet-50 text-violet-800' : 'bg-surface-container text-on-surface-variant'}`}>{st}</span>
                      </div>
                      {open ? (
                        <div className="mt-1.5">
                          <p className="text-[13px] font-semibold text-secondary">Answer: {q.answer}) {q[q.answer]}</p>
                          {q.explanation && <p className="text-[13px] text-on-surface-variant leading-relaxed mt-1">{q.explanation}</p>}
                        </div>
                      ) : <p className="text-[11px] text-outline mt-0.5">Tap to see the answer</p>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>
    )
  }

  // Menu mode
  return (
    <div className="bg-surface-container-low min-h-full pb-4">
      {/* Header */}
      <div className="bg-background px-5 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-on-surface tracking-tight">Flashcards</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">{allKnown} of {cards.length} terms known</p>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-on-surface-variant">
            <span className={`w-2 h-2 rounded-full ${syncColor}`} />
            {syncLabel}
          </div>
        </div>
      </div>

      {/* Chapter selector */}
      <div className="px-5 mt-3">
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-3">Select chapter</p>
          <select value={chapter} onChange={e => setChapter(e.target.value)}
            className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border-0 mb-4">
            {CHAPTERS.map(ch => <option key={ch}>{ch}</option>)}
          </select>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Total',  val: chTotal,  color: 'text-on-surface' },
              { label: 'Known',  val: chKnown,  color: 'text-secondary' },
              { label: 'Forgot', val: chForgot, color: 'text-error' },
              { label: 'Review', val: chReview, color: 'text-violet-700' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-surface-container-low rounded-xl p-2.5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-0.5">{label}</p>
                <p className={`text-xl font-extrabold ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-2">Which cards</p>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {FILTERS.map(f => {
              const active = filter.includes(f.key)
              return (
                <button key={f.key} onClick={() => toggleFilter(f.key)} title={f.hint}
                  className={`rounded-xl py-2.5 text-center transition-all active:scale-95 border
                    ${active ? 'bg-primary text-on-primary border-primary shadow-md shadow-primary/20' : 'bg-surface-container-low text-on-surface border-transparent'}`}>
                  <p className="text-xs font-bold">{f.label}</p>
                  <p className={`text-[11px] font-semibold ${active ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{filterCount[f.key]}</p>
                </button>
              )
            })}
          </div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs text-on-surface-variant">Tap to turn each group on or off. Cards keep coming until you stop. Review = a linked exam question was missed or felt hard.</p>
            <button onClick={() => setFilter(DEFAULT_FILTER)} className="text-xs font-bold text-primary whitespace-nowrap ml-3 active:opacity-70">Reset</button>
          </div>

          <button onClick={start} disabled={startCount === 0}
            className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:shadow-none">
            <span className="material-symbols-outlined sym-filled text-[20px]">play_arrow</span>
            {filter.length === 0 ? 'Pick at least one group' : startCount > 0 ? `Study ${startCount} ${filterLabel(filter)} cards` : 'No cards in this filter'}
          </button>
        </div>
      </div>

      {/* Chapter breakdown (same layout as the Exam tab) */}
      <div className="px-5 mt-4">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-3 mt-1">All chapters</p>
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
          {CHAPTERS.slice(1).map((ch, i) => {
            const chList = cards.filter(c => c.chapter === ch)
            const tot = chList.length
            const kn  = countBy(chList, 'known')
            const fg  = countBy(chList, 'forgot')
            const rv  = countBy(chList, 'review')
            const nw  = tot - kn - fg - rv
            const pKnown  = tot ? (kn / tot * 100) : 0
            const pForgot = tot ? (fg / tot * 100) : 0
            const pReview = tot ? (rv / tot * 100) : 0
            return (
              <button key={ch} onClick={() => setChapter(ch)}
                className={`w-full text-left px-5 py-3.5 active:bg-surface-container-low transition-colors
                  ${chapter === ch ? 'bg-primary/5' : ''} ${i < CHAPTERS.length - 2 ? 'border-b border-surface-container' : ''}`}>
                <div className="flex justify-between items-center mb-1.5 gap-2">
                  <span className="text-sm font-semibold text-on-surface truncate">{ch}</span>
                  <span className="text-xs text-on-surface-variant whitespace-nowrap">
                    <span className="font-semibold text-on-surface">{tot}</span> total
                  </span>
                </div>
                <div className="flex gap-3 text-[11px] text-on-surface-variant mb-1.5">
                  <span><span className="font-semibold text-on-surface">{nw}</span> new</span>
                  <span><span className="font-semibold text-secondary">{kn}</span> known</span>
                  <span><span className="font-semibold text-error">{fg}</span> forgot</span>
                  <span><span className="font-semibold text-violet-700">{rv}</span> review</span>
                </div>
                <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden flex">
                  <div className="h-full bg-secondary" style={{ width: `${pKnown}%` }} />
                  <div className="h-full bg-violet-500" style={{ width: `${pReview}%` }} />
                  <div className="h-full bg-error" style={{ width: `${pForgot}%` }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
