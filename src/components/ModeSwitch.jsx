// App | Desktop switch shown on the login page and Home (and in the desktop sidebar).
export default function ModeSwitch({ mode, onChange, className = '', style }) {
  const opt = (key, icon, label) => {
    const on = mode === key
    return (
      <button onClick={() => !on && onChange(key)} aria-pressed={on}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all
          ${on ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant active:opacity-70'}`}>
        <span className="material-symbols-outlined text-[15px]">{icon}</span>{label}
      </button>
    )
  }
  return (
    <div role="group" aria-label="Switch between app and desktop layout" style={style}
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-full bg-surface-container-lowest/90 border border-outline-variant/40 shadow-sm ${className}`}>
      {opt('app', 'smartphone', 'App')}
      {opt('desktop', 'desktop_windows', 'Desktop')}
    </div>
  )
}
