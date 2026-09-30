import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { mergeProgress } from './api/progress.js'

// Build stamp shown in bug reports: Vercel's commit, or the local commit.
function buildStamp() {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA || ''
  if (!sha) { try { sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch {} }
  return `${sha ? sha.slice(0, 7) : 'local'} ${new Date().toISOString().slice(0, 16)}Z`
}

// Local stand in for api/progress.js during `npm run dev`: progress is saved
// to .data/progress/<user>.json with the same merge the server uses.
function devProgress() {
  const dir = path.resolve('.data/progress')
  const file = (user) => path.join(dir, `${encodeURIComponent(user)}.json`)
  const read = (user) => (fs.existsSync(file(user)) ? JSON.parse(fs.readFileSync(file(user), 'utf8')) : null)
  return {
    name: 'dev-progress',
    configureServer(server) {
      server.middlewares.use('/api/progress', (req, res) => {
        const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
        if (req.method === 'GET') {
          const user = new URL(req.originalUrl || req.url, 'http://x').searchParams.get('user')
          if (!user) return send(400, { error: 'Missing user' })
          return send(200, read(user) || { flashcards: {}, questions: {}, exams: [], totalPoints: 0, empty: true })
        }
        if (req.method === 'POST') {
          let raw = ''
          req.on('data', c => { raw += c })
          req.on('end', () => {
            let body = {}
            try { body = JSON.parse(raw || '{}') } catch {}
            if (!body.user || !body.data) return send(400, { error: 'Missing user or data' })
            const merged = mergeProgress(read(body.user), body.data)
            fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(file(body.user), JSON.stringify(merged))
            send(200, { ok: true, data: merged })
          })
          return
        }
        send(405, { error: 'Method not allowed' })
      })
    },
  }
}

// Local stand in for api/roleplay.js during `npm run dev`. With GROQ_API_KEY /
// GEMINI_API_KEY in the environment it calls the real services; without them
// it returns clearly labeled mock results so the Role Play screens can be
// tested end to end.
function devRoleplay() {
  const mock = {
    transcribe: ({ audio }) => {
      const secs = Math.max(1, Math.round((audio || '').length * 0.75 / 3000))
      const text = '(dev mock transcript) Good morning. Thank you for meeting with me. I reviewed the information and prepared my recommendation. First, the key numbers. Second, the journal entries. Finally, my recommendation and the risks to watch.'
      return { text, segments: [{ start: 0, end: secs, text }], duration: secs }
    },
    grade: ({ roleplay }) => {
      const items = roleplay.rubric.items.map((it, i) => {
        const score = Math.round(it.max * (0.55 + (i % 3) * 0.1))
        const level = Object.entries(it.bands).find(([, [lo, hi]]) => score >= lo && score <= hi)?.[0]
        return { label: it.label, kind: it.kind, max: it.max, score, level, evidence: '"I prepared my recommendation"', feedback: '(dev mock) Explain the key numbers and why they matter to the judge.' }
      })
      return { items, total: items.reduce((s, x) => s + x.score, 0), summary: '(dev mock score) Real scoring needs GEMINI_API_KEY.', strengths: ['Clear opening'], improvements: ['State the key numbers'], missed_points: ['(dev mock)'], judge_answers: [], model: 'dev-mock' }
    },
    judge: ({ roleplay }) => ({ questions: (roleplay.judge_questions || []).slice(0, 2).map(q => `(AI judge mock) ${q}`) }),
    chat: ({ messages }) => ({ reply: `(dev mock coach) You asked: "${messages[messages.length - 1]?.text}". Real answers need GEMINI_API_KEY.` }),
  }
  return {
    name: 'dev-roleplay',
    configureServer(server) {
      server.middlewares.use('/api/roleplay', (req, res) => {
        let raw = ''
        req.on('data', c => { raw += c })
        req.on('end', async () => {
          const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
          let body = {}
          try { body = JSON.parse(raw || '{}') } catch {}
          const real = body.action === 'transcribe' ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY
          try {
            if (real) {
              const api = await server.ssrLoadModule('/api/roleplay.js')
              const fn = { transcribe: () => api.transcribe(body.audio, body.mime), grade: () => api.grade(body), judge: () => api.judgeQuestions(body), chat: () => api.chat(body) }[body.action]
              return fn ? send(200, await fn()) : send(400, { error: 'unknown action' })
            }
            if (!mock[body.action]) return send(400, { error: 'unknown action' })
            setTimeout(() => send(200, mock[body.action](body)), 600)
          } catch (e) { send(500, { error: e.message }) }
        })
      })
    },
  }
}

// Local stand in for api/report.js during `npm run dev`: reports are saved to
// .data/reports/ (git ignored), so the bug button works without Vercel.
function devReports() {
  const dir = path.resolve('.data/reports')
  return {
    name: 'dev-reports',
    configureServer(server) {
      server.middlewares.use('/api/report', (req, res) => {
        const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
        if (req.method === 'POST') {
          let raw = ''
          req.on('data', c => { raw += c })
          req.on('end', () => {
            let body = {}
            try { body = JSON.parse(raw || '{}') } catch {}
            if (!body.text) return send(400, { error: 'empty report' })
            const cut = (v, n) => (v == null ? null : String(v).slice(0, n))
            const report = {
              at: new Date().toISOString(), subject: cut(body.subject, 200) || 'DECA app issue',
              user: cut(body.user, 60), screen: cut(body.screen, 60), item: cut(body.item, 120), text: cut(body.text, 8000),
            }
            const id = `${report.at.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`
            fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(report, null, 1))
            send(200, { ok: true, id, emailed: false })
          })
          return
        }
        if (req.method === 'DELETE') {
          const q = new URL(req.originalUrl || req.url, 'http://x').searchParams
          const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')) : []
          if (q.get('all')) { files.forEach(f => fs.unlinkSync(path.join(dir, f))); return send(200, { ok: true, deleted: files.length }) }
          const id = q.get('id') || ''
          if (!/^[\w-]+$/.test(id)) return send(400, { error: 'missing or bad id' })
          const f = path.join(dir, `${id}.json`)
          if (fs.existsSync(f)) fs.unlinkSync(f)
          return send(200, { ok: true, deleted: 1 })
        }
        if (req.method === 'GET') {
          const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse() : []
          const reports = files.slice(0, 50).map(f => ({ id: f.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }))
          return send(200, { reports, total: files.length })
        }
        send(405, { error: 'method not allowed' })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devProgress(), devRoleplay(), devReports()],
  define: { __APP_BUILD__: JSON.stringify(buildStamp()) },
  build: { outDir: 'dist' }
})
