# Planned API contract

Implemented: sale ingestion, ping/health and Socket.IO ping/pong. Returns and
all other business routes/events below remain planned. Developer-approved decisions,
implemented with AI assistance; independent frontend contracts must not import backend.

## Encoding and errors

IDs are UUID strings; outlet/product IDs are seeded by the server. Event, receipt,
sale-line and return-line IDs are client supplied. The parser normalizes every
UUID to lowercase before duplicate checks and hashing; case-only changes are
identical retries, and case-only duplicate line IDs are rejected with 422.
Timestamps require an explicit
UTC offset on input and use UTC `Z` on output. Fractional seconds have at most
three digits (milliseconds); finer input receives 422 with code
`timestamp_precision`, preventing distinct instants from hashing identically. Zones are IANA names. Money uses
integer minor units encoded as decimal strings in JSON; never JavaScript floats.
Quantities/counts/ranks are safe integers. Average check is an exact SQL numeric
minor-unit decimal string (it may be fractional), not stored money. Rates use
integer basis points. Single configured currency; no currency conversion.

Business errors: `{ code, message, details? }`; malformed JSON is 400, invalid
business input 422, unavailable database 503 (`database_unavailable`, sanitized
message). Other SQL/application errors keep their normal 500 handling; malformed
JSON keeps 400. Unknown fields are rejected.

## HTTP

| Method/path                                         | Request                                               | Response                           | Status                                                                                                                            | Use case                     |
| --------------------------------------------------- | ----------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| POST /api/events                                    | SaleInput; ReturnInput pending                        | Acceptance                         | 201 new; 200 identical retry; 409 conflicting event/receipt identity; 422 invalid references, quantities, prices or return limits | IngestEvent                  |
| GET /api/rankings?window=hour\|business_day         | default business_day                                  | RankingSnapshot                    | 200, 422                                                                                                                          | GetRankings                  |
| GET /api/outlets                                    | none                                                  | `{ items: OutletSummary[] }`       | 200                                                                                                                               | ListOutlets                  |
| GET /api/outlets/:id/card?window=hour\|business_day | default business_day                                  | OutletCard                         | 200, 404, 422                                                                                                                     | GetOutletCard                |
| GET /api/outlets/:id/settings                       | none                                                  | OutletSettings                     | 200, 404                                                                                                                          | GetOutletSettings            |
| PATCH /api/outlets/:id/settings                     | nonempty `{ daily_plan_minor?, responsible_person? }` | OutletSettings                     | 200, 404, 422                                                                                                                     | UpdateOutletSettings         |
| GET /api/products                                   | none                                                  | `{ items: Product[] }`             | 200                                                                                                                               | ListProducts                 |
| GET /api/alerts?active_only=true&outlet_id=UUID     | defaults active only; optional outlet filter          | `{ items: AlertEpisode[] }`        | 200, 422                                                                                                                          | ListAlerts                   |
| GET /api/ping                                       | none                                                  | `{ message: "pong" }`              | 200                                                                                                                               | existing flat ping service   |
| GET /api/health                                     | none                                                  | `{ status: "ok", database: "up" }` | 200; existing sanitized error 503                                                                                                 | existing flat health service |

SaleInput: `{ kind: "sale", event_id, receipt_id, outlet_id, occurred_at,
lines: [{ sale_line_id, product_id, quantity, unit_price_minor, line_amount_minor }] }`.
ReturnInput: `{ kind: "return", event_id, outlet_id, occurred_at, sale_receipt_id,
lines: [{ return_line_id, sale_line_id, quantity }] }`. No return amount is accepted.
Return ingestion is pending: requests with `kind: "return"` currently receive
422 `unsupported_kind`; the ReturnInput shape above is the future contract.
Acceptance: `{ event_id, outlet_id, kind, accepted_at, amount_minor, duplicate }`;
amount is nonnegative gross sale or derived refund magnitude (free sales may
produce zero). Retry preserves the
original accepted_at/result and changes only duplicate to true.
OutletSettings: `{ outlet_id, daily_plan_minor, responsible_person: { name, email } }`.
PATCH uses last write wins for supplied fields; no expected_version or 409.

## Socket.IO (existing /socket.io/ transport)

