# Family Portfolio Tracker: Plan (v2)

A private web app where **Dad (the only user)** tracks the investments of 5 family members across different brokers. It covers stocks, mutual funds, crypto and other assets. Stock prices come live from Angel One SmartAPI (refreshed every 5 s), mutual fund NAVs from AMFI and crypto prices from CoinGecko. It also shows news for the stocks held and sends alerts on Telegram.

---

## 0. Answers so far

| Question | Answer | What it means for the build |
|---|---|---|
| Brokers | Me: Angel One · Dad: Zerodha · Mom: **Groww** · Sister: Upstox · Younger sister: 5paisa | Holdings come from several sources, so we can't depend on one broker's API (see §3) |
| Crypto platform | **CoinDCX** | Prices from CoinDCX's public ticker (same numbers as the app). Optional read-only API key sync of balances (§3.3). |
| Logins | **Dad only** | No roles or member logins. One owner account with MFA. Simpler security rules. |
| Mutual funds | Many platforms, many scheme types | Use the **CAMS/KFintech CAS PDF** import; one file per PAN covers every platform |
| Other assets | Nice to have: gold, FDs, bonds, IPO, **Bitcoin** | A general `asset_class` model. Crypto priced via CoinGecko. The rest is manual. |
| F&O | Not mentioned as a need | **Out of scope** |
| Live prices | 5-second refresh is enough | **No WebSocket worker.** Serverless polling only. |
| Alerts | Telegram. **Launch with price alerts + daily summary + system alerts only.** | See §6 for the full list; the rest are added later |
| Old trade history | None | Start each holding with an **opening balance** (qty + avg price from the broker app). MF history comes from the CAS. |

---

## 1. Key decisions

