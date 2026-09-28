import { useState } from 'react'

// Fixed accounts. No sign-up: only these two can log in.
const USERS = [
  { key: 'hannah', name: 'Hannah', pin: '0325', icon: 'school' },
  { key: 'debug',  name: 'Debug',  pin: '0000', icon: 'bug_report' },
]

const Logo = () => (
  <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30">
    <span className="material-symbols-outlined sym-filled text-white text-[40px]">trending_up</span>
  </div>
)

export default function Login({ onLogin }) {
  const [selected, setSelected] = useState(null)
  const [pin, setPin]           = useState('')
  const [error, setError]       = useState('')

  function pick(u) { setSelected(u); setPin(''); setError('') }

  function handleLogin() {
    if (!selected) return
    if (pin !== selected.pin) { setError('Wrong PIN. Try again.'); setPin(''); return }
    onLogin({ name: selected.name, key: selected.key })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 pb-12 pt-16 relative overflow-hidden">
      {/* Background blobs */}
      <div className="fixed -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-24 -left-24 w-64 h-64 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
      {/* Top gradient line */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-tertiary-container opacity-30" />

      {/* Brand */}
      <div className="text-center mb-12">
        <div className="flex justify-center mb-5"><Logo /></div>
        <h1 className="text-[28px] font-black tracking-tight text-primary mb-1">DECA Finance</h1>
        <p className="text-on-surface-variant font-medium tracking-wide text-sm">Study smarter. Score higher.</p>
      </div>

      <div className="w-full max-w-sm space-y-6">
        {!selected && (
          <>
            <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-on-surface-variant ml-1">Who is studying?</label>
            <div className="grid grid-cols-2 gap-3">
              {USERS.map(u => (
                <button key={u.key} onClick={() => pick(u)}
                  className="bg-surface-container-lowest rounded-2xl p-5 flex flex-col items-center gap-3 shadow-[0px_2px_8px_rgba(26,27,33,0.04)] border border-outline-variant/15 active:scale-95 transition-all">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[26px]">{u.icon}</span>
                  </div>
                  <span className="text-base font-bold text-on-surface">{u.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {selected && (
          <>
            <div className="text-center mb-2">
              <p className="text-lg font-bold text-on-surface">Welcome back, {selected.name}!</p>
              <div className="mt-1.5 h-1 w-8 bg-secondary rounded-full mx-auto" />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-on-surface-variant ml-1">Enter PIN</label>
              <input
                className="w-full text-center text-2xl tracking-[1em] bg-surface-container-low rounded-xl px-4 py-4 text-on-surface font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 border-0 placeholder:tracking-normal placeholder:text-outline"
                type="password" inputMode="numeric" placeholder="••••"
                value={pin} onChange={e => setPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoFocus maxLength={8} />
            </div>
            {error && <p className="text-error text-sm text-center font-medium">{error}</p>}
            <button onClick={handleLogin}
              className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20">
              Sign In <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
            <button onClick={() => setSelected(null)}
              className="w-full flex items-center justify-center gap-2 text-on-surface-variant text-sm font-semibold py-2 active:opacity-70 transition-all">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Different person
            </button>
          </>
        )}
      </div>

      <div className="mt-auto pt-12 text-center">
        <div className="inline-flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/15 px-4 py-2 rounded-full">
          <span className="material-symbols-outlined text-secondary text-[14px]">lock</span>
          <p className="text-[11px] font-medium text-on-surface-variant">Progress syncs to the team server</p>
        </div>
      </div>
    </div>
  )
}
