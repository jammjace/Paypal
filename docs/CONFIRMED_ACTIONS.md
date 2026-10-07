# Milestone 5: confirmed savings changes

Ask Pal can prepare a savings change, but only a user's explicit approval changes earmarks. Try **Add $200 to Travel**, follow **Review funding options**, compare the impacts and approve one option. `/pal/actions` also has a structured form that works without an AI runtime. Rejection leaves money unchanged.

## Two bucket uses

Only active **GOAL** buckets hold savings. **SPENDING** buckets are period-based category limits and cannot donate or receive earmarks. Budget limits are edited through the existing bucket editor. Monthly contribution amounts remain plans, not automatic transfers. Approval only updates virtual earmarks in Pal; it does not call a financial provider or initiate a payment.

## Interpretation and calculation

The existing free Qwen3 4B/Ollama interpreter classifies requests. A narrow local grammar extracts supported action requests; other phrasing can use a second structured local-model call. Names and explicit decimal amounts must be grounded in the question and resolve to one active savings goal in the current session. Ambiguous names, relative amounts, multiple changes and recurring requests are declined. No model receives write tools or calculates impacts. Questions remain standalone, without conversational pronoun resolution.

The deterministic `reallocationOptions` function proposes up to five affordable options: Safe to Spend, individual savings donors, and a combined source when needed. Donors are considered in descending numeric priority (lower-priority goals first). A higher-priority donor is still available with a warning; priority is not a protected-funds lock. Explicit source requests use only that source. All options show account balance, earmarks, Safe to Spend, affected savings amounts and remaining goal gaps. These are present-day impacts, not predicted completion dates; projections belong to milestone 6.

The account balance never changes. Money uses checked integer cents. A negative Safe to Spend is preserved rather than hidden; moves cannot worsen the existing shortfall. Preview creation and rejection never change buckets or allocation history.

## Durable lifecycle

`PENDING -> APPROVED | REJECTED | EXPIRED`

One proposal contains several mutually exclusive options. Creation persists the normalized request, immutable impact preview, owner, request ID, financial-state fingerprint, wall-clock timestamps and audit event. Retrying the same request ID/payload returns the existing proposal. A changed payload under that ID is rejected.

Previews expire after **15 minutes of real server time**, independently of the provider snapshot clock. They also expire when the account balance, snapshot time or bucket state changes. Creating another proposal or unrelated audit events does not expire them. Review-page reads mark stale/expired drafts durably; approval always rechecks even when the page was left open. There is no background expiry scheduler or live countdown.

Approval accepts only a proposal ID and option ID; extra client fields are rejected. The server resolves the session owner, starts a SQLite transaction, checks status/expiry/fingerprint, recalculates the selected option and compares the stored impacts structurally. It then commits savings changes, allocation events, approval status and proposal audit together. Concurrent/repeated approval applies at most one option. Replaying the approved option is a no-op; choosing a sibling afterward is rejected. A rejected or expired proposal needs a new preview.

The additive typed `reallocation` field retains schema version 2 compatibility. Earlier generic proposal placeholders remain readable but cannot be executed. Reset clears proposals along with the current session's other demo changes. Local sessions and durable SQLite limitations remain as documented in PERSISTENCE.md.

## Boundaries

`question/form -> normalized request -> deterministic scenarios -> persisted proposal -> user approval -> revalidation -> atomic allocation/audit`

No provider-specific concepts enter this path. PayPal Sandbox stays a required milestone 7, subject to APIMatic context and current official documentation before implementation. Deployment of the local model remains deferred at the user's request. No paid API or billing requirement was introduced.
