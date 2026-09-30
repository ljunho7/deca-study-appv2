import { useState, useEffect, useMemo } from 'react'
import Study from './Study.jsx'
import Test from './Test.jsx'
import Results from './Results.jsx'
import { readAttempts, attemptsFor, bestScore } from '../lib/attempts.js'
import { setReportContext } from '../lib/report.js'

// Role Play tab (desktop only): the library, then Self study (everything
// visible, AI coach) or Test (timed, recorded, scored; no AI help).

const scoreTone = (n) => n == null ? 'bg-surface-container text-on-surface-variant' : n >= 75 ? 'bg-secondary/15 text-secondary' : n >= 60 ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-error-container text-on-error-container'

export default function RolePlay({ user, cards }) {
  const [index, setIndex] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState({ screen: 'library' })   // library | study | test | results
  const [rp, setRp] = useState(null)
  const [attempts, setAttempts] = useState(() => readAttempts(user.key))
  const [filters, setFilters] = useState({ kind: 'all', level: 'all', area: 'all', status: 'all', q: '' })
  const [open, setOpen] = useState(null)
  const [testKey, setTestKey] = useState(0)

  const cardsById = useMemo(() => Object.fromEntries((cards || []).map(c => [c.id, c])), [cards])

  useEffect(() => {
    fetch('/roleplays/index.json').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => setIndex(d.roleplays)).catch(e => setLoadError(e.message))
  }, [])
  useEffect(() => { if (view.screen === 'library') { setAttempts(readAttempts(user.key)); setReportContext({ screen: 'roleplay', item: null }) } }, [view.screen])
  useEffect(() => { if (view.screen === 'study' && rp) setReportContext({ screen: 'roleplay-study', item: rp.rp_id }) }, [view.screen, rp?.rp_id])

  async function openRp(id, screen, extra = {}) {
    try {
      const full = rp?.rp_id === id ? rp : await fetch(`/roleplays/${id}.json`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      setRp(full); setAttempts(readAttempts(user.key)); setView({ screen, ...extra })
    } catch (e) { alert(`Could not open this role play (${e.message}).`) }
  }
  const leaveTest = (why) => {
    if (why === 'retest') { setTestKey(k => k + 1); setView({ screen: 'test' }); return }
    setView({ screen: 'library' })
  }

  if (view.screen === 'study' && rp) {
    const latest = attemptsFor(attempts, rp.rp_id)[0]
    return <Study user={user} rp={rp} latestAttempt={latest} cardsById={cardsById} onBack={() => setView({ screen: 'library' })} onTest={() => { setTestKey(k => k + 1); setView({ screen: 'test' }) }} />
  }
  if (view.screen === 'test' && rp) {
    return <Test key={testKey} user={user} rp={rp} cardsById={cardsById} onExit={leaveTest} onStudy={() => { setAttempts(readAttempts(user.key)); setView({ screen: 'study' }) }} />
  }
  if (view.screen === 'results' && rp && view.attempt) {
    return <Results user={user} rp={rp} attempt={view.attempt} cardsById={cardsById} onBack={() => setView({ screen: 'library' })}
      onStudy={() => setView({ screen: 'study' })} onRetry={() => { setTestKey(k => k + 1); setView({ screen: 'test' }) }} />
  }

  // ── Library ───────────────────────────────────────────────────────────
  const list = index || []
  const levels = [...new Set(list.map(r => r.level))]
  const areas = [...new Set(list.map(r => r.area))].sort()
  const q = filters.q.trim().toLowerCase()
  const shown = list.filter(r =>
    (filters.kind === 'all' || r.kind === filters.kind) &&
    (filters.level === 'all' || r.level === filters.level) &&
    (filters.area === 'all' || r.area === filters.area) &&
    (filters.status === 'all' || (filters.status === 'tried') === attemptsFor(attempts, r.rp_id).length > 0) &&
    (!q || `${r.title} ${r.rp_id} ${r.pis.join(' ')}`.toLowerCase().includes(q)))
  const set = (k) => (e) => setFilters(f => ({ ...f, [k]: e.target.value }))
  const Select = ({ k, children }) => (
    <select value={filters[k]} onChange={set(k)} className="bg-surface-container-lowest rounded-xl border-outline-variant/50 text-sm py-2 pl-3 pr-8 focus:ring-primary focus:border-primary">{children}</select>
  )
  const tried = list.filter(r => attemptsFor(attempts, r.rp_id).length).length

  return (
    <div className="px-10 pt-10 pb-12">
      <div className="flex items-end justify-between pr-12">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tight">Role Play</h1>
          <p className="text-sm text-on-surface-variant mt-1">ACT (Accounting Applications Series) · {list.length} role plays · {tried} tried</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
        <div className="bg-surface-container-lowest rounded-2xl p-4 flex gap-3 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
          <span className="material-symbols-outlined text-secondary">menu_book</span>
          <p><b>Self study:</b> read everything, including the judge's key and solution, and ask the AI coach.</p>
        </div>
        <div className="bg-surface-container-lowest rounded-2xl p-4 flex gap-3 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
          <span className="material-symbols-outlined text-primary">timer</span>
          <p><b>Test:</b> 10 minutes to prepare, up to 10 minutes to present out loud with judge questions, then a score out of 100.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-6">
        <input value={filters.q} onChange={set('q')} placeholder="Search title or PI" className="bg-surface-container-lowest rounded-xl border-outline-variant/50 text-sm py-2 px-3 w-56 focus:ring-primary focus:border-primary" />
        <Select k="kind"><option value="all">Official and practice</option><option value="official">Official</option><option value="practice">Practice (new scenarios)</option></Select>
        <Select k="level"><option value="all">All levels</option>{levels.map(l => <option key={l}>{l}</option>)}</Select>
        <Select k="area"><option value="all">All instructional areas</option>{areas.map(a => <option key={a}>{a}</option>)}</Select>
        <Select k="status"><option value="all">Tried and not tried</option><option value="untried">Not tried yet</option><option value="tried">Tried</option></Select>
        <span className="text-xs text-on-surface-variant ml-1">{shown.length} shown</span>
      </div>

      {loadError && <p className="mt-6 text-sm text-error">Could not load the role plays ({loadError}).</p>}
      {!index && !loadError && <p className="mt-6 text-sm text-on-surface-variant">Loading role plays…</p>}

      <div className="mt-4 bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
        {shown.map((r, i) => {
          const mine = attemptsFor(attempts, r.rp_id), best = bestScore(attempts, r.rp_id)
          return (
            <div key={r.rp_id} className={`px-5 py-4 ${i ? 'border-t border-surface-container' : ''}`}>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${scoreTone(best)}`} title="Best score">
                  <span className="text-lg font-black leading-none">{best ?? '–'}</span>
                  <span className="text-[9px] font-bold uppercase mt-0.5">{best == null ? 'not tried' : 'best'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    <span className={r.kind === 'official' ? 'text-primary' : 'text-secondary'}>{r.kind === 'official' ? 'Official' : 'Practice'}</span>
                    {' · '}{r.level}{r.year ? ` ${r.year}` : ''}{r.event ? ` · ${r.event}` : ''} · {r.area}{r.difficulty ? ` · difficulty ${r.difficulty}/5` : ''}
                  </p>
                  <p className="text-[15px] font-bold text-on-surface leading-snug mt-0.5">{r.title}</p>
                  {mine.length > 0 && (
                    <button onClick={() => setOpen(open === r.rp_id ? null : r.rp_id)} className="text-xs font-semibold text-primary mt-1">
                      {mine.length} attempt{mine.length > 1 ? 's' : ''} {open === r.rp_id ? '▲' : '▼'}
                    </button>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openRp(r.rp_id, 'study')} className="border border-outline-variant font-bold text-sm px-3.5 py-2 rounded-xl flex items-center gap-1 hover:bg-surface-container-low"><span className="material-symbols-outlined text-[18px]">menu_book</span>Self study</button>
                  <button onClick={() => { setTestKey(k => k + 1); openRp(r.rp_id, 'test') }} className="bg-primary text-on-primary font-bold text-sm px-3.5 py-2 rounded-xl flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">timer</span>Test</button>
                </div>
              </div>
              {open === r.rp_id && (
                <div className="mt-3 ml-[72px] space-y-1">
                  {mine.map(a => (
                    <button key={a.id} onClick={() => openRp(r.rp_id, 'results', { attempt: a })} className="w-full flex items-center justify-between text-sm px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container">
                      <span>{new Date(a.at).toLocaleString()} · {a.judgeMode === 'ai' ? 'AI judge' : 'official questions'}</span>
                      <span className="font-bold">{a.grade ? `${a.grade.total}/100` : 'not scored yet'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {index && shown.length === 0 && <p className="px-5 py-6 text-sm text-on-surface-variant">No role plays match these filters.</p>}
      </div>
    </div>
  )
}
