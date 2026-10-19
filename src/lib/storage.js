// All data goes through /api/* serverless functions

// View-as mode: the Debug account looks at a student's screens. The screens run
// under the user key "viewas_<student key>", so on this device they read and
// write a separate copy (deca_progress_viewas_<key>). Reads come from the
// student's server record; nothing is ever sent back (saves are skipped here and
// the server rejects viewas_ keys too).
export const VIEW_PREFIX = 'viewas_'
export const isViewKey = (k) => String(k || '').startsWith(VIEW_PREFIX)
let viewOnlyActive = false
export function setViewOnlyActive(v) { viewOnlyActive = !!v }

export async function getProgress(username) {
  // Throws when the server cannot be reached or storage is broken, so callers
  // can tell "no progress yet" apart from "server not working".
  const key = isViewKey(username) ? username.slice(VIEW_PREFIX.length) : username   // view-as reads the student's record
  const res = await fetch(`/api/progress?user=${encodeURIComponent(key)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
  return res.json()
}

export async function saveProgress(username, data) {
  // Throws on failure so the UI shows "Not saved" instead of a false "Saved".
  if (isViewKey(username) || viewOnlyActive) return { ok: true, viewOnly: true }   // view-as: never saved
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
  if (viewOnlyActive) return   // view-as: never saved
  try {
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: username, stats })
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
