import { put, list } from '@vercel/blob'

const BLOB_KEY = 'shared/leaderboard.json'

async function readLeaderboard() {
  try {
    const { blobs } = await list({ prefix: BLOB_KEY, token: process.env.BLOB_READ_WRITE_TOKEN })
    if (!blobs || blobs.length === 0) return []
    const res = await fetch(blobs[0].url)
    return res.json()
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
    await put(BLOB_KEY, JSON.stringify(lb), {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false
    })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
