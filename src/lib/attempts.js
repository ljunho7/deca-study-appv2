import { saveProgress } from './storage.js'

// Role play test attempts, kept permanently in the progress record as
// roleplays[attemptId] = { id, rp_id, title, at, updated, judgeMode,
// questions, transcript, grade, error }. Nothing ever deletes an attempt;
// merging keeps every id and, for the same id, the most recently updated copy
// (an attempt is updated when its scoring finishes or is retried).

const key = (userKey) => `deca_progress_${userKey}`

export function mergeAttempts(a = {}, b = {}) {
  const out = { ...(a || {}) }
  for (const [id, e] of Object.entries(b || {})) {
    if (!out[id] || (e?.updated || 0) >= (out[id]?.updated || 0)) out[id] = e
  }
  return out
}

export function readAttempts(userKey) {
  try { return JSON.parse(localStorage.getItem(key(userKey)) || '{}').roleplays || {} } catch { return {} }
}

// Saves on this device right away, then on the server (merged there too).
export async function saveAttempt(userKey, attempt) {
  const a = { ...attempt, updated: Date.now() }
  let full = {}
  try { full = JSON.parse(localStorage.getItem(key(userKey)) || '{}') } catch {}
  full.roleplays = { ...(full.roleplays || {}), [a.id]: a }
  try { localStorage.setItem(key(userKey), JSON.stringify(full)) } catch {}
  try { await saveProgress(userKey, full); return { attempt: a, saved: true } }
  catch { return { attempt: a, saved: false } }
}

// Attempts for one role play (or all), newest first.
export const attemptsFor = (attempts, rpId) =>
  Object.values(attempts || {}).filter(a => !rpId || a.rp_id === rpId).sort((x, y) => String(y.at).localeCompare(String(x.at)))

// How the judge's questions were chosen for an attempt.
export const judgeLabel = (a) => a?.judgeMode === 'official+ai' ? 'official + follow-up questions' : a?.judgeMode === 'ai' ? 'AI judge' : 'official questions'

export const bestScore = (attempts, rpId) => {
  const s = attemptsFor(attempts, rpId).map(a => a.grade?.total).filter(n => typeof n === 'number')
  return s.length ? Math.max(...s) : null
}
