// Copies the DECA ACT role plays into the app (desktop Role Play tab).
//
// Sources (the "DECA Role play" folder, set ROLEPLAY_DIR to override):
//   output/json/*.json                official role plays, one file each
//   source/*.pdf, source/NEW/*.pdf    the official PDFs; each one's Judge's
//                                     Evaluation Form decides its rubric layout
//   new scenarios/json/*.json         AI-made practice scenarios
//   new scenarios/rubrics/*.json      rubric written for each practice scenario
//
// Output (committed):
//   public/roleplays/index.json       list for the library screen
//   public/roleplays/<rp_id>.json     full role play plus its rubric
//   data/roleplay_ids.json            every role play id ever published
//
// Role play ids are permanent: attempts are saved under them. The script
// fails (RETIRED ROLE PLAY IDS) if an id that was published before is missing,
// unless run with --accept-retired. It never runs on Vercel and never replaces
// the content with an empty set.
//
//   npm run sync-roleplays [-- --accept-retired]

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

if (process.env.VERCEL) { console.log('sync-roleplays: skipped on Vercel'); process.exit(0) }

const ROOT = process.env.ROLEPLAY_DIR || 'C:\\Users\\ljunh\\OneDrive\\Desktop\\claude\\DECA Role play'
const OUT = 'public/roleplays'
const IDS = 'data/roleplay_ids.json'
const ACCEPT_RETIRED = process.argv.includes('--accept-retired')
const today = new Date().toISOString().slice(0, 10)

const readDir = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) : []

// ── Rubric layouts, copied from the official Judge's Evaluation Forms ──────
const LEVELS = {
  exceeds: 'Demonstrated the performance indicator in an extremely professional manner; greatly exceeds business standards; would rank in the top 10% of business personnel performing this performance indicator.',
  meets: 'Demonstrated the performance indicator in an acceptable and effective manner; meets at least minimal business standards; there would be no need for additional formalized training at this time; would rank in the 70-89th percentile.',
  below: 'Demonstrated the performance indicator with limited effectiveness; performance generally fell below minimal business standards; additional training would be required; would rank in the 50-69th percentile.',
  little: 'Demonstrated the performance indicator with little or no effectiveness; a great deal of formal training would be needed immediately; would rank in the 0-49th percentile.',
}
const B = (little, below, meets, exceeds) => ({ little, below, meets, exceeds })
const STD_SKILLS = [
  'Critical Thinking: Reason effectively and use systems thinking',
  'Problem Solving: Make judgments and decisions and solve problems',
  'Communication: Communicate clearly',
  'Creativity and Innovation: Show evidence of creativity',
]
const OVERALL = "Overall impression and responses to the judge's questions"

function officialRubric(format, rp) {
  const pis = rp.performance_indicators
  if (format === 'legacy16') return { format, items: [
    ...pis.map(label => ({ kind: 'pi', label, max: 16, bands: B([0, 5], [6, 9], [10, 13], [14, 16]) })),
    { kind: 'skill', label: 'Reason effectively, use systems thinking, make judgments and decisions, and solve problems', max: 10, bands: B([0, 3], [4, 6], [7, 8], [9, 10]) },
    { kind: 'overall', label: OVERALL, max: 10, bands: B([0, 3], [4, 6], [7, 8], [9, 10]) },
  ] }
  if (format === 'sample18') return { format, items: [
    ...pis.map(label => ({ kind: 'pi', label, max: 18, bands: B([0, 5], [6, 11], [12, 15], [16, 18]),
      criteria: { exceeds: `Very effectively: ${label.toLowerCase()}.`, meets: `Effectively: ${label.toLowerCase()}.`, below: `Adequately: ${label.toLowerCase()}.`, little: 'Attempts were inadequate, weak or incorrect.' } })),
    { kind: 'overall', label: OVERALL, max: 10, bands: B([0, 1], [2, 4], [5, 7], [8, 10]),
      criteria: { exceeds: "Demonstrated skills confidently and professionally; answered the judge's questions very effectively and thoroughly.", meets: "Demonstrated the specified skills; answered the judge's questions effectively.", below: "Demonstrated limited ability to link some skills; answered the judge's questions adequately.", little: "Demonstrated few skills; could not answer the judge's questions." } },
  ] }
  // modern14: every form from 2017 to 2026
  const skills = rp.century_skills?.length ? rp.century_skills : STD_SKILLS
  return { format: 'modern14', items: [
    ...pis.map(label => ({ kind: 'pi', label, max: 14, bands: B([0, 4], [5, 8], [9, 11], [12, 14]) })),
    ...skills.map(label => ({ kind: 'skill', label, max: 6, bands: B([0, 1], [2, 3], [4, 4], [5, 6]) })),
    { kind: 'overall', label: OVERALL, max: 6, bands: B([0, 1], [2, 3], [4, 4], [5, 6]) },
  ] }
}

function pdfFormat(file) {
  let text = ''
  try { text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null }
  const form = text.slice(Math.max(0, text.search(/JUDGE.S EVALUATION FORM/i)))
  if (/12-13-14/.test(form)) return 'modern14'
  if (/14-15-16/.test(form)) return 'legacy16'
  if (/16, 17, 18/.test(form)) return 'sample18'
  return null
}

