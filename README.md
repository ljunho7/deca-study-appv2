# deca-study-appv2

DECA Finance study app (ACT, Accounting Applications Series): flashcards linked to real exam questions, an endless practice exam, and a review cascade that ties the two together.

Live: https://deca-study-appv2.vercel.app (Vercel deploys every push to `main`).

```
npm install
npm run dev          # http://localhost:5173
npm run check-ids    # student history check (also runs before every build)
npm run build        # outputs to dist/
```

Stack: React 18 + Vite, Tailwind via CDN, Vercel serverless functions (Node runtime) with a PRIVATE Vercel Blob store (`api/_blob.js`).

## Practice exam

The top dropdown picks the exam year (All years, or a single year). The category list at the bottom picks the category, with "All categories" as its first row. Year and category combine.

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
