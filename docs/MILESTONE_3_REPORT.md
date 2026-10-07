# Milestone 3 report

The original Milestone 3 delivery is recorded below. Its bucket semantics were subsequently amended to distinguish spending budgets and savings goals; see [BUCKETS.md](BUCKETS.md) and [MILESTONE_4_REPORT.md](MILESTONE_4_REPORT.md). The original test counts and limitations below describe that earlier delivery.

## Delivered behavior

- Persistent SQLite workspaces survive page reloads and repository/process recreation.
- Start my demo issues an isolated anonymous session; all reads and writes use server-resolved ownership.
- Create, edit and archive buckets. Preview and confirm earmark changes using the existing finance engine; archive releases earmarks and retains audit history.
- Quick Check saves classifications and optional exact merchant rules. Transaction details allow corrections; income analytics update from saved data.
- Sync reconciles normalized transactions without losing corrections or omitted history. Replay, reversal/status updates and failed pagination are tested.
- Transaction and activity routes, per-workspace reset, revision conflicts, idempotency receipts and atomic audit events.

## Files created

- `src/domain/workspace.ts`: persisted schema and product entity collections.
- `src/repositories/MutablePalRepository.ts`, `SqlitePalRepository.ts`: atomic mutation contract and durable adapter.
- `src/server/database.ts`, `sessions.ts`, `context.ts`, `demo.ts`, `actions.ts`: storage, hashed sessions, composition, seed/reset/sync and validated Server Actions.
- `src/services/classification.ts`, `commands.ts`, `ingestion.ts`: deterministic classification, mutations and provider-neutral reconciliation.
- `src/lib/money-input.ts`: exact decimal-to-cent parsing.
- `src/components/pal/ActivityFeed.tsx`, `BucketForms.tsx`, `TransactionControls.tsx`, `WorkspaceShell.tsx`, `useMutation.ts`: working forms and durable UI flows.
- `src/app/pal/buckets/new/page.tsx`, `src/app/pal/buckets/[id]/page.tsx`, `src/app/pal/transactions/page.tsx`, `src/app/pal/activity/page.tsx`: scoped product routes.
- `tests/persistence.test.ts`, `tests/browser/persistence.spec.ts`: database/service and desktop/mobile coverage.
- `docs/PERSISTENCE.md` and this report.

Existing dashboard, Quick Check, repository contract, composition/config, styling, browser configuration, README, environment example and architecture/integration plans were updated.

## Architecture and assumptions

Provider contracts and normalized account/transaction models are unchanged. FinancialProvider feeds normalized data into an atomic repository merge; finance, bucket commands, analytics and UI contain no PayPal-specific logic. SQLite stores a validated versioned workspace document per owner. SQL remains in the adapter; mutation/ingestion logic remains in services.

This is Node 24 local storage at `.local/pal.sqlite`, not Supabase or production authentication. Anonymous cookie sessions protect separate fictional workspaces. Real identity/account authorization and durable deployment storage remain prerequisites for real-account use. USD, integer cents and explicit UTC snapshot dates remain the existing finance policy.

Completed sync windows are persisted; failed pagination restarts the window rather than resuming partial pages. Learned rules apply to newly ingested exact merchant/direction/type matches. Recurrence and future action/conversation records are storage groundwork only. Categorization does not move earmarked money.

## Validation

- 53 unit/contract/persistence tests passed, including provider interchangeability, actual SQLite reopen, rollback, replay, stale concurrent commands, ownership, pagination failure and lifecycle reconciliation.
- 12 desktop/mobile browser tests passed against the production build, including Quick Check reload/sync/reset, bucket create/edit/allocation/archive and cross-browser isolation.
- ESLint, TypeScript and production build passed.
- Dashboard and mobile bucket-editor screenshots inspected; no horizontal overflow in tested layouts.

Node 24 prints its experimental built-in SQLite warning. No additional dependency was required. Browser validation used installed Chrome/Playwright because the in-app browser runtime was unavailable.

## Remaining milestones

Milestone 4 implements structured Ask Pal/AI interpretation. ProposedAction approval workflows and Future You follow separately. Real PayPal Sandbox flow remains required in milestone 7: consult APIMatic PayPal context plus current official documentation, verify supported scopes/balance/reporting/event semantics, implement normalizers and credential lifecycle, bind real authenticated ownership and demonstrate real Sandbox data through the same repository/services. No PayPal endpoint was guessed or called in this milestone.
