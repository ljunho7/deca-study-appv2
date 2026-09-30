// Role play AI services (desktop Role Play tab). One route, several actions,
// to stay within Vercel's function limit:
//   POST { action: 'transcribe', audio: <base64>, mime }      Groq Whisper
//   POST { action: 'grade', roleplay, transcript, questions }  Gemini, DECA rubric
//   POST { action: 'judge', roleplay, transcript }             Gemini follow-up questions
//   POST { action: 'chat', roleplay, attempt, messages }       Gemini self-study coach
//   POST { action: 'study', section, item, messages }          Gemini coach for Cards / Exam
// Keys live only here: GROQ_API_KEY, GEMINI_API_KEY (optional GEMINI_MODEL,
// GROQ_MODEL). Audio is never stored.

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const GROQ_MODEL = process.env.GROQ_MODEL || 'whisper-large-v3-turbo'

class UserError extends Error {}
const need = (name) => { if (!process.env[name]) throw new UserError(`${name} is not set in the Vercel project settings, so this feature is not available yet.`); return process.env[name] }

// ── Groq Whisper ──────────────────────────────────────────────────────────
export async function transcribe(audioB64, mime = 'audio/webm') {
  const key = need('GROQ_API_KEY')
  const buf = Buffer.from(audioB64 || '', 'base64')
  if (buf.length < 1000) throw new UserError('The recording is empty. Check that the microphone is allowed and working.')
  const form = new FormData()
  form.append('file', new Blob([buf], { type: mime }), mime.includes('ogg') ? 'talk.ogg' : mime.includes('mp4') ? 'talk.mp4' : 'talk.webm')
  form.append('model', GROQ_MODEL)
  form.append('response_format', 'verbose_json')
  form.append('language', 'en')
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form })
  if (!r.ok) throw new Error(`Groq transcription failed (${r.status}): ${(await r.text()).slice(0, 300)}`)
  const out = await r.json()
  return {
    text: (out.text || '').trim(),
    segments: (out.segments || []).map(s => ({ start: Math.round(s.start), end: Math.round(s.end), text: (s.text || '').trim() })),
    duration: out.duration || null,
  }
}

// ── Gemini ────────────────────────────────────────────────────────────────
async function gemini({ system, contents, schema, temperature = 0.2 }) {
  const key = need('GEMINI_API_KEY')
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature, ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}) },
  }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`Gemini request failed (${r.status}): ${(await r.text()).slice(0, 300)}`)
  const out = await r.json()
  const text = out.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || ''
  if (!text) throw new Error(`Gemini returned no answer (${out.candidates?.[0]?.finishReason || out.promptFeedback?.blockReason || 'unknown reason'})`)
  if (!schema) return text
  try { return JSON.parse(text) } catch { throw new Error('Gemini returned a reply that was not valid JSON') }
}

const LEVELS = `Official DECA evaluation levels:
Exceeds Expectations: demonstrated in an extremely professional manner; greatly exceeds business standards; top 10% of business personnel.
Meets Expectations: acceptable and effective; meets at least minimal business standards; 70-89th percentile.
Below Expectations: limited effectiveness; fell below minimal business standards; 50-69th percentile.
Little/No Value: little or no effectiveness; 0-49th percentile.`

// What the participant saw (no judge material).
function participantView(rp) {
  return JSON.stringify({
    title: rp.title, level: rp.level, instructional_area: rp.instructional_area,
    participant_role: rp.participant_role, judge_role: rp.judge_role, scenario: rp.scenario, tasks: rp.tasks,
    exhibits: (rp.exhibits || []).filter(e => !/judge|solution/i.test(e.title || '')),
    performance_indicators: rp.performance_indicators, century_skills: rp.century_skills,
  })
}
const judgeView = (rp) => JSON.stringify({
  judge_exhibits: (rp.exhibits || []).filter(e => /judge|solution/i.test(e.title || '')),
  judge_questions: rp.judge_questions, solution: rp.solution, key_concepts: (rp.key_concepts || []).map(k => ({ term: k.term, definition: k.definition })),
  key_points: rp.rubric?.key_points || [],
})
const clip = (s, n) => String(s || '').slice(0, n)
const bandOf = (item, score) => Object.entries(item.bands || {}).find(([, [lo, hi]]) => score >= lo && score <= hi)?.[0] || null

