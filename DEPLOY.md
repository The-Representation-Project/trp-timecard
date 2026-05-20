# Deploying Timecard

Self-contained browser app — no server, no database, no accounts.
Everything you log lives in **your browser's localStorage**.

## What's in the app now

- **Real users** baked in: Erika Valencia-Quidwai (employee) and
  Katrina Steffek (approver). No sample timesheets — first-time
  load is empty.
- **Accrual on approval**: 0.0385 hrs PTO + 1/30 hrs sick per hour
  worked, added automatically when Katrina signs off a pay period.
  Editable from Time Off → "Balances & Accrual".
- **Starting balances**: 3.34 PTO, 2.88 sick (as of May 19, 2026).
- **Semi-monthly pay periods** (1–15 and 16–end). Submit-by-deadline
  defaults to **2 days before pay date** (so 13th and 28th).
- **Approval handoff via email**: when a pay period is ready, click
  *Send to Katrina*, your email client opens with a pre-written
  message + one-click approval link. She opens the link, types her
  name to sign, gets a signed PDF for payroll, and emails a receipt
  link back that auto-marks your copy as approved.

---

## Option A — Use it locally only (just you, no link sharing)

Simplest possible setup. You bookmark a file on your machine.

1. Put this folder anywhere on your computer (e.g. `~/Timecard/`).
2. Double-click `Timecard.html`. Bookmark it in your browser.
3. Track time. Logs persist forever in that browser's storage.

**Caveat for the approval flow:** the mailto link will use a `file://`
URL Katrina can't open. For the email handoff to work, the app has
to be hosted at a real URL — use Option B.

---

## Option B — Host it on the web (free, recommended)

Pick one. Each takes 5 minutes.

### B1. Netlify Drop (easiest, no account needed for a quick test)

1. Go to **https://app.netlify.com/drop**
2. Drag the entire `Timecard` folder into the page.
3. Netlify gives you a URL like `https://aurora-cobbler-12345.netlify.app/Timecard.html` — that's it.
4. Bookmark it. Use that URL whenever you open the app.

If you sign up (free), you can claim the URL and make it stable
(e.g. `erika-timecard.netlify.app`).

### B2. Cloudflare Pages (free, custom domain support)

1. Push the folder to a GitHub repo (or use Cloudflare's direct upload).
2. **https://pages.cloudflare.com** → Create project → Upload assets.
3. Get a `*.pages.dev` URL. Custom domain available on the free tier.

### B3. GitHub Pages (free, needs a GitHub account)

1. Push the folder to a public GitHub repo.
2. Settings → Pages → Source: `main` branch, `/` root → Save.
3. URL: `https://<your-username>.github.io/<repo>/Timecard.html`

---

## Updating the app

Edit any file → re-deploy (drag the folder again on Netlify Drop, or
git push for Pages). Your localStorage data is **not** overwritten —
it lives in your browser, not in the deployed files.

## Backing up your data

In your browser console (F12 → Console tab):

```js
copy(localStorage.getItem('trp-timecard-v1'))
```

That copies your full data as JSON to your clipboard. Paste it into a
text file somewhere safe. To restore on a new machine:

```js
localStorage.setItem('trp-timecard-v1', '...paste here...')
```

then reload.

## Resetting

To wipe everything and start over:

```js
window.__tc?.actions?.factoryReset?.()
// or:
localStorage.removeItem('trp-timecard-v1')
```

then reload.

## How the email handoff actually works under the hood

The approval link is a long URL like:

    https://your-site.com/Timecard.html#approve=eyJ2IjoxLCJraW5kIjo...

Everything Katrina needs is encoded in the part after `#approve=`.
The hash never hits a server — her browser decodes the payload and
shows the approval page. When she signs, the page builds a
`#receipt=...` URL with her signature data and stages a mailto back
to you. When you click it, your app folds the receipt into local
state (pay period → approved, weeks locked, accrual added).

It's deliberately simple: two emails, one signed PDF, no accounts,
no shared infrastructure to maintain.
