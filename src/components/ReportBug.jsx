import { useState } from 'react'
import { sendReport, reportText, mailtoHref } from '../lib/report.js'

// Small bug button in the top right corner (inside the empty space above every
// screen's header, so it never covers the bottom nav or answer buttons).
// "Send report" saves the report on the server; email and copy are only
// offered if sending fails.
export default function ReportBug() {
  const [open, setOpen]   = useState(false)
  const [note, setNote]   = useState('')
  const [state, setState] = useState('idle')   // idle | sending | sent | error
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function close() {
    setOpen(false)
    if (state === 'sent') { setNote(''); setState('idle') }
  }

  async function send() {
    setState('sending'); setError('')
    try { await sendReport(note.trim()); setState('sent') }
    catch (e) { setState('error'); setError(e.message || 'Could not send') }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(reportText(note.trim())); setCopied(true) } catch {}
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setCopied(false) }}
        aria-label="Report a problem"
        className="absolute right-3 z-40 w-9 h-9 rounded-full bg-surface-container-lowest/90 border border-outline-variant/40 shadow-sm flex items-center justify-center text-on-surface-variant active:scale-90 transition-all"
        style={{ top: 'calc(env(safe-area-inset-top) + 6px)' }}>
        <span className="material-symbols-outlined text-[18px]">bug_report</span>
      </button>

      {open && (
        <div className="absolute inset-0 z-[60] bg-black/30 flex items-end" onClick={close}>
          <div className="w-full bg-background rounded-t-3xl px-5 pt-5 shadow-2xl" onClick={e => e.stopPropagation()}
               style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black text-on-surface tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-[22px]">bug_report</span>
                Report a problem
              </h2>
              <button onClick={close} aria-label="Close" className="text-on-surface-variant active:opacity-70">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {state === 'sent' ? (
              <div className="text-center py-6">
                <span className="material-symbols-outlined sym-filled text-secondary text-[40px]">check_circle</span>
                <p className="font-bold text-on-surface mt-2">Report sent. Thank you!</p>
                <button onClick={close} className="mt-5 w-full bg-primary text-on-primary font-bold py-3.5 rounded-xl active:scale-95 transition-all">Done</button>
              </div>
            ) : (
              <>
                <p className="text-xs text-on-surface-variant mb-2">
                  What went wrong? The screen, the card or question you are on, and device details are added automatically.
                </p>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={5} autoFocus
                  placeholder="For example: the answer to this question looks wrong"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface focus:border-primary focus:ring-primary" />
                <button onClick={send} disabled={state === 'sending'}
                  className="mt-3 w-full bg-primary text-on-primary font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
                  <span className="material-symbols-outlined text-[20px]">send</span>
                  {state === 'sending' ? 'Sending…' : 'Send report'}
                </button>

                {state === 'error' && (
                  <div className="mt-3 rounded-xl bg-error-container/60 text-on-error-container text-xs p-3">
                    <p className="font-semibold">Could not send the report ({error}).</p>
                    <p className="mt-1">You can email it or copy it instead:</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <a href={mailtoHref(note.trim())}
                        className="bg-surface-container-lowest text-primary font-bold py-2.5 rounded-lg text-center">Email it</a>
                      <button onClick={copy}
                        className="bg-surface-container-lowest text-primary font-bold py-2.5 rounded-lg">{copied ? 'Copied' : 'Copy the report'}</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
