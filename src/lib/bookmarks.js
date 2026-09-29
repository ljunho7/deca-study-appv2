// Bookmarks (the ★ star) for cards and questions. A bookmark sits on top of
// any status (new, forgot, review, known, incorrect, hard, easy...).
//
// Stored in the progress record as bookmarks.cards[id] / bookmarks.questions[id]
// = { on: true|false, at: timestamp }. Turning one off keeps the entry with
// on: false, so merging with an older copy (another device, the server) never
// brings it back. Merging keeps the newest entry per id.
//
// Answering a question Incorrect or marking a card Forgot bookmarks it. Nothing
// ever removes a bookmark except the student tapping the star.

const key = (userKey) => `deca_progress_${userKey}`

function readFull(userKey) {
  try { return JSON.parse(localStorage.getItem(key(userKey)) || '{}') } catch { return {} }
}

export function readMarks(userKey, kind) {
  return readFull(userKey).bookmarks?.[kind] || {}
}

export const isMarked = (marks, id) => !!marks?.[id]?.on

// Sets one bookmark on or off in localStorage and returns the new map for that
// kind. The caller then runs its normal save so the server gets it too.
export function setMark(userKey, kind, id, on) {
  const full = readFull(userKey)
  const b = full.bookmarks || {}
  const marks = { ...(b[kind] || {}), [id]: { on, at: Date.now() } }
  full.bookmarks = { ...b, [kind]: marks }
  try { localStorage.setItem(key(userKey), JSON.stringify(full)) } catch {}
  return marks
}

export function mergeBookmarks(a = {}, b = {}) {
  const out = {}
  for (const kind of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const m = { ...(a?.[kind] || {}) }
    for (const [id, e] of Object.entries(b?.[kind] || {})) {
      if (!m[id] || (e?.at || 0) >= (m[id]?.at || 0)) m[id] = e
    }
    out[kind] = m
  }
  return out
}

// One time catch up for history saved before bookmarks existed: cards that are
// Forgot and questions that are Incorrect get bookmarked, dated to when that
// happened so any later unbookmark still wins. Items that already have an entry
// (on or off) are left alone. Returns true if anything was added.
export function seedBookmarks(full) {
  const b = full.bookmarks || {}
  const cards = { ...(b.cards || {}) }, questions = { ...(b.questions || {}) }
  let added = false
  for (const [id, e] of Object.entries(full.flashcards || {})) {
    if (!cards[id] && e && e.status !== 'known' && e.status !== 'review') { cards[id] = { on: true, at: e.lastReviewed || 1 }; added = true }
  }
  for (const [id, e] of Object.entries(full.questions || {})) {
    if (!questions[id] && e?.status === 'incorrect') { questions[id] = { on: true, at: e.last || 1 }; added = true }
  }
  if (added) full.bookmarks = { ...b, cards, questions }
  return added
}
