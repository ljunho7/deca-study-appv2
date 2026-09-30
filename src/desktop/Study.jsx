import { useState } from 'react'
import Scenario from './Scenario.jsx'
import ChatPanel from './ChatPanel.jsx'

// Self study mode: the whole role play (including the judge's key, judge
// questions, solution and rubric) next to the AI coach. No timers.
export default function Study({ user, rp, latestAttempt, cardsById, onBack, onTest }) {
  const [card, setCard] = useState(null)
  return (
    <div className="px-8 pt-8 pb-6 flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0 pr-12">
        <button onClick={onBack} className="flex items-center gap-1 text-primary font-bold text-sm"><span className="material-symbols-outlined text-[20px]">arrow_back</span>Role plays</button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider bg-secondary-container/40 text-on-secondary-container px-3 py-1 rounded-full">Self study</span>
          <button onClick={onTest} className="bg-primary text-on-primary font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">timer</span>Take the test
          </button>
        </div>
      </div>
      <div className="flex gap-5 flex-1 min-h-0">
        <div className="flex-1 min-w-0 overflow-y-auto no-scrollbar pb-8">
          <Scenario rp={rp} showJudge cardsById={cardsById} onOpenCard={setCard} />
        </div>
        <div className="w-[380px] flex-shrink-0 min-h-0"><ChatPanel user={user} rp={rp} latestAttempt={latestAttempt} /></div>
      </div>
      {card && (
        <div className="fixed inset-0 z-[55] bg-black/30 flex items-center justify-center" onClick={() => setCard(null)}>
          <div className="bg-background rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{card.chapter}</p>
            <h3 className="text-xl font-black text-on-surface mt-1">{card.term}</h3>
            <p className="text-[15px] leading-relaxed mt-3">{card.definition}</p>
            <button onClick={() => setCard(null)} className="mt-5 w-full bg-primary text-on-primary font-bold py-3 rounded-xl">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
