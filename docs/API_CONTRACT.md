# Planned API contract

Implemented: sale/return ingestion, product/outlet lists, outlet cards/settings,
HTTP and Socket.IO rankings, stale/noon alerts, and persisted Mailpit email delivery.
Developer-approved decisions, implemented with AI assistance; independent frontend
contracts must not import backend.

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
Quantities/counts/ranks are safe integers. Ranking average check is rounded in SQL to a whole minor-unit decimal string
(halfway values round away from zero), not stored money. Rates use
integer basis points. Single configured currency; no currency conversion.

Business errors: `{ code, message, details? }`; malformed JSON is 400, invalid
business input 422, unavailable database 503 (`database_unavailable`, sanitized
message). Other SQL/application errors keep their normal 500 handling; malformed
JSON keeps 400. Unknown fields are rejected.

## HTTP

| Method/path                                         | Request                                               | Response                           | Status                                                                                                                            | Use case                     |
| --------------------------------------------------- | ----------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| POST /api/events                                    | SaleInput or ReturnInput                              | Acceptance                         | 201 new; 200 identical retry; 409 conflicting event/receipt identity; 422 invalid references, quantities, prices or return limits | IngestEvent                  |
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

No alerts.* events. Alert list is HTTP only. Each client has at most one ranking
window: a valid subscribe leaves its old ranking room and joins the new one.
Invalid payloads acknowledge an error without changing rooms; unknown fields
are rejected. Success acknowledges { ok: true, window }, then GetRankings sends
the initial snapshot only to that client. Unsubscribe leaves both ranking rooms
and acknowledges { ok: true }.
Subscriptions live only in Socket.IO rooms and are lost on disconnect/reconnect;
the client must subscribe again to obtain a fresh initial snapshot. Window belongs
to each client (localStorage), not a stored chain-wide setting. Frontend computes
rank movement from successive snapshots.

Newly created sales and returns request refresh only after commit; duplicate retries and
rejected events never request refresh. Committed settings and alert flag changes use the
same request port. REALTIME_COALESCE_MS defaults to 250: each event request resets
the trailing delay, so a burst's final read includes its last committed event.
If a request arrives during a read, exactly one additional refresh follows that
read (many requests collapse together); refreshes never overlap.
PublishRankings reads only windows that currently have subscribers, once per
window per refresh, and broadcasts that one snapshot to the whole room.

REALTIME_REFRESH_INTERVAL_MS defaults to 5000. Timer ticks request refresh for
rolling expiration and local date changes without ingestion; a tick leaves an
already queued refresh alone so short intervals cannot postpone it forever.
Both delays are positive integer milliseconds, capped at 2147483647. Shutdown
clears both timers. Snapshot failures are logged and later refreshes remain active.
Snapshot UUID/as_of identify each result; no persistent in-memory ranking state.

## Read shapes

RankingSnapshot: `{ snapshot_id, as_of, window, currency, rows: RankingRow[] }`.
RankingRow: `{ outlet_id, outlet_name, time_zone, local_date, starts_at, ends_at,
rank, net_revenue_minor, receipt_count, average_check_minor, previous_revenue_minor,
dynamics_bps, is_leader, is_laggard, stale, behind_plan }`.
Hour dynamics compare preceding hour; business-day previous revenue and dynamics
are null. Descending net revenue, ascending outlet_id gives unique stable ranks.
With at least two outlets and unequal revenues, first/last ranks are leader/laggard.
Both leader/laggard flags are false for one outlet or when all revenues are equal.
Stale and behind_plan reflect persisted episodes; behind_plan expires at local
midnight for the outlet even before the next evaluation tick.

RankingQuery takes an optional as_of instant for deterministic tests; production
omits it and SQL captures COALESCE(as_of, clock_timestamp()) once per response, truncated
to milliseconds so wire timestamps and half-open bounds have the same precision.
This is a port parameter, not an HTTP query field. Missing HTTP window defaults
to business_day; invalid values and unknown query fields receive 422.
Hour starts_at = as_of - 1 hour; ends_at = as_of. Business-day starts_at is the
outlet's own IANA local midnight converted to UTC, never as_of minus 24 hours;
ends_at = as_of. In both windows local_date is the outlet's local date at as_of.
Hour previous_revenue_minor covers [as_of - 2 hours, as_of - 1 hour).
Hour dynamics_bps = round((current - previous) * 10000 / previous) when previous
is positive, otherwise null. Business-day previous revenue and dynamics are null.
Returns subtract server-calculated refunds at their own occurred_at in both current and previous ranking windows.

OutletSummary: `{ outlet_id, name, time_zone }`. Product:
`{ product_id, sku, name, unit_price_minor }` (seeded catalogue).
OutletCard: `{ outlet, settings, as_of, window, metrics, series, top_products,
today_plan }`. Metrics: net revenue, receipt count, numeric average check. Series:
`[{ starts_at, ends_at, metrics }]`; fixed UTC five-minute hour / hourly local-day bins,
clipped to selected bounds and distinguished by UTC during DST. Top products:
`[{ product_id, name, net_quantity, net_revenue_minor }]`, top ten by net revenue
then product_id. Today plan: `{ local_date, daily_plan_minor, net_revenue_minor,
progress_bps }`; progress may be negative or exceed 10000.
AlertEpisode: `{ episode_id, outlet_id, kind: "stale" or "behind_plan",
local_date, opened_at, resolved_at, facts }`; local_date null for stale.
Facts capture threshold, observed values and responsible recipient at opening.

## Required backend behavior

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
receipt_count counts sales only. Ranking average check = round(net revenue / sale count), null
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

## Backend operations

STALE_TIMEOUT_SECONDS defaults to 300 (stale at or beyond the timeout).
ALERT_EVALUATION_INTERVAL_MS defaults to 5000. Evaluation locks each outlet using
the same order as ingestion, persists one episode and one notification atomically,
and requests a coalesced ranking refresh only after commit. Both sale and return
acceptance resolve stale episodes; retries and rejected transactions do not.
Midday catch-up assesses every unassessed civil date since activation using data
then available. Assessment time is persisted separately from its civil-noon
cutoff. Historical behind-plan incidents start at their cutoff and are resolved
at that day's next local midnight; their captured notification remains deliverable.
Both passing and failing assessments are permanent.

SMTP_HOST/SMTP_PORT target Mailpit (defaults 127.0.0.1:1025); SMTP_FROM defaults
to alerts@example.com. OUTBOX_POLL_INTERVAL_MS defaults to 5000 and
OUTBOX_RETRY_DELAY_MS to 1000. Failed sends persist attempts/next_attempt_at and
retry exponentially, capped at five minutes, without generating another job or
Message-ID. Successful jobs are marked sent and not automatically resent.
A PostgreSQL session advisory lock permits only one sending worker at a time,
including overlapping processes; no lease expiry or persistent sending state.
SMTP is plain local SMTP for the agreed Mailpit infrastructure. Process failure
after SMTP accepts but before the sent write can deliver a duplicate with the
same Message-ID. The backend does not claim exactly-once email delivery.
