# Family Portfolio

A private web app for tracking the family's stocks, mutual funds and crypto in one place. Only one person (Dad) signs in.

- **Plan and stages:** [PLAN.md](PLAN.md). Stages are built one at a time; the table in §16 shows progress.
- **Stack:** Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui, Supabase (Postgres + Auth), Vitest.

## Running it locally

### 1. Install

Requires Node.js 20 or newer.

```bash
npm install
```

### 2. Create the Supabase project (one time)

1. Create a free project at [supabase.com](https://supabase.com). Pick the **Mumbai (ap-south-1)** region.
2. **Turn off sign-ups:** Authentication → Sign In / Providers → turn off **Allow new users to sign up**.
3. **Create the tables:** run each file in `supabase/migrations/` in filename order
   (oldest first): SQL Editor → New query → paste the file → Run.
   New stages can add files; run only the ones you haven't run yet.
   (Or with the CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`.)
4. **Create Dad's account:** Authentication → Users → Add user → Create new user.
   Enter email + a strong password and tick **Auto Confirm User**.
   The first account created becomes the app's owner automatically.

### 3. Add the environment variables

Copy `.env.example` to `.env.local` and fill in the values from
Project Settings → API Keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

`.env.local` is git-ignored. Never commit keys.

### 4. Start

```bash
npm run dev
```

Open http://localhost:3000, sign in, then open **Settings**: every setup check should be green.

Without `.env.local` the app still starts and shows a "Connect Supabase" notice.

### 5. Live prices from Angel One (optional)

Without this, enter prices by hand with **Update prices** on the dashboard.

1. Create an app at [smartapi.angelone.in](https://smartapi.angelone.in) (My Apps) and copy its **API key**.
2. Enable TOTP for the Angel One account (**Enable TOTP** on the SmartAPI site). Save the **text secret**
   shown with the QR code. That's what authenticator apps store; it isn't the 6-digit code.
3. Add these to `.env.local`. They are server-only: never prefix them with `NEXT_PUBLIC_`.
   Anyone with them can log in to the Angel One account, so keep them private.
   ```
   ANGELONE_API_KEY=...
   ANGELONE_CLIENT_CODE=...
   ANGELONE_PIN=...
   ANGELONE_TOTP_SECRET=...
   ```
4. Restart `npm run dev` and check **Settings → Live prices**.
5. Add this year's NSE trading holidays in **Settings → Market holidays**.

While the market is open (Mon–Fri, 9:15 AM–3:30 PM India time, except listed holidays), the dashboard
and member pages refresh prices every 5 seconds. Outside market hours prices are fetched at most every
30 minutes. SmartAPI allows 50 stocks per quote request and 1 quote request per second.

## Mutual funds (Stage 8)

1. Run `supabase/migrations/20260915120000_mutual_funds.sql` in the Supabase SQL Editor.
2. Settings → **Mutual fund list** → **Download fund list**. It fetches AMFI's public NAV file (about 14,000 funds) and
   takes under a minute.
3. Open a member → **Add fund entry**. Pick the exact plan (Direct or Regular, Growth or IDCW) and add an opening balance
   with the units and average NAV (amount invested ÷ units) from the platform or statement. Add purchases, SIP
   instalments and redemptions as they happen.

NAVs refresh automatically on weekday nights once deployed. XIRR appears once money has been invested for a year; use the
first investment date for opening balances to get a meaningful figure.

## Crypto, watchlist and news (Stage 10)

1. Run `supabase/migrations/20260915150000_crypto_watchlist_news.sql` in the Supabase SQL Editor.
2. Settings → **Crypto coin list** → **Download coin list**. It fetches every coin traded for rupees on CoinDCX (about 340)
   with its latest price, in a few seconds. No API key is needed.
3. Open a member → **Accounts** → add a **CoinDCX** account, then **Add crypto entry**: an opening balance with the
   quantity and average buy price from the CoinDCX portfolio. Add buys and sells as they happen.
4. Run `supabase/migrations/20260915170000_watchlists.sql` too. **Watchlists** → **New watchlist** (up to 10 lists, e.g.
   "Banks", "To buy") → **Add stock** (up to 50 per list). Stocks get live Angel One prices like holdings. Tap a symbol for
   its chart: 1 day to 5 years, line or candles. Chart history comes from Angel One when the chart opens and isn't
   stored in Supabase, so charts need the Angel One settings from step 5 of "Running it locally".
5. **News** shows Google News headlines for stocks held by active members and stocks on the watchlist.

- **Crypto prices** refresh every 30 seconds while the Crypto page, the dashboard or a member page showing coins is open.
  The daily snapshot fetches them too, so crypto counts in the daily history. The Crypto page also estimates this
  financial year's crypto tax (30% plus cess on each sell's gain, losses not set off, 1% TDS).
- **News** is searched when the News page opens (for stocks not checked in the last 30 minutes) and every morning once
  deployed. Headlines must name the stock, so a bare ticker can miss news or pick up namesakes (RELIANCE also matches
  Reliance Power). Pick the stock on the News page → **Change search** → enter the company name, e.g. "Reliance Industries".
  Only the headline, link, source and date are stored, 10 per stock at most, and deleted after 14 days or once no one holds or watches the stock (well under 1 MB).



## Extras (Stage 12)

1. Run `supabase/migrations/20260919120000_corporate_actions_other_assets.sql`, then
   `supabase/migrations/20260919150000_mfa_audit_log.sql`, in the Supabase SQL Editor. Until both have run, the dashboard
   and member pages show "a database migration may not have been run yet".
2. **Splits & bonuses** (Settings): when a stock the family holds splits or issues bonus shares, add it with the ex-date.
   Every holding of that stock gets the new share count and average price. NSE and BSE listings are separate.
3. **FDs, other assets and IPOs**: open a member → Fixed deposits / Other assets / IPO applications. FDs grow with
   interest to today; other assets use the value you last entered, so update PPF or gold now and then. **FDs & other
   assets** lists them for the whole family. IPO applications aren't counted in totals; once allotted shares list, add
   them as a stock buy.
4. **Tax reports**: capital gains per member and financial year, split into short- and long-term, with an estimate of
   the tax. **Download Excel** there (or in Settings → Backup & restore) gets holdings, the year's gains and every entry
   as a spreadsheet.
5. **Two-step sign-in** (Settings): scan the QR code with an authenticator app (Google Authenticator or similar) and
   enter a code. After that, signing in asks for a code from the app, and the database refuses a session without it.
   TOTP is on by default in Supabase (Authentication → Multi-Factor); turn it on there if setup fails. Keep the phone
   with the app safe: without it, the factor has to be removed in Supabase → Authentication → Users.
6. **Install on the phone**: open the site in Chrome (Android) or Safari (iPhone) → menu → **Add to Home screen** /
   **Install app**. It opens full screen with its own icon.
7. **Recent changes** (Settings) lists the last 30 additions, edits and deletions; the log keeps a year.

XIRR now shows per stock and coin, and on the summary tiles for each member and the family once money has been invested
for a year and every holding has a price.

## Deploying to Vercel (Stage 7)

1. **Run the migrations** `supabase/migrations/20260914170000_scheduled_jobs.sql` and then
   `supabase/migrations/20260915090000_service_role_grants.sql` in the Supabase SQL Editor.
   The second lets scheduled jobs read and write the tables; without it they fail with "permission denied".
2. **Push the code to a private GitHub repository.**
3. **Import the repository in Vercel:** vercel.com → Add New → Project → pick the repository. Vercel detects Next.js.
4. **Add environment variables** (Vercel → Project → Settings → Environment Variables), then redeploy:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Same as in `.env.local` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same as in `.env.local` |
   | `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → Secret keys |
   | `CRON_SECRET` | A random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `ANGELONE_API_KEY`, `ANGELONE_CLIENT_CODE`, `ANGELONE_PIN`, `ANGELONE_TOTP_SECRET` | Optional, see step 5 above |

5. **Point Supabase at the live site:** Supabase → Authentication → URL Configuration → **Site URL** = your Vercel address,
   e.g. `https://family-portfolio.vercel.app`.
6. **On the phone:** open the Vercel address, sign in, then use the browser's **Add to Home screen**.
7. **Check the scheduled jobs:** Vercel → Project → Settings → Cron Jobs lists them, each with a **Run** button for testing.
   Results show in the app under **Settings → Scheduled jobs**.

### Scheduled jobs

Defined in `vercel.json`. Times are UTC; on Vercel's free plan each job runs once a day, at some point within its hour.

| Job | Schedule | What it does |
|---|---|---|
| Daily snapshot | Mon–Fri, 11:00 UTC (4:30–5:30 PM India) | Fetches closing prices from Angel One if set up and crypto prices from CoinDCX, then saves each stock's close and each member's portfolio value for the day. Skips weekends and listed holidays. |
| Mutual fund NAVs | Mon–Fri, 18:00 UTC (11:30 PM–12:30 AM India) | Downloads AMFI's NAV file: new funds, latest NAVs, and closed funds marked inactive. |
| Stock list update | Mondays, 02:00 UTC (7:30–8:30 AM India) | Refreshes the stock list from Angel One's instrument file. |
| Stock news | Every day, 01:00 UTC (6:30–7:30 AM India) | Searches Google News for held and watchlisted stocks and deletes headlines older than 14 days or for stocks no longer followed. |
| Crypto coin list | Mondays, 03:00 UTC (8:30–9:30 AM India) | Refreshes CoinDCX's rupee coins with prices; coins no longer traded for rupees are marked inactive. |

Vercel may occasionally skip or repeat a run; every job is safe to run again.

### Backups, export and restore

Run `supabase/migrations/20260915100000_backup_restore.sql` first.

**Download data** (Settings → Backup & restore) saves everything you've entered as one JSON file: members, accounts,
stock transactions, mutual fund and crypto entries, the watchlist, news search names, prices, holidays and daily history.
The stock, fund and coin lists aren't included (download them again from Settings), nor are news headlines or the sign-in
account. The file isn't encrypted, so keep it somewhere private.

**Weekly encrypted backup:** `.github/workflows/backup.yml` runs every Sunday at 2 AM India time (or on demand from the
repository's **Actions** tab). It downloads the same export from the live site, encrypts it with your passphrase
(AES-256-GCM) and keeps it for 90 days as a workflow artifact.

1. GitHub → repository → Settings → Secrets and variables → Actions → **New repository secret**:
   - `BACKUP_URL`: the live site address, e.g. `https://portfolio.dks189.vercel.app`
   - `CRON_SECRET`: the same value as in Vercel
   - `BACKUP_PASSPHRASE`: a long passphrase. **Keep a copy somewhere safe: encrypted backups can't be restored without it.**
2. Run the workflow once from the Actions tab and check an artifact appears.
3. If you added `SUPABASE_DB_URL` earlier, delete it; it's no longer used.

**Restore:** Settings → Backup & restore → choose a downloaded export or a backup file (GitHub downloads artifacts as a
.zip, so unzip it first) → enter the passphrase if it's encrypted → **Check file** shows what's inside → **Replace all data**.
Restoring replaces everything with the file's contents in one database transaction: if anything fails, nothing changes.
Download the stock, fund and coin lists first, since stocks are matched by exchange and code, funds by AMFI code and coins
by CoinDCX market (e.g. BTCINR). Backups made before Stages 8, 10 and 12 still restore. Backups also carry FDs, other
assets, IPO applications, splits and bonuses, and named watchlists. A restore shows as one entry in Recent changes.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run format` | Format code with Prettier |

## Project layout

```
app/
  (auth)/login/        Sign-in page + auth Server Actions
  (app)/               Signed-in pages: dashboard, members, mutual-funds, crypto, other-assets, watchlist, news,
                       reports, alerts, settings
  (auth)/verify/       Two-step sign-in code
components/
  layout/              App shell, navigation, account menu
  ui/                  shadcn/ui components
lib/
  supabase/            Supabase clients (server, proxy) and database types
  auth.ts              getCurrentUser / requireUser
  env.ts               Environment variable validation
  format.ts            ₹ lakh/crore, %, IST date formatting
proxy.ts               Refreshes the session and redirects signed-out visitors to /login
supabase/
  migrations/          SQL migrations, one or more per stage
```

## Database types

After applying a new migration, regenerate the TypeScript types:

```bash
npx supabase gen types typescript --project-id <project-ref> --schema public > lib/supabase/database.types.ts
```
