import { useState, useEffect, useRef } from 'react'
import Scenario from './Scenario.jsx'
import Calculator from './Calculator.jsx'
import Results from './Results.jsx'
import { rpCall, blobToBase64, speak, stopSpeaking, getMic, startRecorder, stopStream, fmtClock } from './services.js'
import { saveAttempt } from '../lib/attempts.js'
import { setReportContext } from '../lib/report.js'

// Test mode, like the real event: 10 minutes to prepare, then up to 10
// minutes to present out loud (recorded) with the judge's follow-up questions,
// then the recording is transcribed (Groq) and scored on the rubric (Gemini).
// No AI help anywhere in this mode. Timers use the real clock.

const PREP = 600, TALK = 600
const GREETING = 'Hello, thank you for meeting with me today. I am looking forward to hearing your ideas. Please go ahead.'
const CLOSING = 'Thank you for your work. That concludes our meeting.'

export default function Test({ user, rp, cardsById, onExit, onStudy }) {
  const [phase, setPhase] = useState('setup')        // setup | prep | present | scoring | results
  const [judgeMode, setJudgeMode] = useState('scenario')
  const [micError, setMicError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [prepEnds, setPrepEnds] = useState(0)
  const [talkStart, setTalkStart] = useState(0)
  const [notes, setNotes] = useState('')
  const [stage, setStage] = useState('presenting')   // presenting | thinking | asking | closing
  const [questions, setQuestions] = useState([])     // [{ text, at }]
  const [qIndex, setQIndex] = useState(0)
  const [judgeNote, setJudgeNote] = useState('')
  const [step, setStep] = useState('')               // transcribing | scoring
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(null)

  const streamRef = useRef(null), recRef = useRef(null), blobRef = useRef(null), finishing = useRef(false)
  const qRef = useRef([])     // questions queued for this presentation
  const endedRef = useRef(0)
  const askedRef = useRef([]) // questions asked, with times (read when saving)
  const notesRef = useRef(''), talkStartRef = useRef(0)
  useEffect(() => { notesRef.current = notes }, [notes])
  const attemptId = useRef(`${rp.rp_id}-${Date.now().toString(36)}`)

  useEffect(() => { setReportContext({ screen: 'roleplay-test', item: `${rp.rp_id} (${phase}${phase === 'present' ? `, ${stage}` : ''})` }) }, [rp.rp_id, phase, stage])

  // Clock, and a warning before leaving mid test.
  const busy = phase === 'prep' || phase === 'present' || phase === 'scoring'
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => setNow(Date.now()), 250)
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    window.__rpBusy = true
    return () => { clearInterval(t); window.removeEventListener('beforeunload', warn); window.__rpBusy = false }
  }, [busy])
  useEffect(() => () => { stopSpeaking(); stopStream(streamRef.current) }, [])

  const prepLeft = (prepEnds - now) / 1000
  const talkElapsed = talkStart ? (now - talkStart) / 1000 : 0
  const talkLeft = TALK - talkElapsed

  useEffect(() => { if (phase === 'prep' && prepLeft <= 0) startPresent() }, [phase, prepLeft <= 0])
  useEffect(() => { if (phase === 'present' && talkLeft <= 0) finishPresentation() }, [phase, talkLeft <= 0])

  async function startPrep() {
    setMicError('')
    try { streamRef.current = await getMic() }
    catch (e) { setMicError(e?.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow the microphone for this site (the icon in the address bar), then try again.' : (e.message || 'No microphone found.')); return }
    setPrepEnds(Date.now() + PREP * 1000); setNow(Date.now()); setPhase('prep')
  }

  function startPresent() {
    if (phase === 'present') return
    try { recRef.current = startRecorder(streamRef.current) }
    catch (e) { setMicError(`Recording could not start: ${e.message}`); return }
    const t = Date.now()
    setTalkStart(t); talkStartRef.current = t; setNow(t); setStage('presenting'); setPhase('present')
    speak(GREETING)
  }

  const elapsed = () => Math.round((Date.now() - talkStartRef.current) / 1000)

  async function donePresenting() {
    if (stage !== 'presenting') return
    let qs = rp.judge_questions || []
    if (judgeMode === 'ai') {
      setStage('thinking')
      try {
        const audio = await blobToBase64(recRef.current.snapshot())
        const transcript = await rpCall('transcribe', { audio, mime: recRef.current.mime })
        const out = await rpCall('judge', { roleplay: rp, transcript })
        qs = out.questions
        setJudgeNote('')
      } catch (e) {
        setJudgeNote(`The AI judge was not available (${e.message}), so the scenario's judge questions are used.`)
      }
      if (finishing.current) return
    }
    qRef.current = qs
    if (!qs.length) return closeMeeting()
    ask(0)
  }

  function ask(i) {
    const text = qRef.current[i]
    askedRef.current = [...askedRef.current, { text, at: elapsed() }]
    setQuestions(askedRef.current)
    setQIndex(i); setStage('asking')
    speak(text)
  }
  const nextQuestion = () => (qIndex + 1 < qRef.current.length ? ask(qIndex + 1) : closeMeeting())

  async function closeMeeting() {
    setStage('closing')
    await speak(CLOSING)
    finishPresentation()
  }

  async function finishPresentation() {
    if (finishing.current) return
    finishing.current = true
    endedRef.current = Date.now()
    stopSpeaking()
    const blob = await recRef.current?.stop()
    stopStream(streamRef.current)
    blobRef.current = blob
    setPhase('scoring')
    process()
  }

  // Transcribe (if not done yet), save, score, save again. Retry safe.
  async function process(existing) {
    setError('')
    let a = existing || attempt
    try {
      if (!a?.transcript) {
        setStep('transcribing')
        const transcript = await rpCall('transcribe', { audio: await blobToBase64(blobRef.current), mime: recRef.current?.mime || 'audio/webm' })
        a = {
          id: attemptId.current, rp_id: rp.rp_id, title: rp.title, at: new Date(talkStartRef.current || Date.now()).toISOString(),
          judgeMode, questions: askedRef.current, notes: notesRef.current.slice(0, 5000),
          duration: Math.min(TALK, Math.round(((endedRef.current || Date.now()) - talkStartRef.current) / 1000)),
          transcript, grade: null, error: null,
        }
        a = (await saveAttempt(user.key, a)).attempt
        setAttempt(a)
      }
      setStep('scoring')
      const grade = await rpCall('grade', { roleplay: rp, transcript: a.transcript, questions: a.questions, judgeMode: a.judgeMode })
      a = (await saveAttempt(user.key, { ...a, grade, error: null })).attempt
      setAttempt(a); setPhase('results')
    } catch (e) {
      setError(e.message)
      if (a?.transcript) { a = (await saveAttempt(user.key, { ...a, error: e.message })).attempt; setAttempt(a) }
    }
    setStep('')
  }

  // ── Screens ─────────────────────────────────────────────────────────────
  if (phase === 'results' && attempt) return <Results user={user} rp={rp} attempt={attempt} cardsById={cardsById} onBack={onExit} onStudy={onStudy} onRetry={() => { window.__rpBusy = false; onExit('retest') }} />

  const Header = ({ label, clock, warn }) => (
    <div className="flex items-center justify-between mb-5 pr-12">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Test · {rp.rp_id}</p>
        <h1 className="text-2xl font-black text-on-surface">{label}</h1>
      </div>
      {clock != null && (
        <div className={`text-4xl font-black tabular-nums px-5 py-2 rounded-2xl ${warn ? 'bg-error-container text-on-error-container' : 'bg-surface-container-lowest text-on-surface'} shadow-sm`} aria-live="off">
          {fmtClock(clock)}
        </div>
      )}
    </div>
  )

  if (phase === 'setup') return (
    <div className="px-10 pt-10 pb-10 max-w-3xl">
      <button onClick={() => onExit()} className="flex items-center gap-1 text-primary font-bold text-sm mb-6"><span className="material-symbols-outlined text-[20px]">arrow_back</span>Role plays</button>
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Test mode</p>
      <h1 className="text-3xl font-black text-on-surface leading-tight mt-1">{rp.title}</h1>
      <div className="mt-6 bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_2px_8px_rgba(26,27,33,0.04)] space-y-3 text-sm">
        <p><b>1. Prepare, 10 minutes.</b> Read the scenario and exhibits, take notes, use the four-function calculator.</p>
        <p><b>2. Present, up to 10 minutes.</b> Your microphone records. The judge greets you; present out loud, then click <i>Done presenting</i> and answer the judge's questions out loud. Recording stops at 10:00.</p>
        <p><b>3. Score.</b> Your talk is transcribed and scored on this role play's rubric (100 points). The attempt is saved permanently.</p>
        <p className="text-on-surface-variant">No AI coach during the test. Use a quiet room and Chrome or Edge.</p>
      </div>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mt-6 mb-2">Judge's follow-up questions</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { k: 'scenario', t: 'Official questions', d: "The judge asks this role play's own judge questions." },
          { k: 'ai', t: 'AI judge', d: 'The judge listens to your presentation and asks its own follow-up questions (takes a few seconds).' },
        ].map(o => (
          <button key={o.k} onClick={() => setJudgeMode(o.k)} aria-pressed={judgeMode === o.k}
            className={`text-left rounded-2xl p-4 border-2 transition-all ${judgeMode === o.k ? 'border-primary bg-primary/5' : 'border-transparent bg-surface-container-lowest'}`}>
            <p className="font-bold text-on-surface">{o.t}</p><p className="text-xs text-on-surface-variant mt-1">{o.d}</p>
          </button>
        ))}
      </div>
      {micError && <p className="mt-4 text-sm text-on-error-container bg-error-container/60 rounded-xl px-4 py-3">{micError}</p>}
      <button onClick={startPrep} className="mt-6 bg-primary text-on-primary font-bold px-6 py-4 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20">
        <span className="material-symbols-outlined">mic</span>Allow microphone and start the 10 minute prep
      </button>
    </div>
  )

  if (phase === 'prep') return (
    <div className="px-8 pt-8 pb-8">
      <Header label="Prepare" clock={prepLeft} warn={prepLeft <= 60} />
      <div className="flex gap-5">
        <div className="flex-1 min-w-0"><Scenario rp={rp} /></div>
        <div className="w-[340px] flex-shrink-0 space-y-4 sticky top-4 self-start">
          <div className="bg-surface-container-lowest rounded-2xl p-3 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-2 px-1">Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={14} placeholder="Plan your presentation here. You keep these notes while presenting."
              className="w-full resize-none rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm focus:border-primary focus:ring-primary" />
          </div>
          <Calculator />
          <button onClick={startPresent} className="w-full bg-primary text-on-primary font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">record_voice_over</span>I'm ready: start presenting
          </button>
        </div>
      </div>
    </div>
  )

  if (phase === 'present') return (
    <div className="px-8 pt-8 pb-8">
      <Header label="Present to the judge" clock={talkLeft} warn={talkLeft <= 60} />
      <div className="flex gap-5">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
            <p className="flex items-center gap-2 text-sm font-bold text-error"><span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />Recording</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mt-4">Judge ({rp.judge_role})</p>
            {stage === 'presenting' && <p className="text-lg mt-1">"{GREETING}"</p>}
            {stage === 'thinking' && <p className="text-lg mt-1 flex items-center gap-2 text-on-surface-variant"><span className="material-symbols-outlined animate-spin">progress_activity</span>The judge is thinking of questions…</p>}
            {stage === 'asking' && (
              <>
                <p className="text-xs text-on-surface-variant mt-1">Question {qIndex + 1} of {qRef.current.length}</p>
                <p className="text-xl font-semibold mt-1">"{qRef.current[qIndex]}"</p>
                <button onClick={() => speak(qRef.current[qIndex])} className="mt-2 text-xs font-bold text-primary flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">replay</span>Repeat the question</button>
              </>
            )}
            {stage === 'closing' && <p className="text-lg mt-1">"{CLOSING}"</p>}
            {judgeNote && <p className="text-xs text-on-surface-variant mt-3">{judgeNote}</p>}
            <div className="mt-6">
              {stage === 'presenting' && <button onClick={donePresenting} className="bg-primary text-on-primary font-bold px-5 py-3 rounded-xl">Done presenting: ask me questions</button>}
              {stage === 'asking' && <button onClick={nextQuestion} className="bg-primary text-on-primary font-bold px-5 py-3 rounded-xl">{qIndex + 1 < qRef.current.length ? "I've answered: next question" : "I've answered: finish"}</button>}
            </div>
          </div>
          <details className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
            <summary className="text-sm font-bold cursor-pointer">Scenario and exhibits</summary>
            <div className="mt-4"><Scenario rp={rp} compact /></div>
          </details>
        </div>
        <div className="w-[340px] flex-shrink-0 space-y-4 sticky top-4 self-start">
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant mb-2">Your notes</p>
            <p className="text-sm whitespace-pre-wrap max-h-[50vh] overflow-y-auto">{notes || 'No notes.'}</p>
          </div>
          <button onClick={() => { if (window.confirm('End the presentation now and get your score?')) finishPresentation() }}
            className="w-full border border-outline-variant text-on-surface font-semibold py-3 rounded-xl">End presentation now</button>
        </div>
      </div>
    </div>
  )

  // scoring
  return (
    <div className="px-10 pt-16 pb-10 max-w-2xl">
      <h1 className="text-2xl font-black text-on-surface">Scoring your role play</h1>
      <ul className="mt-6 space-y-3 text-sm">
        {[['transcribing', 'Transcribing your recording'], ['scoring', 'Scoring on the rubric']].map(([k, t]) => {
          const done = (k === 'transcribing' && attempt?.transcript) || false
          return (
            <li key={k} className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-[20px] ${step === k ? 'animate-spin text-primary' : done ? 'text-secondary' : 'text-outline'}`}>{step === k ? 'progress_activity' : done ? 'check_circle' : 'radio_button_unchecked'}</span>{t}
            </li>
          )
        })}
      </ul>
      {error && (
        <div className="mt-6 bg-error-container/60 text-on-error-container rounded-xl px-4 py-3 text-sm">
          <p className="font-semibold">Something went wrong: {error}</p>
          <p className="mt-1">{attempt?.transcript ? 'Your transcript is saved, so you can try scoring again now or later from the role play list.' : 'Your recording is still here. Try again.'}</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => process()} disabled={!!step} className="bg-primary text-on-primary font-bold px-4 py-2 rounded-lg disabled:opacity-50">Try again</button>
            <button onClick={() => { if (attempt?.transcript || window.confirm('Leave without scoring? The recording will be lost.')) { window.__rpBusy = false; onExit() } }} className="border border-outline-variant px-4 py-2 rounded-lg font-semibold">Back to role plays</button>
          </div>
        </div>
      )}
    </div>
  )
}
