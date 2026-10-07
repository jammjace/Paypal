# Architecture

Pal follows **AI interprets. Code calculates. User decides.**

## Dependency direction

- `src/domain`: provider-neutral entities and runtime validation. No vendor imports.
- `src/providers/financial`: server-only external data boundary; demo and future Sandbox adapters implement one interface.
- `src/fixtures`: invented sample records and demo clock-relative dates only.
- `src/server`: environment parsing, dependency composition and validated provider-to-repository sync.
- `src/repositories`: ownership-scoped storage interfaces, durable SQLite implementation and in-memory test adapter.
- `src/finance`: pure integer arithmetic over normalized records; no network, environment or vendor dependencies.
- `src/services`: dashboard reads, validated mutation commands, classification rules and ingestion reconciliation over normalized models.
- `src/components` and `src/app`: rendering and formatting. The page calls server composition, never an adapter.

ESLint prevents imports from provider/fixture modules in domain, finance, services, UI and routes. `server-only` guards adapters, composition and repository implementation. Provider metadata never appears in the dashboard read model.

## Current durable data path

Start my demo creates a fictional owner and seeds product state once. DemoProvider supplies normalized account/transactions through `syncFinancialData`. SQLite persists the validated workspace at `.local/pal.sqlite`; ordinary reads never reseed. Server composition resolves an opaque session cookie to the owner. UI and services never select providers or consume vendor records.

Sync fetches and validates every page before an atomic merge. Reconciliation retains history and user corrections, handles status changes, rejects stale/foreign/duplicate input, applies learned rules to new records and saves the completed coverage window. Failed pagination restarts the bounded window safely. Balance remains an independent snapshot, not a transaction sum.

Server Actions validate commands, revision and idempotency keys. A repository transaction commits business changes, audit events and receipts together. Bucket allocation reuses the pure finance engine. Quick Check saves classification without moving money; period-based budgets recalculate from those categories. Savings alone hold earmarks. See [BUCKETS.md](BUCKETS.md). All resource lookups are owner-scoped. See [PERSISTENCE.md](PERSISTENCE.md) for schema, sessions, reset behavior and deployment limits.

## Finance and display

Money inputs and outputs are safe integer cents. Summation and ratio intermediates use BigInt, with checked conversion to safe numbers. Percentage outputs are integer tenths of one percent. Decimal division is permitted for display/CSS only. Safe to Spend may be negative; it is never silently clamped.

Milestone 2 separates checked money utilities, configurable periods, merchant/category analytics, incoming-money partitions, allocation impact validation and fixed-interval goal funding projections. These functions are pure; proposal approval, writes and full Future You timelines remain later milestones. See [FINANCE_ENGINE.md](FINANCE_ENGINE.md) for formulas, rounding, edge cases and assumptions.

## Later AI write path

User question -> validated structured AI intent -> deterministic calculation -> ProposedAction -> explicit confirmation -> revalidation/atomic mutation -> AllocationEvent. No LLM gets direct repository mutation capability. Simulation state remains separate until approved.

## Current limitations

Local fictional workspaces have anonymous session access control, not real-user authentication. SQLite requires durable local disk. Ask Pal supports optional server-only local Qwen3 4B interpretation through Ollama with an explicit local fallback. All answers are calculated and formatted deterministically. No PayPal calls, automatic recurring allocations or subscription events are implemented. Future You remains a preview. Failure to load a selected source displays a neutral unavailable state without fake substitute balances.

See [the implementation plan](IMPLEMENTATION_PLAN.md) and [PayPal integration boundary](PAYPAL_INTEGRATION.md).
