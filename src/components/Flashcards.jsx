import { useState, useEffect, useCallback, useRef } from 'react'
import { saveProgress, getProgress } from '../lib/storage.js'

function nextReview(card, quality) {
  const now = Date.now()
  let interval = card.interval || 1
  let ease = card.ease || 2.5
  if (quality === 0) { interval = 1; ease = Math.max(1.3, ease - 0.2) }
  else if (quality === 1) { interval = Math.max(1, Math.round(interval * 1.2)) }
  else { interval = Math.round(interval * ease); ease = Math.min(3.0, ease + 0.1) }
  return {
    status: quality < 2 ? 'learning' : 'known',
    nextReview: now + interval * 86400000,
    interval, ease,
    reviews: (card.reviews || 0) + 1,
  }
}

const CHAPTERS = [
  'All chapters', 'Financial Analysis', 'Financial-Information Management',
  'Risk Management', 'Professional Development', 'Emotional Intelligence',
  'Communications', 'Economics', 'Business Law', 'Information Management',
  'Operations', 'Customer Relations', 'Human Resources Management',
  'Marketing & Strategy', 'PI & 2025 Updates',
]

export default function Flashcards({ user, data }) {
  const [cards, setCards]         = useState([])
  const [progress, setProgress]   = useState({})
  const [chapter, setChapter]     = useState('All chapters')
  const [queue, setQueue]         = useState([])
  const [idx, setIdx]             = useState(0)
  const [flipped, setFlipped]     = useState(false)
  const [mode, setMode]           = useState('menu')
  const [session, setSession]     = useState({ known: 0, total: 0 })
  const [sync, setSync]           = useState('saved')
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
      if (s?.flashcards) {
        setProgress(s.flashcards)
        try {
          const stored = JSON.parse(localStorage.getItem(PROG_KEY) || '{}')
          stored.flashcards = s.flashcards
          localStorage.setItem(PROG_KEY, JSON.stringify(stored))
        } catch {}
      }
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
    pendingRef.current = newProg
    setSync('unsaved')
    clearTimeout(pendingRef._t)
    pendingRef._t = setTimeout(() => {
      if (pendingRef.current) { push(pendingRef.current); pendingRef.current = null }
    }, 3000)
  }, [PROG_KEY])

  function buildQueue(ch) {
    const filtered = ch === 'All chapters' ? cards : cards.filter(c => c.chapter === ch)
    const now = Date.now()
    const due = filtered.filter(c => progress[c.id] && progress[c.id].status !== 'known' && (progress[c.id].nextReview || 0) <= now)
    const newCards = filtered.filter(c => !progress[c.id])
    const combined = [...due, ...newCards].slice(0, 50)
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]]
    }
    return combined
  }

  function start() {
    const q = buildQueue(chapter)
    setQueue(q); setIdx(0); setFlipped(false)
    setSession({ known: 0, total: q.length })
    setMode(q.length === 0 ? 'done' : 'study')
  }

  function respond(quality) {
    const card = queue[idx]
    const newProg = { ...progress, [card.id]: nextReview(progress[card.id] || {}, quality) }
    setProgress(newProg)
    persist(newProg)
    setSession(s => ({ ...s, known: s.known + (quality === 2 ? 1 : 0) }))
    if (idx + 1 >= queue.length) setMode('done')
    else { setIdx(i => i + 1); setFlipped(false) }
  }

  const totalKnown = Object.values(progress).filter(c => c.status === 'known').length
  const chTotal    = chapter === 'All chapters' ? cards.length : cards.filter(c => c.chapter === chapter).length
  const dueCount   = buildQueue(chapter).length
  const pct        = queue.length ? Math.round(idx / queue.length * 100) : 0

  const syncColor = sync === 'saved' ? 'bg-secondary' : sync === 'saving' ? 'bg-amber-500' : 'bg-error'
  const syncLabel = sync === 'saved' ? 'Saved' : sync === 'saving' ? 'Saving…' : 'Pending'

  if (mode === 'done') return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 text-center">
      <div className="text-6xl mb-5">🎉</div>
      <h2 className="text-2xl font-black text-on-surface mb-2">Session complete!</h2>
      <p className="text-on-surface-variant text-sm mb-8 max-w-xs">
        {session.total === 0
          ? "You're all caught up! Come back tomorrow for more due cards."
          : `Reviewed ${session.total} cards — ${session.known} known.`}
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
            <span className="text-sm font-bold text-on-surface-variant">{idx + 1} / {queue.length}</span>
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
        <div className="grid grid-cols-3 gap-3 px-5 mt-4">
          {[
            { label: 'Known',  val: Object.values(progress).filter(c=>c.status==='known').length, color: 'text-secondary' },
            { label: 'Review', val: Object.values(progress).filter(c=>c.status==='learning').length, color: 'text-tertiary-container' },
            { label: 'New',    val: cards.length - Object.keys(progress).length, color: 'text-on-surface-variant' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-surface-container-low rounded-xl p-3 text-center">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${color} mb-1`}>{label}</p>
              <p className="text-lg font-extrabold text-on-surface">{val}</p>
            </div>
          ))}
        </div>

        {/* Response buttons */}
        {flipped && (
          <div className="grid grid-cols-3 gap-3 px-5 mt-3 pb-4">
            <button onClick={() => respond(0)} className="py-4 bg-error-container text-on-error-container rounded-2xl font-bold text-sm active:scale-95 transition-all">Forgot</button>
            <button onClick={() => respond(1)} className="py-4 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-2xl font-bold text-sm active:scale-95 transition-all">Hard</button>
            <button onClick={() => respond(2)} className="py-4 bg-secondary text-on-secondary rounded-2xl font-bold text-sm shadow-lg shadow-secondary/20 active:scale-95 transition-all">Got it ✓</button>
          </div>
        )}
        {!flipped && <div className="pb-4" />}
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
            <p className="text-sm text-on-surface-variant mt-0.5">{totalKnown} of {cards.length} terms known</p>
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
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Total', val: chTotal, color: 'text-on-surface' },
              { label: 'Due',   val: dueCount, color: 'text-tertiary-container' },
              { label: 'Known', val: totalKnown, color: 'text-secondary' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-surface-container-low rounded-xl p-2.5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-0.5">{label}</p>
                <p className={`text-xl font-extrabold ${color}`}>{val}</p>
              </div>
            ))}
          </div>
          <button onClick={start}
            className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined sym-filled text-[20px]">play_arrow</span>
            {dueCount > 0 ? `Study ${dueCount} due cards` : 'Study new cards'}
          </button>
        </div>
      </div>

      {/* Chapter breakdown */}
      <div className="px-5 mt-4">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-3">All chapters</p>
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
          {CHAPTERS.slice(1).map((ch, i) => {
            const tot = cards.filter(c => c.chapter === ch).length
            const kn  = cards.filter(c => c.chapter === ch && progress[c.id]?.status === 'known').length
            const p   = tot > 0 ? Math.round(kn / tot * 100) : 0
            const barColor = p > 70 ? 'bg-secondary' : p > 40 ? 'bg-tertiary-container' : 'bg-error'
            return (
              <button key={ch} onClick={() => setChapter(ch)}
                className={`w-full text-left px-5 py-3.5 active:bg-surface-container-low transition-colors
                  ${i < CHAPTERS.slice(1).length - 1 ? 'border-b border-surface-container' : ''}`}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-semibold text-on-surface">{ch}</span>
                  <span className="text-xs text-on-surface-variant">{kn}/{tot}</span>
                </div>
                <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                  <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${p}%` }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
