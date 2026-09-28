import { readJSON, writeJSON } from './_blob.js'

const BLOB_KEY = 'shared/pi-tracker.json'

async function readTracker() {
  try {
    return (await readJSON(BLOB_KEY)) || {}
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
    await writeJSON(BLOB_KEY, data)
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
