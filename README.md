# Ledger: accounts for two Swedish freelancers

A light, simple web app for two self-employed people in Sweden (enskild firma, F-skatt):

- **Dashboard**: money expected in the next 30 days, overdue, paid this month, tax to set aside, a one-click **Paid** tick per invoice, Skatteverket deadlines and a money-in chart.
- **A page per person** with invoices, time (translator), expenses with receipts, deductions and a tax estimate with ways to lower it.
- **Invoices you can edit**: days with hour and minute dropdowns for the translator, base fee + commission for the sales contractor, multi-currency, reverse charge, credit notes, a change history for sent invoices and a printable PDF.

Built with Vite, React, TypeScript, Tailwind, TanStack Query and Supabase, and hosted on Vercel. Developed **Red/Green TDD**: see [CLAUDE.md](CLAUDE.md).

## Run it locally

```bash
npm install
npm run dev
```

Without Supabase settings the app runs in **demo mode** with sample data saved in your browser.

## Go live (one-time setup)

### 1. Supabase (database, logins, receipts)

1. Create a project at [supabase.com](https://supabase.com) in an **EU region (Stockholm, eu-north-1)**.
2. Apply the schema. Either paste `supabase/migrations/20261021000000_initial_schema.sql` into the SQL editor and run it, or:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. **Authentication → Users → Add user**: create both people with email and password. Also turn off "Allow new users to sign up" under Authentication → Sign In / Providers.
4. Edit the emails and names in `supabase/bootstrap.sql`, then run it in the SQL editor. This links each login to their person.
5. Copy the **Project URL** and **anon public key** from Project settings → API.

### 2. Vercel (hosting, auto-deploy from GitHub)

1. At [vercel.com/new](https://vercel.com/new), import `michaeldeanlyon-ship-it/Accounting-App`. The framework is detected as Vite.
2. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Production and Preview).
3. Deploy. From then on **every push to `main` deploys to production automatically**, and every branch or pull request gets its own preview link.
4. In Supabase → Authentication → URL configuration, set the Site URL to your Vercel address.

### 3. GitHub (recommended)

Settings → Branches → add a rule for `main` that requires the **CI** checks to pass. Then only tested code reaches production.

## Commands

| Command | |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit and component tests (Vitest) |
| `npm run coverage` | Tests with coverage (≥ 90% on `src/domain`) |
| `npm run test:e2e` | End-to-end tests (Playwright, desktop and mobile) |
| `npm run typecheck` / `npm run lint` | Type and lint checks |
| `npx supabase test db` | Database and security tests (needs Docker; runs in CI) |

## Keep it accurate

- **Every January**, check the tax rates in Settings → Tax rates against Skatteverket ("Belopp och procent").
- The tax figures are planning estimates. Your inkomstdeklaration with NE-bilaga decides the final tax.
