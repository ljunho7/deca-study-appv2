// All data goes through /api/* serverless functions

export async function getProgress(username) {
  // Throws when the server cannot be reached or storage is broken, so callers
  // can tell "no progress yet" apart from "server not working".
  const res = await fetch(`/api/progress?user=${encodeURIComponent(username)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
  return res.json()
}

export async function saveProgress(username, data) {
  // Throws on failure so the UI shows "Not saved" instead of a false "Saved".
  const res = await fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: username, data })
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
  return res.json()
}

export async function getLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard')
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export async function updateLeaderboard(username, stats) {
  // Leaderboard is not shown any more; never let it block saving.
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

// Merge two per-item progress maps, keeping the newer entry for each id.
// Used when the server copy comes back older than what this device already
// has (the blob CDN can serve a stale copy for up to a minute after a save).
export function mergeNewest(local = {}, server = {}, tsKey = 'last') {
  const out = { ...server }
  for (const [id, entry] of Object.entries(local)) {
    const sv = server[id]
    if (!sv || (entry?.[tsKey] || 0) >= (sv?.[tsKey] || 0)) out[id] = entry
  }
  return out
}
