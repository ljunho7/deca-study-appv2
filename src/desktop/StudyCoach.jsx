import { useState, useEffect, useMemo } from 'react'
import ChatPanel from './ChatPanel.jsx'
import { rpCall } from './services.js'
import { onReportContext } from '../lib/report.js'
import { loadRpCards } from './rpcardsData.js'

// AI coach beside the Cards and Exam tabs (desktop only). It follows the card
// or question on screen through the bug report context, which those screens
// already set ("card <id> (<term>)" / "question <id>"), so the phone screens
// need no changes. One conversation per tab, kept on this device.

export default function StudyCoach({ user, kind, cards, questions, onCollapse }) {
  const [item, setItem] = useState(null)   // { type: 'card' | 'question' | 'rpcard', id, flipped }
  useEffect(() => onReportContext(ctx => {
    const r = /^rpcard (\S+)/.exec(ctx.item || '')
    if (r) return setItem({ type: 'rpcard', id: r[1], flipped: !!ctx.view?.flipped })
    // Main bank ids are numbers; New cards / New exam ids are strings (NF27-C001).
    const m = /^(card|question) (\d+|NF\d+-[CQ]\d+)/.exec(ctx.item || '')
    setItem(m ? { type: m[1], id: /^\d+$/.test(m[2]) ? Number(m[2]) : m[2] } : null)
  }), [])
  // Cards for RP content (only loaded on that tab)
  const [rp, setRp] = useState(null)
  useEffect(() => { if (kind === 'rpcards') loadRpCards().then(setRp).catch(() => {}) }, [kind])

  const cardById = useMemo(() => new Map((cards || []).map(c => [c.id, c])), [cards])
  const qById = useMemo(() => new Map((questions || []).map(q => [q.id, q])), [questions])

  // What the coach is told about the item on screen.
  const current = useMemo(() => {
    if (item?.type === 'rpcard') {
      const c = rp?.byId.get(item.id)
      if (!c) return null
      // Only what is on screen: the term until the card is flipped; then the
      // short line, formula, details and the past role play examples below it.
      const payload = { type: 'role play concept card', term: c.term, area: c.area, group: c.group, frequency: c.frequency }
      if (item.flipped) Object.assign(payload, {
        core: c.core, formula: c.formula, detail: c.detail, example: c.example, say_it: c.say_it, common_mistake: c.mistakes,
        performance_indicators: (c.pis || []).map(p => `${p.code} ${p.text || ''}`.trim()),
        past_role_plays: (c.examples || []).map(x => `${x.kind} ${x.level}${x.year ? ' ' + x.year : ''}: ${x.title}`),
      })
      return { label: `Card: ${c.term}`, payload }
    }
    if (item?.type === 'card') {
      const c = cardById.get(item.id)
      if (!c) return null
      return {
        label: `Card: ${c.term}`,
        payload: { type: 'card', term: c.term, definition: c.definition, chapter: c.chapter,
          linked_questions: (c.questions || []).slice(0, 4).map(id => qById.get(id)).filter(Boolean).map(q => ({ question: q.question, A: q.A, B: q.B, C: q.C, D: q.D, answer: q.answer, explanation: q.explanation })) },
      }
    }
    if (item?.type === 'question') {
      const q = qById.get(item.id)
      if (!q) return null
      return {
        label: `Question: ${q.question.slice(0, 70)}${q.question.length > 70 ? '…' : ''}`,
        payload: { type: 'question', category: q.category, year: q.year, question: q.question, A: q.A, B: q.B, C: q.C, D: q.D, answer: q.answer, explanation: q.explanation,
          linked_cards: (q.cards || []).map(id => cardById.get(id)).filter(Boolean).map(c => ({ term: c.term, definition: c.definition })) },
      }
    }
    return null
  }, [item, cardById, qById, rp])

  const noun = kind === 'cards' || kind === 'newcards' ? 'flashcard' : kind === 'rpcards' ? 'role play card' : 'exam question'
  // New cards / New exam use the same coach rules as Cards / Exam.
  const section = kind === 'newcards' ? 'cards' : kind === 'newexam' ? 'exam' : kind
  return (
    <ChatPanel
      storeKey={`deca_coach_${user.key}_${kind}`}
      contextLabel={current?.label}
      onCollapse={onCollapse}
      request={async (messages) => (await rpCall('study', { section, item: current?.payload || null, messages })).reply}
      topBar={
        <p className="px-4 py-2 text-xs text-on-surface-variant border-b border-surface-container truncate">
          {current ? <>Looking at: <span className="font-semibold text-on-surface">{current.label.replace(/^(Card|Question): /, '')}</span></> : `Open a ${noun} and the coach will see it. You can also ask about any DECA topic.`}
        </p>
      } />
  )
}
