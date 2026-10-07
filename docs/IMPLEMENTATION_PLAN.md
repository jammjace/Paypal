# Pal implementation plan

Product source of truth: [PAL_PRODUCT_SPEC.md](../PAL_PRODUCT_SPEC.md). The original filename typo was corrected without changing the supplied specification.

## Architecture from milestone 1

```text
UI -> Pal services -> repository interface -> normalized account/transactions
                              ^
                              | validated, atomic snapshot
                       sync orchestration
                              ^
                              |
                      FinancialProvider
                        /           \
                  DemoProvider   PayPalSandboxProvider
                                      ^
                              API normalizers / verified events
```

- Core calculations, buckets, analytics, future AI query handlers, and UI never consume vendor payloads or import concrete adapters.
- A server-only composition root selects the provider and supplies account ownership, repository, and clock context.
- Demo and Sandbox implement the same `getBalance()` / `getTransactions()` contract. Paginated transactions use half-open UTC ranges and opaque cursors.
- Normalize money, direction, status, identity and dates at the adapter boundary; validate again before repository writes.
- Opaque provider identifiers exist only for reconciliation. No business decisions depend on provider names or IDs.
- The current adapter is read-only. Future event delivery verifies vendor signatures inside the integration boundary and calls the same ingestion path. Subscription capabilities will only be added after their support is verified.
- No silent fallback from a failed real provider to demo financial records.
- Credentials stay server-side. Milestone 3 uses durable local SQLite and isolated anonymous demo sessions. Real identity and a deployment-ready remote adapter remain prerequisites for real-account use.

## Cost constraint

The project must require no payment. Use local SQLite and local inference; no paid AI service, mandatory cloud subscription or live payment is part of the implementation. PayPal integration remains Sandbox-only.

## Milestones and gates

Milestones 1 through 4 are implemented for the local prototype. Milestone 3 now includes the spending-budget/savings-goal distinction. Local Qwen3 4B inference is installed and verified; see MILESTONE_4_REPORT.md. Stopped before milestone 5. See [BUCKETS.md](BUCKETS.md), [AI_DESIGN.md](AI_DESIGN.md) and [PERSISTENCE.md](PERSISTENCE.md) and [MILESTONE_3_REPORT.md](MILESTONE_3_REPORT.md) for persistence, session limitations and validation.

1. **Foundation (complete):** Next.js/TypeScript/Tailwind shell, `/pal`, normalized models and runtime schemas, FinancialProvider contract, DemoProvider, fail-closed Sandbox/normalizer placeholders, repository seam, minimal read-only dashboard arithmetic, environment example, integration docs and independent provider-swap tests. Lint, typecheck, unit tests, production build, and desktop/mobile render checks.
2. **Finance engine (complete):** Expand tested arithmetic to category changes, detailed merchant analytics, income/reimbursement separation, configurable periods, goals and allocation invariants. Preserve the provider-independent functions and add edge-case coverage.
3. **Persistence and ingestion (complete, local prototype):** Durable SQLite repository, server-resolved anonymous session ownership, bucket CRUD with two distinct types (period-based category spending limits and carried-forward savings with monthly contribution plans), audited v1-to-v2 migration, typed storage for remaining product entities, transactional/idempotent sync, normalized lifecycle and committed coverage windows, Quick Check and learned merchant rules. Concurrent/replayed writes and ownership are tested. Real-user authentication and Supabase are deferred; partial pagination restarts safely rather than resuming a saved cursor.
4. **AI (implemented; local model verified):** Server-only structured query/classification functions with Zod validation. Deterministic calculations answer all supported intents. Free local Qwen3 4B/Ollama inference only, with clearly identified rule-based fallback when the runtime is unavailable. No paid API calls, payment details or billing subscriptions. Test malformed output and unsupported questions.
5. **Confirmed actions:** Multiple reallocation scenarios, impact previews, ProposedAction approval/rejection/expiry, revalidation and atomic audit events. AI cannot mutate state. Test stale and repeated approvals.
6. **Future You:** `/pal/future`, extend the existing bucket detail/activity routes, recurring events, goal projections, separate what-if state, Apply/Discard/Modify. Explicit projection labels and simulation tests.
7. **Required PayPal Sandbox flow:** Consult APIMatic PayPal Context Plugin/artifacts and current PayPal docs before any vendor implementation. Implement only verified supported account capabilities, normalize at the adapter boundary, and demonstrate at least one real Sandbox-backed event/data flow through Pal. Verify webhook signatures if used. An adapter stub does not meet this milestone.
8. **Submission readiness:** Responsive/accessibility polish, full demo reset, README and integration evidence, end-to-end walkthrough, source publication and recorded demo after authorization where needed.

Run applicable checks at each milestone and resolve errors before continuing. Do not treat demo-only functionality as completed Sandbox integration.

## Milestone 1 assumptions

- Local, single-user, read-only USD preview; no production authentication or durable state yet.
- Money is safe integer cents. USD is explicitly validated; unsupported currencies fail rather than being converted or summed.
- Demo clock defaults to October 15, 2026 and is configurable only through the demo composition. Product calculations receive `asOf` from normalized snapshots.
- Rent $1,200 + Christmas $260 + Travel $420 + Coffee $64 = $1,944 earmarked. This reconciles the specification's headline totals; its illustrative $38 Coffee amount would not.
- Balance is an independent account snapshot, never inferred from incomplete transaction history.
- Spending uses completed outgoing records, excludes internal transfers and refunds, and reports gross spend (incoming refunds are not netted). Future net-spend analytics must use an explicit definition.
- UTC day ranges are the current reporting convention; a user-configurable reporting timezone belongs in the finance layer, never an individual provider.
- Ask Pal, categorization, bucket mutations, detailed routes and projections are visibly deferred. No mock mutation or simulated AI answer is presented as functional.
- The minimal dashboard arithmetic is included now to prove that swapping providers preserves financial results. Full milestone 2 analytics are deferred.
