# Domain design (implementation deferred)

## Boundaries and dependencies

Two aggregates: SaleReceipt owns original lines and cumulative returned amounts /
quantities; Outlet owns identity, time zone, plan, responsible person and accepted
activity. One ingestion endpoint does not imply one consistency boundary. A
chain-wide aggregate would serialize unrelated outlets and mix queries, SMTP and
receipt invariants. One IngestEvent orchestration shares validation/idempotency
steps for sale/return without a generic aggregate or duplicated handlers.

```text
Outlet 1 ---- * SaleReceipt 1 ---- * ReceiptLine
Product 1 --- * ReceiptLine 1 ---- * ReturnLine
SaleReceipt 1 ---- * ReturnEvent
AcceptedEvent ---- one SaleInput or ReturnInput + original Acceptance
Outlet 1 ---- * AlertEpisode 1 ---- 1 OutboxJob
Outlet 1 ---- * MiddayAssessment (unique outlet + local date)
persisted facts ---- RankingQuery / OutletCardQuery ---- read models
```

Feature folders: events, rankings, outlets, products, alerts, notifications.
Each has domain/, application/ports/, infrastructure/, presentation/; read-heavy
features additionally have application/read-models/. shared/domain/ holds scalar
contracts; shared/application/ports/ holds clock and transaction boundaries.
Rankings intentionally have no domain aggregate. Empty adapters/presentation
folders reserve space, not implementations. Future use-case classes have execute()
and are wired by Nest factories/tokens outside application. No Nest decorators,
TypeORM objects or runtime tokens are introduced in this design-only branch.
ARCHITECTURE.md layers are unchanged.

## Types, ownership and units

See API_CONTRACT.md for full wire field lists and src/_/domain/_.ts for records.
Domain MinorUnits is bigint; JSON MoneyString is a decimal integer string.
Ranking average check is rounded SQL numeric division encoded as a whole minor-unit
string (see API_CONTRACT.md); other planned read metrics may use NumericString;
it is a read metric, never payment arithmetic or persisted monetary value.
Quantities are positive whole safe integers; limits prevent overflow in counts.
IDs are UUID strings, normalized to lowercase by the parser before validation of
line uniqueness and before hashing: clients supply event/receipt/line IDs, server seeds outlet /
product IDs and generates snapshot/episode/job IDs. No string alias validates
runtime input; presentation validators must do that later. UTC timestamps are
ISO strings, input offsets mandatory and at most three fractional-second digits; IANA time zones are validated during seeding.

SaleReceipt contains receipt/event/outlet IDs, occurred_at, gross_amount_minor,
and ReceiptLine[] (product, quantity, unit price, line amount, returned totals).
ReturnEvent contains event/outlet/receipt IDs, occurred_at, derived amount and
ReturnLine[]; input lines contain only IDs and quantity, never amount.
AcceptedEvent stores the payload hash, canonical payload (jsonb, audit only),
occurred_at, amount and accepted_at; the acceptance response is rebuilt from
these columns, with duplicate set by the caller.
Outlet includes activated_at and nullable last_accepted_at, no settings version.
Product contains seeded id/sku/name/current price; receipt price is historical.
AlertEpisode contains IDs, date when relevant, opened/resolved timestamps and
captured facts/recipient. Its kind is the discriminant of facts internally and
flattened by HTTP presentation. MiddayAssessment persists threshold observations
and the boolean decision, including false. OutboxJob contains identity, episode,
unique notification key, captured EmailMessage with stable message_id, pending /
sent status, attempts, next_attempt_at, created_at, sent_at, last_error; no lease.
Query models contain wire-safe strings, not aggregates or TypeORM entities.

## Transaction invariants and concurrency

- Same event_id + same payload hash: 200 original result; otherwise 409.
  Canonical input normalizes offsets/money and key/line ordering before
  hashing; the hash alone decides equality. Duplicate retries do not
  change last_accepted_at or enqueue refresh/email work.
- Global sale receipt ID uniqueness rejects different event IDs. All line IDs
  are unique within their owning receipt/event. Product references must exist.
