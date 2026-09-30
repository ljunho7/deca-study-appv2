import { useState, useEffect } from 'react'
import Scenario from './Scenario.jsx'
import { rpCall, fmtClock } from './services.js'
import { saveAttempt, judgeLabel } from '../lib/attempts.js'
import { setReportContext } from '../lib/report.js'

// Score report for one test attempt. No AI chat here (Test mode); "Study this
// role play" opens Self study, where the coach can see this attempt.

const LEVEL = {
  exceeds: ['Exceeds', 'bg-secondary/15 text-secondary'],
  meets: ['Meets', 'bg-primary/10 text-primary'],
  below: ['Below', 'bg-tertiary-fixed text-on-tertiary-fixed-variant'],
  little: ['Little/No value', 'bg-error-container text-on-error-container'],
}

export default function Results({ user, rp, attempt: initial, cardsById, onBack, onStudy, onRetry }) {
  const [attempt, setAttempt] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initial.error || '')
  const g = attempt.grade

  useEffect(() => { setReportContext({ screen: 'roleplay-results', item: `${rp.rp_id} attempt ${attempt.id}` }) }, [rp.rp_id, attempt.id])

  async function scoreAgain() {
    setBusy(true); setError('')
    try {
      const grade = await rpCall('grade', { roleplay: rp, transcript: attempt.transcript, questions: attempt.questions, judgeMode: attempt.judgeMode })
      setAttempt((await saveAttempt(user.key, { ...attempt, grade, error: null })).attempt)
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  const pct = g ? g.total : 0
  return (
    <div className="px-8 pt-8 pb-12">
      <div className="flex items-center justify-between mb-6 pr-12">
        <button onClick={() => onBack()} className="flex items-center gap-1 text-primary font-bold text-sm"><span className="material-symbols-outlined text-[20px]">arrow_back</span>Role plays</button>
        <div className="flex gap-2">
          <button onClick={onStudy} className="border border-outline-variant font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-1.5"><span className="material-symbols-outlined text-[18px]">menu_book</span>Study this role play</button>
          {onRetry && <button onClick={onRetry} className="bg-primary text-on-primary font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-1.5"><span className="material-symbols-outlined text-[18px]">replay</span>Try again</button>}
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_2px_8px_rgba(26,27,33,0.04)] flex items-center gap-6">
        <div className={`w-28 h-28 rounded-full flex flex-col items-center justify-center flex-shrink-0 ${!g ? 'bg-surface-container' : pct >= 75 ? 'bg-secondary/15 text-secondary' : pct >= 60 ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-error-container text-on-error-container'}`}>
          <span className="text-4xl font-black">{g ? g.total : '?'}</span><span className="text-xs font-bold">/ 100</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Test result · {new Date(attempt.at).toLocaleString()}</p>
          <h1 className="text-xl font-black text-on-surface leading-snug mt-0.5">{rp.title}</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Presented {fmtClock(attempt.duration || 0)} · {judgeLabel(attempt)} · {attempt.questions?.length || 0} question{attempt.questions?.length === 1 ? '' : 's'} asked
          </p>
          {g?.summary && <p className="text-[15px] mt-3">{g.summary}</p>}
        </div>
      </div>

      {!g && (
        <div className="mt-4 bg-error-container/60 text-on-error-container rounded-xl px-4 py-3 text-sm">
          <p>This attempt has not been scored yet{error ? `: ${error}` : '.'}</p>
          <button onClick={scoreAgain} disabled={busy} className="mt-2 bg-primary text-on-primary font-bold px-4 py-2 rounded-lg disabled:opacity-50">{busy ? 'Scoring…' : 'Score it now'}</button>
        </div>
      )}

      {g && (
        <>
          <div className="mt-4 bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-on-surface-variant">
                <tr><th className="text-left px-4 py-2.5 font-semibold">Judge's evaluation</th><th className="px-4 py-2.5 font-semibold w-32">Level</th><th className="px-4 py-2.5 font-semibold w-20 text-right">Score</th></tr>
              </thead>
              <tbody>
                {g.items.map((it, i) => (
                  <tr key={i} className="border-t border-outline-variant/30 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{i + 1}. {it.label}</p>
                      {it.feedback && <p className="text-on-surface-variant mt-1">{it.feedback}</p>}
                      {it.evidence && <p className="text-xs text-outline mt-1 italic">Heard: {it.evidence}</p>}
                    </td>
                    <td className="px-4 py-3">{it.level && <span className={`text-xs font-bold px-2 py-1 rounded-full ${LEVEL[it.level][1]}`}>{LEVEL[it.level][0]}</span>}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{it.score}/{it.max}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-outline-variant/60 bg-surface-container-low"><td className="px-4 py-2.5 font-black" colSpan={2}>Total</td><td className="px-4 py-2.5 text-right font-black">{g.total}/100</td></tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            {[['Strengths', 'thumb_up', g.strengths], ['To improve', 'trending_up', g.improvements], ['Missed points', 'report', g.missed_points]].map(([t, icon, list]) => (
              <div key={t} className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">{icon}</span>{t}</p>
                <ul className="list-disc pl-5 text-sm space-y-1">{(list || []).length ? list.map((s, i) => <li key={i}>{s}</li>) : <li className="list-none -ml-5 text-on-surface-variant">None.</li>}</ul>
              </div>
            ))}
          </div>

          {g.judge_answers?.length > 0 && (
            <div className="mt-4 bg-surface-container-lowest rounded-2xl p-5 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-2">Your answers to the judge</p>
              {g.judge_answers.map((j, i) => <div key={i} className="mb-3 last:mb-0 text-sm"><p className="font-semibold">"{j.question}"</p><p className="text-on-surface-variant mt-0.5">{j.assessment}</p></div>)}
            </div>
          )}
        </>
      )}

      <details className="mt-4 bg-surface-container-lowest rounded-2xl p-5 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]" open={!g}>
        <summary className="text-sm font-bold cursor-pointer">Transcript</summary>
        <div className="mt-3 text-sm space-y-1.5 max-h-[420px] overflow-y-auto">
          {attempt.transcript?.segments?.length
            ? attempt.transcript.segments.map((s, i) => <p key={i}><span className="text-outline tabular-nums mr-2">{fmtClock(s.start)}</span>{s.text}</p>)
            : <p className="whitespace-pre-wrap">{attempt.transcript?.text || 'No speech was recorded.'}</p>}
        </div>
      </details>

      <details className="mt-4 bg-surface-container-lowest rounded-2xl p-5 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
        <summary className="text-sm font-bold cursor-pointer">Role play, judge's key and solution</summary>
        <div className="mt-4"><Scenario rp={rp} showJudge cardsById={cardsById} /></div>
      </details>
    </div>
  )
}
