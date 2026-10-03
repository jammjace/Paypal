# Pal

A financial co-pilot prototype for the PayPal AI Hackathon 2026. One balance, virtual money buckets, and a clearer view of spending.

**Milestone 1 only:** a read-only `/pal` dashboard, provider-ready architecture, normalized models, demo adapter and compatibility tests. There are no real PayPal or AI calls yet. The full product source of truth is [PAL_PRODUCT_SPEC.md](PAL_PRODUCT_SPEC.md).

## Run locally

Requires Node.js 24 (the validated environment) and npm.

```sh
npm ci
# Optional: copy .env.example to .env.local to change the demo clock.
npm run dev
```

Open [localhost:3000/pal](http://localhost:3000/pal). `/` redirects to `/pal`.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:browser
npm start
```

`npm run check` runs all four checks. Package versions are reproducible through `package-lock.json`.

`npm run test:browser` uses an installed Google Chrome and the production build to check desktop/mobile rendering, disabled preview controls, anchor navigation and keyboard access. If Chrome is unavailable, install it or adjust the Playwright browser channel. Build first; the test runner starts and stops its own local server.

## What works now

- Provider-derived $2,430 balance, $1,944 earmarked and $486 Safe to Spend.
- Four virtual buckets, two review transactions, equivalent-day spending comparison, top merchants, scheduled goal dates and sample allocation history.
- Normalized pagination and validated sync into a repository interface.
- Original celestial Pal mark, responsive layout, keyboard navigation, semantic sections, loading and error states.
- An independent alternative provider test confirms identical finance results despite different source IDs, ordering and page sizes.

Ask Pal, Quick Check answers, bucket changes and Future You projections are visibly deferred. There are no fake working actions or hidden state changes. Navigation outside this prototype is presented as inactive shell text.

## Stack and architecture

Next.js App Router, React, TypeScript, Tailwind CSS, Zod, Lucide icons, Vitest and ESLint; npm package manager.

```text
FinancialProvider -> normalized Account/Transaction -> repository -> Pal services -> UI
        |                                                  |
 Demo or Sandbox                                   deterministic finance
```

The server composition root chooses the adapter. Finance, buckets, analytics and UI have no concrete-provider imports. Money is safe integer cents. Credentials stay server-side. See [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Configuration

| Variable | Meaning |
| --- | --- |
| FINANCIAL_PROVIDER | `demo` by default; `paypal-sandbox` intentionally fails until the required integration is implemented |
| DEMO_AS_OF | Demo-only fixed snapshot clock; defaults to `2026-10-15T18:00:00.000Z` |
| PAYPAL_CLIENT_ID | Future Sandbox application credential |
| PAYPAL_CLIENT_SECRET | Future secret, server-side only |
| PAYPAL_ENV | `sandbox` only; live mode rejected |
| PAYPAL_WEBHOOK_ID | Future verified webhook flow, if used |

No credentials are needed for demo mode. Never put secrets in `NEXT_PUBLIC_` values or commit `.env.local`.

## Seed and reset

Milestone 1 automatically creates deterministic records in memory on each server render; refresh resets the preview. No database seed command is needed yet. `src/fixtures/demo.ts` contains previous/current-month transactions, incoming reimbursements/transfers, known merchants and ambiguous records. A persistent seed/reset command will arrive with milestone 3.

Dates are relative to the explicit demo clock. The default October 15 preview intentionally differs from the host date. Consumer code receives a snapshot timestamp and never branches on a demo date.

## Preview walkthrough

1. Open `/pal` and inspect the three financial totals.
2. Review Alex and Target in Quick Check; categorization controls are disabled in this milestone.
3. Inspect Rent, Christmas, Travel and Coffee; allocations sum to $1,944.
4. Compare October 1–15 ($742) with September 1–15 ($891): $149 / 16.7% less.
5. Inspect top merchants and scheduled bucket dates. Luckin's $84.60 total is also checked in the contract tests.
6. Review sample bucket allocation history. No actual money has moved.

## PayPal Sandbox and APIMatic

Real Sandbox data/event flow is **required** in milestone 7. APIMatic context was not exposed in this session, so the Sandbox adapter/normalizer contain no guessed endpoints or SDK models. Before implementing them, consult APIMatic's PayPal Context Plugin or provided artifacts and current official PayPal docs. Verify actual account scopes/capabilities. Selecting an unimplemented provider never silently falls back to demo data.

See [PAYPAL_INTEGRATION.md](docs/PAYPAL_INTEGRATION.md) for the boundary, pending capabilities, environment setup and mandatory submission evidence. A stub is not a completed integration.

## Next milestones

The [revised implementation plan](docs/IMPLEMENTATION_PLAN.md) covers finance, persistence, structured AI, confirmed actions, projections, required Sandbox integration and submission readiness. AI design is documented in [AI_DESIGN.md](docs/AI_DESIGN.md).

The [Milestone 1 report](docs/MILESTONE_1_REPORT.md) lists all created files, architecture decisions, assumptions and validation results.

Framework setup follows the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
