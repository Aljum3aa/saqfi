# سقفي | Saqfi

**ولا دينار فوق السقف — Not one dinar over the cap.**

## Problem, users, solution

Kuwaiti football clubs, especially First Division clubs and academies with limited
budgets, struggle with late salaries and overruns when finances live in Excel or
notebooks. Saqfi gives finance managers and club presidents a hard season budget,
category caps, payroll and a record of every dinar. Players follow their own pay.
This is a coded course FinTech MVP, not a banking or money-transfer service.

## MVP and delivery order

Build one feature fully before the next. Work in small, functioning increments.
Do not add anything outside this list:

1. Phase one: three demo roles (finance manager, president, player), season budget
   and category caps, player contracts, monthly payroll, hard-cap rejection, and
   dashboard (category spending, remaining funds, forecast, 80% and late-pay alerts).
2. AI financial assistant: conversational budget suggestions and questions about
   actual club numbers. Advice only; never spend, sign or directly mutate finances.
3. Manager win/draw bonus rules, match-result bonuses, lateness/cards/absence fines,
   applied automatically to the appropriate monthly salary.
4. Player wallet: salary, bonuses, fines and net monthly pay.

Only phase one is implemented at present. Bonus/fine fields are zero in phase-one
payroll, not simulated as implemented features. Players currently have a restricted
own-contract/history view, not the later full wallet.

## Vision — NOT in the current MVP

Transfer-fee installments, sponsor/ticket income, multi-step approvals, sports
authority reporting, and direct bank salary payouts. Do not implement these now.
No payments are required. Any future payment experiments must use Stripe test mode.

## Stack and layout

- MERN: React + Vite + TypeScript, Node.js + Express, MongoDB Atlas + Mongoose.
- `artifacts/saqfi/`: client application (the client folder in this workspace).
- `artifacts/api-server/src/saqfi/`: server domain layer, routes, Mongoose schemas,
  financial calculations and shared seed (the server folder in this workspace).
- `lib/api-spec/openapi.yaml`: source of truth for API contracts.
- `lib/api-client-react/`, `lib/api-zod/`: generated client hooks/validation.
- Existing PostgreSQL scaffold is unused; do not replace MongoDB with it.
- Arabic RTL first; English toggle; calm light banking interface with navy accent.
- Show whole dinars in summaries; exact detail amounts retain three decimals when
  they actually contain fils. Never round or change stored financial amounts.
- No emojis or decorative icons before labels. Functional icons only.
- Vercel is the intended eventual deployment target; deployment configuration is
  a later step, not a claim that this development build is deployed there.

## Data modes

- Without `MONGODB_URI`: explicit in-memory demo store, seeded on each server
  restart. Edits are temporary, shared between demo sessions, and reset on restart.
- With `MONGODB_URI`: MongoDB Atlas through Mongoose. Restart the API after adding
  the secret. The exact same seed is inserted ONLY when the collection is empty.
  No memory edits are migrated; an existing database is never overwritten.
- A configured but unreachable/invalid MongoDB connection FAILS EXPLICITLY; never
  silently fall back to memory and make users think financial data was saved.
- Admin UI displays `بيانات تجريبية` or `قاعدة البيانات`.
- The fictional First Division demo club is نادي الساحل الجديد / New Sahel FC.
  All 20 player identities and financial records are synthetic.
- Demo season: July 2026–June 2027, KWD 400,000, July–September payroll history.
  Travel is at 92% so warnings and cap rejection can be demonstrated.
- Seed does not add bonuses/fines until the corresponding phase is built.

## Authentication and safety

- Current login is EXPLICIT public sandbox role entry, not production
  authentication. Each role button issues a random opaque, HttpOnly, SameSite
  session cookie; sessions expire after 8 hours and reset with the API process.
- Three demo identities: manager (المدير المالي), president (رئيس النادي),
  player (أحمد العتيبي). No passwords, real users or secret credentials are seeded.
