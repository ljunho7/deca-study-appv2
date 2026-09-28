// Card <-> question mapping: "For review" cascade.
//
// Rules:
//   * A flashcard marked Forgot  -> every linked question becomes "review".
//   * A question answered Incorrect or tagged Hard -> every linked card becomes "review".
//   * "review" never triggers anything further, so there are no loops.
//   * A card leaves "review" when the student marks it Got it (known) or Forgot;
//     a question leaves "review" when it is answered again.
//
// Both progress maps live in one localStorage record (deca_progress_<user>),
// under "flashcards" and "questions". The flashcards and exam tabs are never
// on screen at the same time, so the tab doing the answering updates the other
// map directly in localStorage; the other tab reads it when it opens.
// These helpers only write localStorage. The caller must flag FIRST and then
// run its normal save, so the single server push carries both changes.

const key = (userKey) => `deca_progress_${userKey}`

export function readProgress(userKey) {
  try { return JSON.parse(localStorage.getItem(key(userKey)) || '{}') } catch { return {} }
}

export function writeProgress(userKey, full) {
  try { localStorage.setItem(key(userKey), JSON.stringify(full)) } catch {}
}

// Mark the given card ids "review". Returns how many cards changed.
export function flagCardsForReview(userKey, cardIds, reason) {
  if (!cardIds || !cardIds.length) return 0
  const full = readProgress(userKey)
  const fc = { ...(full.flashcards || {}) }
  const now = Date.now()
  let n = 0
  for (const id of cardIds) {
    const prev = fc[id] || {}
    if (prev.status !== 'review') n++
    fc[id] = { ...prev, status: 'review', lastReviewed: now, reviewReason: reason }
  }
  full.flashcards = fc
  writeProgress(userKey, full)
  return n
}

// Mark the given question ids "review". Returns how many questions changed.
export function flagQuestionsForReview(userKey, questionIds, reason) {
  if (!questionIds || !questionIds.length) return 0
  const full = readProgress(userKey)
  const qp = { ...(full.questions || {}) }
  const now = Date.now()
  let n = 0
  for (const id of questionIds) {
    const prev = qp[id] || {}
    if (prev.status !== 'review') n++
    qp[id] = { ...prev, status: 'review', last: now, reviewReason: reason }
  }
  full.questions = qp
  writeProgress(userKey, full)
  return n
}

export const cardStatus = (p) => !p ? 'new' : p.status === 'known' ? 'known' : p.status === 'review' ? 'review' : 'forgot'
export const questionStatus = (p) => !p ? 'new' : (p.status || 'new')
