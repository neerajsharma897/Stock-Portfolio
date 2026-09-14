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
