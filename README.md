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
| Daily snapshot | Mon–Fri, 11:00 UTC (4:30–5:30 PM India) | Fetches closing prices from Angel One if set up, then saves each stock's close and each member's portfolio value for the day. Skips weekends and listed holidays. |
| Stock list update | Mondays, 02:00 UTC (7:30–8:30 AM India) | Refreshes the stock list from Angel One's instrument file. |

Vercel may occasionally skip or repeat a run; both jobs are safe to run again.

### Backups, export and restore

Run `supabase/migrations/20260915100000_backup_restore.sql` first.

**Download data** (Settings → Backup & restore) saves everything you've entered as one JSON file: members, accounts,
transactions, prices, holidays and daily history. The stock list isn't included (download it again from Settings) and
neither is the sign-in account. The file isn't encrypted, so keep it somewhere private.

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
Download the stock list first, since stocks are matched by exchange and code.

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
  (app)/               Signed-in pages: dashboard, members, mutual-funds, crypto, alerts, settings
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
