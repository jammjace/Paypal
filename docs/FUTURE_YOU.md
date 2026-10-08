# Future You and clarified copilot requests

Milestone 6 adds `/pal/future`, conditional calendar-month projections, planned events, editable what-if previews, and the two requested Ask Pal flows. The finance engine remains provider-independent, uses integer cents, and receives normalized stored records. Qwen3 4B runs through local Ollama only. No payment or cloud account is needed.

## Transport-pass analysis

Ask: **At the rate I am spending money on public transportation, is it better for me to get a monthly concession pass of 90 dollars instead?**

Pal interprets a full-month pass price, asks which stored Transport merchants represent covered journeys, then asks whether the pass covers all selected journeys without extra fares and whether usage is expected to stay similar. A merchant can be selected with a button; multiple exact names can be entered separated by commas. Cancellation never creates a purchase or plan.

The calculation uses this month's completed UTC days, excluding today's partial day. It requires stored sync coverage from the month's start through those completed days, and at least one relevant purchase. Missing coverage is not treated as zero spending. It sums completed, non-transfer/non-refund Transport spending at the confirmed merchants, scales it by calendar days in the month divided by observed days, and compares the rounded integer-cent projection with the stated pass price. It reports the observed period, total/count, projected monthly cost, difference and assumptions. This is a conditional full-month cost comparison, not advice to buy a pass for the remaining days of the current month. Other merchants and partial-day spending are excluded; provisional categories remain subject to review.

The default fixture contains Uber under Transport, not a verified public-transit history. Pal never silently considers Uber pass-eligible. A meaningful real-world comparison needs actual covered transactions and user confirmation. The prototype supports USD only and does not verify operator eligibility, fares or pass rules externally.

## Budget clarification and combined approvals

Ask: **I will put more money into Coffee than Christmas gifts. Help me add $60 to Coffee.**

Coffee is a spending limit; Christmas is a savings balance. Pal asks whether to increase Coffee's allowance only or also withdraw the same amount from Christmas. A mention of a savings goal is not withdrawal authorization. The user can choose a button or a supported reply such as **both** when one source was identified. An ambiguous **yes** does not choose between the options. Unknown/ambiguous names, multiple amounts, absolute replacement limits and recurring instructions are not silently treated as one-time increases.

The resulting preview shows the old/new Coffee limit and remaining allowance, any donor savings change, and old/new Safe to Spend. In a fresh fixture, a $60 combined change means Coffee $100 -> $160, allowance $15.40 -> $75.40, Christmas $260 -> $200 and Safe to Spend $550 -> $610. No money is reserved in Coffee. Actual later purchases reduce the provider balance when synced.

The allowance increase applies **only to the current UTC weekly/monthly budget period**. A bounded override preserves the usual limit and automatically stops applying in the next period. Changing the usual limit, category or period in the bucket editor replaces the temporary override. The displayed allowance and Ask Pal bucket answer both use the effective current-period limit.

## Projection assumptions

- Horizon: the rest of the snapshot month plus the next 12 calendar months. The snapshot clock, not today's host date, anchors financial projections.
- Only explicitly saved planned events affect projected account balance. Everyday spending, budget limits, interest and unplanned income are not inferred as scheduled cash flows.
- Events can be one-time or monthly income/expenses. Monthly occurrences keep their original day, clamped in short months without permanent day drift. Old events are not replayed into today's balance. At most 50 events are supported.
- Savings plans are hypothetically contributed at 23:59:59 UTC on the first day of each next month. Higher-priority goals go first; equal priorities use stable IDs. Contributions are limited by available Safe to Spend and, when present, the remaining target. Unfunded contributions and projected negative Safe to Spend are displayed.
- Savings contributions move projected money from Safe to Spend into goals without changing projected account balance. Applying a contribution plan does not execute contributions now or later automatically.
- Goal projections show estimated target dates where reached within the horizon. Without enough planned resources, Pal reports that a goal is not reached; it never assumes a salary to make the projection work. Already reached targets are observed at the snapshot, not assigned a historical funding date.
- Inputs whose cumulative projection exceeds safe integer money bounds are rejected before saving a preview.

## What-if lifecycle

Preview contribution plans, planned income/expenses, event removals or temporary budget changes. **Modify** replaces the old draft with a fresh preview; **Discard** makes no plan or financial change. **Approve and apply** saves precisely the displayed plan/budget/withdrawal changes. It does not write projected future balances into today's account or send a payment.

Scenarios are owner-scoped, deduplicated by UUID request ID, and expire after 15 minutes of real server time or a relevant state change. Fingerprints include normalized transactions, coverage, account/bucket state and recurring plans. Approval recalculates impacts inside the same transaction as status, allocation and audit writes. Retries apply once; stale or foreign requests cannot mutate the workspace. Replacing a draft also runs in that transaction, so an invalid replacement leaves the original intact.

Clarification records are likewise owner-scoped, persistent across refreshes, and limited by expiry/fingerprint checks. They are a small structured follow-up state, not unrestricted chat memory. Follow-up answers create a preview or calculation, never immediate money changes. The dashboard resumes the latest valid pending clarification. Cancel clears it. Reset clears scenarios, clarifications and planned events in that session along with other demo changes.

## Model and fallback behavior

The specialized model schema accepts only monthly pass analysis, budget increase or unsupported intent, with copied amounts and grounded bucket names. Models never calculate impacts or choose approval. Local rules support the original prompts if Ollama is unavailable; the response labels that fallback. Separate UI states identify clarification, unsupported requests and model failure; timeout notices identify the 45-second limit. Subsequent deterministic clarification/calculation replies are labeled **Pal calculation**, not falsely attributed to another AI call.

Future You forms work without Ollama. Arbitrary financial advice, natural-language planning beyond the documented intents, automatic transaction classification as public transit, automatic recurring payments and operator/pass verification are outside this milestone.
