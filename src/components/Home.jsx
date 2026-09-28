import { useState, useEffect } from 'react'
import { getLeaderboard } from '../lib/storage.js'

const AVATAR_COLORS = [
  'bg-blue-600','bg-emerald-600','bg-violet-600','bg-rose-600',
  'bg-amber-600','bg-cyan-600','bg-pink-600','bg-indigo-600'
]
const getAvatarColor = name => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
const initials = name => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

const TIERS = ['TOP SCHOLAR', 'RISING STAR', 'SCHOLAR', 'STUDENT', 'STUDENT']

function daysUntil(dateStr) {
  const target = new Date(dateStr)
  const now = new Date()
  return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)))
}

export default function Home({ user, onTabChange }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [stats, setStats]             = useState({ known: 0, examAvg: 0, examCount: 0, rank: 0 })
  const [loading, setLoading]         = useState(true)

  // ICDC 2026 approximate date
  const daysToICDC = daysUntil('2026-04-26')
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  useEffect(() => {
    // Local stats
    try {
      const prog = JSON.parse(localStorage.getItem(`deca_progress_${user.key}`) || '{}')
      const cards = prog.flashcards || {}
      const known = Object.values(cards).filter(c => c.status === 'known').length
      const exams = prog.exams || []
      const examAvg = exams.length
        ? Math.round(exams.slice(-5).reduce((s, e) => s + e.pct, 0) / Math.min(exams.length, 5))
        : 0
      setStats(s => ({ ...s, known, examAvg, examCount: exams.length }))
    } catch {}

    getLeaderboard().then(lb => {
      setLeaderboard(lb || [])
      const rank = (lb || []).findIndex(e => e.user === user.name) + 1
      setStats(s => ({ ...s, rank }))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user.key, user.name])

  const statCards = [
    { label: 'CARDS KNOWN',    value: stats.known,     suffix: stats.known > 0 ? '' : '',     color: 'text-on-surface' },
    { label: 'AVG EXAM SCORE', value: stats.examAvg > 0 ? `${stats.examAvg}%` : '—', color: 'text-on-surface' },
    { label: 'EXAMS TAKEN',    value: stats.examCount,  color: 'text-on-surface' },
    { label: 'TEAM RANK',      value: stats.rank > 0 ? `#${stats.rank}` : '—', color: stats.rank === 1 ? 'text-tertiary-container' : 'text-on-surface' },
  ]

  const features = [
    { tab: 'cards',   icon: 'style',      color: 'bg-primary/10 text-primary',    title: 'Flashcards',     sub: '1,324 terms • New, Forgot, Known filters' },
    { tab: 'exam',    icon: 'edit_note',  color: 'bg-secondary/10 text-secondary', title: 'Practice exam',  sub: '3,564 questions • Timed mode' },
    { tab: 'pi',      icon: 'fact_check', color: 'bg-tertiary/10 text-tertiary',   title: 'PI tracker',     sub: 'Coverage map • Shared with team' },
  ]

  return (
    <div className="bg-surface-container-low min-h-full pb-4">
      {/* Top bar */}
      <div className="bg-background px-5 pt-12 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined sym-filled text-white text-[18px]">trending_up</span>
            </div>
            <span className="text-primary font-black text-[15px] tracking-tight">DECA Finance</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary-container/30 rounded-full">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-[11px] font-bold text-on-secondary-container uppercase tracking-wider">Live Sync</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">notifications</span>
          </div>
        </div>

        <div className="mt-5">
          <h1 className="text-[32px] font-black text-on-surface tracking-tighter">
            Hey {user.name.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {today}
            {daysToICDC > 0 && (
              <> • <span className="font-bold text-secondary">{daysToICDC} days to ICDC</span></>
            )}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-3">
        {statCards.map(({ label, value, color }) => (
          <div key={label} className="bg-surface-container-lowest rounded-2xl p-4 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">{label}</p>
            <p className={`text-[28px] font-black tracking-tighter ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Jump In */}
      <div className="px-5 mt-5">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-3">Jump in</p>
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
          {features.map(({ tab, icon, color, title, sub }, i) => (
            <button key={tab} onClick={() => onTabChange(tab)}
              className={`w-full flex items-center gap-4 px-5 py-4 active:bg-surface-container-low transition-colors text-left
                ${i < features.length - 1 ? 'border-b border-surface-container' : ''}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} flex-shrink-0`}>
                <span className="material-symbols-outlined sym-filled text-[20px]">{icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-on-surface text-[15px]">{title}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{sub}</p>
              </div>
              <span className="material-symbols-outlined text-outline-variant text-[20px]">chevron_right</span>
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-5 mt-5">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-3">Team leaderboard</p>
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
          {loading && (
            <div className="py-8 text-center text-sm text-on-surface-variant">Loading...</div>
          )}
          {!loading && leaderboard.length === 0 && (
            <div className="py-8 text-center text-sm text-on-surface-variant px-4">
              No team data yet. Take an exam to appear here!
            </div>
          )}
          {leaderboard.slice(0, 5).map((entry, i) => {
            const isMe = entry.user === user.name
            const rankColors = ['text-amber-500', 'text-slate-400', 'text-amber-700']
            return (
              <div key={entry.user}
                className={`flex items-center gap-3 px-5 py-3.5 ${i < leaderboard.slice(0,5).length - 1 ? 'border-b border-surface-container' : ''}
                  ${isMe ? 'bg-primary/5' : ''}`}>
                <span className={`text-sm font-black w-5 text-center ${rankColors[i] || 'text-outline'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-black flex-shrink-0 ${getAvatarColor(entry.user)}`}>
                  {initials(entry.user)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${isMe ? 'text-primary' : 'text-on-surface'}`}>
                    {entry.user}{isMe ? ' (You)' : ''}
                  </p>
                  {i < 2 && (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{TIERS[i]}</p>
                  )}
                </div>
                <span className="text-sm font-black text-on-surface">{(entry.totalPoints || 0).toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
