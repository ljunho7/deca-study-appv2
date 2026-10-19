import { useState, useEffect, useMemo } from 'react'
import { saveProgress } from '../lib/storage.js'
import { setReportContext } from '../lib/report.js'
import { loadRpCards, FREQ, rpStatus, evidenceText } from './rpcardsData.js'

// Cards for RP (desktop): role play concept cards for the 2026-27 regional
// instructional areas (Financial Analysis, Professional Development).
// Front: the term. Back: the short line to memorize (and formula). Below the
// card after flipping: the detailed explanation and past role play examples.
// Progress: progress.rpcards[id] = { status: known | forgot, reviews, lastReviewed },
// merged like flashcards (newest per card wins). Sets end after the last card.

const AREAS = ['Financial Analysis', 'Professional Development']
const STATUSES = [['new', 'New'], ['forgot', 'Forgot'], ['known', 'Known']]
const progKey = (u) => `deca_progress_${u}`
const readRp = (u) => { try { return JSON.parse(localStorage.getItem(progKey(u)) || '{}').rpcards || {} } catch { return {} } }
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

const Chip = ({ on, onClick, title, sub, cls = '' }) => (
  <button onClick={onClick} aria-pressed={on}
    className={`rounded-xl py-2 px-3 text-center transition-all active:scale-95 border ${on ? 'bg-primary text-on-primary border-primary shadow-md shadow-primary/20' : 'bg-surface-container-low text-on-surface border-transparent'} ${cls}`}>
    <p className="text-xs font-bold">{title}</p>
    {sub != null && <p className={`text-[11px] font-semibold ${on ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{sub}</p>}
  </button>
)
const Stars = ({ n }) => <span className="text-amber-500 tracking-tight" title={FREQ[n]?.hint}>{FREQ[n]?.stars}</span>

export default function RpCards({ user, onOpenRolePlay }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [prog, setProg] = useState(() => readRp(user.key))
  const [areas, setAreas] = useState(AREAS)
  const [freqs, setFreqs] = useState([3, 2, 1])
  const [statuses, setStatuses] = useState(['new', 'forgot'])
  const [group, setGroup] = useState('All groups')
  const [mode, setMode] = useState('menu')          // menu | study | done
  const [queue, setQueue] = useState([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [session, setSession] = useState({ known: 0, forgot: 0 })
  const [sync, setSync] = useState('saved')

  useEffect(() => { loadRpCards().then(setData).catch(e => setError(e.message)) }, [])
  const card = mode === 'study' ? queue[idx] : null
  useEffect(() => {
    setReportContext({ screen: 'rpcards', item: card ? `rpcard ${card.id}` : null, view: card ? { flipped } : null })
  }, [card?.id, flipped])

  const toggle = (list, set, v) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])
  const all = data?.cards || []
  const inArea = all.filter(c => areas.includes(c.area))
  const groups = useMemo(() => [...new Set(inArea.map(c => c.group))].sort(), [data, areas])
  const scope = inArea.filter(c => group === 'All groups' || c.group === group)
  const count = (pred) => scope.filter(pred).length
  const pool = scope.filter(c => freqs.includes(c.frequency) && statuses.includes(rpStatus(prog[c.id])))

  function start() {
    const q = shuffle(pool)
    setQueue(q); setIdx(0); setFlipped(false); setSession({ known: 0, forgot: 0 })
    setMode(q.length ? 'study' : 'done')
  }

  async function answer(known) {
    const prev = prog[card.id] || {}
    const next = { ...prog, [card.id]: { status: known ? 'known' : 'forgot', reviews: (prev.reviews || 0) + 1, lastReviewed: Date.now() } }
    setProg(next)
    // Same record as the other tabs: write locally, then save to the server.
    let full = {}
    try { full = JSON.parse(localStorage.getItem(progKey(user.key)) || '{}') } catch {}
    full.rpcards = next
    try { localStorage.setItem(progKey(user.key), JSON.stringify(full)) } catch {}
    setSync('saving')
    saveProgress(user.key, full).then(() => setSync('saved')).catch(() => setSync('unsaved'))
    setSession(s => ({ known: s.known + (known ? 1 : 0), forgot: s.forgot + (known ? 0 : 1) }))
    if (idx + 1 >= queue.length) setMode('done')
    else { setIdx(i => i + 1); setFlipped(false) }
  }

  const syncDot = sync === 'saved' ? 'bg-secondary' : sync === 'saving' ? 'bg-amber-500' : 'bg-error'
  const syncLabel = sync === 'saved' ? 'Saved' : sync === 'saving' ? 'Saving…' : 'Not saved to server'

  if (error) return <p className="px-10 pt-12 text-sm text-error">Could not load Cards for RP ({error}).</p>
  if (!data) return <p className="px-10 pt-12 text-sm text-on-surface-variant">Loading…</p>
  if (!all.length) return <p className="px-10 pt-12 text-sm text-on-surface-variant">No cards yet.</p>

  // ── Done ──────────────────────────────────────────────────────────────
  if (mode === 'done') return (
    <div className="px-8 pt-16 pb-10 text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-2xl font-black text-on-surface">Set complete</h2>
      <p className="text-sm text-on-surface-variant mt-2">
        {session.known + session.forgot === 0 ? 'No cards match these filters.' : `${session.known + session.forgot} cards: ${session.known} known, ${session.forgot} forgot.`}
      </p>
      <button onClick={() => { setMode('menu'); setProg(readRp(user.key)) }} className="mt-8 bg-primary text-on-primary font-bold px-6 py-3.5 rounded-xl">Back to Cards for RP</button>
    </div>
  )

  // ── Study ─────────────────────────────────────────────────────────────
  if (mode === 'study' && card) return (
    <div className="pt-12 pb-10">
      <div className="flex items-center justify-between mb-3 pr-12">
        <button onClick={() => { setMode('menu'); setProg(readRp(user.key)) }} className="flex items-center gap-1 text-primary font-bold text-sm"><span className="material-symbols-outlined text-[20px]">arrow_back</span>Back</button>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-on-surface-variant"><span className={`w-2 h-2 rounded-full ${syncDot}`} />{syncLabel}</span>
          <span className="font-bold text-on-surface-variant">{idx + 1} / {queue.length}</span>
        </div>
      </div>
      <div className="h-1 bg-surface-container rounded-full overflow-hidden mb-4"><div className="h-full bg-secondary" style={{ width: `${idx / queue.length * 100}%` }} /></div>

      <button onClick={() => setFlipped(f => !f)}
        className="w-full rounded-3xl bg-surface-container-lowest shadow-[0px_20px_40px_rgba(26,27,33,0.06)] p-8 text-center relative overflow-hidden min-h-[300px] flex flex-col items-center justify-center">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-primary-container to-secondary opacity-80" />
        <div className="absolute top-4 left-5 right-5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
          <span>{card.area} · {card.group}</span>
          <span className="flex items-center gap-1 normal-case"><Stars n={card.frequency} />{FREQ[card.frequency]?.label}</span>
        </div>
        {!flipped ? (
          <>
            <h1 className="text-3xl font-extrabold text-primary tracking-tight leading-tight mt-6">{card.term}</h1>
            <p className="text-sm italic text-on-surface-variant/70 mt-8">Tap to reveal</p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-extrabold text-on-surface-variant tracking-[0.15em] uppercase mt-6">{card.term}</p>
            <p className="text-xl font-bold text-on-surface leading-snug mt-4 max-w-xl">{card.core}</p>
            {card.formula && <p className="mt-4 bg-primary/5 text-primary font-semibold rounded-xl px-4 py-2 text-[15px]">{card.formula}</p>}
          </>
        )}
      </button>

      {flipped && (
        <>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={() => answer(false)} className="py-4 bg-error-container text-on-error-container font-bold rounded-2xl active:scale-95">Forgot</button>
            <button onClick={() => answer(true)} className="py-4 bg-secondary text-on-secondary font-bold rounded-2xl active:scale-95 shadow-lg shadow-secondary/20">Got it ✓</button>
          </div>

          <div className="mt-5 bg-surface-container-lowest rounded-2xl p-5 shadow-[0px_2px_8px_rgba(26,27,33,0.04)] space-y-4 text-left">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-1.5">In detail</p>
              <p className="text-[15px] leading-relaxed">{card.detail}</p>
            </div>
            {card.example && <div><p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-1.5">Example</p><p className="text-sm leading-relaxed">{card.example}</p></div>}
            {card.say_it && <div className="bg-primary/5 rounded-xl p-3"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-primary mb-1">Say it to the judge</p><p className="text-sm italic">"{card.say_it}"</p></div>}
            {card.mistakes && <div className="bg-error-container/30 rounded-xl p-3"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-error-container mb-1">Common mistake</p><p className="text-sm">{card.mistakes}</p></div>}
            {card.pis?.length > 0 && (
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-1.5">Performance indicators</p>
                <ul className="text-sm space-y-0.5">{card.pis.map(p => <li key={p.code}><span className="font-semibold text-on-surface-variant">{p.code}</span> {p.text || ''}</li>)}</ul>
              </div>
            )}
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-1.5">Past role play examples</p>
              {card.examples?.length ? (
                <div className="space-y-1.5">
                  {card.examples.map(x => (
                    <button key={x.rp_id} onClick={() => onOpenRolePlay?.(x.rp_id)} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container">
                      <span className={`text-[10px] font-bold uppercase ${x.kind === 'official' ? 'text-primary' : 'text-secondary'}`}>{x.kind === 'official' ? 'Official' : 'Practice'}</span>
                      <span className="flex-1 text-sm truncate">{x.title}</span>
                      <span className="text-[11px] text-on-surface-variant whitespace-nowrap">{x.level}{x.year ? ` ${x.year}` : ''}</span>
                      <span className="material-symbols-outlined text-[18px] text-primary">open_in_new</span>
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-on-surface-variant">Not used in a past role play yet; it is on the 2026-27 PI list.</p>}
              <p className="text-[11px] text-outline mt-2">Frequency {card.frequency}: {evidenceText(card)}.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )

  // ── Menu ──────────────────────────────────────────────────────────────
  const known = all.filter(c => rpStatus(prog[c.id]) === 'known').length
  return (
    <div className="pt-12 pb-10">
      <div className="flex items-end justify-between pr-12">
        <div>
          <h1 className="text-2xl font-black text-on-surface tracking-tight">Cards for RP</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{all.length} role play concepts for 2026-27 regionals (Financial Analysis, Professional Development) · {known} known</p>
        </div>
      </div>

      <div className="mt-5 bg-surface-container-lowest rounded-2xl p-4 shadow-[0px_2px_8px_rgba(26,27,33,0.04)] space-y-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-2">Instructional area</p>
          <div className="grid grid-cols-2 gap-2">
            {AREAS.map(a => <Chip key={a} on={areas.includes(a)} onClick={() => { toggle(areas, setAreas, a); setGroup('All groups') }} title={a} sub={all.filter(c => c.area === a).length} />)}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-2">Frequency</p>
          <div className="grid grid-cols-3 gap-2">
            {[3, 2, 1].map(n => <Chip key={n} on={freqs.includes(n)} onClick={() => toggle(freqs, setFreqs, n)} title={`${FREQ[n].stars} ${FREQ[n].label}`} sub={count(c => c.frequency === n)} />)}
          </div>
          <p className="text-xs text-on-surface-variant mt-1.5">★★★ core: used in 3 or more official role plays (or a foundational idea that official role plays use); ★★ used in a past role play, in several practice scenarios, or its PI was tested more than once; ★ on the 2026-27 PI list but rarely used so far.</p>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-2">Which cards</p>
          <div className="grid grid-cols-3 gap-2">
            {STATUSES.map(([k, t]) => <Chip key={k} on={statuses.includes(k)} onClick={() => toggle(statuses, setStatuses, k)} title={t} sub={count(c => rpStatus(prog[c.id]) === k)} />)}
          </div>
        </div>
        <button onClick={start} disabled={!pool.length}
          className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-40 disabled:shadow-none">
          <span className="material-symbols-outlined sym-filled text-[20px]">play_arrow</span>
          {pool.length ? `Study ${pool.length} cards${group !== 'All groups' ? ` in ${group}` : ''}` : 'No cards match these filters'}
        </button>
      </div>

      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mt-6 mb-3">Topic groups</p>
      <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
        {['All groups', ...groups].map((g, i) => {
          const list = g === 'All groups' ? inArea : inArea.filter(c => c.group === g)
          const kn = list.filter(c => rpStatus(prog[c.id]) === 'known').length
          const fg = list.filter(c => rpStatus(prog[c.id]) === 'forgot').length
          const core = list.filter(c => c.frequency === 3).length
          return (
            <button key={g} onClick={() => setGroup(g)}
              className={`w-full text-left px-5 py-3 ${i ? 'border-t border-surface-container' : ''} ${group === g ? 'bg-primary/5' : ''} hover:bg-surface-container-low`}>
              <div className="flex justify-between items-center gap-2">
                <span className={`text-sm font-semibold truncate ${group === g ? 'text-primary' : 'text-on-surface'}`}>{g}</span>
                <span className="text-xs text-on-surface-variant whitespace-nowrap"><span className="font-semibold text-on-surface">{list.length}</span> cards · <span className="text-amber-600">★★★ {core}</span></span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5"><span className="text-secondary font-semibold">{kn}</span> known · <span className="text-error font-semibold">{fg}</span> forgot · {list.length - kn - fg} new</p>
              <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden flex mt-1.5">
                <div className="h-full bg-secondary" style={{ width: `${list.length ? kn / list.length * 100 : 0}%` }} />
                <div className="h-full bg-error" style={{ width: `${list.length ? fg / list.length * 100 : 0}%` }} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
