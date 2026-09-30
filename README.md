# deca-study-appv2

DECA Finance study app (ACT, Accounting Applications Series): flashcards linked to real exam questions, a practice exam, and a review cascade that ties the two together.

Live: https://deca-study-appv2.vercel.app (Vercel deploys every push to `main`).

```
npm install
npm run dev          # http://localhost:5173
npm run check-ids    # student history check (also runs before every build)
npm run build        # outputs to dist/
```

Stack: React 18 + Vite, Tailwind via CDN, Vercel serverless functions (Node runtime) with a PRIVATE Vercel Blob store (`api/_blob.js`).

## App and Desktop modes

The login page (and Home in app mode) has an **App | Desktop** switch, remembered per device (default App). Desktop mode shows a sidebar with Home, Cards, Exam, **Role Play** and Profile; Home, Cards, Exam and Profile are the same screens as the phone app. Desktop code (`src/desktop/`) is lazy loaded, so phone mode never downloads it.

## AI coach on Cards and Exam (desktop only)

In desktop mode the Cards and Exam tabs have the same AI coach side panel as Role Play Self study (Gemini, `study` action in `api/roleplay.js`). It sees the card or question on screen (with the answer, explanation and linked cards or questions) through the bug report context those screens already set, so the phone screens are unchanged. On the Exam tab it gives hints and does not reveal the answer unless the student asks or has answered. One chat per tab is kept on the device; each question is tagged with the card or question it was asked about. The panel can be hidden and reopened (remembered per device).

## Role Play (desktop only)

64 ACT role plays: 29 official (from the DECA PDFs) and 35 practice scenarios. The library opens filtered to Official.

* **Self study:** the whole role play including the judge's key, judge questions, solution, key concepts (with links to flashcards) and the rubric, next to an **AI coach** chat (Gemini). The chat is kept on the device per role play; it can include the student's latest test so they can ask about their scores.
* **Test:** 10 minutes to prepare (the scenario as on the real instruction sheet: no "Exhibits" section, only the data tables the sheet prints, inside the scenario; no judge material; a notes box), then up to 10 minutes to present out loud while the microphone records. The judge's greeting and questions appear on screen (silent by default; a "Judge reads the greeting and questions aloud" switch on the setup screen uses browser speech and is remembered per device); after "Done presenting" it asks the role play's official judge questions right away. At the same moment the talk so far is transcribed and Gemini writes 2 or 3 follow-up questions (not repeating the official ones); these are asked after the official questions. If they are not ready yet the judge "thinks" for a moment; if they fail, the meeting simply closes. At 10:00 the recording stops. The recording is transcribed by **Groq Whisper** and scored by **Gemini** on the role play's rubric (100 points). No AI help anywhere in Test mode.
* **Attempts** (transcript, questions, notes, scores, feedback) are saved permanently in the progress record under `roleplays`, merged by attempt id on the server and at login. Audio is never stored. If scoring fails, the transcript is kept and the attempt can be scored later from the library. Debug's Profile shows Hannah's role play tests.
* **Rubrics:** official role plays use their own Judge's Evaluation Form, read from each source PDF (2017 to 2026: 5 PIs x 14 + 4 skills x 6 + overall 6; 2014 and 2015: 5 PIs x 16 + 2 items x 10; undated sample: 5 PIs x 18 + overall 10). Practice scenarios use rubrics written for them in `DECA Role play/new scenarios/rubrics/` (same 2017 to 2026 layout with scenario specific criteria for each level).
* **Server:** `api/roleplay.js` (actions transcribe, grade, judge, chat; 60 s limit in `vercel.json`). Needs `GROQ_API_KEY` and `GEMINI_API_KEY` in the Vercel project settings (optional `GEMINI_MODEL`, default `gemini-2.5-flash`, and `GROQ_MODEL`, default `whisper-large-v3-turbo`). Without keys the screens work and show a clear "not set" message. In `npm run dev` a stand in returns labeled mock results when the keys are not in the environment. For testing without a microphone, set `localStorage.deca_fake_mic = '1'`.

* **Solution tables:** journal entries are shown as Account | Debit | Credit tables and accounting-equation effects as Assets = Liabilities + Equity tables, inside the solution step they belong to. They come from `DECA Role play/solution_tables/<rp_id>.json` (`tasks[].tables`, plus `hide_bullets` and `hide_calculations` for the wordy copies they replace), so the same fact is never shown twice. The sync rejects any journal table that does not balance. Every account in a journal table is shown with its category first ("Asset - Cash", "Contra asset - Accumulated Depreciation", "Expense - Rent Expense"), from `data/account_categories.json`; the sync fails if a table uses an account that is not listed there, so add new accounts to that file.

### Updating role play content

