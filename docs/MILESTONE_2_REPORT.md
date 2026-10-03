# Milestone 2 delivery

Completed the deterministic finance engine and connected its expanded analytics to the read-only dashboard. No provider interfaces, adapters, PayPal calls, credentials, database writes or AI integration were changed.

## Delivered

- Integer-cent addition/subtraction, average rounding, basis-point calculations and checked percentage ratios using BigInt intermediates.
- Safe to Spend with bucket validation and explicit negative balances.
- Equivalent-day comparisons, leap-year/month boundaries and validated custom/full-month period APIs.
- Category totals, shares and changes, including categories with no current-period spend.
- Merchant counts, averages, prior-period totals, changes, share of all spending and correct per-category shares for merchants spanning categories.
- Disjoint incoming-money classification; salary/other income exclude reimbursements, transfers, refunds, gifts and unresolved receipts.
- Pure, immutable allocation impact calculation with ownership, source-fund, archive, duplicate and over-allocation checks.
- Pure fixed-day goal funding projections, rounded-up contribution requirements, overdue/shortfall states and overflow checks.
- Native expandable merchant/category/income details, empty/baseline/unchanged states and mobile layout.

## Files

New source: `src/finance/money.ts`, `periods.ts`, `analytics.ts`, `allocations.ts`, `goals.ts`, and `src/components/pal/SpendingAnalytics.tsx`.

Updated: `src/finance/dashboard.ts`, `src/services/dashboard.ts`, `src/components/pal/PalDashboard.tsx`, and `src/app/globals.css`.

Tests: new `tests/finance-engine.test.ts`; expanded `tests/dashboard-finance.test.ts`, `tests/provider-compatibility.test.ts`, and `tests/browser/dashboard.spec.ts`. `playwright.config.ts` now isolates checks on port 3100 to avoid stale preview reuse.

Documentation: `README.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, new `docs/FINANCE_ENGINE.md` and this report.

## Verification

- 39 unit/contract tests passed, including provider replacement producing identical expanded analytics/income results.
- All six browser checks passed across desktop and phone viewports (four existing checks plus two expanded-analytics checks).
- Expanded merchant averages/trends/shares, incoming-money separation, keyboard disclosure toggling, navigation and no horizontal overflow verified. Screenshots inspected at both widths.
- ESLint, TypeScript, production build and diff whitespace checks passed.
- No dependencies added or changed.

The in-app browser remained unavailable; existing Chrome/Playwright validation was used. Preview was restarted at `http://127.0.0.1:3000/pal` with the new build.

## Results and limits

The fixture still yields $486 Safe to Spend and $742 vs $891 spending. Luckin details show $84.60 across 12 purchases, $7.05 average and +38.2% over $61.20 in the prior equivalent period. Income is $2,400, with $32 reimbursements and the unresolved $48.20 Alex receipt counted separately.

USD, UTC calendar reporting and explicit fixture dates remain the MVP assumptions. Custom-period APIs aggregate supplied data and do not fetch missing history. Goal projections assume fixed-day contributions only; no inferred paycheck/bill behavior. Allocation previews and goal functions do not persist anything or implement approval workflows. Full projection UI remains milestone 6.

Milestone 3 is next: durable repositories, bucket operations, transaction ingestion and persisted Quick Check/merchant rules. Sandbox remains a required later milestone, with APIMatic/current-doc verification before its implementation. See [FINANCE_ENGINE.md](FINANCE_ENGINE.md) for exact calculation definitions.
