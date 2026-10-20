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
  3: { stars: '★★★', label: 'Core', hint: 'Used in 3 or more actual (official) role plays' },
  2: { stars: '★★', label: 'Often', hint: 'Used in 1 or 2 actual (official) role plays' },
  1: { stars: '★', label: 'Sometimes', hint: 'Not in any actual role play yet (practice scenarios only, or on the PI list)' },
}

// Status of one card in progress.rpcards: new | forgot | known
export const rpStatus = (p) => !p ? 'new' : p.status === 'known' ? 'known' : 'forgot'

export function evidenceText(c) {
  // The rating counts official role plays only; practice scenarios are listed
  // as extra information.
  const e = c.evidence || {}
  const base = e.official ? `used in ${e.official} official role play${e.official > 1 ? 's' : ''}` : 'not used in any official role play yet'
  return e.practice ? `${base} (also ${e.practice} practice scenario${e.practice > 1 ? 's' : ''}, not counted)` : base
}
