# Milestone 6 report

Completed Future You and the two requested copilot additions for the local prototype. Validation date: 2026-10-08.

## Delivered behavior

- `/pal/future` shows conditional calendar projections, goal funding dates/shortfalls and user-planned one-time/monthly income or expenses.
- What-if previews support contribution-plan changes, planned-event creation/removal and temporary budget increases. Modify replaces a draft; Discard leaves money and plans unchanged; Apply explicitly saves the displayed changes.
- The $90 monthly transport-pass question asks which journeys are represented by stored merchants and confirms coverage assumptions before computing a full-month cost comparison. It reports missing coverage instead of inventing data.
- The Coffee/Christmas question clarifies limit-only versus combined savings withdrawal. It shows all impacts before approval. The temporary Coffee increase expires at the budget-period boundary, while released savings remain available until used or allocated again.
- Clarifications persist across refreshes, support scoped follow-up replies, and expire when stale. Starting a new question cancels the pending follow-up. Choice labels, not internal IDs, appear in the input.
- Unsupported questions, clarifications and local-model failures are distinguished. Both original prompts work with the free Qwen3 4B model and have explicit deterministic fallback handling.
- Existing bucket detail routes link to Future You and show goal projections; activity records approved changes. No projected future balance is written into the real snapshot.

## Main implementation files

| Area | Files |
| --- | --- |
| Typed records | `src/domain/future.ts`, additive fields in `src/domain/workspace.ts` and `src/domain/models.ts` |
| Pure calculations | `src/finance/future.ts`, `src/finance/pass-analysis.ts`, effective-limit handling in `src/finance/buckets.ts` |
| Lifecycle and clarification | `src/services/future.ts`, `src/services/copilot.ts` |
| Local AI and validated endpoints | `src/server/ai/copilot.ts`, `src/server/ai/pal.ts`, `src/server/actions.ts` |
| UI | `src/app/pal/future/page.tsx`, `src/components/pal/FutureYou.tsx`, Ask Pal, bucket display/detail and navigation updates |
| Verification | `tests/future.test.ts`, `tests/browser/future.spec.ts`, expanded unit/browser local-AI acceptance suites |
| Documentation | `FUTURE_YOU.md`, this report, implementation plan, README, AI design, architecture, persistence and bucket docs |

## Architecture and assumptions

See [FUTURE_YOU.md](FUTURE_YOU.md) for formulas and full boundaries. Financial records remain normalized and provider-agnostic. All authoritative arithmetic uses checked integer cents; unsafe cumulative projections are rejected before preview creation. Model outputs contain grounded intent/amount/name fields, never authoritative balances or executable mutations.

Saved plans include only explicitly entered events. Everyday spending, salary, interest and pass eligibility are not inferred. Monthly savings additions are conditional simulations constrained by available funds; no background transfer job is created. The pass comparison assumes a full month of unchanged usage and confirmed journey coverage. USD remains the only supported currency.

Scenario status, combined withdrawal, budget override and audit share a transaction. Request IDs prevent duplicate application; 15-minute real-time expiry and state fingerprints prevent stale approval. Owner-scoped v2 fields default empty for existing workspaces, so no reseed or destructive migration is required. Demo reset clears new records in that session.

## Validation

- 147 ordinary unit/contract/persistence tests passed; 28 cover MS6. Eleven opt-in live-model cases are skipped by the ordinary suite.
- 32 desktop/mobile Chrome checks passed, including eight MS6 checks for both original prompts, refresh persistence, combined approval, Modify/Discard and saved recurring plans. The mobile budget-preview screenshot was inspected; automated overflow checks passed.
- All 11 opt-in checks passed against actual local Qwen3 4B, including both original prompts. No fallback was accepted as a model success. Ollama was initially stopped; the installed local runtime was started before the successful run.
- Three production-browser checks also passed with real Ollama inference: existing budget/savings queries, the Coffee clarification followed by approval, and the transport-pass question followed by scope confirmation and calculation. They took approximately 80 seconds together on this local machine.
- Lint, TypeScript via production build, production compilation and diff whitespace checks passed.

## Try it

1. Start the installed model with `npm run ai:start`, then Pal with `npm run dev`.
2. Ask the original Coffee/Christmas question. Choose the intended interpretation, review the limits/savings/Safe to Spend, then approve or discard.
3. Ask the original transport-pass question. Select only genuinely covered merchants and confirm the assumptions. The sample's Uber is not automatically public transport; cancel if the sample does not represent eligible journeys.
4. Open Future You to preview a changed monthly contribution or planned income/expense. Modify or discard it, or explicitly apply the plan. Today's account balance stays unchanged.

## Remaining milestones

MS7 is the required real PayPal Sandbox data/event flow. Consult APIMatic PayPal Context Plugin/artifacts and current official PayPal docs before vendor implementation. MS8 covers submission readiness and further polish. Public model hosting remains deferred. No paid API, cloud inference fallback, real payment or real PayPal call was introduced in MS6.
