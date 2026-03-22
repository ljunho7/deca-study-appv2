import { useState } from 'react'

const Logo = () => (
  <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30">
    <span className="material-symbols-outlined sym-filled text-white text-[40px]">trending_up</span>
  </div>
)

export default function Login({ onLogin }) {
  const [step, setStep]       = useState('name')
  const [name, setName]       = useState('')
  const [pin, setPin]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState('')

  const getUsers = () => { try { return JSON.parse(localStorage.getItem('deca_users') || '{}') } catch { return {} } }
  const saveUsers = u => localStorage.setItem('deca_users', JSON.stringify(u))

  function handleName() {
    const n = name.trim()
    if (n.length < 2) { setError('Enter your name (at least 2 characters)'); return }
    setError('')
    const users = getUsers()
    setStep(users[n.toLowerCase()] ? 'pin' : 'setpin')
  }

  function handleLogin() {
    const users = getUsers()
    const stored = users[name.trim().toLowerCase()]
    if (!stored || stored.pin !== pin) { setError('Wrong PIN. Try again.'); setPin(''); return }
    onLogin({ name: stored.displayName, key: name.trim().toLowerCase() })
  }

  function handleSetPin() {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    if (pin !== confirm) { setError("PINs don't match"); return }
    const users = getUsers()
    const key = name.trim().toLowerCase()
    users[key] = { displayName: name.trim(), pin }
    saveUsers(users)
    onLogin({ name: name.trim(), key })
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
        {step === 'name' && (
          <>
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-on-surface-variant ml-1">Your name</label>
              <input
                className="w-full bg-surface-container-low rounded-xl px-4 py-4 text-on-surface placeholder:text-outline font-semibold text-base focus:outline-none focus:ring-2 focus:ring-primary/20 border-0"
                placeholder="e.g. Jamie Smith" value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleName()}
                autoFocus />
            </div>
            {error && <p className="text-error text-sm text-center font-medium">{error}</p>}
            <button onClick={handleName}
              className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20">
              Continue <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </>
        )}

        {step === 'pin' && (
          <>
            <div className="text-center mb-2">
              <p className="text-lg font-bold text-on-surface">Welcome back, {name.trim()}!</p>
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
            <button onClick={() => { setStep('name'); setPin(''); setError('') }}
              className="w-full flex items-center justify-center gap-2 text-on-surface-variant text-sm font-semibold py-2 active:opacity-70 transition-all">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Different person
            </button>
          </>
        )}

        {step === 'setpin' && (
          <>
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-on-surface-variant ml-1">Create a PIN (4–8 digits)</label>
              <input
                className="w-full bg-surface-container-low rounded-xl px-4 py-4 text-on-surface font-semibold tracking-widest text-base focus:outline-none focus:ring-2 focus:ring-primary/20 border-0"
                type="password" inputMode="numeric" placeholder="e.g. 1234"
                value={pin} onChange={e => setPin(e.target.value)} maxLength={8} autoFocus />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-on-surface-variant ml-1">Confirm PIN</label>
              <input
                className="w-full bg-surface-container-low rounded-xl px-4 py-4 text-on-surface font-semibold tracking-widest text-base focus:outline-none focus:ring-2 focus:ring-primary/20 border-0"
                type="password" inputMode="numeric"
                value={confirm} onChange={e => setConfirm(e.target.value)} maxLength={8}
                onKeyDown={e => e.key === 'Enter' && handleSetPin()} />
            </div>
            {error && <p className="text-error text-sm text-center font-medium">{error}</p>}
            <button onClick={handleSetPin}
              className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20">
              Create Account <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </>
        )}
      </div>

      <div className="mt-auto pt-12 text-center">
        <div className="inline-flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/15 px-4 py-2 rounded-full">
          <span className="material-symbols-outlined text-secondary text-[14px]">lock</span>
          <p className="text-[11px] font-medium text-on-surface-variant">Your PIN is stored locally on this device</p>
        </div>
      </div>
    </div>
  )
}
