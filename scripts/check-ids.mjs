// Protects student history. Progress is saved per card id and per question id,
// so an id must stay with its item for good. Ids are explicit integers that
// come from the "Card ID" and "Question ID" columns of DECA_Data_Raw.xlsx;
// they are never derived from text or position.
//
// data/id_registry.json records every id ever issued with a fingerprint of its
// content. This script runs before every build and fails when:
//   * an id in the registry is missing from the app data (history would be
//     orphaned): printed as RETIRED IDS; rerun with --accept-retired if the
//     removal is intended (for example a card merged into another)
//   * an id now holds clearly different content (history would attach to the
//     wrong item): printed as CHANGED IDS; rerun with --accept-changed only if
//     it really is the same item, rewritten
//   * a retired id comes back with different content, ids repeat, ids are not
//     integers, or card/question links point at missing ids or are not mirrored
// A retired id that comes back with the same content is revived automatically.
// New items must use the next free id (printed below), never a retired one.
//
// Never edit or delete entries in data/id_registry.json by hand.
//
//   npm run check-ids                      check and update the registry
//   npm run check-ids -- --accept-retired  record intended removals
//   npm run check-ids -- --accept-changed  accept rewritten items
//   node scripts/check-ids.mjs --registry <file> --cards <file> --questions <file>

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def }
const ACCEPT_RETIRED = args.includes('--accept-retired')
const ACCEPT_CHANGED = args.includes('--accept-changed')
const READ_ONLY = !!process.env.VERCEL || args.includes('--read-only')
const REG_FILE = opt('--registry', 'data/id_registry.json')
const WARN_FILE = path.join(path.dirname(REG_FILE), 'id_warnings.txt')
const cards = JSON.parse(fs.readFileSync(opt('--cards', 'public/flashcards.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(opt('--questions', 'public/questions.json'), 'utf8'))

const fp = (s, n = 240) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, n)
const words = (s) => new Set(fp(s, 100000).split(' ').filter(w => w.length > 2))
// Share of the shorter text's words found in the other one (1 = same wording).
function overlap(a, b) {
  const A = words(a), B = words(b)
  if (!A.size || !B.size) return A.size === B.size ? 1 : 0
  let n = 0
  for (const w of A) if (B.has(w)) n++
  return n / Math.min(A.size, B.size)
}
const today = new Date().toISOString().slice(0, 10)

const describe = {
  cards: (c) => ({ term: fp(c.term, 120), def: fp(c.definition), chapter: c.chapter }),
  questions: (q) => ({ stem: fp(q.question), category: q.category }),
}
const sameItem = {
  cards: (e, d) => e.term === d.term || overlap(e.def, d.def) >= 0.5,
  questions: (e, d) => e.stem === d.stem || overlap(e.stem, d.stem) >= 0.6,
}
const label = {
  cards: (e) => `"${e.term || '?'}"`,
  questions: (e) => `"${(e.stem || '?').slice(0, 70)}"`,
}

const errors = []
const notes = []

// ── Basic integrity ───────────────────────────────────────────────────
for (const [kind, list] of [['cards', cards], ['questions', questions]]) {
  const seen = new Set()
  for (const it of list) {
    if (!Number.isInteger(it.id) || it.id < 0) errors.push(`${kind}: id ${JSON.stringify(it.id)} is not a whole number`)
    if (seen.has(it.id)) errors.push(`${kind}: id ${it.id} is used twice`)
    seen.add(it.id)
  }
}
const cardIds = new Set(cards.map(c => c.id)), qIds = new Set(questions.map(q => q.id))
const c2q = new Set(), q2c = new Set()
for (const c of cards) for (const q of c.questions || []) {
  if (!qIds.has(q)) errors.push(`card ${c.id} links to missing question ${q}`)
  c2q.add(`${c.id}|${q}`)
}
for (const q of questions) for (const c of q.cards || []) {
  if (!cardIds.has(c)) errors.push(`question ${q.id} links to missing card ${c}`)
  q2c.add(`${c}|${q.id}`)
}
for (const k of c2q) if (!q2c.has(k)) errors.push(`card ${k.split('|')[0]} lists question ${k.split('|')[1]}, but the question does not list the card`)
for (const k of q2c) if (!c2q.has(k)) errors.push(`question ${k.split('|')[1]} lists card ${k.split('|')[0]}, but the card does not list the question`)

// ── Registry ──────────────────────────────────────────────────────────
const fresh = !fs.existsSync(REG_FILE)
const reg = fresh ? {} : JSON.parse(fs.readFileSync(REG_FILE, 'utf8'))
reg.cards ||= {}; reg.questions ||= {}

const retiredNow = [], changed = [], revived = [], reused = [], added = []

for (const [kind, list] of [['cards', cards], ['questions', questions]]) {
  const entries = reg[kind]
  const live = new Set(list.map(it => String(it.id)))

  if (fresh) {
    // First run: every id in the data is live. Gaps below the highest id were
    // issued before and removed (hidden duplicates, merged cards); record them
    // as retired so they are never handed to a different item.
    const max = Math.max(-1, ...list.map(it => it.id))
    for (let i = 0; i <= max; i++) {
      if (!live.has(String(i))) entries[i] = { retired: 'before registry', note: 'not in the app data when the registry was created' }
    }
  }

  for (const it of list) {
    const id = String(it.id)
    const d = describe[kind](it)
    const e = entries[id]
    if (!e) { entries[id] = { ...d, since: today }; if (!fresh) added.push(`${kind} ${id} ${label[kind](d)}`); continue }
    const hasPrint = kind === 'cards' ? e.term != null : e.stem != null
    if (e.retired) {
      if (hasPrint && sameItem[kind](e, d)) revived.push(`${kind} ${id} ${label[kind](d)}`)
      else if (ACCEPT_CHANGED) revived.push(`${kind} ${id} ${label[kind](d)} (accepted with --accept-changed)`)
      else { reused.push(`${kind} ${id}: retired ${e.retired}${hasPrint ? ` (was ${label[kind](e)})` : ''}, now ${label[kind](d)}`); continue }
    } else if (hasPrint && !sameItem[kind](e, d)) {
      if (!ACCEPT_CHANGED) { changed.push(`${kind} ${id}: was ${label[kind](e)}, now ${label[kind](d)}`); continue }
      notes.push(`accepted change: ${kind} ${id}: was ${label[kind](e)}, now ${label[kind](d)}`)
    }
    entries[id] = { ...d, since: e.since || today }
  }

  for (const [id, e] of Object.entries(entries)) {
    if (live.has(id) || e.retired) continue
    retiredNow.push(`${kind} ${id} ${label[kind](e)}`)
    if (ACCEPT_RETIRED) e.retired = today
  }
}

if (retiredNow.length && !ACCEPT_RETIRED) errors.push(`RETIRED IDS: ${retiredNow.length} id(s) are no longer in the app data. Students' history for them would stop showing:\n  ${retiredNow.join('\n  ')}\n  If the removal is intended, run: npm run check-ids -- --accept-retired`)
if (changed.length) errors.push(`CHANGED IDS: these ids now hold different content, so old history would attach to the wrong item. Give the new item a new id and put the old one back:\n  ${changed.join('\n  ')}`)
if (reused.length) errors.push(`REUSED RETIRED IDS: new items must use a new id, never a retired one:\n  ${reused.join('\n  ')}`)

const nextId = (kind) => Math.max(-1, ...Object.keys(reg[kind]).map(Number)) + 1
const lines = []
if (retiredNow.length && ACCEPT_RETIRED) lines.push(`RETIRED IDS (recorded ${today}, history kept on the server but no longer shown):\n  ${retiredNow.join('\n  ')}`)
if (revived.length) lines.push(`REVIVED IDS (came back, old history shows again):\n  ${revived.join('\n  ')}`)
if (added.length) lines.push(`NEW IDS: ${added.length} (${added.slice(0, 5).join('; ')}${added.length > 5 ? '; …' : ''})`)
lines.push(...notes)
const total = (kind) => Object.values(reg[kind]).filter(e => e.retired).length
lines.push(`Ids: ${cards.length} cards, ${questions.length} questions live; ${total('cards')} card ids and ${total('questions')} question ids retired.`)
lines.push(`Next free ids: card ${nextId('cards')}, question ${nextId('questions')}.`)

if (errors.length) {
  console.error(`\n✗ ID CHECK FAILED (student history protection)\n\n${errors.join('\n\n')}\n`)
  if (!READ_ONLY) fs.writeFileSync(WARN_FILE, `ID CHECK FAILED\n\n${errors.join('\n\n')}\n`)
  process.exit(1)
}

console.log(`✓ id check passed. ${lines.join('\n')}`)
if (!READ_ONLY) {
  const sorted = (o) => Object.fromEntries(Object.keys(o).sort((a, b) => a - b).map(k => [k, o[k]]))
  // One entry per line keeps the file small and its git diffs readable.
  const block = (o) => Object.entries(sorted(o)).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')
  const text = `{\n "_readme": "Written by scripts/check-ids.mjs. Every card and question id ever issued. Do not edit; never delete entries.",\n "cards": {\n${block(reg.cards)}\n },\n "questions": {\n${block(reg.questions)}\n }\n}\n`
  fs.mkdirSync(path.dirname(REG_FILE), { recursive: true })
  if (!fs.existsSync(REG_FILE) || fs.readFileSync(REG_FILE, 'utf8').replace(/\r\n/g, '\n') !== text) fs.writeFileSync(REG_FILE, text)
  const warn = retiredNow.length || revived.length ? lines.join('\n') + '\n' : 'No retired or revived ids in the last check.\n'
  if (!fs.existsSync(WARN_FILE) || fs.readFileSync(WARN_FILE, 'utf8').replace(/\r\n/g, '\n') !== warn) fs.writeFileSync(WARN_FILE, warn)
}
