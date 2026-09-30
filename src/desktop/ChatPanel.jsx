import { useState, useEffect, useRef } from 'react'
import { rpCall } from './services.js'

// Gemini coach for Self study mode only (never in Test mode). The chat is kept
// on this device per user and role play.

const storeKey = (userKey, rpId) => `deca_rpchat_${userKey}_${rpId}`
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }

// Minimal formatting for replies: paragraphs, bullet lists and **bold**.
function Reply({ text }) {
  const bold = (s) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p)
  const blocks = String(text).split(/\n{2,}/)
  return blocks.map((b, i) => {
    const lines = b.split('\n')
    if (lines.every(l => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
      return <ul key={i} className="list-disc pl-5 space-y-0.5 mb-2 last:mb-0">{lines.map((l, j) => <li key={j}>{bold(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''))}</li>)}</ul>
    }
    return <p key={i} className="mb-2 last:mb-0 whitespace-pre-line">{bold(b.replace(/^#+\s*/gm, ''))}</p>
  })
}

const STARTERS = ['Explain the main concept of this role play simply', 'What would a strong opening sound like?', 'Walk me through the calculations', 'How should I answer the judge questions?']

export default function ChatPanel({ user, rp, latestAttempt }) {
  const k = storeKey(user.key, rp.rp_id)
  const [messages, setMessages] = useState(() => load(k))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [useAttempt, setUseAttempt] = useState(!!latestAttempt?.grade)
  const endRef = useRef(null)

  useEffect(() => { setMessages(load(k)); setError('') }, [k])
  useEffect(() => { try { localStorage.setItem(k, JSON.stringify(messages.slice(-60))) } catch {} }, [k, messages])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, busy])

  async function send(text) {
    const q = (text ?? input).trim()
    if (!q || busy) return
    const next = [...messages, { role: 'user', text: q }]
    setMessages(next); setInput(''); setBusy(true); setError('')
    try {
      const { reply } = await rpCall('chat', { roleplay: rp, attempt: useAttempt ? latestAttempt : null, messages: next })
      setMessages(m => [...m, { role: 'model', text: reply }])
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest rounded-2xl shadow-[0px_2px_8px_rgba(26,27,33,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-container flex items-center justify-between">
        <p className="text-sm font-bold text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[20px]">smart_toy</span>AI coach
        </p>
        {messages.length > 0 && <button onClick={() => { if (window.confirm('Clear this chat?')) setMessages([]) }} className="text-xs font-semibold text-on-surface-variant hover:text-error">Clear chat</button>}
      </div>
      {latestAttempt?.grade && (
        <label className="px-4 py-2 text-xs text-on-surface-variant flex items-center gap-2 border-b border-surface-container cursor-pointer">
          <input type="checkbox" checked={useAttempt} onChange={e => setUseAttempt(e.target.checked)} className="rounded text-primary focus:ring-primary" />
          Include my latest test ({latestAttempt.grade.total}/100) so the coach can explain my scores
        </label>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm no-scrollbar">
        {messages.length === 0 && (
          <div className="text-on-surface-variant">
            <p className="mb-2">Ask anything about this role play. For example:</p>
            <div className="flex flex-col gap-1.5">
              {STARTERS.map(s => <button key={s} onClick={() => send(s)} className="text-left px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface">{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={`rounded-2xl px-3.5 py-2.5 max-w-[92%] ${m.role === 'user' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'}`}>
              {m.role === 'user' ? <p className="whitespace-pre-line">{m.text}</p> : <Reply text={m.text} />}
            </div>
          </div>
        ))}
        {busy && <p className="text-on-surface-variant text-xs flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>The coach is thinking…</p>}
        {error && <p className="text-error text-xs bg-error-container/50 rounded-xl px-3 py-2">Could not get an answer: {error}</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={e => { e.preventDefault(); send() }} className="p-3 border-t border-surface-container flex gap-2">
        <textarea value={input} onChange={e => setInput(e.target.value)} rows={2} placeholder="Ask the coach…"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          className="flex-1 resize-none rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:ring-primary" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send"
          className="self-end bg-primary text-on-primary rounded-xl w-11 h-11 flex items-center justify-center disabled:opacity-40">
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
      </form>
    </div>
  )
}
