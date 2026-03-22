import { useState, useEffect, useRef } from 'react'
import { saveProgress, getProgress, updateLeaderboard } from '../lib/storage.js'

const CATEGORIES = [
  'All categories','Financial Analysis','Financial-Information Management',
  'Professional Development','Emotional Intelligence','Communications',
  'Information Management','Operations','Economics','Business Law',
  'Risk Management','Customer Relations','Marketing',
  'Human Resources Management','Strategic Management','Entrepreneurship',
]
const EXAM_SIZE  = 100
const DRILL_SIZE = 20
const TIME_LIMIT = 3600

export default function Exam({ user, data }) {
  const [mode,      setMode]      = useState('menu')
  const [examType,  setExamType]  = useState('full')
  const [category,  setCategory]  = useState(CATEGORIES[1])
  const [questions, setQuestions] = useState([])
  const [cur,       setCur]       = useState(0)
  const [answers,   setAnswers]   = useState({})
  const [selected,  setSelected]  = useState(null)
  const [showExpl,  setShowExpl]  = useState(false)
  const [timeLeft,  setTimeLeft]  = useState(TIME_LIMIT)
  const [history,   setHistory]   = useState([])
  const [sync,      setSync]      = useState('saved')
  const timerRef   = useRef(null)
  const answersRef = useRef({})
  const PROG_KEY   = `deca_progress_${user.key}`

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(PROG_KEY)||'{}'); setHistory(s.exams||[]) } catch {}
    getProgress(user.key).then(s => { if (s?.exams) setHistory(s.exams) }).catch(()=>{})
  }, [])

  useEffect(() => { answersRef.current = answers }, [answers])

  useEffect(() => {
    const flush = () => {
      if (mode !== 'exam') return
      const score = Object.entries(answersRef.current).filter(([i,a])=>questions[+i]?.answer===a).length
      save(score, questions.length, true)
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState==='hidden') flush() })
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [mode, questions])

  useEffect(() => {
    if (mode === 'exam' && examType === 'full') {
      setTimeLeft(TIME_LIMIT)
      timerRef.current = setInterval(() => setTimeLeft(t => { if (t<=1){clearInterval(timerRef.current);finish();return 0} return t-1 }), 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [mode])

  useEffect(() => {
    if (mode !== 'exam') return
    const t = setInterval(() => {
      const score = Object.entries(answersRef.current).filter(([i,a])=>questions[+i]?.answer===a).length
      save(score, questions.length, false)
    }, 60000)
    return () => clearInterval(t)
  }, [mode, questions])

  async function save(score, total, partial) {
    setSync('saving')
    try {
      const s = JSON.parse(localStorage.getItem(PROG_KEY)||'{}')
      const pts = (s.exams||[]).reduce((a,e)=>a+e.score,0)
      s.totalPoints = pts
      localStorage.setItem(PROG_KEY, JSON.stringify(s))
      await saveProgress(user.key, s)
      if (!partial) await updateLeaderboard(user.name, { totalPoints: pts, lastExamPct: Math.round(score/total*100) })
      setSync('saved')
    } catch { setSync('unsaved') }
  }

  function buildExam(type, cat) {
    if (!data) return []
    let pool = cat==='All categories' ? data : data.filter(q=>q.category===cat)
    const shuffled = [...pool].sort(()=>Math.random()-.5)
    return shuffled.slice(0, Math.min(type==='full'?EXAM_SIZE:DRILL_SIZE, shuffled.length))
  }

  function start() {
    const qs = buildExam(examType, examType==='full'?'All categories':category)
    setQuestions(qs); setCur(0); setAnswers({}); answersRef.current={}
    setSelected(null); setShowExpl(false); setMode('exam')
  }

  function pick(opt) {
    if (selected) return
    setSelected(opt); setShowExpl(true)
    setAnswers(a=>({...a,[cur]:opt}))
  }

  function next() {
    if (cur+1>=questions.length) finish()
    else { setCur(c=>c+1); setSelected(null); setShowExpl(false) }
  }

  async function finish() {
    clearInterval(timerRef.current)
    const score = Object.entries(answersRef.current).filter(([i,a])=>questions[+i]?.answer===a).length
    const total = questions.length
    const result = { date:new Date().toISOString(), score, total, category:examType==='full'?'All categories':category, type:examType, pct:Math.round(score/total*100) }
    setSync('saving')
    try {
      const s = JSON.parse(localStorage.getItem(PROG_KEY)||'{}')
      s.exams = [...(s.exams||[]), result]
      s.totalPoints = s.exams.reduce((a,e)=>a+e.score,0)
      localStorage.setItem(PROG_KEY, JSON.stringify(s))
      setHistory(s.exams)
      await saveProgress(user.key, s)
      await updateLeaderboard(user.name, { totalPoints:s.totalPoints, lastExamPct:result.pct })
      setSync('saved')
    } catch { setSync('unsaved') }
    setMode('results')
  }

  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
  const syncDot = sync==='saved'?'bg-secondary':sync==='saving'?'bg-amber-500':'bg-error'

  // ── MENU ──────────────────────────────────────────────────────────────
  if (mode === 'menu') {
    const recent = history.slice(-3).reverse()
    return (
      <div className="bg-surface-container-low min-h-full pb-4">
        <div className="bg-background px-5 pt-12 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-on-surface tracking-tight">Practice Exam</h1>
              <p className="text-sm text-on-surface-variant mt-0.5">{data?`${data.length.toLocaleString()} questions available`:'Loading…'}</p>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-on-surface-variant">
              <span className={`w-2 h-2 rounded-full ${syncDot}`} />{sync==='saved'?'Saved':sync==='saving'?'Saving…':'Pending'}
            </div>
          </div>
        </div>

        <div className="px-5 mt-3 space-y-3">
          {/* Exam type */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-3">Exam type</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                {key:'full',  icon:'quiz',      title:'Full exam',      sub:'100 Qs · 60 min · all categories'},
                {key:'drill', icon:'filter_alt', title:'Category drill', sub:'20 Qs · no timer · focus area'},
              ].map(({key,icon,title,sub})=>(
                <button key={key} onClick={()=>setExamType(key)}
                  className={`p-3.5 rounded-xl text-left transition-all active:scale-95 border-2 ${examType===key?'border-primary bg-primary/5':'border-outline-variant/20 bg-surface-container-low'}`}>
                  <span className={`material-symbols-outlined text-[20px] ${examType===key?'text-primary':'text-on-surface-variant'} mb-1.5 block`}>{icon}</span>
                  <p className={`text-sm font-bold ${examType===key?'text-primary':'text-on-surface'}`}>{title}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">{sub}</p>
                </button>
              ))}
            </div>

            {examType==='drill'&&(
              <div className="mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-2">Category</p>
                <select value={category} onChange={e=>setCategory(e.target.value)}
                  className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border-0">
                  {CATEGORIES.slice(1).map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            )}

            <button onClick={start} disabled={!data}
              className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
              <span className="material-symbols-outlined sym-filled text-[20px]">play_arrow</span>
              {data?'Start exam →':'Loading questions…'}
            </button>
          </div>

          {/* Recent */}
          {recent.length>0&&(
            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
              <div className="px-5 py-3 border-b border-surface-container">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">Recent exams</p>
              </div>
              {recent.map((e,i)=>(
                <div key={i} className={`px-5 py-3.5 flex items-center gap-3 ${i<recent.length-1?'border-b border-surface-container':''}`}>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-on-surface">{e.category} · {e.type==='full'?'Full':'Drill'}</p>
                    <p className="text-xs text-on-surface-variant">{new Date(e.date).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-lg font-black ${e.pct>=75?'text-secondary':e.pct>=60?'text-tertiary-container':'text-error'}`}>{e.pct}%</span>
                  <span className="text-xs text-on-surface-variant">{e.score}/{e.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── RESULTS ───────────────────────────────────────────────────────────
  if (mode === 'results') {
    const score = Object.entries(answers).filter(([i,a])=>questions[+i]?.answer===a).length
    const pct   = Math.round(score/questions.length*100)
    const bycat = {}
    questions.forEach((q,i)=>{
      if(!bycat[q.category]) bycat[q.category]={correct:0,total:0}
      bycat[q.category].total++
      if(answers[i]===q.answer) bycat[q.category].correct++
    })
    return (
      <div className="bg-surface-container-low min-h-full pb-4">
        <div className="bg-background px-5 pt-12 pb-6 text-center">
          <div className="text-5xl mb-3">{pct>=75?'🎉':pct>=60?'📈':'💪'}</div>
          <p className={`text-6xl font-black tracking-tighter ${pct>=75?'text-secondary':pct>=60?'text-tertiary-container':'text-error'}`}>{pct}%</p>
          <p className="text-on-surface-variant mt-1">{score} / {questions.length} correct</p>
          <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant mt-2">
            <span className={`w-2 h-2 rounded-full ${syncDot}`} />
            {sync==='saved'?'Saved':sync==='saving'?'Saving…':'Pending'}
          </div>
        </div>
        <div className="px-5 mt-3">
          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_2px_8px_rgba(26,27,33,0.04)] mb-4">
            <div className="px-5 py-3.5 border-b border-surface-container">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">Breakdown by category</p>
            </div>
            {Object.entries(bycat).sort((a,b)=>b[1].total-a[1].total).map(([cat,{correct,total}])=>{
              const p=Math.round(correct/total*100)
              return (
                <div key={cat} className="px-5 py-3.5 border-b border-surface-container last:border-0">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-semibold text-on-surface">{cat}</span>
                    <span className="text-xs text-on-surface-variant">{correct}/{total}</span>
                  </div>
                  <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${p>=75?'bg-secondary':p>=60?'bg-tertiary-container':'bg-error'}`} style={{width:`${p}%`}} />
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={()=>setMode('menu')} className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl active:scale-95 transition-all mb-3">← Back to menu</button>
          <button onClick={start} className="w-full bg-secondary text-on-secondary font-bold py-4 rounded-xl active:scale-95 transition-all">Retake exam</button>
        </div>
      </div>
    )
  }

  // ── ACTIVE EXAM ───────────────────────────────────────────────────────
  const q = questions[cur]
  if (!q) return null

  return (
    <div className="bg-background min-h-full flex flex-col">
      {/* Header */}
      <div className="bg-background/80 backdrop-blur-md px-5 pt-12 pb-2 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-on-surface-variant font-medium text-sm">{cur+1} / {questions.length}</span>
          <div className="bg-surface-container-high px-3 py-1 rounded-full">
            <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">{q.category}</span>
          </div>
          {examType==='full'
            ? <div className="flex items-center gap-1">
                <span className="material-symbols-outlined sym-filled text-primary text-[18px]">timer</span>
                <span className={`font-bold text-sm ${timeLeft<300?'text-error':'text-primary'}`}>{fmt(timeLeft)}</span>
              </div>
            : <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span className={`w-2 h-2 rounded-full ${syncDot}`} />
                {sync==='saved'?'Saved':'…'}
              </div>
          }
        </div>
        <div className="h-1 bg-surface-container rounded-full overflow-hidden">
          <div className="h-full bg-secondary transition-all duration-300" style={{width:`${(cur/questions.length)*100}%`}} />
        </div>
      </div>

      <div className="px-5 pt-6 pb-6 flex-1">
        <h2 className="text-xl font-bold text-on-surface leading-snug mb-7">{q.question}</h2>
        <div className="space-y-3">
          {['A','B','C','D'].map(opt => {
            const val = q[opt]
            if (!val) return null
            let state = null
            if (selected) { state = opt===q.answer?'correct':opt===selected?'wrong':null }
            return (
              <button key={opt} onClick={()=>pick(opt)} disabled={!!selected}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98] relative overflow-hidden text-left
                  ${state==='correct' ? 'bg-secondary-container/30 border-2 border-secondary' :
                    state==='wrong'   ? 'bg-error-container/20 border-2 border-error/30' :
                    'bg-surface-container-lowest border border-outline-variant/10 shadow-sm'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm
                  ${state==='correct'?'bg-secondary text-on-secondary':
                    state==='wrong'  ?'bg-error text-on-error':
                    'bg-surface-container text-on-surface'}`}>
                  {opt}
                </div>
                <span className={`flex-1 text-sm font-medium
                  ${state==='correct'?'text-on-secondary-container font-semibold':
                    state==='wrong'  ?'text-on-error-container':
                    'text-on-surface-variant'}`}>
                  {val}
                </span>
                {state==='correct' && <span className="material-symbols-outlined sym-filled text-secondary text-[22px]">check_circle</span>}
                {state==='wrong'   && <span className="material-symbols-outlined sym-filled text-error   text-[22px]">cancel</span>}
              </button>
            )
          })}
        </div>

        {showExpl && q.explanation && (
          <div className="mt-5 p-4 bg-surface-container-low rounded-2xl border-l-4 border-secondary">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined sym-filled text-secondary text-[16px]">lightbulb</span>
              <span className="text-secondary font-bold text-[11px] uppercase tracking-widest">Scholar's Insight</span>
            </div>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              <span className={`font-bold ${selected===q.answer?'text-secondary':'text-error'}`}>
                {selected===q.answer?'✓ Correct.':'✗ Incorrect.'}
              </span>{' '}
              {q.explanation}
            </p>
          </div>
        )}

        {selected && (
          <button onClick={next}
            className="mt-6 w-full bg-primary text-on-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20">
            {cur+1>=questions.length?'See results':'Next question'}
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
        )}
      </div>
    </div>
  )
}
