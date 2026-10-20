// New cards and New exam tabs: practice content we wrote for 2026-27 (not from
// past exams). Reads the two folders beside the repo and writes
//   public/new_flashcards.json   (shape of flashcards.json, type "new2027")
//   public/new_questions.json    (shape of questions.json, no exam year)
// Ids are the authored strings (NF27-C001, NF27-Q001, ...). They never collide
// with the numeric ids of the main bank, so progress, bookmarks and the review
// cascade use the same progress record. Ids are permanent: they are checked by
// scripts/check-ids.mjs against data/new_id_registry.json before every build.
//
//   npm run sync-new [-- --src <folder containing "new flashcards" and "new questions">]

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def }
const SRC = opt('--src', 'C:/Users/ljunh/OneDrive/Desktop/claude/DECA')
const read = (p) => JSON.parse(fs.readFileSync(path.join(SRC, p), 'utf8'))

const rawCards = read('new flashcards/generated_flashcards.json')
const rawQs = read('new questions/generated_questions.json')
const errors = []

// Use the app's own chapter and category names (Flashcards CHAPTERS, Exam CATEGORIES).
const CHAPTER = { 'Communication Skills': 'Communications', Marketing: 'Marketing & Strategy', 'Strategic Management': 'Marketing & Strategy', Entrepreneurship: 'Marketing & Strategy' }
const CATEGORY = { 'Communication Skills': 'Communications' }

const cards = rawCards.map(c => ({
  id: c.id, term: c.term, definition: c.definition, chapter: CHAPTER[c.chapter] || c.chapter, type: 'new2027',
  questions: c.questions || [], pi: c.pi || null, pi_text: c.pi_text || null,
  ...(c.topic_tag ? { tag: c.topic_tag } : {}),
}))
const questions = rawQs.map(q => ({
  id: q.id, category: CATEGORY[q.category] || q.category, question: q.question, A: q.A, B: q.B, C: q.C, D: q.D,
  answer: q.answer, explanation: q.explanation, cards: q.cards || [],
  pi: q.pi || null, pi_text: q.pi_text || null, pattern: q.construction_pattern || null,
}))

const cardIds = new Set(cards.map(c => c.id)), qIds = new Set(questions.map(q => q.id))
if (cardIds.size !== cards.length) errors.push('duplicate card ids')
if (qIds.size !== questions.length) errors.push('duplicate question ids')
for (const c of cards) {
  if (!/^NF\d+-C\d+$/.test(c.id)) errors.push(`card id ${c.id} is not NF..-C...`)
  for (const k of ['term', 'definition', 'chapter']) if (!c[k]) errors.push(`card ${c.id}: missing ${k}`)
  for (const q of c.questions) if (!qIds.has(q)) errors.push(`card ${c.id} links to missing question ${q}`)
}
for (const q of questions) {
  if (!/^NF\d+-Q\d+$/.test(q.id)) errors.push(`question id ${q.id} is not NF..-Q...`)
  for (const k of ['question', 'A', 'B', 'C', 'D', 'answer', 'category']) if (!q[k]) errors.push(`question ${q.id}: missing ${k}`)
  if (!'ABCD'.includes(q.answer) || q.answer.length !== 1) errors.push(`question ${q.id}: answer ${q.answer}`)
  for (const c of q.cards) {
    if (!cardIds.has(c)) errors.push(`question ${q.id} links to missing card ${c}`)
    else if (!cards.find(x => x.id === c).questions.includes(q.id)) errors.push(`question ${q.id} lists card ${c}, but the card does not list it`)
  }
}

if (errors.length) { console.error(`sync-new failed:\n  ${errors.join('\n  ')}`); process.exit(1) }
fs.writeFileSync('public/new_flashcards.json', JSON.stringify(cards))
fs.writeFileSync('public/new_questions.json', JSON.stringify(questions))
console.log(`New content: ${cards.length} cards, ${questions.length} questions. Now run npm run check-ids.`)
