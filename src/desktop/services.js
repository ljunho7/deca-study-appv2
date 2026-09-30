// Browser side helpers for the Role Play tab: the /api/roleplay client, the
// judge's spoken voice, and the microphone recorder.

// ── API ───────────────────────────────────────────────────────────────────
export async function rpCall(action, payload) {
  const r = await fetch('/api/roleplay', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  const out = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(out.error || `The server returned ${r.status}`)
  return out
}

export async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000))
  return btoa(s)
}

// ── Judge voice (browser speech synthesis, free) ──────────────────────────
function pickVoice() {
  const voices = window.speechSynthesis?.getVoices() || []
  return voices.find(v => /en-US/i.test(v.lang) && /natural|google|aria|jenny|guy/i.test(v.name))
    || voices.find(v => /^en[-_]US/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang)) || null
}

// Resolves when finished (or right away if speech is unavailable).
export function speak(text) {
  return new Promise(resolve => {
    const synth = window.speechSynthesis
    if (!synth || !text) return resolve()
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const v = pickVoice()
    if (v) u.voice = v
    u.rate = 0.98
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    u.onend = finish; u.onerror = finish
    // Some browsers never fire onend; give up after a generous estimate.
    setTimeout(finish, 2000 + text.length * 90)
    synth.speak(u)
  })
}
export const stopSpeaking = () => window.speechSynthesis?.cancel()

// ── Microphone ────────────────────────────────────────────────────────────
// Test hook: localStorage deca_fake_mic = '1' records a quiet tone instead of
// the microphone (used to self test without a mic).
export async function getMic() {
  if (localStorage.getItem('deca_fake_mic') === '1') {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator(), gain = ctx.createGain(), dest = ctx.createMediaStreamDestination()
    gain.gain.value = 0.05; osc.connect(gain).connect(dest); osc.start()
    return dest.stream
  }
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot record audio. Use Chrome or Edge.')
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
}

// Low bitrate speech recording: 10 minutes stays around 2 MB.
export function startRecorder(stream) {
  const types = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4']
  const mimeType = types.find(t => window.MediaRecorder?.isTypeSupported?.(t)) || ''
  const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24000 })
  const chunks = []
  rec.ondataavailable = e => { if (e.data?.size) chunks.push(e.data) }
  rec.start(1000)
  const mime = (rec.mimeType || mimeType || 'audio/webm').split(';')[0]
  return {
    mime,
    // Everything recorded so far, without stopping (used by the AI judge).
    snapshot: () => new Blob(chunks, { type: mime }),
    stop: () => new Promise(resolve => {
      if (rec.state === 'inactive') return resolve(new Blob(chunks, { type: mime }))
      rec.onstop = () => resolve(new Blob(chunks, { type: mime }))
      rec.stop()
    }),
  }
}

export const stopStream = (stream) => stream?.getTracks().forEach(t => t.stop())

export const fmtClock = (sec) => {
  const s = Math.max(0, Math.ceil(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