function findPdf(name) {
  for (const dir of ['source', path.join('source', 'NEW')]) {
    const p = path.join(ROOT, dir, path.basename(name || ''))
    if (name && fs.existsSync(p)) return p
  }
  return null
}

// ── Build ─────────────────────────────────────────────────────────────────
const warnings = [], errors = []
const official = readDir(path.join(ROOT, 'output', 'json'))
const practice = readDir(path.join(ROOT, 'new scenarios', 'json'))
if (official.length + practice.length === 0) { console.error(`No role plays found under ${ROOT}. Nothing written.`); process.exit(1) }

const all = []
for (const rp of official) {
  const pdf = findPdf(rp.source_pdf)
  let format = pdf ? pdfFormat(pdf) : null
  if (!format) { format = 'modern14'; warnings.push(`${rp.rp_id}: rubric layout not found in ${pdf || rp.source_pdf || 'no PDF'}; using the 2017-2026 form`) }
  all.push({ ...rp, kind: 'official', rubric: { ...officialRubric(format, rp), source: `Judge's Evaluation Form in ${path.basename(rp.source_pdf || '')}` } })
}
for (const rp of practice) {
  const file = path.join(ROOT, 'new scenarios', 'rubrics', `${rp.rp_id}.json`)
  let rubric
  if (fs.existsSync(file)) {
    const r = JSON.parse(fs.readFileSync(file, 'utf8'))
    const pis = r.items.filter(i => i.kind === 'pi').map(i => i.label)
    const sum = r.items.reduce((s, i) => s + i.max, 0)
    if (sum !== 100) errors.push(`${rp.rp_id}: rubric maxes add to ${sum}, not 100`)
    if (JSON.stringify(pis) !== JSON.stringify(rp.performance_indicators)) warnings.push(`${rp.rp_id}: rubric PI labels differ from the scenario's performance indicators`)
    rubric = { format: r.format || 'modern14', items: r.items, key_points: r.key_points || [], source: r.written_by || 'Rubric written for this practice scenario' }
  } else {
    warnings.push(`${rp.rp_id}: no rubric in new scenarios/rubrics; using the 2017-2026 form without scenario criteria`)
    rubric = { ...officialRubric('modern14', rp), source: 'Standard 2017-2026 Judge\'s Evaluation Form' }
  }
  all.push({ ...rp, kind: 'practice', rubric })
}

