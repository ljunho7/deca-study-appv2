# CLAUDE.md — DECA Study App v2

Read this first in every session. Put this file at the repo root so Claude Code loads it automatically.

## What this is

A study app for a high school DECA competitor in **ACT (Accounting Applications Series)**, which uses the Finance cluster exam. Flashcards linked to real exam questions, a practice exam, and a review cascade that ties the two together. Companion to a 14-chapter Word study guide (`DECA_Study_Guide_2026.docx`, kept outside the repo).

## Repo, deploy, local

| | |
|---|---|
| Repo | `github.com/ljunho7/deca-study-appv2`, branch `main` (see `git log` for the latest commit) |
| Live | https://deca-study-appv2.vercel.app (Vercel project `deca-study-appv2`, auto-deploys from `main`) |
| Local clone | `C:\Users\ljunh\OneDrive\Desktop\claude\DECA\deca-project\repo-check` (git clone). The older `deca-app` folder beside it is not a git repo and has stale data; do not work there. |
| Master data | `C:\Users\ljunh\OneDrive\Desktop\claude\DECA\DECA_Data_Raw.xlsx` (outside the repo) |
| Old repo | `deca-study-app` is retired. Never push there. |

Stack: React 18 + Vite, Tailwind via CDN, Material Symbols, Inter font. Vercel serverless API routes (Node runtime) with Vercel Blob for storage.

```
npm install
npm run dev        # local at http://localhost:5173
npm run check-ids  # student history check (also runs before every build)
npm run build      # outputs to dist/
git push origin main   # Vercel builds automatically
```

## Data model

- `public/questions.json`: 3,080 active questions. 484 near-duplicate copies are hidden (text never edited; most recent exam year kept). Each has `cards: [ids]`.
- `public/flashcards.json`: 1,771 cards. Each has `questions: [ids]`. Types: `standard`, `pi`, `trend`, `exam2026`.
- Links are many-to-many (4,077 links). Every active question links to at least one card. 261 cards teach study-guide concepts no question in the bank tests; that is intentional.
- Card 761 deliberately teaches both official answers for "first step in project planning" (identify stakeholders vs. define purpose and scope) because different exams key it differently.
- Ids are explicit integers from the workbook's "Card ID" and "Question ID" columns. Never change an existing id and never reuse a removed one; progress is keyed by these ids. See "Student history" below.
- The master workbook `DECA_Data_Raw.xlsx` has sheets: Questions, Flashcards, Card to Questions, Question to Cards, Duplicate Questions, Link Review Changes, Review Log. When data changes, update the workbook and regenerate the two JSONs from it, not the other way around.

## Server storage (do not regress this)

- The Blob store attached to this Vercel project is **PRIVATE**. All routes go through `api/_blob.js` with `access: 'private'` (`@vercel/blob ^2.8.0`). Using `access: 'public'` fails with "Cannot use public access on a private store" and the UI still shows "Saved," so the bug is silent. This was live for weeks before it was caught on Sept 28, 2026.
- `api/progress.js` merges each save with the stored copy (newest entry per card or question wins; exam history is combined). Never replace the stored blob wholesale.
- On login the app pulls server progress, merges with the device, and pushes back what the server lacked. A red banner shows if the server is unreachable; failed saves show "Not saved to server" and retry.
- API routes use the Node.js runtime. Do **not** add `export const config = { runtime: 'edge' }` and do **not** add a `functions.runtime` block to `vercel.json`. Both broke the build in earlier versions.
- A stray test record `zz_diag_test` exists in the Blob store. Safe to delete.

## App behavior

