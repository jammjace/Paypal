# AI design — deferred until milestone 4

Milestone 1 makes no AI requests. Ask Pal is a visibly disabled preview; its dashboard summary is deterministically formatted from transaction aggregates. It is not presented as an LLM response.

Future server-only functions:

- `parseFinancialQuery()`: natural language -> Zod-validated query intent.
- `classifyTransaction()`: normalized descriptors/metadata and merchant rules -> merchant, category, confidence, short safe explanation and review flag.
- `parseBucketAction()`: user request -> structured proposal input, never a database mutation.
- `summarizeFinancialResult()`: explain already-calculated results without inventing numbers.

Finance services operate on internal records in the repository. No PayPal response models or SDK calls enter prompts or query logic. Low-confidence data goes to Quick Check; known user rules take precedence. Thresholds will be configurable.

AI output is untrusted input. Validate schemas, ownership, resources and requested operations. Keep money arithmetic in deterministic code. State changes create ProposedAction records and require explicit approval, revalidation and audit events. Store only concise user-safe explanations, never hidden reasoning.

The implementation milestone will consult current official OpenAI structured-output documentation and add malformed-output tests, deterministic query coverage, and clear no-credentials behavior.