// Real ACT role plays have no "Exhibits" section: data tables are printed
// inside the participant's instructions. The converted files moved those
// tables into exhibits; mark each one so Test mode can show only the tables
// that add data the scenario text does not already contain (inside the
// scenario, with no "Exhibits" heading), and hide judge-only tables.
const words = (s) => String(s).toLowerCase().replace(/,/g, '').match(/[a-z]{3,}|\d+(\.\d+)?/g) || []
for (const rp of all) {
  const text = new Set(words(rp.scenario))
  // A "[Table ...]" / "[...: see exhibits]" marker, or text pointing to the
  // exhibits, means the tables are part of the sheet: always show them.
  const placeholder = /\[Table|\bexhibits?\b/i.test(rp.scenario)
  rp.exhibits = (rp.exhibits || []).map(e => {
    const cells = words((e.rows || []).flat().join(' '))
    const covered = cells.length ? cells.filter(w => text.has(w)).length / cells.length : 1
    return { ...e, judge_only: /judge|solution/i.test(e.title || ''), repeats_scenario: !placeholder && covered >= 0.8 }
  })
}

// Solution tables (DECA Role play/solution_tables/<rp_id>.json): debit/credit
// and accounting-equation tables shown inside each solution step, with the
// bullets, entries and calculations they replace hidden (nothing shown twice).
const near = (a, b) => Math.abs(a - b) < 0.005
for (const rp of all) {
  const file = path.join(ROOT, 'solution_tables', `${rp.rp_id}.json`)
  if (!fs.existsSync(file)) continue
  const t = JSON.parse(fs.readFileSync(file, 'utf8'))
  const tasks = rp.solution?.by_task || []
  for (const tk of t.tasks || []) {
    if (!tasks[tk.task_index]) { errors.push(`${rp.rp_id}: solution table for missing task ${tk.task_index}`); continue }
    for (const tb of tk.tables || []) {
      if (tb.type === 'journal') {
        const d = tb.lines.reduce((s, l) => s + (l.debit || 0), 0), c = tb.lines.reduce((s, l) => s + (l.credit || 0), 0)
        if (!near(d, c)) errors.push(`${rp.rp_id}: journal table "${tb.title}" does not balance (${d} vs ${c})`)
      } else if (tb.type === 'equation') {
        for (const r of tb.rows || []) if (!near(r.assets, r.liabilities + r.equity)) errors.push(`${rp.rp_id}: equation row "${r.label}" does not balance`)
      } else errors.push(`${rp.rp_id}: unknown table type ${tb.type}`)
    }
  }
  if ((rp.solution?.journal_entries || []).length && !t.covers_journal_entries) warnings.push(`${rp.rp_id}: solution tables do not cover the existing journal entries; they stay in their own block`)
  rp.solution = { ...rp.solution, tables: { tasks: t.tasks || [], covers_journal_entries: !!t.covers_journal_entries, hide_calculations: t.hide_calculations || [] } }
}

// Account categories ("Asset - Cash") for every journal line, from
// data/account_categories.json. An account missing there fails the sync.
const CATS = JSON.parse(fs.readFileSync('data/account_categories.json', 'utf8')).accounts
const tagLines = (rp, lines) => lines.map(l => {
  const category = CATS[String(l.account).trim()]
  if (!category) errors.push(`${rp.rp_id}: account "${l.account}" has no category; add it to data/account_categories.json`)
  return { ...l, category: category || null }
})
for (const rp of all) {
  const sol = rp.solution || {}
  if (sol.journal_entries) sol.journal_entries = sol.journal_entries.map(je => ({ ...je, lines: tagLines(rp, je.lines || []) }))
  for (const tk of sol.tables?.tasks || []) tk.tables = (tk.tables || []).map(tb => tb.type === 'journal' ? { ...tb, lines: tagLines(rp, tb.lines) } : tb)
}

for (const rp of all) {
  if (!rp.rp_id || !/^[\w-]+$/.test(rp.rp_id)) errors.push(`bad rp_id ${JSON.stringify(rp.rp_id)}`)
  const total = rp.rubric.items.reduce((s, i) => s + i.max, 0)
  if (total !== 100) errors.push(`${rp.rp_id}: rubric totals ${total}, not 100`)
}
const seen = new Set()
for (const rp of all) { if (seen.has(rp.rp_id)) errors.push(`duplicate rp_id ${rp.rp_id}`); seen.add(rp.rp_id) }

// ── Permanent ids ─────────────────────────────────────────────────────────
const reg = fs.existsSync(IDS) ? JSON.parse(fs.readFileSync(IDS, 'utf8')) : { ids: {} }
const retired = []
for (const [id, e] of Object.entries(reg.ids)) {
  if (seen.has(id)) { if (e.retired) { delete e.retired; warnings.push(`REVIVED ROLE PLAY ID ${id}`) } continue }
  if (!e.retired) { retired.push(`${id} "${e.title}"`); if (ACCEPT_RETIRED) e.retired = today }
}
if (retired.length && !ACCEPT_RETIRED) errors.push(`RETIRED ROLE PLAY IDS: these were published before and are now missing, so their attempt history would stop showing:\n  ${retired.join('\n  ')}\n  If intended, run: npm run sync-roleplays -- --accept-retired`)
for (const rp of all) reg.ids[rp.rp_id] = { ...(reg.ids[rp.rp_id] || { since: today }), title: rp.title }

if (errors.length) { console.error(`\n✗ sync-roleplays failed\n  ${errors.join('\n  ')}\n`); process.exit(1) }

// ── Write ─────────────────────────────────────────────────────────────────
const writeIfChanged = (file, obj) => {
  const text = JSON.stringify(obj) + '\n'
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text)
}
fs.mkdirSync(OUT, { recursive: true })
const order = (rp) => [rp.kind === 'official' ? 0 : 1, -(rp.year || 0), rp.rp_id]
all.sort((a, b) => { const x = order(a), y = order(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0 })
for (const rp of all) writeIfChanged(path.join(OUT, `${rp.rp_id}.json`), rp)
// Remove files for role plays no longer published (their ids stay in the registry).
for (const f of fs.readdirSync(OUT)) if (f !== 'index.json' && f.endsWith('.json') && !seen.has(f.slice(0, -5))) fs.unlinkSync(path.join(OUT, f))
writeIfChanged(path.join(OUT, 'index.json'), {
  synced: today,
  roleplays: all.map(rp => ({
    rp_id: rp.rp_id, kind: rp.kind, title: rp.title, level: rp.level, year: rp.year, event: rp.event_number,
    area: rp.instructional_area, difficulty: rp.difficulty?.score ?? null, participant_role: rp.participant_role,
    pis: rp.performance_indicators, rubric: rp.rubric.format,
  })),
})
const sorted = Object.fromEntries(Object.keys(reg.ids).sort().map(k => [k, reg.ids[k]]))
writeIfChanged(IDS, { _readme: 'Written by scripts/sync-roleplays.mjs. Every role play id ever published. Do not edit; never delete entries.', ids: sorted })

const count = (k) => all.filter(r => r.kind === k).length
const formats = all.reduce((m, r) => (m[r.rubric.format] = (m[r.rubric.format] || 0) + 1, m), {})
console.log(`✓ ${all.length} role plays synced (${count('official')} official, ${count('practice')} practice). Rubric layouts: ${JSON.stringify(formats)}.`)
if (retired.length) console.log(`RETIRED ROLE PLAY IDS (recorded ${today}):\n  ${retired.join('\n  ')}`)
if (warnings.length) console.log(`Warnings:\n  ${warnings.join('\n  ')}`)
