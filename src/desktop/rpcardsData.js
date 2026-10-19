// Cards for RP content (public/rpcards.json, built by npm run sync-roleplays),
// loaded once and shared by the screen and the AI coach.
let cache = null
export function loadRpCards() {
  if (!cache) cache = fetch('/rpcards.json').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
    .then(d => ({ cards: d.cards || [], byId: new Map((d.cards || []).map(c => [c.id, c])) }))
    .catch(e => { cache = null; throw e })
  return cache
}

export const FREQ = {
  3: { stars: '★★★', label: 'Core', hint: 'Core concept, used or tested often' },
  2: { stars: '★★', label: 'Often', hint: 'Used in a past role play or several practice scenarios, or its PI was tested more than once' },
  1: { stars: '★', label: 'Sometimes', hint: 'On the PI list, rarely used so far' },
}

// Status of one card in progress.rpcards: new | forgot | known
export const rpStatus = (p) => !p ? 'new' : p.status === 'known' ? 'known' : 'forgot'

export function evidenceText(c) {
  const e = c.evidence || {}, parts = []
  if (e.official) parts.push(`used in ${e.official} official role play${e.official > 1 ? 's' : ''}`)
  if (e.practice) parts.push(`${e.practice} practice scenario${e.practice > 1 ? 's' : ''}`)
  if (e.piTested) parts.push(`its PI was tested in ${e.piTested} official role play${e.piTested > 1 ? 's' : ''}`)
  if (c.foundational) parts.unshift('foundational concept')
  return parts.length ? parts.join(', ') : 'on the 2026-27 PI list'
}
