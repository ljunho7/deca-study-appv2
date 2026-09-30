import { useState } from 'react'

// Four-function calculator (the only kind allowed in ACT).
export default function Calculator() {
  const [display, setDisplay] = useState('0')
  const [acc, setAcc] = useState(null)
  const [op, setOp] = useState(null)
  const [fresh, setFresh] = useState(true)

  const calc = (a, b, o) => o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : o === '÷' ? (b === 0 ? NaN : a / b) : b
  const show = (n) => !isFinite(n) ? 'Error' : String(parseFloat(n.toFixed(10)))

  function digit(d) {
    if (fresh || display === '0' || display === 'Error') { setDisplay(d === '.' ? '0.' : d); setFresh(false); return }
    if (d === '.' && display.includes('.')) return
    if (display.replace(/[-.]/g, '').length >= 14) return
    setDisplay(display + d)
  }
  function operator(o) {
    const cur = parseFloat(display)
    if (acc != null && op && !fresh) { const r = calc(acc, cur, op); setAcc(r); setDisplay(show(r)) } else setAcc(cur)
    setOp(o); setFresh(true)
  }
  function equals() {
    if (acc == null || !op) return
    const r = calc(acc, parseFloat(display), op)
    setDisplay(show(r)); setAcc(null); setOp(null); setFresh(true)
  }
  const clear = () => { setDisplay('0'); setAcc(null); setOp(null); setFresh(true) }

  const K = ({ k, onClick, cls = '' }) => (
    <button onClick={onClick} className={`h-10 rounded-lg text-sm font-bold active:scale-95 transition-all ${cls || 'bg-surface-container-low text-on-surface hover:bg-surface-container'}`}>{k}</button>
  )
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-3 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
      <div className="text-right text-xl font-bold tabular-nums bg-surface-container-low rounded-lg px-3 py-2 mb-2 truncate">
        {op && <span className="text-xs text-on-surface-variant mr-2">{show(acc)} {op}</span>}{display}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <K k="C" onClick={clear} cls="bg-error-container/60 text-on-error-container" />
        <K k="±" onClick={() => setDisplay(show(-parseFloat(display) || 0))} />
        <K k="%" onClick={() => setDisplay(show(parseFloat(display) / 100))} />
        <K k="÷" onClick={() => operator('÷')} cls="bg-primary/10 text-primary" />
        {['7', '8', '9'].map(d => <K key={d} k={d} onClick={() => digit(d)} />)}<K k="×" onClick={() => operator('×')} cls="bg-primary/10 text-primary" />
        {['4', '5', '6'].map(d => <K key={d} k={d} onClick={() => digit(d)} />)}<K k="−" onClick={() => operator('−')} cls="bg-primary/10 text-primary" />
        {['1', '2', '3'].map(d => <K key={d} k={d} onClick={() => digit(d)} />)}<K k="+" onClick={() => operator('+')} cls="bg-primary/10 text-primary" />
        <K k="0" onClick={() => digit('0')} /><K k="." onClick={() => digit('.')} />
        <K k="=" onClick={equals} cls="col-span-2 bg-primary text-on-primary" />
      </div>
    </div>
  )
}
