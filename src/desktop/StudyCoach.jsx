import { useState, useEffect, useMemo } from 'react'
import ChatPanel from './ChatPanel.jsx'
import { rpCall } from './services.js'
import { onReportContext } from '../lib/report.js'

// AI coach beside the Cards and Exam tabs (desktop only). It follows the card
// or question on screen through the bug report context, which those screens
// already set ("card <id> (<term>)" / "question <id>"), so the phone screens
// need no changes. One conversation per tab, kept on this device.

export default function StudyCoach({ user, kind, cards, questions, onCollapse }) {
  const [item, setItem] = useState(null)   // { type: 'card' | 'question', id }
  useEffect(() => onReportContext(ctx => {
    const m = /^(card|question) (\d+)/.exec(ctx.item || '')
    setItem(m ? { type: m[1], id: Number(m[2]) } : null)
  }), [])

  const cardById = useMemo(() => new Map((cards || []).map(c => [c.id, c])), [cards])
  const qById = useMemo(() => new Map((questions || []).map(q => [q.id, q])), [questions])

  // What the coach is told about the item on screen.
  const current = useMemo(() => {
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
  }, [item, cardById, qById])

  const noun = kind === 'cards' ? 'flashcard' : 'exam question'
  return (
    <ChatPanel
      storeKey={`deca_coach_${user.key}_${kind}`}
      contextLabel={current?.label}
      onCollapse={onCollapse}
      request={async (messages) => (await rpCall('study', { section: kind, item: current?.payload || null, messages })).reply}
      topBar={
        <p className="px-4 py-2 text-xs text-on-surface-variant border-b border-surface-container truncate">
          {current ? <>Looking at: <span className="font-semibold text-on-surface">{current.label.replace(/^(Card|Question): /, '')}</span></> : `Open a ${noun} and the coach will see it. You can also ask about any DECA topic.`}
        </p>
      } />
  )
}
