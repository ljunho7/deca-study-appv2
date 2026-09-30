import { useState, useEffect, useRef } from 'react'

// Gemini coach side panel (desktop). Used by Role Play Self study (never Test
// mode) and by the Cards and Exam tabs. The conversation is kept on this device
// under storeKey. Each user message can carry a short context label (the card
// or question it was asked about), shown above the message.
//   request(messages) -> Promise<reply text>

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

export default function ChatPanel({ storeKey, request, starters = [], title = 'AI coach', topBar = null, contextLabel = null, intro = 'Ask anything. For example:', onCollapse }) {
  const [messages, setMessages] = useState(() => load(storeKey))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const sending = useRef(false)   // blocks a double click from sending twice

  useEffect(() => { setMessages(load(storeKey)); setError('') }, [storeKey])
  useEffect(() => { try { localStorage.setItem(storeKey, JSON.stringify(messages.slice(-60))) } catch {} }, [storeKey, messages])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, busy])

  async function send(text) {
    const q = (text ?? input).trim()
    if (!q || busy || sending.current) return
    sending.current = true
    const next = [...messages, { role: 'user', text: q, ...(contextLabel ? { ctx: contextLabel } : {}) }]
    setMessages(next); setInput(''); setBusy(true); setError('')
    try {
      const reply = await request(next)
      setMessages(m => [...m, { role: 'model', text: reply }])
    } catch (e) { setError(e.message) }
    setBusy(false)
    sending.current = false
  }

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest rounded-2xl shadow-[0px_2px_8px_rgba(26,27,33,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-container flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[20px]">smart_toy</span>{title}
        </p>
        <div className="flex items-center gap-3">
          {messages.length > 0 && <button onClick={() => { if (window.confirm('Clear this chat?')) setMessages([]) }} className="text-xs font-semibold text-on-surface-variant hover:text-error">Clear chat</button>}
          {onCollapse && <button onClick={onCollapse} aria-label="Hide the AI coach" className="text-on-surface-variant hover:text-on-surface flex items-center"><span className="material-symbols-outlined text-[20px]">right_panel_close</span></button>}
        </div>
      </div>
      {topBar}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm no-scrollbar">
        {messages.length === 0 && starters.length > 0 && (
          <div className="text-on-surface-variant">
            <p className="mb-2">{intro}</p>
            <div className="flex flex-col gap-1.5">
              {starters.map(s => <button key={s} onClick={() => send(s)} className="text-left px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface">{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex flex-col items-end' : ''}>
            {m.ctx && <p className="text-[10px] text-outline mb-0.5 max-w-[92%] truncate">About: {m.ctx}</p>}
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
