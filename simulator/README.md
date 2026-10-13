# Outlet simulator

A standalone Node 24 script that talks to the backend only through HTTP. It has
no runtime dependencies and imports no backend code.

## Run

Install the allowed development tools and compile first:

    cd simulator
    npm ci
    npm run build
    npm start -- --outlet "Bishkek Center" --rate 30 --seed demo

The backend must expose GET /api/outlets, GET /api/products and POST /api/events.
Startup reads both catalogues, retries up to four times with 500 ms pauses and
fails with a clear message and exit code 1 if it cannot load them.

Start up to five outlets concurrently:

    npm run start:all -- --duplicate-percent 10 --outage-every-seconds 8 --outage-duration-seconds 3 --seed demo

The launcher selects the first five outlets by the endpoint's stable ID order.
Default rates are 20, 30, 40, 50 and 60 receipts per minute. With --rate 40, rates
are 40, 50, 60, 70 and 80. Other flags are forwarded to every child. Use npm start
for --outlet; start:all rejects that selector. Each output line is prefixed with
the outlet's name.

## Flags

| Flag                      | Default                   | Meaning                                                                   |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| --api-url                 | http://127.0.0.1:3000/api | HTTP(S) API base; SIMULATOR_API_URL also sets it; explicit flag wins      |
| --outlet                  | first outlet              | Exact outlet ID or name                                                   |
| --rate                    | 30                        | Positive receipts per minute                                              |
| --min-lines               | 1                         | Positive integer minimum distinct products                                |
| --max-lines               | 4                         | Positive integer maximum, at least min-lines                              |
| --duplicate-percent       | 0                         | Probability from 0 through 100 of an immediate exact resend after success |
| --outage-every-seconds    | 0                         | Interval between simulated connection losses                              |
| --outage-duration-seconds | 0                         | Duration of each simulated loss                                           |
| --seed                    | unset                     | Reproducible random product, quantity, timing and duplicate choices       |

Pass flags as separate name/value arguments. Unknown/repeated flags, missing
values and invalid combinations exit 1. Use both outage flags together, with
positive finite seconds and duration shorter than interval. Zero for both
disables outages. Rate and outage delays must fit Node's timer range; generated
sale delays have a 1 ms minimum.

Each receipt has 1 through the configured maximum distinct products, limited by
the catalogue size. Startup rejects a minimum larger than the catalogue.
Quantities are whole integers from 1 through 5. Prices are catalogue decimal
strings; amounts use BigInt multiplication. Event, receipt and sale-line IDs use
crypto.randomUUID. occurred_at is the sale's actual millisecond ISO timestamp
with UTC Z. Seeds affect choices, not UUIDs or wall-clock timestamps.

## Sending and shutdown

The interval is approximately 60000 / rate milliseconds with +/-30% jitter.
HTTP requests have a 3 second timeout. Network failures and 5xx responses retry
the exact same serialized body up to five total attempts, with pauses starting
at 500 ms and doubling up to a 5 second cap. No retry creates another identity.

201 increments created; 200 increments duplicates acknowledged. 409/422 log the
error body and increment rejected without retries. Other unexpected non-5xx
statuses count as failed without retries; exhausted transient errors also count
as failed, and the loop continues. An intentional duplicate resends the exact
receipt after success; 200 is expected and counted separately.

During simulated outages the loop keeps generating receipts into an in-memory
FIFO queue. Reconnection flushes them in one burst with original occurred_at
values. Queued and late log lines include event IDs and original timestamps for
checking persisted facts. Late counts successfully acknowledged queued receipts,
once each; intentional duplicate resends do not add to late.

Every ten seconds each instance prints outlet, created, duplicates, rejected,
failed, late and queued totals. Ctrl-C or SIGTERM stops generation, attempts every
pending receipt with the same bounded retry policy, prints final totals and exits 0. The launcher forwards shutdown to its children and waits for them. Startup
errors and unexpected child failures exit 1.

Generation pauses while sending/retrying or flushing; intensity is approximate,
not a throughput guarantee during a real network failure. The queue is not
durable: a forced kill loses pending receipts. If a connection drops after the
backend commits, its retry can return 200; created totals count observed 201
responses, so they cannot prove insert counts in that ambiguous failure case.

## Check

    npm run typecheck
    npm run lint
    npm run format:check
    npm run build
    npm test

Tests use node:test and tiny node:http servers, never a real backend. They cover
receipt fields and exact amounts, flags, retries, rejected responses, duplicates
and FIFO late delivery including shutdown flushing.

Only six existing-tool devDependencies are installed, pinned to backend versions.
Because the allowlist excludes @types/node, src/node.d.ts declares only the Node
APIs used by this package. No backend types or implementation are imported.
