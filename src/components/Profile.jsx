import { useState, useEffect } from 'react'

const AVATAR_COLORS = [
  'bg-blue-600','bg-emerald-600','bg-violet-600','bg-rose-600',
  'bg-amber-600','bg-cyan-600','bg-pink-600','bg-indigo-600'
]
const getAvatarColor = name => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
const initials = name => name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

export default function Profile({ user, onLogout }) {
  const [stats, setStats] = useState({ known:0, examCount:0, examAvg:0, totalPoints:0, streak:0 })
  const [history, setHistory] = useState([])
  const PROG_KEY = `deca_progress_${user.key}`

  useEffect(() => {
    try {
      const prog = JSON.parse(localStorage.getItem(PROG_KEY)||'{}')
      const cards = prog.flashcards || {}
      const known = Object.values(cards).filter(c=>c.status==='known').length
      const exams = prog.exams || []
      const examAvg = exams.length
        ? Math.round(exams.slice(-5).reduce((s,e)=>s+e.pct,0)/Math.min(exams.length,5))
        : 0
      setStats({ known, examCount:exams.length, examAvg, totalPoints:prog.totalPoints||0 })
      setHistory(exams.slice(-5).reverse())
    } catch {}
  }, [])

  const statItems = [
    { label:'Cards known',   val:stats.known,                        icon:'style',     color:'text-primary' },
    { label:'Exams taken',   val:stats.examCount,                    icon:'edit_note',  color:'text-secondary' },
    { label:'Avg score',     val:stats.examAvg>0?`${stats.examAvg}%`:'—', icon:'analytics', color:'text-tertiary-container' },
    { label:'Total points',  val:stats.totalPoints.toLocaleString(), icon:'emoji_events',color:'text-amber-600' },
  ]

  return (
    <div className="bg-surface-container-low min-h-full pb-4">
      {/* Header */}
      <div className="bg-background px-5 pt-12 pb-6">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-5">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-black ${getAvatarColor(user.name)} shadow-lg`}>
            {initials(user.name)}
          </div>
          <div>
            <h1 className="text-xl font-black text-on-surface tracking-tight">{user.name}</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">DECA Finance Scholar</p>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {statItems.map(({ label, val, icon, color }) => (
            <div key={label} className="bg-surface-container-lowest rounded-2xl p-4 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
              <span className={`material-symbols-outlined sym-filled ${color} text-[20px] mb-1 block`}>{icon}</span>
              <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-0.5">{label}</p>
              <p className="text-2xl font-black text-on-surface tracking-tighter">{val}</p>
            </div>
          ))}
        </div>

        {/* Recent exams */}
        {history.length > 0 && (
          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
            <div className="px-5 py-3.5 border-b border-surface-container">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">Recent exams</p>
            </div>
            {history.map((e, i) => (
              <div key={i} className={`px-5 py-3.5 flex items-center gap-3 ${i<history.length-1?'border-b border-surface-container':''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm
                  ${e.pct>=75?'bg-secondary/10 text-secondary':e.pct>=60?'bg-tertiary-container/20 text-tertiary-container':'bg-error-container text-error'}`}>
                  {e.pct}%
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-on-surface">{e.category}</p>
                  <p className="text-xs text-on-surface-variant">{new Date(e.date).toLocaleDateString()} · {e.score}/{e.total}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full
                  ${e.pct>=75?'bg-secondary/10 text-secondary':e.pct>=60?'bg-tertiary-container/10 text-tertiary-container':'bg-error-container/50 text-error'}`}>
                  {e.type==='full'?'Full':'Drill'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* About */}
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
          <div className="px-5 py-3.5 border-b border-surface-container">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">About</p>
          </div>
          {[
            { icon:'menu_book', label:'Study guide',  val:'1,050 terms · 14 chapters' },
            { icon:'quiz',      label:'Question bank', val:'3,200 questions' },
            { icon:'fact_check',label:'PI coverage',  val:'Business Admin Core + Finance' },
          ].map(({ icon, label, val }) => (
            <div key={label} className="px-5 py-3.5 flex items-center gap-3 border-b border-surface-container last:border-0">
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">{icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-on-surface">{label}</p>
                <p className="text-xs text-on-surface-variant">{val}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Sign out */}
        <button onClick={onLogout}
          className="w-full bg-surface-container-lowest border border-error/20 text-error font-semibold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Sign out
        </button>

        <p className="text-center text-[11px] text-outline pb-2">
          DECA Finance Study App · 2025/2026
        </p>
      </div>
    </div>
  )
}
