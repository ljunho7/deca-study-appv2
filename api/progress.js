import { readJSON, writeJSON } from './_blob.js'

// Progress is stored as one JSON blob per user: progress/<user>.json
// POST merges the incoming copy with what is already stored (newest entry per
// card/question wins, exam history is combined), so a phone and a laptop
// saving at different times never erase each other's answers.

const path = (user) => `progress/${encodeURIComponent(user)}.json`
const readStored = (user) => readJSON(path(user))

function newest(a = {}, b = {}, ts) {
  const out = { ...a }
  for (const [id, e] of Object.entries(b || {})) {
    const cur = out[id]
    if (!cur || (e?.[ts] || 0) >= (cur?.[ts] || 0)) out[id] = e
  }
  return out
}

export function mergeProgress(stored, incoming) {
  if (!stored) return incoming
  const exams = [...(stored.exams || []), ...(incoming.exams || [])]
  const seen = new Set()
  const uniq = exams.filter(e => { const k = `${e.date}|${e.score}|${e.total}`; if (seen.has(k)) return false; seen.add(k); return true })
    .sort((x, y) => String(x.date).localeCompare(String(y.date)))
  return {
    ...stored, ...incoming,
    flashcards: newest(stored.flashcards, incoming.flashcards, 'lastReviewed'),
    questions: newest(stored.questions, incoming.questions, 'last'),
    exams: uniq,
    totalPoints: uniq.reduce((s, e) => s + (e.score || 0), 0),
    usage: mergeUsage(stored.usage, incoming.usage),
    bookmarks: mergeBookmarks(stored.bookmarks, incoming.bookmarks),
    lastActive: new Date().toISOString(),
  }
}

// Bookmarks per kind (see src/lib/bookmarks.js): newest { on, at } per id wins,
// and "off" entries are kept so an older copy never turns a bookmark back on.
function mergeBookmarks(a = {}, b = {}) {
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

// Usage seconds per device per day (see src/lib/usage.js): keep the larger count.
function mergeUsage(a = {}, b = {}) {
  const out = {}
  for (const src of [a, b]) {
    for (const [dev, days] of Object.entries(src || {})) {
      out[dev] ||= {}
      for (const [day, sec] of Object.entries(days || {})) out[dev][day] = Math.max(out[dev][day] || 0, sec || 0)
    }
  }
  return out
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'GET') {
    const { user } = req.query
    if (!user) return res.status(400).json({ error: 'Missing user' })
    try {
      const data = await readStored(user)
      return res.status(200).json(data || { flashcards: {}, questions: {}, exams: [], totalPoints: 0, empty: true })
    } catch (e) {
      return res.status(500).json({ error: `Could not read progress: ${e.message}` })
    }
  }

  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    const { user, data } = body || {}
    if (!user || !data) return res.status(400).json({ error: 'Missing user or data' })
    try {
      const merged = mergeProgress(await readStored(user), data)
      await writeJSON(path(user), merged)
      return res.status(200).json({ ok: true, data: merged })
    } catch (e) {
      return res.status(500).json({ error: `Could not save progress: ${e.message}` })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
