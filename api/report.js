import { list } from '@vercel/blob'
import { readJSON, writeJSON } from './_blob.js'

// Bug reports: POST saves one JSON blob per report under reports/ (same
// PRIVATE store as progress), GET returns the newest 50. If RESEND_API_KEY is
// set, each report is also emailed to REPORT_TO. An email failure never fails
// the request: the saved copy is what counts.
// This endpoint has no login. Reports hold only notes and device details.

const REPORT_TO = process.env.REPORT_TO || 'ljunho7@gmail.com'
const auth = process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {}
const cut = (v, n) => (v == null ? null : String(v).slice(0, n))

export function makeReport(body) {
  return {
    at: new Date().toISOString(),
    subject: cut(body.subject, 200) || 'DECA app issue',
    user: cut(body.user, 60), screen: cut(body.screen, 60), item: cut(body.item, 120),
    text: cut(body.text, 8000) || '',
  }
}

async function email(report) {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.REPORT_FROM || 'DECA app reports <onboarding@resend.dev>',
      to: [REPORT_TO], subject: report.subject, text: report.text,
    }),
  })
  if (!r.ok) throw new Error(`email failed: ${r.status} ${await r.text()}`)
  return true
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'POST') {
      let body = req.body
      if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
      if (!body?.text) return res.status(400).json({ error: 'empty report' })
      const report = makeReport(body)
      const id = `${report.at.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`
      await writeJSON(`reports/${id}.json`, report)
      let emailed = false
      try { emailed = await email(report) } catch (e) { console.error(e) }
      return res.status(200).json({ ok: true, id, emailed })
    }
    if (req.method === 'GET') {
      const blobs = []
      let cursor
      do {
        const page = await list({ prefix: 'reports/', limit: 1000, cursor, ...auth })
        blobs.push(...page.blobs)
        cursor = page.hasMore ? page.cursor : undefined
      } while (cursor)
      const newest = blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1)).slice(0, 50)
      const reports = await Promise.all(newest.map(async b => ({ id: b.pathname.slice(8, -5), ...(await readJSON(b.pathname)) })))
      return res.status(200).json({ reports, total: blobs.length })
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method not allowed' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
