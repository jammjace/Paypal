> Cost constraint: no paid API calls or payment requirement. Local SQLite and optional local Qwen3 4B/Ollama inference; no hosted AI service.

> Milestone 3 clarification: buckets have two purposes. Spending budgets track category spending against a weekly/monthly limit; savings goals hold accumulated money with a separate monthly contribution plan. Only saved money is earmarked. See [docs/BUCKETS.md](docs/BUCKETS.md) for current semantics, migration and revised sample totals. Original proposal follows for reference.

Pal — Product Specification
PayPal AI Hackathon 2026
1. Product Summary
Pal is an AI financial co-pilot for PayPal that helps users understand, earmark, and explore their money without requiring separate bank accounts.
The core idea:
Keep one balance. Give every dollar a purpose. Ask your money anything.

Pal sits as a dedicated page inside a PayPal-style interface. It adds a virtual allocation layer over the user's balance.
The user remains fully in charge. Pal organizes, calculates, explains, and proposes. The user decides.
2. Problem
A balance is not the same as money that is genuinely free to spend.
A user may see:
- PayPal balance: $2,430
But mentally they may already have:
- Rent: $1,200
- Utilities: $180
- Christmas: $400
- Travel: $300
- Coffee: $80
The problem is not where money is physically stored. The problem is understanding:
- what money is already spoken for
- what money is genuinely flexible
- what changed
- whether spending habits are improving
- where money is going
- how today's choices affect future plans
Users often solve this manually with separate accounts, transfers, notes, or spreadsheets.
Pal makes those mental allocations visible inside one financial interface.
3. Product Philosophy
User = decision-maker
Pal never behaves like a financial authority.
Avoid:
- "You should not buy this."
- "You cannot afford this."
- "I decided to reduce your Travel budget."
Prefer:
- "This would reduce Safe to Spend by $120."
- "Travel would fall $80 behind its current target."
- "Here are three ways to rebalance. You choose."
AI interprets. Code calculates. User confirms.
The LLM should:
- interpret questions
- understand financial intent
- classify transactions
- summarize results
- generate candidate explanations
Deterministic code should:
- calculate balances
- aggregate transactions
- compare periods
- compute percentages
- calculate bucket allocations
- project timelines
- simulate scenarios
State-changing actions require user confirmation.
4. Core Concepts
4.1 Virtual Buckets
Buckets are virtual earmarks. Money does not need to move into separate accounts.
Examples:
- Rent
- Groceries
- Coffee
- Travel
- Christmas
- Shopping
- Emergency Fund
- Subscriptions
Do not give buckets fictional names.
Use plain category names so users instantly understand them.
Each bucket may contain:
- allocated amount
- target amount
- due/target date
- recurrence
- priority
- spending history
- projected status
4.2 Safe to Spend
Primary financial metric:
Safe to Spend = Current Balance - Earmarked Amounts
Example:
- Current balance: $2,430
- Earmarked: $1,944
- Safe to Spend: $486
This does not mean the money is technically locked. Use words like:
- earmarked
- reserved
- allocated
Avoid:
- locked
- inaccessible
- protected
unless an actual PayPal capability guarantees that behavior.
4.3 Pal
Pal is the only named character.
Pal is:
- conductor
- analyst
- summarizer
- planner
- interface to bucket agents
Pal should feel like a calm financial co-pilot.
4.4 Bucket Agents
Each bucket behaves like a lightweight specialist agent.
A bucket agent knows:
- its current allocation
- its target
- its deadline
- its priority
- its recent usage
- what would happen if money were removed or added
Users do not need to talk to the bucket agents directly.
Pal consults them when producing scenarios.
For the MVP, these do not need to be separate autonomous LLM processes. They can be structured bucket state + deterministic logic + persona-neutral summaries.
5. Signature Features
5.1 Ask Pal
Users can ask natural-language questions about their money.
Examples:
- "Have I spent more so far this month than I had by this point last month?"
- "How much have I spent at Luckin Coffee this month?"
- "How much did I spend on SHEIN this month?"
- "What percentage of my Shopping spending was SHEIN?"
- "What category increased the most this month?"
- "How much have I spent since my last paycheck?"
- "How much money did friends reimburse me this month?"
- "Compare my weekend spending this month with last month."
- "How much of my income is already earmarked?"
- "Why is my Safe to Spend only $486?"
Pal translates the question into a structured query. Backend code performs the calculation.
Example response
Question:
Have I spent more so far this month compared with the same number of days last month?

