import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Build stamp shown in bug reports: Vercel's commit, or the local commit.
function buildStamp() {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA || ''
  if (!sha) { try { sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch {} }
  return `${sha ? sha.slice(0, 7) : 'local'} ${new Date().toISOString().slice(0, 16)}Z`
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
  plugins: [react(), devReports()],
  define: { __APP_BUILD__: JSON.stringify(buildStamp()) },
  build: { outDir: 'dist' }
})
