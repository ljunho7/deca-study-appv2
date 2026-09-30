// Role Play tab (desktop only). Step 1 placeholder: the library, Self study
// mode and Test mode are built in the next steps.
export default function RolePlay() {
  return (
    <div className="px-10 pt-12 pb-10">
      <h1 className="text-3xl font-black text-on-surface tracking-tight">Role Play</h1>
      <p className="text-sm text-on-surface-variant mt-1">ACT (Accounting Applications Series) role plays, desktop only.</p>

      <div className="mt-8 grid grid-cols-2 gap-4">
        {[
          { icon: 'menu_book', title: 'Self study', text: 'Read a role play with its judge key and solution, and ask the AI coach questions about it.' },
          { icon: 'timer', title: 'Test', text: '10 minutes to prepare, then 10 minutes to present out loud with judge questions. Scored against the DECA rubric.' },
        ].map(c => (
          <div key={c.title} className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0px_2px_8px_rgba(26,27,33,0.04)]">
            <span className="material-symbols-outlined text-primary text-[28px]">{c.icon}</span>
            <p className="text-lg font-bold text-on-surface mt-2">{c.title}</p>
            <p className="text-sm text-on-surface-variant mt-1">{c.text}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm text-on-surface-variant bg-surface-container rounded-xl px-4 py-3">
        Coming soon: the role play library (29 official role plays and 35 practice scenarios) is being added.
      </p>
    </div>
  )
}
