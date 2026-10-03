# Milestone 1 delivery

Implemented the revised provider-ready foundation only. No real PayPal API calls, AI requests, persistence or state-changing features were added.

## Validation

- ESLint: passed with no warnings.
- TypeScript: passed.
- Unit/contract tests: 18 passed.
- Production build: passed; `/pal` renders on the server.
- Browser checks: 4 passed across 1440px desktop and 390px phone viewports. Verified totals, disabled previews, section navigation, no page errors, no horizontal overflow, and keyboard skip navigation.
- Desktop and phone screenshots visually inspected. Reproducible screenshots are written under ignored `test-results/` by `npm run test:browser`.
- Dependency audit after the final dependency install: 0 vulnerabilities reported.

The in-app browser backend was unavailable, so browser validation used installed Chrome through Playwright. The browser test waits for streamed page content before checking initial keyboard focus.

## Architecture decisions

1. One read-only `FinancialProvider` contract returns normalized balance snapshots and paginated transactions.
2. Concrete adapters and environment configuration stay server-only. Core/UI provider and fixture imports are prohibited by lint rules.
3. Domain models contain opaque source identifiers solely for reconciliation; vendor payloads do not leave the integration boundary.
4. Sync validates schemas, ownership, account/currency, integer cents, canonical UTC timestamps, date bounds, duplicate IDs and pagination before an atomic repository write.
5. Repository and dashboard service interfaces separate storage from calculations. An in-memory repository is sufficient for this explicitly read-only milestone.
6. An independent second provider in tests changes source IDs, order and page size without changing any downstream financial results.
7. Sandbox and its normalizer intentionally fail until verified integration is available. They never substitute demo balances.

## Assumptions

USD only; a fictional user; in-memory data reset per render; fixed demo snapshot of October 15, 2026; UTC reporting days. Coffee holds $64 so the four buckets total exactly $1,944 and Safe to Spend is $486. No actual money moves. The small read-only finance slice is included to power the dashboard and prove provider interchangeability; broader finance functionality remains milestone 2.

## Files created

```text
.env.example
.gitignore
README.md
package.json
package-lock.json
tsconfig.json
next-env.d.ts
next.config.ts
postcss.config.mjs
eslint.config.mjs
vitest.config.ts
playwright.config.ts
docs/
  IMPLEMENTATION_PLAN.md
  ARCHITECTURE.md
  PAYPAL_INTEGRATION.md
  AI_DESIGN.md
  MILESTONE_1_REPORT.md
src/app/
  layout.tsx
  page.tsx
  globals.css
  icon.svg
  pal/page.tsx
  pal/loading.tsx
  pal/error.tsx
src/components/pal/
  PalDashboard.tsx
  PalMascot.tsx
  QuickCheck.tsx
src/domain/models.ts
src/finance/dashboard.ts
src/fixtures/demo.ts
src/lib/format.ts
src/providers/financial/
  FinancialProvider.ts
  types.ts
  DemoProvider.ts
  PayPalSandboxProvider.ts
  normalizers/paypalTransactionNormalizer.ts
src/repositories/
  PalRepository.ts
  InMemoryPalRepository.ts
src/server/
  config.ts
  dashboard.ts
  syncFinancialData.ts
src/services/dashboard.ts
tests/
  server-only.ts
  provider-compatibility.test.ts
  dashboard-finance.test.ts
  browser/dashboard.spec.ts
```

Renamed the supplied `PAL_RODUCT_SPEC.md` to `PAL_PRODUCT_SPEC.md`, preserving its contents. Installed dependencies and generated build/cache/screenshot files are ignored, not source deliverables. No commits or deployments were made.

## Required Sandbox work remaining

Obtain APIMatic PayPal Context Plugin access or its SDK/context artifacts; consult them and current PayPal docs; verify application/account scopes and Sandbox capabilities; implement server auth/API calls and source normalization; connect authenticated ownership and durable idempotent storage; verify webhooks if used; add source-mapping/error tests; and demonstrate at least one real Sandbox-backed event/data flow through Pal. See [PAYPAL_INTEGRATION.md](PAYPAL_INTEGRATION.md) for acceptance evidence and the pending capability list.

Ask Pal, Quick Check writes, bucket CRUD, proposals, projections and full activity routes remain in their specified later milestones. Milestone 1 is complete; the full hackathon definition of done is not yet met.
