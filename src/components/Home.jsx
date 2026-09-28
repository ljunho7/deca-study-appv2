import { useState, useEffect } from 'react'

import { cardStatus, questionStatus as qStatus } from '../lib/review.js'

function daysUntil(dateStr) {
  const target = new Date(dateStr)
  const now = new Date()
  return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)))
}

export default function Home({ user, onTabChange, cards, questions }) {
  const [prog, setProg] = useState({})

  // ICDC 2026 approximate date
  const daysToICDC = daysUntil('2026-04-26')
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  useEffect(() => {
    try { setProg(JSON.parse(localStorage.getItem(`deca_progress_${user.key}`) || '{}')) } catch {}
  }, [user.key])

  const fc = prog.flashcards || {}
  const qp = prog.questions || {}
  const cardList = cards || []
  const qList    = questions || []
  const cKnown  = cardList.filter(c => cardStatus(fc[c.id]) === 'known').length
  const cForgot = cardList.filter(c => cardStatus(fc[c.id]) === 'forgot').length
  const cReview = cardList.filter(c => cardStatus(fc[c.id]) === 'review').length
  const cNew    = cardList.length - cKnown - cForgot - cReview
  const qInc    = qList.filter(q => qStatus(qp[q.id]) === 'incorrect').length
  const qHard   = qList.filter(q => qStatus(qp[q.id]) === 'hard').length
  const qEasy   = qList.filter(q => qStatus(qp[q.id]) === 'easy').length
  const qRev    = qList.filter(q => qStatus(qp[q.id]) === 'review').length
  const qNew    = qList.length - qInc - qHard - qEasy - qRev
  const pctOf   = (n, t) => t ? (n / t * 100) : 0

  const dashboards = [
    {
      tab: 'cards', icon: 'style', title: 'Cards', total: cardList.length,
      segments: [
        { label: 'known',  val: cKnown,  bar: 'bg-secondary', text: 'text-secondary' },
        { label: 'review', val: cReview, bar: 'bg-violet-500', text: 'text-violet-700' },
        { label: 'forgot', val: cForgot, bar: 'bg-error',     text: 'text-error' },
      ],
      newVal: cNew,
    },
    {
      tab: 'exam', icon: 'edit_note', title: 'Exam', total: qList.length,
      segments: [
        { label: 'easy',      val: qEasy, bar: 'bg-secondary',         text: 'text-secondary' },
        { label: 'hard',      val: qHard, bar: 'bg-tertiary-container', text: 'text-tertiary-container' },
        { label: 'review',    val: qRev,  bar: 'bg-violet-500',         text: 'text-violet-700' },
        { label: 'incorrect', val: qInc,  bar: 'bg-error',             text: 'text-error' },
      ],
      newVal: qNew,
    },
  ]

  const features = [
    { tab: 'cards',   icon: 'style',      color: 'bg-primary/10 text-primary',    title: 'Flashcards',     sub: `${(cards || []).length.toLocaleString()} terms • linked to exam questions` },
    { tab: 'exam',    icon: 'edit_note',  color: 'bg-secondary/10 text-secondary', title: 'Practice exam',  sub: `${(questions || []).length.toLocaleString()} questions • linked to flashcards` },
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

      {/* Progress dashboards */}
      <div className="px-5 mt-4 space-y-3">
        {dashboards.map(d => {
          const done = d.total - d.newVal
          return (
            <button key={d.tab} onClick={() => onTabChange(d.tab)}
              className="w-full text-left bg-surface-container-lowest rounded-2xl p-4 shadow-[0px_2px_8px_rgba(26,27,33,0.04)] active:bg-surface-container-low transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined sym-filled text-primary text-[20px]">{d.icon}</span>
                  <span className="text-[15px] font-black text-on-surface">{d.title}</span>
                </div>
                <span className="text-xs text-on-surface-variant">
                  <span className="font-bold text-on-surface">{done.toLocaleString()}</span> of {d.total.toLocaleString()} done
                </span>
              </div>
              <div className={`grid gap-1.5 mb-3 ${d.segments.length === 3 ? 'grid-cols-4' : 'grid-cols-5'}`}>
                {[
                  { label: 'new',   val: d.newVal, text: 'text-on-surface-variant' },
                  ...d.segments,
                ].map(({ label, val, text }) => (
                  <div key={label} className="bg-surface-container-low rounded-xl py-2 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-outline mb-0.5">{label}</p>
                    <p className={`text-base font-extrabold ${text}`}>{val.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden flex">
                {d.segments.map(sg => (
                  <div key={sg.label} className={`h-full ${sg.bar}`} style={{ width: `${pctOf(sg.val, d.total)}%` }} />
                ))}
              </div>
            </button>
          )
        })}
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

    </div>
  )
}