Response:
- Oct 1-15: $742
- Sep 1-15: $891
- Difference: -$149
- Change: -16.7%
Then:
- Dining: -$94
- Shopping: -$61
- Transport: +$22
5.2 Automatic Transaction Categorization
Pal should categorize transactions using the strongest available metadata.
Inputs may include:
- transaction descriptor
- normalized merchant/counterparty
- amount
- incoming vs outgoing
- transaction type
- recurring pattern
- previous user corrections
- date/frequency
- PayPal-provided metadata when available
Examples:
- LUCKIN COFFEE -> Coffee
- NETFLIX -> Subscriptions
- SHEIN -> Shopping
Ambiguous merchants:
- TARGET
- AMAZON
- WALMART
These may require user clarification.
Important rule
Do not classify every incoming transfer as "Income".
Incoming money could be:
- salary
- reimbursement
- peer payment
- gift
- refund
- transfer between own accounts
- other income
This distinction matters because financial analytics depend on it.
5.3 Quick Check
When Pal is unsure, the dashboard asks short clarification questions.
Example:
ALEX +$48.20
What was this?
- Reimbursement
- Gift
- Income
- Transfer
- Other
Example:
TARGET -$72.18
Where should this go?
- Groceries
- Shopping
- Household
- Other
Interaction rule
Questions should not pile up unnecessarily.
Use confidence logic:
- High confidence -> classify automatically
- Medium confidence -> classify provisionally, easy to edit
- Low confidence -> add to Quick Check
Quick Check should be answerable in 1-2 taps.
Pal should learn from corrections.
5.4 Spending Pulse
A simple snapshot showing whether spending behavior is changing.
Example:
Oct 1-15
$742 spent
Sep 1-15
$891 spent
Down $149 / 16.7%
Biggest changes:
- Dining: -$94
- Shopping: -$61
- Transport: +$22
This is a core dashboard component.
5.5 Merchant Insights
Users can inspect merchant-level spending.
Example:
Luckin Coffee
- This month: $84.60
- Transactions: 12
- Average transaction: $7.05
- Last month: $61.20
- Change: +38.2%
- Share of Coffee category: 64%
SHEIN
- This month: $132.40
- Share of Shopping: 32.3%
- Share of total spending: 8.7%
5.6 Bucket Negotiation
When a user wants to reallocate money, Pal can consult bucket state and present trade-offs.
Example:
Move $200 toward Travel.

Pal may show:
- Flexible Spending can contribute $120
- Shopping can contribute $50
- Coffee can contribute $30
- Rent and Bills remain untouched
The user chooses whether to apply it.
The idea is that buckets "negotiate", but the UI should remain simple and factual.
5.7 Future You Timeline
A timeline of projected financial state.
Example:
- Today — Safe to Spend: $486
- Oct 15 — Paycheck
- Nov 1 — Rent due
- Dec 15 — Christmas goal
The user can select a future date and see:
- projected balance
- earmarked amount
- projected Safe to Spend
- bucket status
- upcoming bills/goals
Future You makes the product forward-looking instead of only reporting past expenses.
5.8 What-If Simulation
Users can model hypothetical changes without altering real state.
Examples:
- "What if I add $300 to Travel?"
- "What if rent increases by $150?"
- "What if I spend $500 next week?"
- "What if I reduce Coffee to $50?"
- "What if I want $1,000 for a trip by March?"
The engine calculates impact.
No state changes until the user explicitly applies a scenario.
6. Dashboard
Pal is imagined as a dedicated PayPal page/tab.
Example navigation:
Home | Wallet | Payments | Activity | Pal
Dashboard hierarchy
1. Current financial state
2. Pal insight / Ask Pal
3. Quick Check
4. Buckets
5. Spending Pulse
6. Merchant insights
7. Future You
8. Recent Pal activity
Wireframe
PAL
Your money, organized around you

TOTAL BALANCE
$2,430.00

SAFE TO SPEND
$486.00

$1,944 earmarked

--------------------------------

PAL
You're spending 16.7% less than
this point last month.

[ Ask anything about your money... ]

[Compare this month]
[Where did I spend most?]

--------------------------------

QUICK CHECK
Pal needs your help with 2 transactions

ALEX +$48.20
What was this?
[Reimbursement] [Gift] [Income] [Transfer]