- Login is fixed to two users: **Hannah (0325)** and **Debug (0000)**. No sign-up. Do not add a registration flow.
- Cards tab: filters New / Forgot / Review / Known (multi-select, default New + Forgot + Review), each set ends after its last card (no second round; changed Sept 29, 2026), two responses only (Forgot, Got it). Card back lists linked exam questions with all four choices; tap to reveal answer and explanation.
- Exam tab: top dropdown picks the exam year (All years or one year); the category list at the bottom picks the category ("All categories" is its first row). Filters New / Incorrect / Hard / Review / Easy (default New + Incorrect + Hard + Review), each set ends after its last question and shows results (no second round), Hard/Easy rating above the question, linked flashcards shown after each answer.
- Review cascade (`src/lib/review.js`): card marked Forgot → all linked questions become Review. Question answered Incorrect or rated Hard → all linked cards become Review. Review clears on the next answer.
- Home shows Cards and Exam dashboards. The leaderboard was removed; do not bring it back.
- App / Desktop switch (`src/components/ModeSwitch.jsx`, `src/lib/mode.js`, localStorage `deca_mode`, default `app`) on the login page, on Home in app mode, and in the desktop sidebar. Desktop mode (`src/desktop/`, lazy loaded so the phone bundle stays small) shows a sidebar with Home, Cards, Exam, Role Play, Profile; Home/Cards/Exam/Profile are the same components as the phone app. Role Play is desktop only. Do not change phone behavior when working on desktop code. The bug button is on every screen in both modes (centered dialog on desktop).
- Role Play (desktop only, `src/desktop/`, `api/roleplay.js`, content in `public/roleplays/` from `npm run sync-roleplays`): Self study (everything visible plus the Gemini AI coach) and Test (10 min prep, 10 min recorded presentation, judge asks the official questions first, then AI follow-up questions fetched in the background (no choice screen), no AI help; Groq Whisper transcript, Gemini scoring on the role play's own rubric). Attempts are saved permanently in the progress record under `roleplays` (merged by attempt id, newest `updated` wins, never pruned); audio is never stored. Needs GROQ_API_KEY and GEMINI_API_KEY in Vercel. Role play ids are permanent (`data/roleplay_ids.json`, never edit or delete). See README.
- Tabs are Home, Cards, Exam, Profile. The PIs tab (shared PI tracker) was removed on Sept 29, 2026; its old checklist data is still in Blob at `shared/pi-tracker.json`, and the code is in git history.
- Exam question text is `text-base` (16px), answer choices `text-sm` (14px). Keep the question at least as large as the choices.
- Bug button (top right of every screen) sends a report to `POST /api/report` (saved in Blob under `reports/`). Reports are listed on the Debug account's Profile screen, with a delete button per report and "Clear all". Optional email copies need `RESEND_API_KEY` in Vercel (see README).
- Debug's Profile shows Hannah's progress (read only, from `GET /api/progress?user=hannah`) including usage time. Usage is tracked by `src/lib/usage.js` as `usage[device][day] = seconds` inside the progress record; `api/progress.js` and the login sync merge it by max per device and day. Keep that merge if progress code changes.
- The main scroll area hides its scroll bar (`no-scrollbar`); keep it that way.
- Autosave: localStorage instantly, server sync shortly after each change and on tab hide/close via `sendBeacon`.

## Student history (do not regress this)

- Never edit or delete `data/id_registry.json`; it is written by `scripts/check-ids.mjs` and must be committed when it changes.
- `npm run build` runs the id check first. Watch for RETIRED IDS, CHANGED IDS and REUSED RETIRED IDS in the output. Accept an intended removal with `npm run check-ids -- --accept-retired`.
- New cards and questions take the next free id printed by the check.
- Progress only ever merges (newest entry per id wins). Never add code that prunes ids missing from the current content.
- ★ Bookmark history is permanent, like progress. `bookmarks.cards[id]` / `bookmarks.questions[id]` = `{ on, at }` (`src/lib/bookmarks.js`); unbookmarking stores `on: false` and that entry is kept forever so older copies never switch it back on. `api/progress.js` and the login sync merge newest per id. Never prune, reset or drop bookmark entries.
- Bookmarks can sit on any status. Incorrect (exam) and Forgot (cards) turn a bookmark on; only the student tapping the star turns it off. Both tabs have a "Bookmarked only" switch that combines with the status filters. On login, Forgot cards and Incorrect questions without a bookmark entry get one (one time catch up for older history).

## Content rules

- Categories come from PI code prefixes in official answer keys, never keyword guessing. BL Business Law · CO Communications · CR Customer Relations · EC Economics · EI Emotional Intelligence · EN Entrepreneurship · FI Financial Analysis · FM Financial-Information Mgmt · HR Human Resources Mgmt · NF Information Management · MK Marketing · OP Operations · PD Professional Development · RM Risk Management · SM Strategic Management.
- Never edit question text. Strip SOURCE lines from explanations. Preserve underscores.
- Card definitions are written for high school students: plain language, one short example.
- Card-to-question links must be about the tested concept, not scenario words. Outside reviewers who matched on keywords ("Market" hit 344 questions) were mostly wrong; if a reviewer proposes links, give them the current `DECA_Data_Raw.xlsx` and check each proposal against the question's answer and explanation.
- No dashes as punctuation in prose written for the user. Use commas, colons, or parentheses.
- Show a plan or gap list and wait for approval before large data changes.

## Open items

1. Three ideas no card teaches yet; add cards if the user agrees: "information" as a business resource (Q2099), meta tags (Q2676), limited government control in private enterprise (Q2606).
2. Verify these six cards exist (added as candidates on Sept 28; may already be among the 465 gap cards): Programming Languages, Endorsing a Check, Convergence (financial services), EDGAR, Marital Deduction (estate tax), Product Innovation.
3. The GitHub personal access token used for pushes never expires. Remind the user to delete it at github.com/settings/tokens and create one with an expiry.
4. Delete the `zz_diag_test` Blob record.

## Things a new session should not redo

- The 2026 exam update (Sept 11) and the full link audit (Sept 28) are done. Do not re-derive categories, re-run the duplicate hiding, or re-import the 2026 exams.
- Do not migrate away from Vercel Blob or add an auth backend.
- An AI tutor was deliberately left out to keep running cost at $0.
