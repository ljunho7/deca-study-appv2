import { put, list } from '@vercel/blob'

const BLOB_KEY = 'shared/pi-tracker.json'

async function readTracker() {
  try {
    const { blobs } = await list({ prefix: BLOB_KEY, token: process.env.BLOB_READ_WRITE_TOKEN })
    if (!blobs || blobs.length === 0) return {}
    const res = await fetch(blobs[0].url)
    return res.json()
  } catch {
    return {}
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const tracker = await readTracker()
    return res.status(200).json(tracker)
  }

  if (req.method === 'POST') {
    const data = req.body
    await put(BLOB_KEY, JSON.stringify(data), {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false
    })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