- Nonempty lines; integer quantities; nonnegative unit price; sale amount equals
  quantity × historical price. Revenue is sum of validated line amounts.
- Return refers to one original receipt at the same outlet, cannot predate sale,
  derives amount from original price, and cannot exceed either remaining cap.
- Application opens TransactionRunner. Lock outlet, then receipt consistently;
  unrelated outlets can proceed concurrently. Ledger uniqueness must arbitrate
  concurrent retries. Return validation and returned totals update are atomic.
- Event ledger, receipt/return facts, activity update and stale resolution commit
  together. Episode opening and unique outbox insertion commit together. Failed
  transactions request no ranking refresh. After commit, request coalesced refresh;
  timer refresh provides recovery if process dies before requesting publication.
- Single worker sends a due job and persists sent/retry state. No second worker
  runs concurrently. One unique job per episode does not guarantee exactly-once
  SMTP: crash after acceptance can resend; reuse stable Message-ID on retry.

## Use cases and ports (planned, no implementations)

| Feature       | Use cases                                                           | Ports                                                                                                                                  |
| ------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| events        | IngestEvent                                                         | EventLedgerRepository, SaleReceiptRepository, ProductLookup, OutletActivityRepository, AlertEpisodeRepository, RankingRefreshRequester |
| rankings      | GetRankings, PublishRankings                                        | RankingQuery, RankingPublisher, RankingRefreshRequester                                                                                |
| outlets       | ListOutlets, GetOutletCard, GetOutletSettings, UpdateOutletSettings | OutletRepository, OutletQuery, OutletCardQuery, RankingRefreshRequester                                                                |
| products      | ListProducts                                                        | ProductCatalogueQuery, ProductLookup                                                                                                   |
| alerts        | EvaluateAlerts, ListAlerts                                          | AlertEpisodeRepository, MiddayAssessmentRepository, AlertEvaluationQuery, AlertQuery, OutboxRepository, RankingRefreshRequester        |
| notifications | DispatchOutbox                                                      | OutboxRepository, Mailer                                                                                                               |
| shared        | none                                                                | Clock, TransactionRunner (transaction-scoped repository bundle)                                                                        |

Ports are intentionally narrow interfaces. Transaction callback receives bound
ports, never a TypeORM QueryRunner. Query responses stay read models. Application
may import another feature's pure domain contracts/ports; no adapter dependency.
Later adapters own SQL and map wire/internal money explicitly.

## Read and alert policies

Occurrence-time half-open windows, per-outlet local midnight, zero-activity rows,
return-aware net metrics and numeric average check follow API_CONTRACT.md. Hour
comparison is previous hour; business-day dynamics null. Rank ties use outlet_id;
frontend derives movement. Both stale and behind-plan flags travel in rankings.
Alert evaluation uses acceptance time for stale, occurrence time for noon revenue.
Noon decisions use the plan and data available at assessment/catch-up and persist;
late events and subsequent settings changes do not revise them. Plan must be
positive. Behind-plan episodes expire at next local midnight; stale episodes end
on newly accepted activity. Thresholds/cadences/currency live in env.

## Backup lessons and deferred work

Read only: backup/first-pass:src/rankings.ts and db/migrations/001_initial.sql,
002_outlet_activity.sql. They demonstrate occurred_at filtering, SQL numeric
average, IANA local-midnight conversion, all-outlet left joins, deterministic
revenue/id ordering and separate acceptance activity. These are observations from
source, not rerun verification in this branch. Re-read before future schema work.
Do not inherit fractional quantities, the old receipt uniqueness scope, in-memory
snapshot counters, or raw return amounts blindly. No migration is added here.

One-day scope: seeded catalogue/outlets, one currency, whole quantities, fixed
chart bins, one worker. Defer catalogue CRUD, tax/discount/FX, authentication,
custom charts and settings history. Later required tests: concurrent retries,
conflicting receipts, concurrent over-returns, rollback of state + outbox, stale
reopening, strict noon equality, late events, restart/catch-up, DST midnight and
numeric average. SQL queries reconstruct rankings from durable facts on restart.
