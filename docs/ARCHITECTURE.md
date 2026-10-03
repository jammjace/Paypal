# Architecture

Pal follows **AI interprets. Code calculates. User decides.**

## Dependency direction

- `src/domain`: provider-neutral entities and runtime validation. No vendor imports.
- `src/providers/financial`: server-only external data boundary; demo and future Sandbox adapters implement one interface.
- `src/fixtures`: invented sample records and demo clock-relative dates only.
- `src/server`: environment parsing, dependency composition and validated provider-to-repository sync.
- `src/repositories`: ownership-scoped storage interfaces and a replaceable in-memory implementation.
- `src/finance`: pure integer arithmetic over normalized records; no network, environment or vendor dependencies.
- `src/services`: dashboard read model from the repository and finance functions.
- `src/components` and `src/app`: rendering and formatting. The page calls server composition, never an adapter.

ESLint prevents imports from provider/fixture modules in domain, finance, services, UI and routes. `server-only` guards adapters, composition and repository implementation. Provider metadata never appears in the dashboard read model.

## Current read-only data path

Each read-only render creates demo fixtures in the server composition root, injects them into DemoProvider, and syncs normalized results to a fresh in-memory repository. The repository begins with zero balance/no transactions so financial values must pass through the provider. Pal buckets and allocation events are independently seeded product state, not provider data.

Sync validates the owner, account, currency, integer money, timestamps, pagination and duplicate source IDs before a single atomic write. Balance is a snapshot, not the sum of a partial transaction window. Sync currently loads the previous month through the snapshot time. The dashboard compares calendar days, clipped to the prior month's length, using UTC. Records beyond `asOf` are not ingested.

The repository contract deliberately hides the storage backend. In milestone 3, a durable implementation will own transactions, unique constraints, checkpoints and preservation of user classifications. All requested models beyond Account, Transaction, User, Bucket and AllocationEvent arrive with their corresponding milestones; no unused mutation APIs are exposed now.

## Finance and display

Money inputs and outputs are safe integer cents. Summation and ratio intermediates use BigInt, with checked conversion to safe numbers. Percentage outputs are integer tenths of one percent. Decimal division is permitted for display/CSS only. Safe to Spend may be negative; it is never silently clamped.

Milestone 2 separates checked money utilities, configurable periods, merchant/category analytics, incoming-money partitions, allocation impact validation and fixed-interval goal funding projections. These functions are pure; proposal approval, writes and full Future You timelines remain later milestones. See [FINANCE_ENGINE.md](FINANCE_ENGINE.md) for formulas, rounding, edge cases and assumptions.

## Later write path

User question -> validated structured AI intent -> deterministic calculation -> ProposedAction -> explicit confirmation -> revalidation/atomic mutation -> AllocationEvent. No LLM gets direct repository mutation capability. Simulation state remains separate until approved.

## Current limitations

Single fictional owner; no real authentication, database, mutations, AI calls, PayPal calls or subscription events. Feature previews are disabled and labeled. Failure to load a selected source displays a neutral unavailable state without fake substitute balances.

See [the implementation plan](IMPLEMENTATION_PLAN.md) and [PayPal integration boundary](PAYPAL_INTEGRATION.md).
