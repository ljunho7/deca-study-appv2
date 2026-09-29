// ★ bookmark controls shared by the Cards and Exam tabs.

export function StarButton({ on, onToggle, className = '' }) {
  return (
    <button onClick={e => { e.stopPropagation(); onToggle() }}
      aria-label={on ? 'Remove bookmark' : 'Bookmark'} aria-pressed={on}
      className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all ${on ? 'text-amber-500' : 'text-outline'} ${className}`}>
      <span className={`material-symbols-outlined text-[26px] ${on ? 'sym-filled' : ''}`}>star</span>
    </button>
  )
}

// "Bookmarked only" switch for the menu. Works together with the status filters.
export function BookmarkedOnly({ on, count, onToggle, noun }) {
  return (
    <button onClick={onToggle} aria-pressed={on}
      className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 mb-3 border transition-all active:scale-[0.98]
        ${on ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-surface-container-low border-transparent text-on-surface'}`}>
      <span className="flex items-center gap-2 text-sm font-bold">
        <span className={`material-symbols-outlined text-[20px] ${on ? 'sym-filled text-amber-500' : 'text-outline'}`}>star</span>
        Bookmarked only
      </span>
      <span className="text-xs font-semibold text-on-surface-variant">{count} bookmarked {noun}{on ? ' · on' : ''}</span>
    </button>
  )
}