TARGET -$72.18
Where should this go?
[Groceries] [Shopping] [Household] [Other]

--------------------------------

YOUR BUCKETS

Rent
$1,200 / $1,200
Fully funded

Christmas
$260 / $400
On track

Travel
$420 / $1,000
On track

Coffee
$38 left this month

[+ Create bucket]

--------------------------------

SPENDING PULSE

Oct 1-15     Sep 1-15
$742         $891

Down $149 / 16.7%

Dining      -$94
Shopping    -$61
Transport   +$22

--------------------------------

TOP MERCHANTS

SHEIN           $132.40
32% of Shopping

Luckin Coffee    $84.60
64% of Coffee

--------------------------------

FUTURE YOU

Today --- Oct 15 --- Nov 1 --- Dec 15
$486     Paycheck    Rent      Christmas

[View timeline]

--------------------------------

RECENT PAL ACTIVITY

+$150 -> Christmas
$7.20 Luckin -> Coffee
$48.20 Alex -> Reimbursement
7. Visual Direction
Goal:
simple, easy, memorable, intuitive, cute
Reference direction:
- pastel accents
- lots of whitespace
- simple smiling shapes
- rounded cards
- minimal illustrations
Rule:
90% clean finance UI, 10% playful charm
Base UI
- off-white / white background
- dark readable text
- subtle gray dividers
- PayPal-compatible blue accents
Pastel accents
- soft yellow
- mint
- pastel blue
- soft pink
- lavender
- soft orange
Pal mascot
Original character only.
Inspiration:
- small celestial companion
- simple face
- tiny star-like or soft floating form
- calm and friendly
Do not copy protected characters or visual assets.
Bucket visuals
Use category name + simple icon.
Examples:
- Rent -> house
- Coffee -> cup
- Travel -> plane
- Christmas -> gift/star
- Shopping -> bag
No invented bucket names.
8. Data Model
Use integer cents for money.
User
- id
- name
- currency
- createdAt
Account
- id
- userId
- provider
- providerAccountId
- currentBalanceCents
- lastSyncedAt
Bucket
- id
- userId
- name
- category
- type: BILL | SPENDING | GOAL | FLEXIBLE
- allocatedAmountCents
- targetAmountCents
- targetDate
- recurrence
- priority
- status
Transaction
- id
- userId
- accountId
- providerTransactionId
- rawDescription
- normalizedMerchant
- amountCents
- direction: IN | OUT
- transactionType
- transactionDate
- category
- categorizationConfidence
- categorizationSource
- needsReview
TransactionAllocation
- id
- transactionId
- bucketId
- amountCents
AllocationRule
- id
- userId
- bucketId
- triggerType
- amountType
- amountValue
- priority
AllocationEvent
- id
- userId
- bucketId
- deltaCents
- previousAmountCents
- newAmountCents
- reason
- createdAt
ProposedAction
- id
- userId
- type
- payloadJson
- impactJson
- status: PENDING | APPROVED | REJECTED | EXPIRED
- createdAt
MerchantRule
- id
- userId
- merchantPattern
- normalizedMerchant
- category
- confidence
- learnedFromUser
Conversation
- id
- userId
- createdAt
9. AI Responsibilities
AI is used for:
- natural-language financial queries
- intent parsing
- transaction categorization
- merchant normalization
- ambiguity detection
- explanation and summarization
- structured scenario requests
- suggested bucket reallocation plans
AI must not:
- invent transactions
- invent balances
- perform authoritative arithmetic
- modify allocations directly
- silently change financial state
Use structured outputs wherever possible.
10. Deterministic Finance Engine
Must handle:
- Safe to Spend
- bucket totals
- monthly spending
- merchant totals
- category totals
- period comparisons
- proportions
- averages
- recurring pattern detection
- future projections
- scenario simulations
- goal funding requirements
- reallocation impacts
Use integer cents.
Never rely on floating-point arithmetic for money.
11. PayPal Integration
The hackathon requires meaningful use of PayPal and AI. The official Devpost page requires at least one PayPal technology/API/SDK/product/developer capability, a working prototype, documentation, a public open-source GitHub repository, and a sub-3-minute public YouTube demo. The current deadline is Nov 12, 2026 at 12:00 PM PST.
For the prototype, use PayPal Sandbox.
PayPal Sandbox simulates PayPal transactions without touching live accounts.
PayPal responsibilities in Pal
PayPal should be the financial-data/event layer for the demo.
Potential supported integrations:
- sandbox account/payment events
- transaction/reporting data where permitted
- balance/reporting data where permitted
- webhook events
Important constraint
Do not assume unrestricted read access to every arbitrary consumer PayPal account.
Build a provider abstraction:
interface FinancialProvider {
  getBalance(): Promise<Money>;
  getTransactions(input: TransactionQuery): Promise<Transaction[]>;
}
Implement:
- PayPalSandboxProvider
- DemoProvider
The application should work end-to-end with seeded/demo data even if a specific PayPal reporting permission is unavailable.
PayPal Sandbox demo scenario
Use a controlled sandbox/demo account with:
- paycheck-like incoming transaction
- merchant transactions
- peer transfer
- refund
- recurring-looking subscriptions
- ambiguous transfer
Show Pal:
- categorizing them
- asking Quick Check questions
- computing Safe to Spend
- answering queries
- projecting Future You
12. APIMatic Integration Strategy
Use APIMatic's PayPal Context Plugin as the authoritative API context while implementing PayPal.
The goal is to prevent the coding agent from guessing:
- endpoint paths
- authentication
- SDK methods
- request models
- response models
- error handling
Development rule:
Before writing or changing any PayPal API integration code, consult the APIMatic PayPal context available in the IDE/environment. Do not guess PayPal endpoints from memory.

