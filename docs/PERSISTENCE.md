# Milestone 3 persistence and ingestion

## Storage

The default repository uses SQLite at `.local/pal.sqlite`, opened with Node 24's built-in `DatabaseSync`. WAL mode and a 5-second lock timeout support serialized local writes. Connections close after each operation; reads survive process restarts. Database files and sidecars are ignored by Git. The path can be configured with `PAL_DB_PATH`.

This is a local document-oriented SQLite adapter, not a Supabase schema: `workspaces` stores one validated, schema-versioned JSON document and revision per owner; `sessions` stores hashed opaque tokens, owner references and expiry. Domain records are normalized provider-independent models inside that document. The small prototype trades query efficiency for simple atomic commits.

Schema version 2 covers User, Account, Bucket, Transaction, TransactionAllocation, AllocationRule, AllocationEvent, ProposedAction, MerchantRule and Conversation. Separate PalEvent records capture categorization and bucket lifecycle events. AllocationRule, TransactionAllocation, ProposedAction and Conversation collections are typed storage groundwork; no automatic scheduling, transaction-to-bucket cash deductions or AI action execution is enabled yet.

`PalRepository` provides reads and sync commits. `MutablePalRepository.transact` supplies the atomic mutation boundary. SQL and serialization stay in `SqlitePalRepository`; command logic and ingestion merges live in provider-independent services. A future Supabase adapter can use JSONB compare-and-swap or normalized tables with transactional RPC and RLS. It must provide the same ownership, revision, atomic audit and idempotency guarantees. Remote transactions should fail/retry safely on revision conflicts, never blindly overwrite newer data.

See [BUCKETS.md](BUCKETS.md) for the revised two-type model and non-destructive v1 migration.

## Local session identity

**Start my demo** creates an isolated fictional workspace. A cryptographically random 256-bit token is stored in an HttpOnly, SameSite=Lax cookie; only its SHA-256 hash is persisted. Sessions expire after 30 days. Secure cookies are configurable for HTTPS; local HTTP uses `PAL_COOKIE_SECURE=false`.

All reads/mutations resolve the owner from this server-side session, never from form inputs. Resource IDs are looked up only inside that owner's workspace. Unknown/foreign bucket paths display not-found; mutation payloads reject client-supplied identity. Next Server Actions supply same-origin/CSRF checks. SQL uses bound parameters.

This is anonymous local demo access control, not real-user authentication. Browser cookie possession grants access to that browser's sample data. Clearing/expiring cookies creates a new workspace; recovery, real login, public-service abuse protection and Supabase Auth remain prerequisites for real-account use. No real PayPal data or credentials are connected. Do not interpret this milestone as production authentication.

## Mutations and audit

Commands are Zod-validated on the server. Each carries the expected workspace revision and a UUID idempotency key. SQLite uses `BEGIN IMMEDIATE`; command execution, validation, audit events, receipt and revision increment commit together. Errors roll back all changes. A repeated key with the same normalized command returns the saved result; reuse for a different command fails. Competing stale forms fail with a refresh/review message.

Create/edit supports either a spending budget (category, positive limit, calendar week/month) or a savings goal (saved balance, optional total target/date, monthly contribution plan). A category has at most one active budget. Type changes require archiving and creating a new bucket, preserving historical meaning. Savings additions/withdrawals use deterministic previews and explicit confirmation. Monthly plans do not run automatically. Archive releases saved cash and retains audit history; budgets have no reserved cash to release.

Quick Check saves category/confidence/source and an event atomically. Existing transactions can be corrected on `/pal/transactions`; current budget totals immediately reflect the correction. An explicit Remember checkbox creates/updates an exact normalized-merchant + direction + transaction-type rule for new matching records. User corrections take precedence. AI classification may be enabled for new unresolved records; peer-payment purpose still needs user input. See [AI_DESIGN.md](AI_DESIGN.md).

Budget spending derives from completed category transactions in the current UTC period; no transaction-to-bucket cash deduction is performed. Savings remain virtual reserves and must be released explicitly when used. A spending limit is not subtracted from the account balance a second time.

## Sync and lifecycle

`syncFinancialData` fetches all pages before committing. Failed/invalid pages leave the previous balance, transactions and coverage checkpoint untouched. `mergeFinancialSnapshot` reconciles by source transaction ID within the bound account/connection, keeps stable internal IDs, retains omitted history, updates financial fields/status, and preserves saved categories. New records use learned rules. Older snapshots and duplicate/cross-account input are rejected. Replaying identical data produces no duplicate records, allocation events or revision change.

The latest successfully committed UTC sync window is stored with the snapshot. There is no half-finished cursor checkpoint: a failed page sequence restarts the bounded window and reconciles idempotently. Older retained history does not imply complete coverage outside the last requested window. Source IDs must be stable within an account; future adapters must honor this contract and supply current status/reversal information.

`Sync transactions` currently replays the controlled DemoProvider dataset. Novel records, reversals and learned-rule classification are covered by integration tests; no fake external transaction is claimed. The workspace's demo clock is saved at creation so an environment clock change cannot silently remap existing source IDs to another month.

## Seed, reset and limitations

`npm run dev` plus Start my demo seeds one workspace using the existing deterministic fixture path. Normal reads never reseed. Demo controls → Confirm reset replaces only the current workspace with the baseline and keeps its revision monotonic. Reset intentionally clears its changes, learned rules, receipts and audit history; other owners and session tokens remain intact. Changing DEMO_AS_OF affects new/reset demos, not existing data.

SQLite files need durable local disk; this adapter is unsuitable for ephemeral/serverless multi-host storage. No Supabase configuration, password authentication, autonomous rules, recurring allocations or real PayPal calls are included. Sandbox integration remains required later and must consult APIMatic/current official docs before implementation.

Implementation references: [Node SQLite API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [Next cookies](https://nextjs.org/docs/app/api-reference/functions/cookies), and [Next data security](https://nextjs.org/docs/15/app/guides/data-security).