Edit or add JSON files in `DECA Role play/output/json` or `DECA Role play/new scenarios/json` (and a rubric in `new scenarios/rubrics/` for each new practice scenario, plus an optional `solution_tables/<rp_id>.json`), then run `npm run sync-roleplays` (needs `pdftotext`, which comes with Git for Windows) and commit `public/roleplays/` and `data/roleplay_ids.json`. Role play ids are permanent: the sync fails with RETIRED ROLE PLAY IDS if one disappears (accept an intended removal with `npm run sync-roleplays -- --accept-retired`). Never edit or delete `data/roleplay_ids.json`.

## Practice exam

The top dropdown picks the exam year (All years, or a single year). The category list at the bottom picks the category, with "All categories" as its first row. Year and category combine.

## Bookmarks (★)

Every flashcard and exam question has a star. A bookmark sits on top of any status (new, forgot, review, known, incorrect, hard, easy). Answering a question incorrectly or marking a card Forgot bookmarks it automatically; only tapping the star again removes it. The Cards and Exam menus have a "Bookmarked only" switch that combines with the status filters.

Bookmark history is permanent: it is stored in the progress record as `bookmarks.<cards|questions>[id] = { on, at }`, synced to the server, merged newest per id, and never pruned. Removing a bookmark is stored as `on: false`, so an older copy on another device can never switch it back on.

## Hannah's progress and usage time (Debug account)

The Debug account's Profile shows Hannah's progress, read from the same server copy her devices sync to: last active time, usage time (today, last 7 days, all time, and a 7 day bar chart), cards and questions studied in the last 7 days, flashcard and exam question status counts, accuracy, and recent practice sessions. Tap refresh to reload.

Usage time is counted from Sept 29, 2026 on: while the app is on screen and the student has tapped, typed or scrolled in the last 2 minutes, every 15 seconds is added to the day's total. It is stored in the progress record as `usage[device][YYYY-MM-DD] = seconds`; merging keeps the larger count per device and day, so two devices never overwrite each other. It is sent to the server every 5 minutes of use and when the app is hidden or closed.

In `npm run dev`, a Vite middleware stands in for `/api/progress` and stores progress in `.data/progress/` with the same merge as the server.

## Bug reports

A small bug button sits in the top right corner of every screen. It opens a short form; "Send report" saves the report on the server, no email app needed. The report adds the screen, the card or question on screen, the user, the app build, the content size, time, URL, device, screen size and the last 8 JavaScript errors.

* `POST /api/report` saves `reports/<time>-<random>.json` in the Blob store. `GET /api/report` returns the newest 50 and the total.
* Reports are listed on the Profile screen of the Debug account (newest first, tap to expand, refresh button). The trash icon deletes one report and "Clear all" deletes every report (both ask first). `DELETE /api/report?id=<id>` and `DELETE /api/report?all=1` do the same.
* If sending fails, the form offers "Email it" (a `mailto:` link) and "Copy the report".
* In `npm run dev`, a Vite middleware stands in for the API and stores reports in `.data/reports/` (git ignored).
* The report endpoint has no login. Reports hold only notes and device details; never put PINs or secrets in them.

### Email copies (optional)

Sign up free at resend.com with ljunho7@gmail.com (without a verified domain, Resend only sends to the account owner's address, which is what we want). Add `RESEND_API_KEY` in the Vercel project's environment variables and redeploy. Optional: `REPORT_TO` (default ljunho7@gmail.com) and `REPORT_FROM`. Without the key, reports are still saved and listed, just not emailed. An email failure never fails a report.

## Student history (ids)

Progress is saved per card id and per question id (`deca_progress_<user>` in localStorage and `progress/<user>.json` in Blob). Ids are explicit integers from the "Card ID" and "Question ID" columns of `DECA_Data_Raw.xlsx`, never derived from text or position, so editing a term, a definition, a category or the order keeps history attached.

Rules:

* Never change the id of an existing card or question. New items take the next free id (printed by `npm run check-ids`), never a retired one.
* Progress is only ever merged (newest entry per id wins); nothing deletes ids that are not in the current content.
* `data/id_registry.json` records every id ever issued with a fingerprint of its content. It is written by `scripts/check-ids.mjs`. **Never edit or delete `data/id_registry.json`**, and commit it whenever it changes.
* The check runs before every build and fails on RETIRED IDS (an id disappeared, so its history would stop showing), CHANGED IDS (an id now holds different content, so history would attach to the wrong item), reused retired ids, duplicate ids, and broken or one sided card/question links. If a removal is intended (a merged card, a hidden duplicate), run `npm run check-ids -- --accept-retired`; a retired id that comes back with the same content is revived automatically. Watch for RETIRED IDS in the output and in `data/id_warnings.txt`.