If the Codex environment cannot consume the plugin directly, use the APIMatic-provided SDK/context artifacts as the source of truth and keep PayPal calls isolated behind the provider adapter.
13. Suggested Stack
Frontend:
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
Backend:
- Next.js server routes / server actions
Database:
- Supabase Postgres
Auth:
- Supabase Auth
AI:
- OpenAI API with structured outputs
Financial integration:
- PayPal Sandbox
- APIMatic PayPal Context Plugin during development
Deployment:
- Render or Vercel
14. MVP Scope
Must have:
1. PayPal-style Pal page
2. Dashboard summary
3. Safe to Spend
4. Create/edit/delete virtual buckets
5. Seeded or PayPal Sandbox transaction ingestion
6. Automatic merchant/category classification
7. Quick Check for ambiguous transactions
8. Ask Pal natural-language queries
9. Merchant-level analytics
10. Spending Pulse comparison
11. Bucket negotiation/reallocation preview
12. Future You timeline
13. What-if simulation
14. Explicit confirmation for state changes
15. Persistent database
16. Audit history
Do not build yet:
- bank aggregation
- investments
- credit scores
- lending
- crypto
- tax advice
- autonomous purchases
- complex household sharing
- dozens of screens
15. Hackathon Demo Story
Target: under 3 minutes.
Scene 1 — Raw balance is misleading
Show:
- Balance: $2,430
- Safe to Spend: $486
- $1,944 earmarked
Scene 2 — Pal understands transactions
Show recent transactions.
Most classify automatically.
One ambiguous transfer appears:
ALEX +$48.20
User taps:
Reimbursement
Quick Check disappears.
Scene 3 — Ask Pal
User asks:
Have I spent more so far this month than I had by this point last month?

Pal returns:
- Oct 1-15: $742
- Sep 1-15: $891
- -16.7%
Scene 4 — Merchant insight
User asks:
How much did I spend on Luckin this month?

Pal returns merchant total, count, average, trend.
Scene 5 — Buckets
Show:
- Rent
- Travel
- Christmas
- Coffee
User asks to put $200 more into Travel.
Pal presents trade-offs.
User confirms one option.
Scene 6 — Future You
Timeline updates instantly.
Show future paycheck, rent, and goal dates.
Scene 7 — Close
Message:
One balance. Clear priorities. Ask your money anything.

16. Product Positioning
Primary pitch:
Pal is an AI financial co-pilot inside PayPal that turns one balance into clear virtual allocations, answers natural-language questions about your spending, and shows how today's money choices affect your future.

Short tagline:
Ask your money anything.

Alternative:
One balance. Many purposes.

17. Success Criteria
A user should be able to:
1. see their balance and Safe to Spend
2. understand where money is earmarked
3. create and edit buckets
4. have transactions categorized automatically
5. resolve ambiguity in 1-2 taps
6. ask arbitrary financial questions in natural language
7. inspect merchant and category spending
8. compare spending periods correctly
9. simulate changes
10. view future financial state
11. approve or reject reallocations
12. understand every calculation