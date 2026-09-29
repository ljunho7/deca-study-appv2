// Bug report helpers. Screens call setReportContext({ screen, item }) when they
// change, so a report says where the student was. The last 8 JavaScript errors
// are kept and attached automatically.

export const REPORT_EMAIL = 'ljunho7@gmail.com'
/* global __APP_BUILD__ */
const ctx = { screen: 'app', item: null, user: null, build: typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : null, content: null }
const errors = []
export function setReportContext(patch) { Object.assign(ctx, patch) }

if (typeof window !== 'undefined') {
  const push = (msg) => { errors.push(`${new Date().toISOString().slice(11, 19)} ${String(msg).slice(0, 300)}`); if (errors.length > 8) errors.shift() }
  window.addEventListener('error', (e) => push(e.message || e.error))
  window.addEventListener('unhandledrejection', (e) => push(e.reason?.message || e.reason))
  const orig = console.error
  console.error = (...a) => { push(a.map(String).join(' ')); orig.apply(console, a) }
}

export function reportText(note) {
  return [
    note ? `What happened:\n${note}\n` : 'What happened:\n(describe the problem here)\n',
    '--- details (added automatically) ---',
    `Screen: ${ctx.screen}`, ctx.item ? `Item: ${ctx.item}` : null,
    `User: ${ctx.user || 'not logged in'}`,
    `App build: ${ctx.build || 'unknown'}`, `Content: ${ctx.content || 'not loaded'}`,
    `Time: ${new Date().toString()}`, `URL: ${location.href}`,
    `Device: ${navigator.userAgent}`, `Screen size: ${window.innerWidth}x${window.innerHeight}`,
    errors.length ? `Recent errors:\n${errors.join('\n')}` : 'Recent errors: none',
  ].filter(Boolean).join('\n')
}
export const reportSubject = () => `DECA app issue: ${ctx.screen}${ctx.item ? ` (${ctx.item})` : ''}`

export async function sendReport(note) {
  const r = await fetch('/api/report', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: reportSubject(), text: reportText(note), user: ctx.user, screen: ctx.screen, item: ctx.item }),
  })
  const out = await r.json().catch(() => ({}))
  if (!r.ok || !out.ok) throw new Error(out.error || `HTTP ${r.status}`)
  return out
}

export async function fetchReports() {
  const r = await fetch('/api/report', { cache: 'no-store' })
  const out = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(out.error || `HTTP ${r.status}`)
  return out
}

export const mailtoHref = (note) =>
  `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(reportSubject())}&body=${encodeURIComponent(reportText(note).slice(0, 1800))}`
