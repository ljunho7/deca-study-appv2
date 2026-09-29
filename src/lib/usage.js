import { saveProgress } from './storage.js'

// Usage time. While the app is on screen and the student has touched, typed or
// scrolled in the last 2 minutes, every 15 s is added to today's total.
// Stored inside the progress record as usage[deviceId][YYYY-MM-DD] = seconds,
// so a phone and a laptop never overwrite each other: merging keeps the larger
// number per device and day, and the totals add devices together.

const TICK = 15, IDLE = 120, PUSH_EVERY = 300

export const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA')   // local YYYY-MM-DD

function deviceId() {
  try {
    let id = localStorage.getItem('deca_device')
    if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem('deca_device', id) }
    return id
  } catch { return 'unknown' }
}

export function mergeUsage(a = {}, b = {}) {
  const out = {}
  for (const src of [a, b]) {
    for (const [dev, days] of Object.entries(src || {})) {
      out[dev] ||= {}
      for (const [day, sec] of Object.entries(days || {})) out[dev][day] = Math.max(out[dev][day] || 0, sec || 0)
    }
  }
  return out
}

// { day: seconds } summed over devices.
export function usageByDay(usage = {}) {
  const out = {}
  for (const days of Object.values(usage || {})) for (const [day, sec] of Object.entries(days || {})) out[day] = (out[day] || 0) + (sec || 0)
  return out
}

// Starts counting for this user; returns a stop function.
export function startUsageTracking(userKey) {
  const KEY = `deca_progress_${userKey}`
  const dev = deviceId()
  let lastInput = Date.now(), unsent = 0
  const touch = () => { lastInput = Date.now() }
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']
  events.forEach(e => window.addEventListener(e, touch, { passive: true, capture: true }))

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
  const push = () => { if (unsent) { unsent = 0; saveProgress(userKey, read()).catch(() => {}) } }
  const beacon = () => {
    if (!unsent) return
    unsent = 0
    navigator.sendBeacon?.('/api/progress', new Blob([JSON.stringify({ user: userKey, data: read() })], { type: 'application/json' }))
  }

  const timer = setInterval(() => {
    if (document.visibilityState !== 'visible' || Date.now() - lastInput > IDLE * 1000) return
    try {
      const s = read()
      s.usage ||= {}; s.usage[dev] ||= {}
      const d = dayKey()
      s.usage[dev][d] = (s.usage[dev][d] || 0) + TICK
      localStorage.setItem(KEY, JSON.stringify(s))
      unsent += TICK
      if (unsent >= PUSH_EVERY) push()
    } catch {}
  }, TICK * 1000)

  const onVis = () => { if (document.visibilityState === 'hidden') beacon() }
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('pagehide', beacon)
  return () => {
    clearInterval(timer)
    events.forEach(e => window.removeEventListener(e, touch, { capture: true }))
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('pagehide', beacon)
    push()
  }
}
