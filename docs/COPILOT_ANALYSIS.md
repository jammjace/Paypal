# Spending analysis copilot

Pal treats advisory questions as read-only analysis. It does not interpret a price mentioned in a question as permission to move money. A separate explicit instruction can start the existing proposal flow; applying it still requires approval.

## Architecture

`askPalAction` → local Ollama structured planner → validated `AnalysisPlan` → pure `runAnalysis` operations → calculated answer and clarification choices.

The planner can compose spending summaries, merchant rankings, equivalent-day comparisons, purchase counts and averages, observed rates, dollar/percentage reductions, alternative pricing, current cash affordability, bucket status, income and saved goal projections. Merchant and category selections come from the owner's normalized records. There are no merchant-specific analysis implementations and no provider API concepts in the planner or engine.

Qwen3 4B interprets the request and follow-up context; it does not perform authoritative arithmetic. Code computes monetary results using integer cents. Model output is schema-validated, entity names are checked against the workspace, and proposed numeric inputs must appear in the user's messages. Clarification wording can come from the planner; calculated financial conclusions come from code.

Analysis has no financial mutation capability. Owner-scoped threads preserve questions, answers and plans across refreshes, expire after 15 minutes, and allow eight turns. Follow-ups recalculate against the current snapshot. Request IDs deduplicate retries, and a financial change during inference invalidates the answer rather than persisting a stale calculation. A fresh explicit action goes through separate grounded action extraction and approval.

## Evidence and missing information

Rate estimates use complete UTC days with verified sync coverage. They show the observation interval, snapshot and assumptions. Missing transactions do not imply zero spending. Comparisons describe recorded changes, not unobserved personal causes.

Alternative pricing supports unlimited coverage, quotas with overage prices, and percentage discounts. Pal asks for eligibility and terms; transaction names do not establish subscription coverage. Receipts are not assumed to represent individual items. Affordability is a current unreserved-cash check, not a guarantee that a recurring expense is sustainable. Savings projections use the stored event and contribution plans.

## Boundaries

This is an extensible set of composable analysis operations, not a guarantee of answering every possible financial question. Current analysis periods are this month and last month; comparisons use equivalent calendar days. External prices, subscription terms, item-level receipts, missing history and personal priorities must be supplied or clarified. Unsupported calculations need another tested operation before Pal can answer them reliably. No model retraining is required to add an operation.

Local Ollama is required for broad natural-language interpretation. The explicitly labeled offline fallback supports a smaller grammar. No paid API, hosted model fallback or payment account is used. Deployment still needs an accessible local inference runtime on the application host; publishing the web app alone does not deploy Ollama.

## Verification

`tests/analysis.test.ts` covers advisory/action separation, composed calculations, alternative pricing, missing evidence, grounded inputs, read-only persistence, retries, ownership and expiry. Browser tests cover clarification after refresh, savings what-ifs, affordability and switching from an answer to a separately approved action. Opt-in live Ollama tests exercise several question families, not only the reported subscription example.
