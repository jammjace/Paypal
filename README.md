# Pal

A financial co-pilot prototype for the PayPal AI Hackathon 2026. One balance, virtual money buckets, and a clearer view of spending.

**Milestones 1–6:** persistent savings goals and period-based spending budgets, Ask Pal with free local Qwen3 4B interpretation, Quick Check, normalized ingestion, approved changes, and Future You projections. MS6 adds transport-pass analysis, persistent clarifications and combined budget/savings previews. No real PayPal calls are made. The revised bucket definition is documented in [BUCKETS.md](docs/BUCKETS.md) and supersedes the original earmark-only examples in [PAL_PRODUCT_SPEC.md](PAL_PRODUCT_SPEC.md).

## Run locally

Requires Node.js 24 (the validated environment) and npm.

```sh
npm ci
# Optional: copy .env.example to .env.local to change the demo clock.
npm run dev
```

For the configured local AI runtime, start `npm run ai:start` before Pal. This runs Qwen3 4B locally with cloud disabled; see [AI setup](docs/AI_DESIGN.md). `npm run test:ai` verifies real model interpretation.

Open [localhost:3000/pal](http://localhost:3000/pal) and choose **Start my demo** once. `/` redirects to `/pal`. Keep using the same hostname/browser to retain its session cookie.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:browser
npm start
```

`npm run check` runs all four checks. Package versions are reproducible through `package-lock.json`.

`npm run test:browser` uses installed Google Chrome and the production build to check desktop/mobile rendering, expanded analytics, Ask Pal, budget corrections, confirmed savings changes, navigation and keyboard access. If Chrome is unavailable, install it or adjust the Playwright browser channel. Build first; tests start and stop their own server on port 3100 and never reuse a stale preview server.

## What works now

- Provider-derived $2,430 balance, $1,880 saved and $550 Safe to Spend. Coffee: $84.60 spent of a $100 monthly limit, $15.40 left.
- Four virtual buckets, two review transactions, equivalent-day spending comparison, top merchants, scheduled goal dates and sample allocation history.
- Category changes and shares, expandable merchant totals/counts/averages/trends/category shares, and a separate income/received-money breakdown.
- Custom/UTC month periods, checked integer money utilities, pure allocation impact validation and fixed-interval goal funding projections. These pure functions expose no state-changing endpoints.
- Normalized pagination and validated sync into a repository interface.
- SQLite persistence across refreshes and server restarts, isolated browser sessions, ownership checks, optimistic revision checks and idempotent mutations.
- Create/edit/archive spending budgets and savings goals, preview and confirm savings additions/withdrawals, persist Quick Check answers, optionally remember matching future transactions, inspect transactions and activity history.
- Original celestial Pal mark, responsive layout, keyboard navigation, semantic sections, loading and error states.
- An independent alternative provider test confirms identical finance results despite different source IDs, ordering and page sizes.

Ask Pal answers balance, spending comparison, merchant/category, income and bucket questions. Local model interpretation is optional; without Ollama the UI labels its limited local fallback. Savings carry forward, while budget allowances reset weekly/monthly. Monthly contributions are plans confirmed manually. Ask Pal prepares savings proposals and clarifies budget increases before showing impacts for approval. Future You supports conditional calendar projections, planned events and Apply/Discard/Modify scenarios. See [Confirmed actions](docs/CONFIRMED_ACTIONS.md) and [Future You](docs/FUTURE_YOU.md).

Try **“Help me add $60 to Coffee”** to clarify a temporary allowance increase versus a savings withdrawal, or ask whether a **$90 monthly transport pass** would be cheaper. Pal asks you to confirm covered merchants and assumptions before calculating a comparison. The sample Transport merchant is Uber; no public-transit eligibility is assumed. Open `/pal/future` to preview contribution plans and recurring income/expenses. Applying a plan never executes future payments.

## Stack and architecture

Next.js App Router, React, TypeScript, Tailwind CSS, Zod, Lucide icons, SQLite via Node 24's built-in `node:sqlite`, Vitest and ESLint; npm package manager. Node may print an experimental SQLite API warning; no native database dependency is installed.

```text
FinancialProvider -> normalized Account/Transaction -> repository -> Pal services -> UI
        |                                                  |
 Demo or Sandbox                                   deterministic finance
```

The server composition root chooses the adapter. Finance, buckets, analytics and UI have no concrete-provider imports. Money is safe integer cents. Credentials stay server-side. See [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Configuration

| Variable | Meaning |
| --- | --- |
| PAL_AI_MODE | `local` uses free rule-based fallback; `ollama` uses Qwen3 4B running locally, with no paid API |
| FINANCIAL_PROVIDER | `demo` by default; `paypal-sandbox` intentionally fails until the required integration is implemented |
| PAL_DB_PATH | SQLite path; defaults to ignored `.local/pal.sqlite` |
| PAL_COOKIE_SECURE | `false` for local HTTP; use `true` behind HTTPS |
| DEMO_AS_OF | Demo-only fixed snapshot clock; defaults to `2026-10-15T18:00:00.000Z` |
| PAYPAL_CLIENT_ID | Future Sandbox application credential |
| PAYPAL_CLIENT_SECRET | Future secret, server-side only |
| PAYPAL_ENV | `sandbox` only; live mode rejected |
| PAYPAL_WEBHOOK_ID | Future verified webhook flow, if used |

No payment, billing account or API key is required. Paid AI connections are not supported. No credentials are needed for demo mode or local Ask Pal. See [AI_DESIGN.md](docs/AI_DESIGN.md) for optional local model setup and verification limits. Never put secrets in `NEXT_PUBLIC_` values or commit `.env.local`.

## Seed and reset

Start with `npm run dev`, then **Start my demo** seeds a private workspace on the server. Reads and refreshes never reseed it. To reset only your browser's demo, open **Demo controls → Confirm reset** on `/pal`; this replaces that workspace's buckets, classifications, rules and activity with the sample baseline. Other browser sessions are unaffected. `src/fixtures/demo.ts` is the deterministic seed source. There is intentionally no global wipe command.

Data and hashed session tokens live in `.local/pal.sqlite` (including SQLite WAL/SHM sidecars), which is ignored by Git. Retain this directory across local server restarts. A new browser/cleared/expired cookie starts a separate demo; there is no account recovery or real identity provider in this local milestone. Browser tests use a separate `.local/browser-tests.sqlite` database.

Dates are relative to the explicit demo clock. The default October 15 preview intentionally differs from the host date. Consumer code receives a snapshot timestamp and never branches on a demo date.

## Preview walkthrough

1. Open `/pal`, start a demo if needed, and inspect the three financial totals.
2. Classify Alex as Reimbursement, optionally remembering the choice. Its card disappears; refresh or sync preserves it and reimbursements become $80.20.
3. Inspect Rent, Christmas and Travel savings; saved amounts sum to $1,880. Coffee is a $100 monthly spending budget, not a cash reserve.
4. Compare October 1–15 ($742) with September 1–15 ($891): $149 / 16.7% less.
5. Expand Luckin Coffee: $84.60 across 12 transactions, $7.05 average, $61.20 previous equivalent days and +38.2%. It represents 100% of this seed's Coffee category and 11.4% of total spending.
6. Expand income and money received: after classifying Alex, $2,400 income, $80.20 reimbursements, $200 transfers and $18 refunds. Before classification, reimbursements are $32 with $48.20 awaiting review.
7. Create a savings goal, set its monthly contribution plan, preview and confirm an addition, then inspect `/pal/activity`. Create an Eating out budget for Dining and watch its allowance reflect category transactions. Ask Pal about either bucket. No actual money leaves the account.

## PayPal Sandbox and APIMatic

Real Sandbox data/event flow is **required** in milestone 7. APIMatic context was not exposed in this session, so the Sandbox adapter/normalizer contain no guessed endpoints or SDK models. Before implementing them, consult APIMatic's PayPal Context Plugin or provided artifacts and current official PayPal docs. Verify actual account scopes/capabilities. Selecting an unimplemented provider never silently falls back to demo data.

See [PAYPAL_INTEGRATION.md](docs/PAYPAL_INTEGRATION.md) for the boundary, pending capabilities, environment setup and mandatory submission evidence. A stub is not a completed integration.

## Next milestones

Milestone 6 is complete; see the [delivery report](docs/MILESTONE_6_REPORT.md). Next is **Milestone 7: required PayPal Sandbox integration**. Public model hosting remains deferred.

The [revised implementation plan](docs/IMPLEMENTATION_PLAN.md) covers finance, persistence, structured AI, confirmed actions, projections, required Sandbox integration and submission readiness. AI design is documented in [AI_DESIGN.md](docs/AI_DESIGN.md).

The [Milestone 1 report](docs/MILESTONE_1_REPORT.md) lists all created files, architecture decisions, assumptions and validation results.

[FINANCE_ENGINE.md](docs/FINANCE_ENGINE.md) documents milestone 2 formulas, rounding, period coverage, income classification and projection assumptions.

The [Milestone 2 report](docs/MILESTONE_2_REPORT.md) records the delivered files, 39 unit/contract tests, six browser checks and remaining scope.

The [Milestone 4 report](docs/MILESTONE_4_REPORT.md) records the bucket amendment, Ask Pal implementation and verification.

The [Milestone 3 report](docs/MILESTONE_3_REPORT.md) records delivered files, validation and remaining integration work.

[PERSISTENCE.md](docs/PERSISTENCE.md) describes local sessions, SQLite transactions, reconciliation, reset behavior and the Supabase integration seam.

Framework setup follows the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
