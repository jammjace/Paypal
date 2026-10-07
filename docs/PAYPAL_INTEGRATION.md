# PayPal Sandbox integration

## Status

**Required milestone 7; not implemented through milestone 3.** No PayPal API, SDK, authentication, or webhook calls are made. No APIMatic PayPal tools were exposed in this session. The adapter and normalizer intentionally throw `NOT_CONFIGURED`.

Real Sandbox integration is a submission requirement, not optional work. Until it exists, Pal is a local demo prototype and does not satisfy the complete hackathon demo definition of done.

## Provider boundary

```text
PayPal response -> PayPalSandboxProvider -> validated internal Account/Transaction
                                           |
                                   syncFinancialData
                                           |
                         repository (durable SQLite; normalized records)
                                           |
                             Pal services -> finance engine -> UI
```

`src/providers/financial/FinancialProvider.ts` exposes only:

- `getBalance(): Promise<BalanceSnapshot>`: normalized account balance and snapshot timestamp.
- `getTransactions(query): Promise<TransactionPage>`: normalized records with an opaque continuation cursor.

Instances are server-side and bound to an authenticated owner/account. External account/transaction IDs are opaque provenance, not product decisions. No SDK models, secrets, authorization headers, webhook bodies, or payment-event codes cross the boundary. Core services only read the repository.

`DemoProvider` implements exactly this contract. `src/server/context.ts` and `src/server/demo.ts` compose storage, sessions and the demo adapter. `syncFinancialData` handles date windows, pagination, ownership, validation, duplicates and atomic snapshot reconciliation. Adapter selection changes composition, not finance, bucket, analytics or UI code.

The durable repository persists normalized accounts/transactions, stable source mappings, user classifications, merchant rules and completed sync windows. Atomic reconciliation retains omitted history and handles replay/status changes; failed pagination restarts the window without committing partial data. See [PERSISTENCE.md](PERSISTENCE.md). Real-account authentication, verified external account binding, operational retries and vendor-specific lifecycle mapping remain required before activation. Anonymous demo sessions are not PayPal authorization.

## Expected normalized models

Authoritative TypeScript types and Zod schemas: `src/domain/models.ts`.

| Model | Required semantics |
| --- | --- |
| Account | Internal ID and owner, opaque provider/source account IDs, currency, signed integer-cent balance, last sync timestamp |
| BalanceSnapshot | Account plus `asOf` UTC timestamp; balance must come from a verified source, not an incomplete history sum |
| Transaction | Internal ID and owner/account, opaque source ID, raw descriptor, normalized merchant, nonnegative integer cents plus IN/OUT direction, currency, UTC timestamp, normalized type/status, category/confidence/source/review flag |
| TransactionQuery | UTC `[from, to)` interval, optional page size and opaque cursor |
| TransactionPage | Normalized transactions and `nextCursor`, null when complete |

Supported types: PURCHASE, SALARY, PEER_PAYMENT, INTERNAL_TRANSFER, REFUND, FEE, OTHER. Statuses: PENDING, COMPLETED, REVERSED. Do not infer that an incoming payment is salary; unclassified data starts as Uncategorized with a review flag. Category inference is a separate Pal service; vendor normalization is not an LLM calculation.

USD is the only supported currency currently. Decimal source strings must be parsed directly to cents with validated precision using integer/string arithmetic. No `parseFloat(value) * 100` for authoritative money. Reject unsupported currencies/precision until explicit currency policy exists. Never aggregate unlike currencies.

## Where APIMatic context is required

Before implementing or modifying PayPal-specific behavior:

1. Check for the APIMatic PayPal Context Plugin in the development environment. If unavailable, obtain APIMatic-provided SDK/context artifacts.
2. Consult that authoritative context **and current official PayPal documentation**. Record the consulted artifacts, versions, links and dates here.
3. Verify endpoint paths, SDK methods, auth parameters, request/response models, scopes, pagination, errors and Sandbox support. Do not fill in gaps from memory.
4. Implement requests only in `PayPalSandboxProvider.ts` and integration helpers. Implement response mapping in `normalizers/paypalTransactionNormalizer.ts` and an account normalizer once its source schema is verified.
5. Add captured, sanitized contract fixtures and mapping/error tests. Reuse the provider compatibility suite to ensure downstream behavior stays unchanged.

If authoritative context remains unavailable, retain the documented boundary and report milestone 7 as blocked. Never invent a plausible endpoint or pretend demo data came from Sandbox.

## Environment placeholders

Copy `.env.example` to untracked `.env.local`:

```dotenv
FINANCIAL_PROVIDER=demo
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENV=sandbox
PAYPAL_WEBHOOK_ID=
```

`PAYPAL_WEBHOOK_ID` is needed only if a webhook flow is implemented. All configuration is server-only and has no `NEXT_PUBLIC_` prefix. Live mode is rejected. Selecting `FINANCIAL_PROVIDER=paypal-sandbox` currently returns an unavailable dashboard; it never substitutes sample balances.

## Pending capability verification

- Provisioning a controlled Sandbox application and account with appropriate credentials/scopes.
- Whether balance and transaction reporting are supported for that account/app and what delays/permissions apply. No arbitrary consumer-account access is assumed.
- Exact balance semantics (available vs held, currency-specific values) and transaction semantics (gross/net/fees, refunds, reversals, unsettled items).
- Source timestamps, stable identifiers, pagination ordering, date limits, rate limits, retry/backoff, error mapping and reconciliation.
- A supported Sandbox transaction/payment/event mechanism suitable for a meaningful demo.
- If using webhooks: supported event types, registration, verification flow, raw body handling, replay protection and reconciliation with reporting records.
- Server token lifecycle, credential-safe logging, ownership binding and persistent idempotency.

Subscription methods are deliberately not invented in the interface. A verified webhook adapter can translate a vendor event into a generic sync trigger. Signature verification must precede ingestion. Repeated, invalid or out-of-order events must not duplicate allocations or financial records.

If reporting is unavailable, select another **documented and supported** Sandbox data/event path. Show its scope and source truthfully; demo records must remain a separately labeled mode.

## Required pre-submission demonstration

- Execute at least one real, controlled PayPal Sandbox-backed data/event flow.
- Show its normalized transaction/account data stored in the repository and reflected in Pal.
- Demonstrate categorization/review and a deterministic calculation using that real event/data where supported.
- Show that replacing the demo adapter requires no changes to finance, bucket, analytics, Ask Pal or UI logic.
- Document actual capabilities/scopes, consulted APIMatic context, setup, sanitized evidence and reproducible steps.
- Test auth failures, malformed data, duplicate delivery and signature rejection if webhooks are used.
- Keep demo mode working without credentials, clearly labeled separately.
- Complete the rest of the product's end-to-end demo: Quick Check, questions, confirmation, Future You and audit history.
