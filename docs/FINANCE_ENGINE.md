# Finance engine — Milestone 2

All functions consume normalized internal records, with no provider, database, network, environment, AI or system-clock dependency. Provider interfaces/adapters are unchanged.

## Modules

| File in `src/finance` | Responsibility |
| --- | --- |
| `money.ts` | Checked sums/differences, averages, basis-point multiplication, ratios |
| `periods.ts` | Validated custom UTC ranges and calendar-month periods |
| `analytics.ts` | Gross spending, merchant/category analytics, incoming-money partitions |
| `allocations.ts` | Safe to Spend, allocation invariants and pure impact previews |
| `goals.ts` | Fixed-day goal contributions, requirements, funding dates and shortfalls |
| `dashboard.ts` | Snapshot cutoff and compatible exports for existing callers |

The service reads the repository and produces financial read models. UI components format them; native disclosures expose merchant and income detail without financial state changes.

## Money and rounding

Money inputs/outputs are safe integer cents. Fractional, non-finite and unsafe values fail. Sum/multiplication intermediates use BigInt with checked conversion to number. Averages and rate applications round to nearest, with exact halves away from zero; an average of 100 and 101 cents is 101 cents. Empty averages return null.

`applyBasisPoints(101, 5000)` applies 50% and returns 51 cents. Rates are signed integer basis points. Percentages return integer tenths of one percent: 382 means 38.2%. A zero denominator returns null, never Infinity or fabricated growth. Minimum goal contributions round up. Decimal division is used only for formatting/CSS and date interval counts, not authoritative money.

## Periods and coverage

Ranges are UTC `[from, to)`. MONTH_TO_DATE includes the snapshot's calendar day. PREVIOUS_MONTH_EQUIVALENT_DAYS clips the same day number to the previous month's end. PREVIOUS_MONTH and CUSTOM endpoints are also supported. January transitions, leap years, exclusive bounds and malformed/inverted ranges are tested. Dashboard consumers exclude all transactions later than `asOf`, including later that day.

These are reusable engine APIs, not new date-picker UI. The engine aggregates supplied records only. Callers must obtain complete data for the requested periods; current ingestion covers the prior month through the snapshot, not all history. Later sync work must expose coverage and stale-data state.

## Spending and merchant/category analytics

Gross spend includes completed outgoing records excluding transfers and refunds by normalized type or category. Pending/reversed records and incoming money do not contribute. Incoming refunds are reported separately rather than netted against gross spending.

Unreviewed purchases remain included in spending and their current categories. Category comparisons can change when transactions are reclassified; the dashboard states this. Changes include prior-only categories. Rankings use descending totals/absolute changes, then stable labels.

Merchant grouping uses `normalizedMerchant`, folding case and whitespace only. Raw descriptor/alias normalization stays at the provider/classification boundary; no fuzzy merges or location stripping occur in finance. Label selection is independent of row/page order.

Merchant details include total/count/rounded average, previous equivalent-period total, cents/percentage change, total-spending share and per-category shares. For a merchant spanning categories, each category numerator includes only its spending in that category. Prior-only merchants remain queryable; absent merchants have zero spend and null average/baseline. Analytics reject invalid normalized records, unsupported currencies, mixed owners and duplicate internal or account/source IDs.

## Incoming money

Completed receipts are partitioned into salary, other income, reimbursements, transfers, refunds, gifts, explicitly classified other receipts and unresolved receipts. Income = salary + other income; each receipt contributes once to total received.

Transfer/refund semantics take priority over an erroneous Income category. Other receipts needing review remain unresolved. Income requires an explicit Income category; SALARY type identifies its salary subset. An explicit Other category is separate from both income and unresolved money. Ambiguous incoming transfers are never assumed to be income.

## Allocation previews

`previewAllocation(balance, buckets, changes, userId)` returns copied bucket state, before/after totals and per-bucket impacts. It has no repository access and never mutates inputs.

It validates ownership, unique IDs/changes, active destinations, safe integer deltas, nonnegative amounts and sufficient source earmarks. Archived buckets must hold zero earmarks. Targets are goals, not caps: overfunding is allowed when the balance supports it.

Net-new earmarks must fit in unearmarked balance. Existing negative Safe to Spend is displayed honestly; reducing or preserving a shortfall is allowed, worsening it is rejected. This is bookkeeping validation, not permission to purchase. Changes are evaluated together, independently of order. Persistence, proposals, approval and audit writes remain milestones 3/5.

## Goal projection assumptions

`projectGoal` takes allocation, target/date, snapshot date, fixed contribution amount and a positive day interval. Contributions start one interval after the snapshot's UTC day, include the due day and continue through the deadline. No income, investment return or affordability assumption is inferred.

Outputs: remaining cents, contribution opportunities, required contribution (rounded up), projected amount, shortfall, funding date and FUNDED/ON_TRACK/SHORTFALL/OVERDUE. No remaining opportunities gives a null required contribution for unmet goals. Zero planned contributions gives no funding date. A date beyond the deadline remains visible and does not imply the goal is on track. Funded goals need no further contributions. Overflow fails explicitly.

Calendar-month recurring bills/paychecks, account projections and Future You/what-if UI remain milestone 6.

## Reproducible demo results

- Balance $2,430; earmarked $1,944; Safe to Spend $486.
- Oct 1–15 spend $742 vs Sep 1–15 $891: −$149 / −16.7%.
- Luckin: $84.60, 12 purchases, $7.05 average; prior $61.20; +38.2%; 100% of this seed's Coffee category and 11.4% of total spend.
- Income $2,400; reimbursements $32; transfers $200; refunds $18; unresolved Alex $48.20. Total received $2,698.20.

All amounts are calculated from records, not hardcoded from the illustrative product specification.
