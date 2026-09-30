// App (phone layout) or Desktop (wide layout with the Role Play tab).
// Remembered per device; the default is 'app', so nothing changes until the
// student picks Desktop.

const KEY = 'deca_mode'

export function readMode() {
  try { return localStorage.getItem(KEY) === 'desktop' ? 'desktop' : 'app' } catch { return 'app' }
}

export function saveMode(mode) {
  try { localStorage.setItem(KEY, mode) } catch {}
}

// index.html limits #root to phone width; body.desktop lifts that limit.
export function applyModeClass(mode) {
  document.body.classList.toggle('desktop', mode === 'desktop')
}
