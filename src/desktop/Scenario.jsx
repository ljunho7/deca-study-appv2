// Shows a role play. showJudge = false is what a competitor sees (Test mode
// prep); true adds the judge's key, judge questions, solution, key concepts
// and rubric (Self study and results).

export const isJudgeExhibit = (e) => /judge|solution/i.test(e?.title || '')

const Card = ({ title, icon, children, tone = '' }) => (
  <section className={`bg-surface-container-lowest rounded-2xl p-5 shadow-[0px_2px_8px_rgba(26,27,33,0.04)] ${tone}`}>
    {title && (
      <h3 className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-3 flex items-center gap-1.5">
        {icon && <span className="material-symbols-outlined text-[16px]">{icon}</span>}{title}
      </h3>
    )}
    {children}
  </section>
)

export function Exhibit({ ex }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-sm font-bold text-on-surface mb-1.5">{ex.title}</p>
      <div className="overflow-x-auto rounded-xl border border-outline-variant/40">
        <table className="w-full text-sm">
          {ex.columns?.length > 0 && (
            <thead className="bg-surface-container-low">
              <tr>{ex.columns.map((c, i) => <th key={i} className="text-left font-semibold px-3 py-2 text-on-surface-variant">{c}</th>)}</tr>
            </thead>
          )}
          <tbody>
            {(ex.rows || []).map((r, i) => (
              <tr key={i} className="border-t border-outline-variant/30">
                {r.map((c, j) => <td key={j} className={`px-3 py-1.5 ${j > 0 && /^[\s$(\-]*[\d,.]+%?\)?$/.test(c) ? 'text-right tabular-nums' : ''}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const Paragraphs = ({ text }) => String(text || '').split(/\n{2,}/).map((p, i) => (
  <p key={i} className="text-[15px] leading-relaxed text-on-surface mb-3 last:mb-0 whitespace-pre-line">{p}</p>
))

export function RubricTable({ rubric }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant/40">
      <table className="w-full text-sm">
        <thead className="bg-surface-container-low text-on-surface-variant">
          <tr><th className="text-left px-3 py-2 font-semibold">Item</th><th className="px-3 py-2 font-semibold text-left">Little/No</th><th className="px-3 py-2 font-semibold text-left">Below</th><th className="px-3 py-2 font-semibold text-left">Meets</th><th className="px-3 py-2 font-semibold text-left">Exceeds</th></tr>
        </thead>
        <tbody>
          {rubric.items.map((it, i) => (
            <tr key={i} className="border-t border-outline-variant/30 align-top">
              <td className="px-3 py-2 font-semibold">{i + 1}. {it.label} <span className="text-on-surface-variant font-normal">(0 to {it.max})</span></td>
              {['little', 'below', 'meets', 'exceeds'].map(k => (
                <td key={k} className="px-3 py-2 text-on-surface-variant min-w-[120px]">
                  <span className="font-semibold text-on-surface">{it.bands[k][0] === it.bands[k][1] ? it.bands[k][0] : `${it.bands[k][0]} to ${it.bands[k][1]}`}</span>
                  {it.criteria?.[k] && <span className="block text-xs mt-0.5">{it.criteria[k]}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-on-surface-variant px-3 py-2 border-t border-outline-variant/30">Source: {rubric.source}. Total 100 points.</p>
    </div>
  )
}

export default function Scenario({ rp, showJudge = false, cardsById, onOpenCard, compact = false }) {
  const exhibits = (rp.exhibits || []).filter(e => showJudge || !isJudgeExhibit(e))
  const sol = rp.solution || {}
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
          {rp.kind === 'official' ? 'Official' : 'Practice'} · {rp.level}{rp.year ? ` ${rp.year}` : ''} · {rp.instructional_area}
        </p>
        <h2 className="text-xl font-black text-on-surface leading-snug">{rp.title}</h2>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div className="bg-primary/5 rounded-xl p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">Your role</p>{rp.participant_role}</div>
          <div className="bg-surface-container-low rounded-xl p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-0.5">Judge's role</p>{rp.judge_role}</div>
        </div>
      </Card>

      <Card title="Scenario" icon="description"><Paragraphs text={rp.scenario} /></Card>

      <div className={`grid gap-4 ${compact ? '' : 'grid-cols-2'}`}>
        <Card title="Your tasks" icon="checklist">
          <ol className="list-decimal pl-5 space-y-1.5 text-sm">{(rp.tasks || []).map((t, i) => <li key={i}>{t}</li>)}</ol>
        </Card>
        <Card title="Performance indicators" icon="fact_check">
          <ol className="list-decimal pl-5 space-y-1.5 text-sm">{rp.performance_indicators.map((t, i) => <li key={i}>{t}</li>)}</ol>
          {rp.century_skills?.length > 0 && (
            <>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mt-4 mb-2">21st century skills</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">{rp.century_skills.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </>
          )}
        </Card>
      </div>

      {exhibits.length > 0 && <Card title="Exhibits" icon="table_chart">{exhibits.map((e, i) => <Exhibit key={i} ex={e} />)}</Card>}

      {showJudge && (
        <>
          <Card title="Judge's questions" icon="record_voice_over" tone="border border-amber-200">
            <ol className="list-decimal pl-5 space-y-3 text-sm">
              {rp.judge_questions.map((q, i) => {
                const a = (sol.judge_question_answers || [])[i]
                return (
                  <li key={i}>
                    <p className="font-semibold">{q}</p>
                    {a?.answer?.length > 0 && <ul className="list-disc pl-5 mt-1 text-on-surface-variant">{a.answer.map((x, j) => <li key={j}>{x}</li>)}</ul>}
                  </li>
                )
              })}
            </ol>
          </Card>

          <Card title="Solution" icon="lightbulb" tone="border border-secondary/30">
            {sol.overview && <p className="text-[15px] leading-relaxed mb-4">{sol.overview}</p>}
            {(sol.by_task || []).map((t, i) => (
              <div key={i} className="mb-3">
                <p className="text-sm font-bold">{t.task}</p>
                <ul className="list-disc pl-5 text-sm space-y-0.5 mt-1">{(t.answer || []).map((a, j) => <li key={j}>{a}</li>)}</ul>
              </div>
            ))}
            {(sol.journal_entries || []).length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-bold mb-2">Journal entries</p>
                {sol.journal_entries.map((je, i) => (
                  <div key={i} className="mb-3 overflow-x-auto rounded-xl border border-outline-variant/40">
                    <p className="text-xs font-semibold px-3 py-1.5 bg-surface-container-low">{je.description}</p>
                    <table className="w-full text-sm"><tbody>
                      {(je.lines || []).map((l, j) => (
                        <tr key={j} className="border-t border-outline-variant/30">
                          <td className={`px-3 py-1 ${l.credit != null ? 'pl-10' : ''}`}>{l.account}</td>
                          <td className="px-3 py-1 text-right tabular-nums w-28">{l.debit != null ? Number(l.debit).toLocaleString() : ''}</td>
                          <td className="px-3 py-1 text-right tabular-nums w-28">{l.credit != null ? Number(l.credit).toLocaleString() : ''}</td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                ))}
              </div>
            )}
            {(sol.calculations || []).length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-bold mb-2">Calculations</p>
                {sol.calculations.map((c, i) => (
                  <div key={i} className="mb-2 text-sm">
                    <p className="font-semibold">{c.label}: <span className="text-secondary">{c.result}</span></p>
                    <ul className="list-disc pl-5 text-on-surface-variant">{(c.steps || []).map((s, j) => <li key={j}>{s}</li>)}</ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {(rp.key_concepts || []).length > 0 && (
            <Card title="Key concepts" icon="menu_book">
              <dl className="grid grid-cols-2 gap-3">
                {rp.key_concepts.map((k, i) => {
                  const card = k.flashcard_id != null ? cardsById?.[k.flashcard_id] : null
                  return (
                    <div key={i} className="bg-surface-container-low rounded-xl p-3 text-sm">
                      <dt className="font-bold flex items-start justify-between gap-2">
                        {k.term}
                        {card && onOpenCard && (
                          <button onClick={() => onOpenCard(card)} className="text-[11px] font-bold text-primary whitespace-nowrap flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[14px]">style</span>Flashcard
                          </button>
                        )}
                      </dt>
                      <dd className="text-on-surface-variant mt-0.5">{k.definition}</dd>
                    </div>
                  )
                })}
              </dl>
            </Card>
          )}

          <Card title="How this role play is scored" icon="grading"><RubricTable rubric={rp.rubric} /></Card>
        </>
      )}
    </div>
  )
}
