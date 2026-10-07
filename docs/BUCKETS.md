# Milestone 3 amendment: two bucket purposes

This clarification supersedes the original all-buckets-are-earmarks model.

| | Spending budget | Savings goal |
|---|---|---|
| Purpose | Limit category spending within a period | Hold money for a future use |
| Example | Eating out: $300 per calendar month | Travel: $2,000 total goal, $200 monthly addition plan |
| Display | Spent, remaining allowance or overspent | Saved, amount to target, monthly plan |
| Period behavior | Resets each UTC calendar month or Monday-start week; no rollover | Saved balance carries forward |
| Cash treatment | Limit is a rule, not reserved cash | Saved amount is earmarked cash |

## Spending budgets

The current period is resolved from the account snapshot date. Completed outgoing category spending reduces the allowance. Pending/reversed transactions and transfers/refunds are excluded. This is gross spending: incoming refunds do not replenish the allowance. Classification corrections and status updates recalculate it; reads never mutate balances. Unclassified purchases need Quick Check before they can count toward a specific category. Provisional categories are included.

A positive limit and a supported spending category are required. At most one active budget can track a category, preventing overlapping limits. Weekly and monthly periods are supported; custom periods, carryover and category history snapshots are not. Editing a limit/category recalculates the entire current period, including transactions before bucket creation. Overspending is shown explicitly, not clamped to zero. No purchase blocking is implied.

## Savings goals

Money can be added from Safe to Spend, moved between goals, or withdrawn back to Safe to Spend through a preview and explicit confirmation. A target of zero means open-ended saving. Otherwise, Savings goal reached means the saved amount meets the total target. It does not mean a bill was paid.

Monthly contribution is an editable plan separate from saved cash and the total target. It prefills the addition form; the user confirms each contribution. It does not automatically move funds or promise funds will be available. Automatic scheduled contributions remain future work. Transaction categorization does not automatically release savings when a purchase occurs; release the relevant earmark explicitly.

## Accounting

Safe to Spend = current account balance ? saved amounts in active savings goals. Spending-budget limits are not subtracted, nor are historical purchases subtracted again from a provider balance that already reflects them. A remaining category allowance is not a guarantee of available cash; the UI advises checking Safe to Spend.

The revised sample is $2,430 balance ? $1,880 saved = $550 Safe to Spend. Coffee has a $100 monthly limit, $84.60 spent and $15.40 left. Travel holds $420 toward $1,000 with a $200 monthly contribution plan.

## Existing data and migration

Workspace v2 uses GOAL and SPENDING. Existing BILL/FLEXIBLE records become GOAL, retaining their saved amounts, names and history. Existing SPENDING earmarks are released and recorded in allocation/audit history; targets become limits. No transactions or user corrections are deleted. Migration is deterministic/idempotent on read and persists with the next changed transaction. Repeated reads cannot repeatedly release cash. Existing type changes are rejected: archive and create the other type explicitly. Historical audit/receipt records remain readable.