| Direction/event             | Shape                                   | Behavior/use case                                                                                                                       |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| client rankings.subscribe   | `{ window: "hour" or "business_day" }`  | replace this socket's window; ack `{ ok: true, window }` or `{ ok: false, error: { code, message } }`; GetRankings sends fresh snapshot |
| client rankings.unsubscribe | `{}`                                    | ack `{ ok: true }`; remove subscription                                                                                                 |
| server rankings.snapshot    | RankingSnapshot                         | PublishRankings; only business push channel, including stale/behind-plan flags                                                          |
| client ping / server pong   | no ping payload / `{ message: "pong" }` | existing flat gateway                                                                                                                   |

No alerts.* events. Alert list is HTTP only. Window belongs to each client
(localStorage), not a stored chain-wide setting. Reconnect resubscribes and obtains
a fresh snapshot. Frontend computes rank movement from successive snapshots.
Refresh requests after committed events/settings/alert changes coalesce for about
250 ms (configured); broadcast once per subscribed window per batch, not per event.
Timer refreshes handle rolling expiration and local date changes without ingestion.
Snapshot UUID/as_of identify each result; no persistent in-memory ranking state.

## Read shapes

RankingSnapshot: `{ snapshot_id, as_of, window, currency, rows: RankingRow[] }`.
RankingRow: `{ outlet_id, outlet_name, time_zone, local_date, starts_at, ends_at,
rank, net_revenue_minor, receipt_count, average_check_minor, previous_revenue_minor,
dynamics_bps, is_leader, is_laggard, stale, behind_plan }`.
Hour dynamics compare preceding hour; business-day previous revenue and dynamics
are null. Descending net revenue, ascending outlet_id gives unique stable ranks.
With at least two outlets, first/last ranks are leader/laggard even on equal revenue.

OutletSummary: `{ outlet_id, name, time_zone }`. Product:
`{ product_id, sku, name, unit_price_minor }` (seeded catalogue).
OutletCard: `{ outlet, settings, as_of, window, metrics, series, top_products,
today_plan }`. Metrics: net revenue, receipt count, numeric average check. Series:
`[{ starts_at, ends_at, metrics }]`; fixed five-minute hour / hourly day bins,
clipped to selected bounds and distinguished by UTC during DST. Top products:
`[{ product_id, name, net_quantity, net_revenue_minor }]`, top ten by net revenue
then product_id. Today plan: `{ local_date, daily_plan_minor, net_revenue_minor,
progress_bps }`; progress may be negative or exceed 10000.
AlertEpisode: `{ episode_id, outlet_id, kind: "stale" or "behind_plan",
local_date, opened_at, resolved_at, facts }`; local_date null for stale.
Facts capture threshold, observed values and responsible recipient at opening.

## Required behavior (later implementation)

One receipt = one sale; revenue derives from its lines. Sale line amount must
exactly equal quantity × unit price, otherwise 422. Returns derive amount from
original price and quantity, refer to one receipt at the same outlet, and cannot
exceed remaining quantity or amount. Reused sale receipt ID with another event ID
is 409. Semantic canonicalization ignores JSON key/line ordering and normalizes
offsets/money spelling; changing business content for the same event_id is 409.
No retry refreshes outlet activity. Sale/return lines are nonempty with unique IDs,
positive whole quantities and nonnegative prices; a return cannot predate its sale.

Window bounds are [start, as_of); occurrence time, not acceptance time, attributes
late events. Returns count at their own occurred_at, reducing revenue/quantities;
receipt_count counts sales only. Average check = net revenue / sale count, null
when count is zero; return-only windows may have negative revenue. Query all
outlets, including zero-sales outlets. Recompute from persisted facts after restart.

Noon assessment once per outlet/local date: net revenue from local midnight up to
12:00 is strictly below 50% of the captured daily plan. Persist both positive and
negative assessments; catch up missed assessments after restart using data then
available. Later settings/late events do not revise that decision. Resolve its flag
at local midnight. Stale baseline is last accepted event or outlet activation time;
accepted events resolve stale episodes, later inactivity opens another episode.
Timeout and refresh/evaluation cadence are environment configuration.

One unique outbox job per episode, inserted atomically with episode opening.
Single email worker, attempts and next_attempt_at; no lease expiry. Recipient and
message are captured, with a stable Message-ID across retries. SMTP delivery is
at least once: a crash after SMTP acceptance but before marking sent can cause a
duplicate. No automatic second job for a continuous episode. No auth or catalogue
CRUD in the one-day scope; deploy-access controls remain later work.