| Decision | Choice | Why |
|---|---|---|
| Place orders? | **No, read-only** | Avoids SEBI's retail-algo rules and big security risk |
| Holdings source of truth | **Transaction ledger** (incl. `OPENING_BALANCE`) | Needed for P&L, XIRR and capital gains |
| Stock prices | Angel One SmartAPI (one account prices everyone's stocks) | Free, auto-login with TOTP |
| MF NAV | AMFI NAVAll.txt | Free, official |
| Crypto prices | **CoinDCX public ticker** (INR), CoinGecko as fallback | Free, no key needed; matches what the CoinDCX app shows |
| Getting holdings in | ① Opening balance from broker app ② Manual buy/sell ③ CSV/PDF import ④ Optional "Sync" per broker API | See §3 |
| Infra | Vercel + Supabase only | No extra server now that 5-s polling is enough |

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Frontend + API | **Next.js** (App Router, TypeScript, Server Actions, Route Handlers) |
| UI | Tailwind CSS + **shadcn/ui**, lucide icons, mobile-first (Dad uses a phone) |
| Data fetching | TanStack Query (`refetchInterval: 5000` during market hours) |
| Forms / validation | react-hook-form + **Zod** |
| Charts | Recharts (allocation, net-worth line), TradingView lightweight-charts (stock chart) |
| Database / Auth | **Supabase** Postgres + Auth (single owner, MFA) + RLS |
| Scheduled jobs | Supabase **pg_cron + Edge Functions** |
| Broker / market data | Angel One SmartAPI REST, `otplib` for TOTP |
| CAS PDF parsing | Python **`casparser`** as a small Python endpoint (Vercel Python function, or Render free tier if it's too heavy) |
| Notifications | **Telegram Bot API** (plain `fetch`, no SDK needed) |
| Tests | Vitest for `lib/portfolio` calculations |
| Hosting | Vercel (Hobby) + Supabase (Free) |

---

## 3. Getting holdings from 5 different brokers

### 3.1 Can we use webhooks from the broker apps?
**Not as the main approach.** What brokers offer as "webhooks" (postbacks) are **order-status updates** (placed, executed, rejected). They are *not* holdings feeds, and:
- each account needs its own developer API app, set up by the account holder;
- some fire only for orders placed *through that API app*, not trades made in the normal mobile app;
- most broker API sessions expire **every day** and need a fresh login.

So webhooks would miss trades and break often. Instead, pull holdings on demand and reconcile with statements.

### 3.2 Recommended approach by stage

| Stage | Method | Works for |
|---|---|---|
| **Day 1** | **Opening balance**: for each stock, enter qty + avg buy price shown in the broker app (or import the holdings CSV/Excel every broker lets you download) | All brokers |
| **Ongoing** | Dad adds buy/sell entries manually (quick form, about 10 seconds) | All |
| **Monthly check** | Upload the **NSDL/CDSL CAS** (the consolidated demat statement, emailed monthly per PAN). The app flags mismatches, e.g. "TCS: app says 10, CAS says 15". | All demat accounts, whatever the broker |
| **Optional sync** | "Sync holdings" button per broker API | See table below |

### 3.3 Broker API status (check current pricing and terms before building)

| Broker | Who | Holdings API | Login | Worth building? |
|---|---|---|---|---|
| Angel One SmartAPI | Me | Yes, free | TOTP, **fully automatic** | ✅ Yes, auto-sync daily |
| Zerodha Kite Connect | Dad | Yes (personal plan) | Browser login **every day**; can't be automated under their terms | ⚠️ Phase 3: "Connect & Sync" button |
| Upstox API | Sister | Yes, free | OAuth login, token expires daily | ⚠️ Phase 3: "Connect & Sync" button |
| 5paisa Xtream | Younger sister | Yes | OAuth/TOTP, daily session | ⚠️ Phase 3 |
| Groww Trade API | Mom | Yes, but a **paid** subscription | API key flow | ❌ Use Groww's holdings statement (Excel) for stocks + CAS PDF for MFs |
| CoinDCX API | Crypto | Yes: balances + trade history via **read-only API key** (HMAC signed) | Key doesn't expire daily, so **fully automatic** | ✅ Phase 2/3: auto-sync balances; create the key with trading/withdrawal **disabled** |

**Bottom line:** build opening balance, manual entry and CSV import first (they work for everyone). Add Angel One auto-sync, then one-tap syncs for the others only if manual entry gets tiresome.

---

## 4. Mutual funds: what those names mean and how we import them

A scheme name like **"Parag Parikh Flexi Cap Fund – Direct Plan – Growth"** has three parts:
- **Category**: Flexi Cap, Large Cap, Mid Cap, Small Cap, ELSS (tax saving), Index, Debt, Liquid, Hybrid...
- **Plan**: **Direct** (bought straight from the fund house, lower cost) or **Regular** (through a distributor who takes a commission)
- **Option**: **Growth** (returns stay invested) or **IDCW** (pays out "dividends")

Each combination is a separate scheme with its own **AMFI code** and NAV. The app stores the AMFI code, so these details come with it.

**Import: CAMS/KFintech detailed CAS PDF** (request it free from camsonline.com or mfcentral.com, once per PAN)
- Covers **every** mutual fund held under that PAN: Groww, Zerodha Coin, Upstox, Angel One, direct AMC...
- Contains **full transaction history since each folio was opened**, so MF XIRR and capital gains are exact even without old records
- The PDF password is usually the PAN, and `casparser` reads it

**Extra feature:** flag **Regular plans**, e.g. "Mom holds 3 regular plans; switching to direct could save about ₹X per year in commission."

---

## 5. Assets covered

| Asset class | Price source | Entry method | Tax note for reports |
|---|---|---|---|
| Stocks / ETFs (NSE/BSE) | Angel One (5 s) | Opening, manual, CSV, sync | STCG 20%, LTCG 12.5% above ₹1.25L |
| Sovereign Gold Bonds, Gold ETFs | Angel One (traded on NSE) | Same as stocks | Treated separately |
| Mutual funds | AMFI NAV (daily) | CAS PDF, manual | Equity vs debt rules |
| **Crypto (Bitcoin etc.) on CoinDCX** | CoinDCX public ticker, INR (every 5 min; CoinGecko fallback) | Manual buy/sell, CoinDCX trade-history CSV, or read-only API sync | **30% flat + 1% TDS**, losses can't be set off |
| IPO applications | Angel One once listed | Manual: applied, allotted or refunded | Becomes a stock after listing |
| Fixed deposits | Calculated (principal, rate, compounding) | Manual | Interest taxed at slab rate |
| Physical gold / bonds / PPF / other | Manual value update | Manual | — |
| F&O | — | **Out of scope** | — |

---

## 6. Telegram alerts: what's included

**At launch only three are on: price alerts (§6.1), the daily summary (§6.3) and system alerts (§6.6).** The others are built in later phases.

Every alert type can be switched on or off and has a threshold in Settings. To avoid spam there is a **cooldown** (the same alert fires at most once a day) and **quiet hours** (no messages 10 PM–7 AM, except the nightly NAV update if enabled).

### 6.1 Price alerts (set per stock / crypto)
| Alert | Example message |
|---|---|
| Target price hit | 🎯 **TCS** hit your target ₹4,200 (now ₹4,212). Held by: Dad 20, Me 5 |
| Stop-loss hit | 🔻 **ZOMATO** fell below stop-loss ₹180 (now ₹178.40). Dad's loss on holding: −₹2,340 |
| Big daily move | ⚡ **HDFCBANK** −4.8% today (₹1,560). Family exposure ₹1.2L |
| 52-week high / low | 📈 **ITC** at a new 52-week high ₹512 |
| Crypto move | ₿ **Bitcoin** +6.2% in 24h, ₹58.4L. Your holding ₹41,200 |

### 6.2 Automatic portfolio alerts (no setup needed)
| Alert | Example |
|---|---|
| Member portfolio big move | 📊 Sister's portfolio −3.1% today (−₹8,450) |
| Family portfolio big move | 👨‍👩‍👧‍👧 Family portfolio +2.4% today (+₹31,200) |
| Concentration warning (weekly) | ⚠️ 38% of Dad's portfolio is in 1 stock (RELIANCE) |

### 6.3 Summaries
**Daily at 3:45 PM (trading days):**
```
📅 Market close, 14 Sep
Family: ₹24.6L  (+₹12,340, +0.5% today)

Dad        ₹11.2L  +0.8%
Me          ₹4.1L  +0.2%
Mom         ₹3.9L  −0.1%
Sister      ₹3.4L  +0.6%
Y. Sister   ₹2.0L  +0.3%

🟢 Top gainer: TATAMOTORS +4.1%
🔴 Top loser: INFY −2.3%
📰 3 news items for your stocks → open app
```
**Weekly on Saturday morning:** week's change, best and worst holdings, upcoming SIPs, FD maturities.

### 6.4 News alerts (held stocks only)
Only **important** news is sent: results, big orders, mergers, SEBI/regulatory action, rating changes, block deals. Keyword filters decide this at first; Claude classification can come later.
> 📰 **INFY**: Q2 results: net profit up 8% YoY, guidance cut. *(Moneycontrol)* → link

Everything else stays in the in-app news feed.

### 6.5 Reminders
| Alert | Example |
|---|---|
| SIP due tomorrow | 🔁 SIP ₹5,000 in Parag Parikh Flexi Cap (Mom) due tomorrow |
| FD maturing | 🏦 SBI FD ₹2L (Dad) matures in 7 days |
| IPO | 📝 IPO allotment status today for XYZ Ltd (Sister applied) |
| Monthly CAS | 📄 Time to upload this month's CAS to check holdings |

### 6.6 System alerts
| Alert | Example |
|---|---|
| Angel One login failed | ❗ Live prices are down: Angel One login failed (TOTP). Check settings. |
| Scheduled job failed | ❗ NAV sync failed last night |
| Holdings mismatch after CAS upload | 🔍 2 mismatches found in Dad's holdings → review |

### 6.7 Telegram bot commands (phase 3, Dad's chat only)
`/networth` · `/today` · `/member mom` · `/stock TCS` · `/alerts` · `/mute 2h`
The bot answers only Dad's `chat_id` and ignores everyone else.

---

## 7. Live price architecture (5-second polling, no worker)

```
Browser (market open) --every 5s--> /api/prices   (auth required)
/api/prices:
   read live_quotes where updated_at > now() - 4s  -> return if fresh
   else  -> SmartAPI Quote (LTP/OHLC, 50 tokens/call) -> upsert live_quotes -> return
SmartAPI session (jwt/feed tokens) stored in a service-role-only table,
   refreshed with TOTP when expired or at 08:45 daily
Market closed -> return last close, no API calls

pg_cron every 1 min (market hours) -> Edge Function: refresh quotes + check alerts
pg_cron every 5 min              -> CoinDCX ticker prices for crypto held
```
There is only one user and fewer than 300 symbols, so this stays well inside the rate limits.

---

## 8. Other data sources

| Need | Source |
|---|---|
| Instrument list | Angel One `OpenAPIScripMaster.json` (daily) |
| MF NAV | AMFI `NAVAll.txt` (nightly) · history via `mfapi.in` |
| Crypto | CoinDCX public ticker (`api.coindcx.com/exchange/ticker`, e.g. `BTCINR`) · fallback CoinGecko `/simple/price?vs_currencies=inr` |
| Crypto balances (optional) | CoinDCX user API with a read-only key |
| News | Google News RSS per symbol (free) → Marketaux later if needed |
| Holidays | NSE holiday list, entered yearly |

---

## 9. Database schema

```sql
-- Owner & family -------------------------------------------------------------
profiles_owner      (user_id PK -> auth.users, telegram_chat_id, timezone,
                     quiet_hours_start, quiet_hours_end)
members             (id, name, relation, color, pan_last4, is_active, created_at)
broker_accounts     (id, member_id, broker: angelone|zerodha|upstox|groww|fivepaisa|
                     coindcx|bank|other, label, client_code_masked)

-- Reference data --------------------------------------------------------------
instruments         (id, asset_class: STOCK|ETF|SGB|CRYPTO,
                     exchange: NSE|BSE|CRYPTO, symbol, name,
                     token NULL,            -- Angel One token
                     isin NULL,
                     coindcx_market NULL,   -- e.g. BTCINR
                     coingecko_id NULL,     -- fallback, e.g. bitcoin
                     price_source: angelone|coindcx|coingecko,
                     sector NULL, updated_at)
mf_schemes          (amfi_code PK, isin, name, amc, category,
                     plan: DIRECT|REGULAR, option: GROWTH|IDCW)
market_holidays     (date PK, exchange, description)

-- Transactions (source of truth) ------------------------------------------------
transactions        (id, member_id, broker_account_id, instrument_id,
                     type: OPENING_BALANCE|BUY|SELL|BONUS|SPLIT|DIVIDEND|
                           TRANSFER_IN|TRANSFER_OUT,
                     quantity numeric(20,8),    -- 8 dp for crypto
                     price numeric(18,4), charges numeric(14,2),
                     trade_date date, notes,
                     source: manual|csv|cas|api, import_batch_id NULL, created_at)
mf_transactions     (id, member_id, amfi_code, folio_no, broker_account_id NULL,
                     type: OPENING_BALANCE|PURCHASE|SIP|REDEMPTION|SWITCH_IN|
                           SWITCH_OUT|IDCW_PAYOUT|IDCW_REINVEST,
                     units numeric(18,4), nav numeric(14,4), amount numeric(14,2),
                     stamp_duty numeric(10,2), trade_date, source, import_batch_id)
sips                (id, member_id, amfi_code, folio_no, amount, day_of_month,
                     start_date, end_date NULL, is_active)
corporate_actions   (id, instrument_id, type: SPLIT|BONUS|DIVIDEND,
                     ratio_from, ratio_to, amount_per_share, ex_date)

-- Manual assets ---------------------------------------------------------------
fixed_deposits      (id, member_id, bank, principal, rate_pct, compounding:
                     MONTHLY|QUARTERLY|YEARLY|MATURITY, start_date, maturity_date,
                     is_closed)
ipo_applications    (id, member_id, company, applied_qty, price, applied_on,
                     status: APPLIED|ALLOTTED|NOT_ALLOTTED, allotted_qty,
                     instrument_id NULL)
other_assets        (id, member_id, type: PHYSICAL_GOLD|BOND|PPF|EPF|NPS|OTHER,
                     name, invested, current_value, value_updated_on, notes)

-- Derived / cached -------------------------------------------------------------
holdings            VIEW  (member_id, instrument_id, qty, avg_cost, invested)
mf_holdings         VIEW  (member_id, amfi_code, folio_no, units, invested)
live_quotes         (instrument_id PK, ltp, open, high, low, prev_close,
                     week52_high, week52_low, updated_at)
eod_prices          (instrument_id, date, close)          PK (instrument_id, date)
mf_nav_history      (amfi_code, date, nav)                 PK (amfi_code, date)
portfolio_snapshots (member_id, date, asset_class, invested, value)

-- Alerts & news ----------------------------------------------------------------
alert_rules         (id, kind: PRICE_ABOVE|PRICE_BELOW|PCT_MOVE|HIGH_52W|LOW_52W|
                           MEMBER_MOVE|FAMILY_MOVE|NEWS|SIP_DUE|FD_MATURITY|
                           DAILY_SUMMARY|WEEKLY_SUMMARY|CAS_REMINDER,
                     instrument_id NULL, member_id NULL, threshold numeric NULL,
                     is_active, cooldown_minutes default 1440, last_triggered_at)
alert_events        (id, rule_id, triggered_at, message, delivered bool, error)
watchlist_items     (instrument_id PK, added_at, note)
news_articles       (id, url UNIQUE, title, source, published_at,
                     is_important bool, summary NULL, fetched_at)
news_instruments    (article_id, instrument_id)

-- Imports, broker sessions, ops -----------------------------------------------------
import_batches      (id, member_id, kind: BROKER_CSV|CAMS_CAS|NSDL_CDSL_CAS,
                     file_name, row_count, status, mismatches jsonb, created_at)
broker_sessions     (broker PK, access_token_encrypted, expires_at)  -- service role only
job_runs            (id, job_name, started_at, finished_at, status, error)
audit_log           (id, table_name, row_id, action, old_data jsonb, new_data jsonb, at)
```

**Rules**
- Use `numeric` for all money and quantities; never floats.
- Only one user, so RLS is simple: `auth.uid() = <owner id>` on every table. Still turn it on everywhere, so a leaked anon key exposes nothing.
- `broker_sessions` and secrets are readable only with the service role. API keys, PIN and TOTP secret stay in env vars / Supabase Vault.
- Store only the last 4 digits of PAN. The CAS password is typed in at upload time and **never stored**.
- Delete uploaded PDFs after parsing (or keep them in private Storage if Dad wants copies).

---

## 10. Calculations

- **Opening balance** lots use the broker's avg price, dated when entered. Capital gains on these lots are an estimate (flagged in the tax report).
- **FIFO lots** for realized P&L and capital gains; weighted avg for display
- **Day change** = (LTP − prev_close) × qty
- **XIRR** per holding, member and family (MF exact from CAS history)
- **Split/bonus** adjusts qty and avg price; invested stays the same
- **FD value** = compound interest to today
- **Crypto** tax bucket kept separate (30%, no set-off)
- All of this lives in `lib/portfolio/` with Vitest unit tests

---

## 11. Features by phase

### Phase 1: MVP
- Owner login (MFA), members, broker accounts
- Instrument search (ScripMaster sync)
- **Opening balance** and buy/sell entry for stocks
- Live prices (5 s) with a market open/closed badge
- Family dashboard + member page: holdings, invested, current value, day change, P&L
- Mobile-first UI

### Phase 2
- Mutual funds: scheme search, manual entry, **CAMS/KFintech CAS import**, NAV sync, SIPs, Direct vs Regular flag
- **Telegram**: price alerts, daily summary, system alerts (the launch set)
- News feed (in-app only for now)
- Watchlist
- Crypto (Bitcoin) with CoinDCX prices; manual entry + CoinDCX trade-history CSV
- Groww holdings statement import for Mom (plus CAS for her MFs)
- Allocation charts (member, asset class, sector)

### Phase 3
- Broker holdings CSV import (Zerodha, Upstox, Groww, 5paisa, Angel One formats)
- **NSDL/CDSL CAS reconciliation** (mismatch report)
- Angel One holdings auto-sync; CoinDCX balance auto-sync (read-only key); "Connect & Sync" for Zerodha, Upstox and 5paisa if wanted
- FDs, IPOs, other assets
- Corporate actions, XIRR, capital gains report per member per FY, Excel export
- Remaining alerts: portfolio moves, important-news alerts, SIP/FD/IPO/CAS reminders, weekly summary
- Telegram bot commands, net-worth history chart

### Later / nice to have
- Claude-based news summaries and importance tagging
- PWA install, dark mode, Hindi labels
- Goals (e.g. education fund) linked to holdings

---

## 12. Scheduled jobs (IST)

| Job | When | What |
|---|---|---|
| sync-instruments | 08:30 daily | ScripMaster into `instruments` |
| angel-login | 08:45 trading days + on 401 | Refresh SmartAPI session |
| quotes-and-alerts | every 1 min, 09:15–15:30 | Refresh held/watchlist quotes, evaluate price rules |
| crypto-prices | every 5 min, 24×7 | CoinDCX ticker, evaluate crypto rules |
| eod-snapshot | 15:40 trading days | `eod_prices` + `portfolio_snapshots` |
| daily-summary | 15:45 trading days | Telegram summary |
| fetch-news | every 30 min, 07:00–22:00 | Google News RSS, mark important, send news alerts |
| sync-nav | 23:00 daily | AMFI NAV into `mf_nav_history` |
| reminders | 09:00 daily | SIP, FD, IPO, CAS reminders |
| weekly-summary | Sat 09:00 | Telegram weekly report |

Every run is logged in `job_runs`. A failure sends a system alert.

---

## 13. Project structure

```
app/
  (auth)/login/
  (app)/dashboard/
  (app)/members/[id]/          tabs: Stocks | MF | Crypto | Other | P&L | Tax
  (app)/stocks/[symbol]/
  (app)/mutual-funds/  crypto/  other-assets/
  (app)/import/                 CSV + CAS upload, mismatch review
  (app)/alerts/  news/  watchlist/  reports/  settings/
  api/prices/route.ts
  api/telegram/webhook/route.ts (phase 3 bot commands)
components/ui/  components/portfolio/
lib/
  supabase/ (server.ts, client.ts, admin.ts)
  angelone/ (session.ts, quotes.ts, instruments.ts, holdings.ts)
  brokers/ (zerodha.ts, upstox.ts, fivepaisa.ts, csv-parsers/)
  amfi/  coindcx/  coingecko/  news/  telegram/
  portfolio/ (holdings.ts, fifo.ts, xirr.ts, fd.ts, corporate-actions.ts) + tests
  market-hours.ts
api/cas/parse.py                Python casparser endpoint
supabase/
  migrations/  functions/  seed.sql
```

---

## 14. Security checklist

- [ ] Signups disabled in Supabase (only Dad's account exists) + MFA
- [ ] RLS on every table
- [ ] Service-role key only in server code; no `NEXT_PUBLIC_` secrets
- [ ] SmartAPI key, PIN, TOTP secret, CoinDCX key/secret and Telegram bot token in env vars
- [ ] CoinDCX API key created **read-only** (no trading, no withdrawals)
- [ ] Telegram webhook checks the secret token header + Dad's `chat_id`
- [ ] CAS passwords never stored; uploaded PDFs deleted after parsing
- [ ] `/api/prices` requires a session and is rate-limited
- [ ] Weekly `pg_dump` backup via GitHub Action (Supabase free tier has no backups)
- [ ] `.env*` git-ignored, `.env.example` committed

---

## 15. Costs

Everything is free: Angel One, AMFI, CoinDCX public API, CoinGecko, Google News RSS, Telegram, Vercel Hobby, Supabase Free.
Optional: Groww API (paid; skip), Supabase Pro (~$25/mo for backups), a domain (~₹800/yr).

---

## 16. Development stages

We build **one stage at a time**. Each stage ends in a working app you can run, review and commit before the next one starts. External APIs and deployment wait until stage 6 onwards.

| Stage | Name | Needs keys / accounts | Status |
|---|---|---|---|
| 1 | Foundation | Supabase project (only to log in) | ✅ Done |
| 2 | Members & broker accounts | — | ✅ Built |
| 3 | Stock list & search | — (public Angel One instrument file) | ✅ Built (with 4) |
| 4 | Transactions & holdings engine | — | ✅ Built |
| 5 | Dashboard & member portfolio pages | — | ✅ Built |
| 6 | Live prices (Angel One SmartAPI) → **MVP** | Angel One API key + TOTP | Next |
| 7 | Deployment & scheduled jobs | Vercel | |
| 8 | Mutual funds | — (AMFI is public) | |
| 9 | Telegram alerts (launch set) | Telegram bot token | |
| 10 | Crypto, watchlist, news | — (public CoinDCX ticker, RSS) | |
| 11 | Imports & reconciliation | CoinDCX read-only key (optional) | |
| 12 | Extras & hardening | — | |

### Stage 1: Foundation ✅
- Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui, ESLint, Prettier, Vitest
- Supabase clients (server + proxy) and env validation; the app shows a setup notice if `.env.local` is missing
- Email/password login, sign out, route protection (`proxy.ts` + `requireUser()` in pages)
- App shell: sidebar on desktop, slide-out menu on mobile, account menu with light/dark theme
- Placeholder pages: Dashboard, Members, Mutual funds, Crypto, Alerts, Settings (setup status)
- Migration `20260914120000_foundation.sql`: `app_owner` table, `is_owner()` for RLS, first user becomes owner, `set_updated_at()` trigger
- `lib/format.ts` (₹ lakh/crore, %, IST dates) and `lib/redirect.ts` with unit tests
- **Done when:** `npm run lint`, `typecheck`, `test` and `build` pass; Dad can sign in and Settings shows all checks green

### Stage 2: Members & broker accounts ✅
- Migration `20260914130000_members.sql`: `members`, `broker_accounts`, enums, owner-only RLS
- Members list, add/edit/archive/restore member (name, relation, colour, PAN last 4); delete only after archiving
- Link broker accounts per member (Angel One, Zerodha, Groww, Upstox, 5paisa, CoinDCX, Other)
- Member detail page with accounts; holdings placeholder for Stage 4
- Owner-only gate on every signed-in page and Server Action
- **Done when:** the 5 family members and their accounts are saved and editable

### Stage 3: Stock list & search ✅ (built together with Stage 4)
- Migration `20260914140000_instruments_transactions.sql`: `instruments` with owner-only RLS
- Settings → **Update stock list** downloads Angel One's public `OpenAPIScripMaster.json` (≈33 MB, link from the SmartAPI docs) and keeps NSE/BSE shares, SME shares, Sovereign Gold Bonds and indices. Entries that disappear are marked inactive, never deleted
- Stock search by symbol in the transaction form (exact matches first, NSE before BSE)
- The file has no ISIN or full company names, so search is by ticker ("RELIANCE", not "Reliance Industries")
- `market_holidays` moved to Stage 6, where market hours are used
- **Done when:** searching "TCS" or "NIFTYBEES" finds the right instruments

### Stage 4: Transactions & holdings engine ✅
- Same migration: `transactions` (member, broker account, stock, type, quantity, price, charges, date, notes) with owner-only RLS; a composite foreign key ensures the account belongs to the member
- Forms: opening balance, buy, sell; edit/delete with confirmation. A save or delete is refused if any sell would exceed the shares held on its date
- `lib/portfolio`: FIFO lots, average cost including charges, realized P&L, with unit tests. Holdings are calculated in the app from transactions (no database view)
- Member page: holdings table (quantity, average cost, invested, booked P&L) and transaction history
- Stock splits and bonuses moved to Stage 12
- **Done when:** every member's current holdings are entered and match their broker apps

### Stage 5: Dashboard & member portfolio pages ✅
- Migration `20260914150000_instrument_prices.sql`: `instrument_prices` (last price, previous close, source, time) with owner-only RLS. Stage 6 writes to the same table
- "Update prices" form (dashboard and member page) for hand-entered prices until Stage 6
- Family dashboard: current value, invested, unrealised P&L, today's change, booked P&L; value per member with share bars; top gainers/losers. Archived members are excluded
- Member page: the same summary tiles; holdings show last price, today's change, current value and P&L
- `lib/portfolio/valuation`: valuation, totals and movers, with unit tests. Holdings without a price count toward invested but not value or P&L
- No sector allocation: the instrument file has no sector data
- `eod_prices` and `portfolio_snapshots` (history charts) moved to Stage 7, which adds scheduled jobs
- **Done when:** the dashboard shows correct numbers using stored prices

### Stage 6: Live prices (Angel One SmartAPI) → MVP
- Server-side SmartAPI login with TOTP, session stored server-only
- `/api/prices` with batching, 4-second cache, market-hours and holiday check (adds the `market_holidays` table)
- 5-second refresh on dashboard/member pages (writes to `instrument_prices`), market open/closed badge
- **Done when:** prices update live during market hours

### Stage 7: Deployment & scheduled jobs
- Deploy to Vercel; Supabase auth URLs for production
- pg_cron + Edge Functions: instrument sync, Angel One login, EOD snapshot, `job_runs` log (adds `eod_prices` and `portfolio_snapshots`)
- Weekly DB backup (GitHub Action `pg_dump`)
- **Done when:** Dad uses it from his phone and daily jobs run on their own

### Stage 8: Mutual funds
- Migrations: `mf_schemes`, `mf_transactions`, `sips`, `mf_nav_history`, `mf_holdings` view
- AMFI scheme list + nightly NAV sync
- CAMS/KFintech CAS PDF import (Python `casparser` endpoint), manual entry, SIPs
- Direct vs Regular flag, MF XIRR
- **Done when:** all members' funds are imported and valued daily

### Stage 9: Telegram alerts (launch set)
- Migrations: `alert_rules`, `alert_events`, owner Telegram settings
- Price alerts (target, stop-loss, % move, 52-week high/low), daily 3:45 PM summary, system alerts
- Cooldown + quiet hours; alert management page
- **Done when:** Dad receives a test alert and the daily summary

### Stage 10: Crypto, watchlist, news
- Crypto instruments + CoinDCX ticker prices; crypto buy/sell entry
- Watchlist page
- News feed from Google News RSS for held and watchlisted stocks
- **Done when:** Bitcoin value is live and each stock shows recent news

### Stage 11: Imports & reconciliation
- Holdings/tradebook imports: Zerodha, Groww, Upstox, 5paisa, Angel One, CoinDCX
- NSDL/CDSL CAS upload with mismatch report
- Angel One holdings auto-sync; CoinDCX balance sync (read-only key)
- **Done when:** a monthly CAS upload confirms every member's holdings

### Stage 12: Extras & hardening
- Stock splits and bonuses (corporate actions) applied to holdings
- FDs, IPO applications, other assets (gold, PPF, bonds)
- Capital gains report per member per FY, XIRR everywhere, Excel export
- Remaining alerts (portfolio moves, news, reminders, weekly summary), Telegram bot commands
- MFA for the owner, PWA install, audit log

---

## 17. Before coding: what to prepare

All questions are answered. Get these ready (none go into git):

| # | Item | Needed for | Where |
|---|---|---|---|
| 1 | Node.js 20+ and a GitHub repo | Stage 1 | nodejs.org |
| 2 | **Supabase project** (region: Mumbai `ap-south-1`): URL and publishable key | Stage 1 (to sign in) | supabase.com |
| 3 | **Angel One SmartAPI**: API key, client code, PIN, TOTP secret (text under the QR code when enabling TOTP) | Stage 6 | smartapi.angelone.in |
| 4 | Vercel account linked to GitHub | Stage 7 | vercel.com |
| 5 | Each member's holdings export (Angel One, Zerodha Console, Groww, Upstox, 5paisa) | Stage 4 (opening balances) | Broker apps → Reports |
| 6 | CAMS/KFintech detailed CAS PDF per PAN | Stage 8 | camsonline.com / mfcentral.com |
| 7 | Telegram bot token (from @BotFather) + Dad's chat ID | Stage 9 | Telegram |
| 8 | CoinDCX read-only API key (optional) | Stage 11 | CoinDCX → API dashboard |
