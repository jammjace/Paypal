# Milestone 3 amendment and Milestone 4 report

Milestone 3 now implements two different bucket purposes. Milestone 4 implements read-only Ask Pal and optional local structured classification. Work stops before Milestone 5 action proposals.

## Delivered

- Spending budgets track completed category spending against weekly/monthly limits, show remaining allowance/overspending and reset per calendar period without carrying unused allowance forward.
- Savings goals retain saved money, support optional targets/dates and separate monthly contribution plans. Additions/withdrawals still require deterministic preview and explicit confirmation.
- Spending limits never reduce Safe to Spend a second time. Existing bucket data migrates to schema v2 with preserved savings, classifications and audit history.
- Ask Pal answers balance, equivalent-day spending comparisons, merchant/category spending, top merchants, income partitions, current budget allowance and current savings progress.
- Questions are parsed into a strict intent schema. All calculations and answer text are deterministic; the model has no mutation tools.
- Optional local model classification respects corrections and remembered rules, routes uncertain categories to Quick Check, and leaves ambiguous peer-payment purpose to the user.
- Unsupported or money-changing questions produce a clarification or direct the user to manual confirmation forms.

## No-payment requirement

The only model adapter is local **Qwen3 4B (`qwen3:4b`) through Ollama**. Its endpoint is fixed to localhost; redirects, arbitrary endpoints, cloud-model configuration and paid-provider keys are not supported. No paid inference call has been made. Default `PAL_AI_MODE=local` runs the labeled rule-based fallback with no model or service dependency. To use the local LLM, configure `PAL_AI_MODE=ollama` after installing Ollama and downloading the weights; disable cloud features in Ollama using `OLLAMA_NO_CLOUD=1`.

Ollama v0.40.0 and Qwen3 4B are now installed under the ignored `.local/ollama` directory. The official runtime archive checksum was verified. The service runs hidden on localhost with cloud disabled and model storage isolated to this project. `.env.local` selects `PAL_AI_MODE=ollama`; the example retains the portable rule-based default. Run `npm run ai:start` after a reboot. The VS Code extension can use the same server.

Eight opt-in live model checks pass (`npm run test:ai`), covering spending-budget allowance, savings/contribution plans, equivalent-day comparison, merchant spending, Safe to Spend explanation, non-mutating action requests, unsupported predictions and classification. They assert the AI mode explicitly, so fallback cannot masquerade as a successful model result. These are focused acceptance checks, not a guarantee of arbitrary language accuracy. First-run mistakes between budget and account-balance intent were corrected by defining each intent and supplying bucket types.

## Main files

- `src/domain/migrations.ts`, `models.ts`, `workspace.ts`: two-type schema and deterministic migration.
- `src/finance/buckets.ts`, `allocations.ts`: period spending and savings-only allocation invariants.
- `src/services/commands.ts`, `dashboard.ts`, `query.ts`: validated bucket edits, progress data and deterministic answers.
- `src/server/ai/structured.ts`, `pal.ts`: local structured transport, intent interpretation and classification.
- `src/server/actions.ts`, `config.ts`, `syncFinancialData.ts`: scoped query action and optional local ingestion interpretation.
- `src/components/pal/AskPal.tsx`, `BucketProgress.tsx`, `BucketForms.tsx`, `PalDashboard.tsx` and bucket detail route: separate displays, contribution forms and working Ask Pal.
- `tests/buckets.test.ts`, `ask-pal.test.ts`, `persistence.test.ts`, `tests/browser/ask-pal.spec.ts`: calculation, migration, storage, model boundary and UI coverage.
- `.env.example`, README, product clarification, implementation plan, [BUCKETS.md](BUCKETS.md), [AI_DESIGN.md](AI_DESIGN.md) and persistence documentation.

## Validation

83 unit/contract/persistence tests pass. These include local-only endpoint/model/no-credential assertions, malformed/truncated response handling, deterministic query answers, category corrections, period reset/overspend, migration, saved contribution plans and explicit withdrawals. ESLint, TypeScript and production build pass. All 18 desktop/mobile browser checks pass, including Ask Pal, budget correction/overspending, saved monthly contribution plans, explicit allocations, reset and cross-browser isolation. Browser concurrency is capped at two workers for the shared local Next/SQLite server. Screenshots were visually inspected. Ordinary transport tests use mocked responses; separate opt-in tests now verify real local Qwen3 inference.

## Remaining scope

No automatic monthly savings transfers, custom budget periods, rollover, historical bucket snapshots or persisted conversational context. Savings spent outside Pal require an explicit reserve release. Real identity and deployment-grade storage remain future work. Milestone 5 adds AI-generated proposals and approval lifecycles; Milestone 6 adds Future You; Milestone 7 still requires a real Sandbox event/data demonstration grounded in APIMatic and current PayPal docs.

Local-model follow-up (2026-10-06): eight live interpretation/classification checks and one production-build dashboard check passed. The dashboard confirmed the Local AI label and correct Coffee allowance. Runtime setup, restart and opt-in test commands are in [AI_DESIGN.md](AI_DESIGN.md). No paid calls or cloud inference were used.
