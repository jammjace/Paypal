# Milestone 5 report

Implemented confirmed savings changes. Ask Pal can prepare a proposal, `/pal/actions` shows multiple funding options with deterministic impacts, and only explicit approval changes savings. Spending budgets remain period-based limits and cannot fund or receive savings allocations.

## Files created

- `src/domain/proposals.ts`: normalized requests, option impacts, lifecycle details and strict approval/rejection inputs.
- `src/finance/reallocation.ts`: pure affordable funding scenarios, goal gaps and priority trade-offs.
- `src/services/proposals.ts`: creation, deduplication, expiry, owner-scoped approval/rejection and revalidation.
- `src/services/mutations.ts`: shared atomic allocation/audit helpers, also used by existing bucket commands.
- `src/server/ai/actions.ts`: local grammar and grounded structured Qwen action extraction.
- `src/app/pal/actions/page.tsx`: persistent review/history route.
- `src/components/pal/ProposalReview.tsx`: manual preview form, option cards and explicit approval/rejection controls.
- `tests/proposals.test.ts`: calculation, interpretation and SQLite lifecycle tests.
- `tests/browser/proposals.spec.ts`: desktop/mobile preview, approval, rejection, persistence and stale-preview checks.
- `docs/CONFIRMED_ACTIONS.md` and this report.

Existing server actions, Ask Pal, dashboard/navigation, storage schema, styles, live-model tests, README and architecture/AI/persistence/implementation-plan docs were updated. No provider adapter, credentials, dependency or paid service was added.

## Decisions and assumptions

- One proposal holds mutually exclusive options; at most one can be applied. Duplicate approvals do not move money again.
- Previews expire after 15 minutes of actual server time or a relevant financial-state change, independently of the demo's October 15 snapshot. Approval always checks; page reads persist expiry without a background scheduler.
- Financial-state fingerprints avoid invalidating previews merely because another draft was created. Account balance, snapshot time and full bucket records participate.
- Approval recalculates and structurally compares stored impacts inside the same transaction that writes balances, status and audit. Client-supplied impact amounts are never accepted.
- Only savings goals hold money. Budget limits are edited separately; monthly contributions remain manual plans.
- Lower-priority donors are considered first. Higher-priority donors are not locked; their impact is explicitly warned about. Goal completion dates are not predicted here.
- Local model phrasing remains limited and validated. Missing/ambiguous/recurring/relative requests require clarification or the structured form. AI receives no mutation tool and no vendor payload.
- The new typed proposal details are additive to workspace schema v2. Old generic placeholders are readable but not executable.
- Approval updates virtual earmarks only, without changing the account balance or making external transfers.

## Validation

- Lint, TypeScript and production build pass.
- 119 unit/contract/persistence tests pass, including 36 new cases covering funding options, negative Safe to Spend, spending-budget exclusion, expiry boundaries, stale drafts, replay, competing options, foreign ownership, untrusted inputs and rollback of money/status/audit together.
- 24 Chrome desktop/mobile checks pass; two opt-in local-model browser cases are excluded from the ordinary suite. Review-page screenshots were inspected at both sizes.
- Existing eight live Qwen3 checks passed. The new structured action extraction case passed after clarifying that funding describes the source and an unspecified source uses AUTO. This uses the installed local Ollama runtime, without a cloud fallback.
- The opt-in desktop browser acceptance check passed through the production UI with real Qwen3 inference: Coffee allowance answered correctly, then “Could you set aside $200 for Travel?” produced reviewable funding options. No fallback result was accepted.

## Walkthrough

1. Start Pal and enter the current demo session.
2. Ask **Add $200 to Travel**, then follow **Review funding options**.
3. Inspect Safe to Spend ($550 -> $350 for the cash option) and Travel savings ($420 -> $620). Other options draw from existing savings with donor impacts and warnings.
4. Approve one option or reject the entire preview. Refresh to confirm its persistent status and inspect Pal activity.
5. Use **Review changes** to preview an explicit withdrawal or transfer without requiring AI.

These amounts describe a fresh default fixture; calculations use the actual session's data.

## Remaining work

Milestone 6 is Future You: timelines, recurring events, projections and separate what-if state with Apply/Discard/Modify. Real PayPal Sandbox remains required in milestone 7; consult APIMatic PayPal Context Plugin/artifacts and current official PayPal docs before implementation. No real PayPal calls were made in this milestone. Hosting/local-model deployment and submission readiness remain later work.
