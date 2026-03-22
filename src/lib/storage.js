// All data goes through /api/* serverless functions

export async function getProgress(username) {
  try {
    const res = await fetch(`/api/progress?user=${encodeURIComponent(username)}`)
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export async function saveProgress(username, data) {
  try {
    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: username, data })
    })
  } catch {}
}

export async function getLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard')
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export async function updateLeaderboard(username, stats) {
  try {
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: username, stats })
    })
  } catch {}
}

export async function getPITracker() {
  try {
    const res = await fetch('/api/pi-tracker')
    if (!res.ok) return {}
    return res.json()
  } catch { return {} }
}

export async function savePITracker(data) {
  try {
    await fetch('/api/pi-tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  } catch {}
}
