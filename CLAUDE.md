# Ledger: freelancer accounting app (Sweden)

Web app for two self-employed freelancers in Sweden (both **enskild firma, F-skatt**):
- **Translator**: VAT registered. Invoices per project from logged days (hours + minutes).
- **Sales contractor**: not VAT registered. Invoices base fee + commission twice a month.

Both have their own login and can see everything. Shared dashboard plus one page per person.

## Development rule: Red/Green TDD, always

Every feature, bug fix and refactor follows:

1. **RED**: write a failing test that describes the behaviour. Run it and confirm it fails for the right reason.
2. **GREEN**: write the *minimum* code needed to make it pass. Run the suite.
3. **REFACTOR**: clean up while the suite stays green. Commit.

No production code is written without a failing test first.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server (demo mode with sample data when Supabase env vars are missing) |
| `npm test` | Vitest unit + component tests |
| `npm run coverage` | Tests with coverage (≥ 90% required on `src/domain/`) |
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | oxlint |
| `npm run test:e2e` | Playwright end-to-end tests (runs against `npm run dev`) |
| `npx supabase test db` | pgTAP tests for schema and RLS (needs Docker; runs in CI) |

## Architecture

- `src/domain/`: **pure TypeScript** money, VAT, duration, invoice, tax, deadline and dashboard logic. No React, no Supabase. Highest test density.
- `src/data/`: `Repository` interface with two implementations: `memoryRepository` (demo mode and tests) and `supabaseRepository` (production). UI talks only to the interface through React Query hooks.
- `src/features/<area>/`: React pages and components (dashboard, person, invoices, time, expenses, tax, settings, auth).
- `src/components/`: shared UI primitives (Tailwind).
- `supabase/migrations/`: SQL schema, RLS policies, invoice numbering, audit log. `supabase/tests/`: pgTAP.
- `api/`: Vercel serverless functions (`fx-rate`: Riksbank exchange rates).

## Conventions

- **Money is integer öre** (minor units) plus a currency code. Never floats for stored amounts.
- **Durations are integer minutes.** UI uses hour and minute dropdowns, displayed as `6 h 30 min`.
- Tax rates live in `TaxYearParams` (`src/domain/tax/params.ts` and the `tax_year_params` table). Tests use fixture params, never live values. **Verify the rates against Skatteverket every January.**
- UI copy: English, sentence case, Swedish tax terms in brackets where helpful (moms, egenavgifter, periodiseringsfond).
- Design: light theme, one teal accent, green = paid, amber = due soon, red = overdue. Ease of use first.

## Accounting rules encoded in the app

- Domestic reverse charge does not apply to translation or sales services. Swedish clients pay 25% moms. EU business clients: reverse charge (no VAT, mandatory text). Outside EU: no Swedish VAT.
- Non-registered seller: invoices carry the momsbefriad text. Warn when turnover nears the 120,000 kr limit.
- Services to a company outside the EU (Michael's US client) are `export`: place of supply outside Sweden, no Swedish moms, and **not counted** towards the 120,000 kr limit (`countsTowardsVatLimit`). Each person has a usual VAT choice (`defaultVatTreatment`).
- Foreign-currency invoices: the SEK that actually reached the bank (`paidAmountSek`) is the income under kontantmetoden.
- Default kontantmetoden (cash method): income and VAT are counted when paid.
- Sent invoices can still be edited, but every change is written to `audit_log`. Credit notes are the clean correction.
- Tax figures are estimates for planning. They don't replace the NE-bilaga or the deklaration.

## Deployment

Pushes to `main` on GitHub (`michaeldeanlyon-ship-it/Accounting-App`) deploy to production on Vercel through Vercel's Git integration. Other branches get preview URLs. CI (GitHub Actions) runs lint, typecheck, tests and the build.