export async function grade({ roleplay: rp, transcript, questions = [], judgeMode = 'scenario' }) {
  const items = rp?.rubric?.items
  if (!items?.length) throw new UserError('This role play has no rubric.')
  const rubricText = items.map((it, i) => `${i + 1}. [${it.kind}] ${it.label} (0-${it.max}; bands ${Object.entries(it.bands).map(([k, [lo, hi]]) => `${k} ${lo}-${hi}`).join(', ')})` +
    (it.criteria ? `\n   Criteria for this scenario: exceeds: ${it.criteria.exceeds} | meets: ${it.criteria.meets} | below: ${it.criteria.below} | little: ${it.criteria.little}` : '')).join('\n')
  const lines = (transcript?.segments?.length ? transcript.segments.map(s => `[${Math.floor(s.start / 60)}:${String(s.start % 60).padStart(2, '0')}] ${s.text}`).join('\n') : transcript?.text) || '(no speech was recorded)'
  const system = `You are an experienced, fair and demanding DECA judge scoring a high school participant in the Accounting Applications Series (ACT) role play. Score ONLY what the participant actually said in the transcript. The transcript comes from one microphone, so it may also contain the judge's lines, which were spoken by the app: ignore those when scoring. Do not give credit for content the participant did not say. Use the rubric's score ranges exactly, pick a whole number inside the right band, and quote short phrases from the transcript as evidence. If the transcript is very short or off topic, scores must be low. Write feedback in plain language for a high school student, addressed to them as "you". Do not use dashes as punctuation.`
  const user = `${LEVELS}

ROLE PLAY (what the participant saw):
${participantView(rp)}

JUDGE MATERIAL (model solution; use it to judge accuracy):
${judgeView(rp)}

RUBRIC (${items.length} items, total 100):
${rubricText}

JUDGE QUESTIONS ASKED DURING THE PRESENTATION (${judgeMode === 'official+ai' ? 'the official questions first, then follow-up questions written live by the AI judge' : judgeMode === 'ai' ? 'written live by the AI judge' : 'from the scenario'}):
${questions.length ? questions.map((q, i) => `${i + 1}. ${q.source === 'ai' ? '[AI follow-up] ' : q.source === 'official' ? '[official] ' : ''}${q.text}${q.at != null ? ` (asked at ${Math.floor(q.at / 60)}:${String(q.at % 60).padStart(2, '0')})` : ''}`).join('\n') : '(none were asked)'}

TRANSCRIPT (10 minute limit, times are minutes:seconds from the start of the presentation):
${clip(lines, 60000)}`
  const schema = {
    type: 'OBJECT',
    properties: {
      items: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
        index: { type: 'INTEGER' }, score: { type: 'INTEGER' },
        evidence: { type: 'STRING' }, feedback: { type: 'STRING' },
      }, required: ['index', 'score', 'evidence', 'feedback'] } },
      summary: { type: 'STRING' },
      strengths: { type: 'ARRAY', items: { type: 'STRING' } },
      improvements: { type: 'ARRAY', items: { type: 'STRING' } },
      missed_points: { type: 'ARRAY', items: { type: 'STRING' } },
      judge_answers: { type: 'ARRAY', items: { type: 'OBJECT', properties: { question: { type: 'STRING' }, assessment: { type: 'STRING' } }, required: ['question', 'assessment'] } },
    },
    required: ['items', 'summary', 'strengths', 'improvements', 'missed_points', 'judge_answers'],
  }
  const out = await gemini({ system, contents: [{ role: 'user', parts: [{ text: user }] }], schema })
  // Never trust the model's arithmetic: clamp each score and add them up here.
  const scored = items.map((it, i) => {
    const g = (out.items || []).find(x => x.index === i + 1) || {}
    const score = Math.max(0, Math.min(it.max, Math.round(Number(g.score) || 0)))
    return { label: it.label, kind: it.kind, max: it.max, score, level: bandOf(it, score), evidence: clip(g.evidence, 600), feedback: clip(g.feedback, 800) }
  })
  return {
    items: scored, total: scored.reduce((s, x) => s + x.score, 0),
    summary: clip(out.summary, 1500),
    strengths: (out.strengths || []).slice(0, 6).map(s => clip(s, 300)),
    improvements: (out.improvements || []).slice(0, 6).map(s => clip(s, 300)),
    missed_points: (out.missed_points || []).slice(0, 8).map(s => clip(s, 300)),
    judge_answers: (out.judge_answers || []).slice(0, 5).map(j => ({ question: clip(j.question, 300), assessment: clip(j.assessment, 600) })),
    model: GEMINI_MODEL,
  }
}

