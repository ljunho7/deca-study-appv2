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

function mergeProgress(stored, incoming) {
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
    lastActive: new Date().toISOString(),
  }
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