- Server enforces manager-only mutations; president is read-only; player receives
  only their own contract and payroll lines, never the club budget or other pay.
- Do not enter real club finances into this public demo, even in MongoDB mode.
  Real authentication via Clerk and owner-controlled role provisioning is required
  before any real-data/public production use.
- Secrets belong in Replit Secrets / untracked `.env`, NEVER code, logs, git or
  browser bundles. Never print MongoDB URI or AI keys.
- Phase two should prefer Replit AI integration when available; otherwise use
  server-only `OPENAI_API_KEY`, with a graceful unavailable message when missing.

## Financial rules

- Integer fils for all arithmetic; API amounts are KWD, max three decimals.
- Contracts reserve ALL unpaid inclusive calendar months through season end.
  Partial calendar months count as full salary months in this MVP; explain in UI.
- Contract start/end must be within season. No adding contracts retroactively
  into an already completed payroll month.
- Available funds = cap − actual spending − unpaid contractual commitments.
  New contracts, expenses, and allocation reductions must all pass this invariant.
- Payroll converts reserved obligations into spending atomically, and records
  one ledger transaction and all player lines. Duplicate monthly runs rejected.
- Run oldest unpaid eligible month first, never a future month. Payroll is
  accounting-only; no bank or Stripe transfer is made.
- MongoDB stores the season as a Mongoose aggregate with validated subdocuments.
  Revision compare-and-swap prevents concurrent cap overspend, duplicate payroll,
  and partial ledger/contract changes across server processes. In-memory mode
  uses the same revision and financial validation.
- Forecast = actual spend / elapsed calendar months (including current month)
  × season months. This is an indicative burn-rate extrapolation, not a promise.
- A previous month with eligible unpaid players generates a late salary alert.
- No edit/delete of paid contracts or ledger entries in phase one; these were not
  requested and would need an explicit reversal/audit policy.

## Run and operate

- Client workflow: `artifacts/saqfi: web`.
- API workflow: `artifacts/api-server: API Server`.
- `pnpm --filter @workspace/api-spec run codegen` after EVERY spec change.
- `pnpm run typecheck` for the complete workspace.
- `pnpm --filter @workspace/api-server run build` for backend bundle.
- API base: `/api/saqfi`; same-origin cookies, no hardcoded hosts.
- Key endpoints: `/session` GET/POST/DELETE, `/state` GET, `/budget` PUT,
  `/contracts` POST, `/expenses` POST, `/payroll` POST.
- Artifacts have managed workflows; do not create duplicate servers.

## Interface direction

The user's supplied designer handoff is authoritative. Use provided component
files exactly as supplied. Only fix demonstrated integration or runtime
breakages; do not rewrite or visually "improve" the designer's work.

- Cool-paper background, white cards, deep navy brand/action colour, gold for the
  logo and budget-cap line. Root and dark token values intentionally match.
- Green means paid/good, amber warning, red over-cap/rejected.
- IBM Plex Sans Arabic for body text and Readex Pro for display text, with weights
  400, 500, 600 and 700.
- Readable 16px body, generous spacing, 16px theme corners, 20px panel corners and
  the designer's supplied component shapes.
- Five sections: الرئيسية، الميزانية، اللاعبين والعقود، الرواتب، المصاريف.
  Mobile bottom tabs; dark desktop sidebar. Advisor is a separate button.
- The home summary prominently shows genuinely spendable money after salary
  reservations, and distinguishes spent, reserved and the season cap.
- Plain short Kuwaiti/Gulf Arabic, one page title/short explanation/main action.
  Empty states explain what to do. Cap failures explain amount and next steps.
- Mobile tables become stacked cards; verify every page at 375px and desktop.
- Advisor availability dialog is honest about the feature not being active yet;
  it is not an implemented AI assistant and must not fabricate answers.
- No em/en dashes in visible wording. Show month names instead of ISO month dates;
  keep stored ISO values intact. Keep the mobile role/data-mode line short.
