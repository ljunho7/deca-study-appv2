import { readJSON, writeJSON } from './_blob.js'

const BLOB_KEY = 'shared/leaderboard.json'

async function readLeaderboard() {
  try {
    return (await readJSON(BLOB_KEY)) || []
  } catch {
    return []
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const lb = await readLeaderboard()
    return res.status(200).json(lb)
  }

  if (req.method === 'POST') {
    const { user, stats } = req.body
    const lb = await readLeaderboard()
    const idx = lb.findIndex(e => e.user === user)
    const entry = { user, ...stats, updatedAt: new Date().toISOString() }
    if (idx >= 0) lb[idx] = entry
    else lb.push(entry)
    lb.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
    await writeJSON(BLOB_KEY, lb)
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