export async function judgeQuestions({ roleplay: rp, transcript }) {
  const system = `You are the judge in a DECA Accounting Applications Series role play, playing this character: ${rp.judge_role}. The participant has just finished presenting. Ask follow-up questions like a real DECA judge: short, natural, spoken questions (one sentence each) that probe points the participant missed, got wrong or explained vaguely, or that test deeper understanding of the performance indicators. Stay in character and in the scenario. Do not give hints or answers.`
  const user = `Role play: ${participantView(rp)}
Official judge questions (they are asked first, so do NOT repeat or rephrase them): ${JSON.stringify(rp.judge_questions)}
Model solution (to spot gaps): ${JSON.stringify(rp.solution?.overview || '')}
What the participant said: ${clip(transcript?.text || '(nothing was recorded)', 20000)}
Write 2 or 3 follow-up questions that are different from the official ones.`
  const out = await gemini({ system, contents: [{ role: 'user', parts: [{ text: user }] }], temperature: 0.6,
    schema: { type: 'OBJECT', properties: { questions: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['questions'] } })
  const questions = (out.questions || []).map(q => clip(q, 300)).filter(Boolean).slice(0, 3)
  if (!questions.length) throw new Error('The AI judge did not write any questions')
  return { questions }
}

export async function chat({ roleplay: rp, attempt, messages = [] }) {
  const system = `You are a friendly, expert DECA coach helping a high school student prepare for the Accounting Applications Series (ACT) role play below. Explain in plain language with short examples, using this scenario's own numbers and facts. Keep answers focused and reasonably short (use short paragraphs or lists). You may discuss the solution and judge's key: this is self study. If the student asks something unrelated to DECA, accounting or this role play, gently bring them back. Do not use dashes as punctuation.

ROLE PLAY: ${participantView(rp)}
JUDGE MATERIAL: ${judgeView(rp)}
RUBRIC: ${JSON.stringify((rp.rubric?.items || []).map(i => ({ label: i.label, max: i.max, criteria: i.criteria })))}${attempt ? `

THE STUDENT'S LATEST TEST ATTEMPT (${attempt.at}): total ${attempt.grade?.total}/100.
Scores: ${JSON.stringify((attempt.grade?.items || []).map(i => ({ label: i.label, score: i.score, max: i.max, feedback: i.feedback })))}
Transcript: ${clip(attempt.transcript?.text, 15000)}` : ''}`
  const contents = messages.slice(-20).map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: clip(m.text, 4000) }] }))
  if (!contents.length || contents[contents.length - 1].role !== 'user') throw new UserError('Ask a question first.')
  return { reply: await gemini({ system, contents, temperature: 0.5 }) }
}

// Coach beside the Cards and Exam tabs (desktop). item is the card or
// question on screen (or null).
export async function study({ section, item, messages = [] }) {
  const where = section === 'exam' ? 'practicing Finance cluster exam questions' : 'studying flashcards'
  const system = `You are a friendly, expert DECA coach helping a high school student prepare for the Finance cluster exam used by the Accounting Applications Series (ACT). The student is ${where}. Explain in plain language with short, concrete examples. Keep answers focused and reasonably short (short paragraphs or lists). Stay on DECA, accounting, finance and business topics; gently bring the student back if they drift. Do not use dashes as punctuation.${item?.type === 'question' ? `

The exam question on screen is below, with its official answer. The student may not have answered it yet: do not reveal the correct letter or answer unless the student asks for it or says they already answered. Until then, give hints and explain the concepts behind the choices. When you do discuss the answer, explain why it is right and why each other choice is wrong.` : ''}${item ? `

ON SCREEN NOW: ${JSON.stringify(item)}` : `

Nothing specific is on screen right now; answer general questions about the exam topics.`}`
  const contents = messages.slice(-20).map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: (m.ctx ? `[Asked while viewing ${m.ctx}] ` : '') + clip(m.text, 4000) }] }))
  if (!contents.length || contents[contents.length - 1].role !== 'user') throw new UserError('Ask a question first.')
  return { reply: await gemini({ system, contents, temperature: 0.5 }) }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method not allowed' }) }
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  try {
    const { action } = body || {}
    if (action === 'transcribe') return res.status(200).json(await transcribe(body.audio, body.mime))
    if (action === 'grade') return res.status(200).json(await grade(body))
    if (action === 'judge') return res.status(200).json(await judgeQuestions(body))
    if (action === 'chat') return res.status(200).json(await chat(body))
    if (action === 'study') return res.status(200).json(await study(body))
    return res.status(400).json({ error: 'unknown action' })
  } catch (e) {
    console.error(e)
    return res.status(e instanceof UserError ? 400 : 502).json({ error: e?.message || String(e) })
  }
}
