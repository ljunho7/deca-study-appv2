import { put, list } from '@vercel/blob'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { user } = req.query
    if (!user) return res.status(400).json({ error: 'Missing user' })
    try {
      const { blobs } = await list({ prefix: `progress/${encodeURIComponent(user)}.json`, token: process.env.BLOB_READ_WRITE_TOKEN })
      if (!blobs || blobs.length === 0) return res.status(200).json(defaultProgress())
      const dataRes = await fetch(blobs[0].url)
      const data = await dataRes.json()
      return res.status(200).json(data)
    } catch {
      return res.status(200).json(defaultProgress())
    }
  }

  if (req.method === 'POST') {
    const { user, data } = req.body
    if (!user) return res.status(400).json({ error: 'Missing user' })
    await put(
      `progress/${encodeURIComponent(user)}.json`,
      JSON.stringify(data),
      { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN, addRandomSuffix: false }
    )
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

function defaultProgress() {
  return {
    flashcards: {},
    exams: [],
    totalPoints: 0,
    lastActive: new Date().toISOString()
  }
}
