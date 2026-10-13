# MD sales outlet ranking

Retail-chain ranking dashboard backed by PostgreSQL and NestJS. The independent
React frontend loads rankings over HTTP and receives live Socket.IO snapshots.
The backend implements sale/return ingestion, outlet cards/settings, products,
alerts and email delivery; only rankings are connected to the frontend so far.
The interface uses a basic table with minimal CSS. Outlet details come next.

Prerequisites: Node.js 24.11 or newer (observed `v24.21.0`), npm, Docker Engine,
and Docker Compose v2.

## Local infrastructure

Run from the repository root:

```sh
test -f .env || cp .env.example .env
docker compose config --quiet
docker compose up -d --wait
docker compose ps
docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
curl --fail --silent --show-error http://localhost:8025/ -o /dev/null
```

Mailpit UI: <http://localhost:8025>. SMTP: `127.0.0.1:1025`.
PostgreSQL uses the host, port, database, and local credentials in `.env`.
Edit `.env` ports if another local service already uses them.

Stop infrastructure while preserving database data:

```sh
docker compose down
```

## Backend

Run installation from the repository root:

```sh
npm --prefix backend ci
```

The backend reads the root `.env` created above. Shell environment variables take
precedence. `NODE_ENV`, `BACKEND_HOST`, `BACKEND_PORT`, and `FRONTEND_ORIGIN` are
validated at startup, along with `POSTGRES_HOST`, `POSTGRES_PORT`,
`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. An invalid configuration
prevents the app from listening.
`FRONTEND_ORIGIN` must be an HTTP(S) origin without a path or trailing slash.
Do not overwrite an existing `.env` when updating this repository.

Start with rebuilds on source changes:

```sh
npm --prefix backend run start:dev
```

Or build and run the compiled application:

```sh
npm --prefix backend run build
npm --prefix backend start
```

Start the infrastructure first; backend startup requires a reachable PostgreSQL
database. Press Ctrl+C to stop the backend. The API prefix is `/api`, and CORS
uses `FRONTEND_ORIGIN`.

While the backend runs, check the HTTP listener and CORS headers in another terminal:

```sh
curl -i --header 'Origin: http://localhost:5173' 'http://127.0.0.1:3000/api/rankings?window=hour'
curl -i http://127.0.0.1:3000/api/health
```

Expect HTTP 200 with a `RankingSnapshot` from rankings and
`{"status":"ok","database":"up"}` from health. Health executes `SELECT 1`
through a dedicated query class; it returns HTTP 503 if PostgreSQL is unavailable.
With the example env, the CORS header is
`Access-Control-Allow-Origin: http://localhost:5173`.
Check startup validation after stopping the backend:

```sh
BACKEND_PORT=invalid npm --prefix backend start
```

Expect a nonzero exit and an error naming `BACKEND_PORT`.

Similarly, a frontend URL with a path must be rejected:

```sh
FRONTEND_ORIGIN=http://localhost:5173/path npm --prefix backend start
```

Run quality checks and formatting from the root:

```sh
npm --prefix backend run typecheck
npm --prefix backend run lint
npm --prefix backend run format:check
npm --prefix backend run build
npm --prefix backend run format
```

The formatter writes changes; lint reports issues without modifying source.
No packages are installed at the repository root.

## Frontend

Run from the repository root:

```sh
npm --prefix frontend ci
npm --prefix frontend run dev
```

Vite reads the root `.env`. If updating an existing local env, add
`FRONTEND_HOST=localhost` and `FRONTEND_PORT=5173` from `.env.example` without
overwriting your other values. Keep `FRONTEND_ORIGIN` consistent with the frontend
host and port so backend HTTP CORS permits the page.

The HTTP client uses `VITE_API_URL` (including `/api`); Socket.IO uses
`VITE_SOCKET_URL` (backend origin only). Vite validates both URLs and the listener
address at startup/build. Only `VITE_` values are exposed to browser code; use
them for public settings. Restart Vite after changing env values.

Open <http://localhost:5173/> in two tabs while backend and infrastructure run.
The table displays outlet name, rank, exact revenue, receipt count, movement,
leader/last-place indicators, stale and behind-plan flags. Select **Last hour**
(`hour`) or **Business day** (`business_day`). Zero-sales outlets remain visible.
Movement compares consecutive snapshots of the same window; the first snapshot
shows —. It resets on a window change or page reload.

Each tab owns its socket and subscription. The selected window is saved in
localStorage; reload restores the last saved selection for that browser origin.
Changing one tab's selector does not change another tab's active subscription.
Storage failures do not prevent the selector from working. HTTP requests have a
10-second timeout. The page shows loading, empty and error states and provides
**Refresh rankings** to retry HTTP and the live subscription. During a socket
outage the last table remains visible with a disconnected message.

To produce real sales, run the existing simulator in another terminal:

```sh
npm --prefix simulator run build
npm --prefix simulator start -- --outlet 'Almaty Mall' --rate 30 --seed dashboard
```

Both tabs should update without reload. Stop the simulator with Ctrl+C; its
accepted sales remain in PostgreSQL. No database reset is needed.

Quality and production commands:

```sh
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run format:check
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run format
```

The build and preview wrappers select production before Vite reads the shared
backend development env. To inspect the compiled app, stop the development server with
Ctrl+C, then run:

```sh
npm --prefix frontend run preview
```

Preview uses the same configured host/port and CORS origin. Open the same URL in
two tabs; preview and development cannot run on that port together. Press Ctrl+C
to stop frontend and backend servers; `docker compose down` stops infrastructure
while retaining the database volume.

To reproduce configuration rejection:

```sh
VITE_SOCKET_URL= npm --prefix frontend run build
```

Expect exit 1 naming `VITE_SOCKET_URL`. To reproduce reconnection, stop the
backend with Ctrl+C while both tabs remain open, then restart with
`npm --prefix backend start`. Both tabs should show a disconnected status,
retain their rows and regain **Live updates connected.** with a fresh snapshot
without reloading. Use **Refresh rankings** for an HTTP retry.

## Backend checks that preserve existing data

The full `npm --prefix backend test` suite uses `sales_ranking_test`, but some
integration tests truncate that database. It was not run for this dashboard
branch because the task requires preserving all existing database data.
The following checks run all unit tests plus health and timer e2e tests without
truncating or deleting records (the running app can still evaluate alerts):

```sh
cd backend
./node_modules/.bin/tsc -p test/tsconfig.json
POSTGRES_DB=sales_ranking_test node --env-file-if-exists=../.env --test --test-concurrency=1 '.test-dist/test/*.unit-spec.js' .test-dist/test/health.e2e-spec.js .test-dist/test/realtime-rankings-timer.e2e-spec.js
```

Both development and test databases already have the eight backend migrations.
Typecheck and lint include the test files. Tests compile into ignored `.test-dist`.

The operational endpoint remains `GET /api/health`. To check its database outage
response while the backend is running:

```sh
docker compose stop postgres
curl -i --max-time 10 http://127.0.0.1:3000/api/health
docker compose up -d --wait postgres
curl -i --max-time 10 http://127.0.0.1:3000/api/health
```

Expect health HTTP 503 during the outage, then HTTP 200 after PostgreSQL is ready.
This outage procedure was not rerun in the dashboard branch; its sanitized 503
behavior is covered by a unit test.

## Live rankings

Socket.IO shares the HTTP listener at `/socket.io/`, outside the `/api` prefix.
`VITE_SOCKET_URL` is the backend origin, e.g. `http://localhost:3000`.
The shared adapter configures polling CORS from `FRONTEND_ORIGIN`.
The client connects with WebSocket first and enables `tryAllTransports` so
HTTP polling is attempted if WebSocket fails. This avoids cancelling an in-flight
polling upgrade when switching windows immediately after the first snapshot.

On every connection/reconnection the client sends `rankings.subscribe` with
`{ window: "hour" }` or `{ window: "business_day" }`. It checks the acknowledgement
and receives `rankings.snapshot`. Cleanup sends `rankings.unsubscribe` with `{}`
when connected, removes named listeners, cancels timers and disconnects. Delayed
callbacks after cleanup are ignored. A subscription acknowledgement times out
after five seconds; a missing initial snapshot becomes visible after ten seconds.
HTTP and live snapshots share validation. Duplicate/older snapshots cannot
replace newer data or change the movement baseline.

The backend uses a trailing coalescing delay (default 250 ms). Continuous sales
closer together than that delay can postpone a snapshot until the burst becomes
quiet. This is existing backend behavior; no frontend polling loop was added.

The temporary application ping/pong UI, endpoint, events and tests were removed
after real integration passed. Socket.IO's own transport heartbeat is preserved.
For exact response/event shapes, see [API contract](docs/API_CONTRACT.md).

## Database migrations

With infrastructure running, execute from the repository root:

```sh
npm --prefix backend run migration:show
npm --prefix backend run migration:run
npm --prefix backend run migration:show
```

Each command builds first and loads the root `.env` using Node's env-file flag.
Shell values take precedence. The CLI and application share PostgreSQL options
and startup validation. No ts-node dependency is needed; the CLI loads compiled
ESM from `backend/dist/database/data-source.js`.

There are eight migrations, including catalogue seed data, event/receipt/return
facts, alerts and outbox tables. The initial migration is empty; later migrations
create the domain schema. Repeating `migration:run` reports no pending migrations
when all are applied. Startup never synchronizes schemas or applies migrations.
No migrations, rollbacks or database resets were run for this frontend branch.

Inspect local table names and migration history:

```sh
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename;" -c "SELECT name, count(*) FROM migrations GROUP BY name;"'
```

The existing development database has 11 public tables and eight migration
history rows. Existing outlets and historical sales were preserved.

Check database env validation without contacting PostgreSQL:

```sh
POSTGRES_PORT=invalid npm --prefix backend run migration:show
```

Expect a nonzero exit and an error naming `POSTGRES_PORT`.

## Review workflow

`main` is stable and `dev` is integration. Feature branches start from `dev`;
feature work is pushed for review, and the developer approves merges. After each
merge the assistant runs `git checkout dev` and `git pull` before starting the next feature.
A release branch is created from `dev` only at the end.

## Dashboard verification — 2026-10-13

| Check | Result |
| --- | --- |
| Frontend typecheck, lint, format, build | Passed |
| Frontend `npm test` | 10 passed; uses node:test and the existing Vite transform, no added dependencies |
| Backend typecheck, lint, format, build | Passed after demo removal |
| Non-destructive backend tests above | 52 passed, including real PostgreSQL health and periodic Socket.IO snapshots |
| Real PostgreSQL to browser integration | Both windows rendered all 41 existing outlets; Bishkek business-day revenue `55340232221132258342` and 166 receipts matched direct SQL |
| Two actual Playwright Chromium tabs | Real simulator sales changed revenue/counts without reload; independent window subscriptions and saved-window reload passed |
| Backend restart | Both tabs retained rows, showed disconnection, then resubscribed and received fresh snapshots without reload |
| Post-removal live integration | Both tabs received simulator snapshots and displayed rank movement; `/api/ping` returned 404, `/api/health` returned 200 |
| Production preview | Two tabs, rapid window changes, periodic snapshots and exact subscribe/unsubscribe frames passed; fresh pages had no console errors or warnings |
| WebSocket handshake failure | Real polling fallback and periodic snapshots passed with the WebSocket URL deliberately redirected to a missing route |
| Mocked browser edge states | Loading, empty, 503 error, retry recovery, blocked socket and blocked localStorage passed |
| Full backend integration suite | Not run: its truncation hooks conflict with data-preservation requirement |
| Other browsers, deployment, visual design | Not verified; design is deferred |

The real simulator runs added 464 accepted sales (52 Almaty, 412 Moscow), with no
rejections or failures. They remain in PostgreSQL. Historical test outlets were
left in place. MYLOG.md's pre-existing edit was preserved and never staged.

## Earlier foundation verification (historical)

These earlier measurements describe the removed connection demonstration and the
initial empty migration. They are retained as history, not current reproduction
steps or dashboard results. Current commands and results are listed above.

| Check | Command / action | Result |
| --- | --- | --- |
| Node runtime | `node --version` | Passed: v24.21.0 |
| Compose installed | `docker compose version` | Passed: 2.40.3+ds1-0ubuntu1~24.04.1 |
| Docker daemon | `docker info` | Passed outside sandbox; sandbox socket access denied |
| Compose configuration | `docker compose config --quiet` | Passed |
| Infrastructure startup | `docker compose up -d --wait` | Passed outside sandbox |
| Service status | `docker compose ps` | Passed: both services healthy |
| PostgreSQL readiness | `docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` | Passed: accepting connections |
| Mailpit HTTP | `curl --fail --silent --show-error http://localhost:8025/ -o /dev/null` | Passed outside sandbox; sandbox connection failed |
| Infrastructure stop | `docker compose down` | Passed; infrastructure is stopped, data volume retained |
| Patch whitespace | `git diff --check` | Passed |
| Backend ping | Ping curl command above | Passed: HTTP 200, exact pong JSON |
| Database health | Health curl command above | Passed: HTTP 200, status ok and database up |
| Database outage and recovery | Outage commands above | Passed: health 503, ping 200, restored health 200 |
| Backend e2e | `npm --prefix backend test` | Passed: 2 tests, 0 failures |
| WebSocket pong | `npm --prefix backend test` | Passed: application ping returned pong event with exact payload over WebSocket |
| Socket.IO polling and CORS | Realtime polling curl above | Passed: HTTP 200, Engine.IO handshake, configured origin header |
| Browser Socket.IO reconnection | Backend stop/restart steps above | Passed: both development tabs regained pong without reload |
| Backend install | `npm --prefix backend ci` | Passed outside sandbox |
| Backend typecheck | `npm --prefix backend run typecheck` | Passed |
| Backend lint | `npm --prefix backend run lint` | Passed via RTK proxy |
| Backend formatting | `npm --prefix backend run format:check` | Passed; `npm run format` also ran in backend |
| Backend build | `npm --prefix backend run build` | Passed |
| Backend compiled start | `npm --prefix backend start` | Passed outside sandbox with TypeORM connection initialized |
| Backend development start | `npm --prefix backend run start:dev` | Passed in backend-init; not rerun in frontend branch; file-change restart not tested |
| Backend HTTP listener and CORS | Ping curl command above | Passed: HTTP 200 and configured CORS header |
| Invalid backend port | `BACKEND_PORT=invalid npm --prefix backend start` | Passed: expected exit 1 naming BACKEND_PORT |
| Invalid frontend origin | `FRONTEND_ORIGIN=http://localhost:5173/path npm --prefix backend start` | Passed: expected exit 1 naming FRONTEND_ORIGIN |
| Migration run | `npm --prefix backend run migration:run` | Passed: empty migration recorded; repeat reported no pending migrations |
| Migration status | `npm --prefix backend run migration:show` | Passed: pending before run, applied afterward |
| Migration rollback | `npm --prefix backend run migration:revert` | Passed: status became pending; reapplied afterward |
| Schema and history inspection | PostgreSQL inspection command above | Passed: only migrations table, one initial migration row |
| Invalid database port | `POSTGRES_PORT=invalid npm --prefix backend run migration:show` | Passed: expected exit 1 naming POSTGRES_PORT; confirms shell overrides env file |
| Frontend clean install | `npm --prefix frontend ci` | Passed outside sandbox |
| Frontend typecheck | `npm --prefix frontend run typecheck` | Passed |
| Frontend lint | `npm --prefix frontend run lint` | Passed via RTK proxy |
| Frontend formatting | `npm --prefix frontend run format:check` | Passed; formatter also ran |
| Frontend production build | `npm --prefix frontend run build` | Passed; production React selected despite backend development env |
| Frontend dev server | `npm --prefix frontend run dev` | Passed outside sandbox |
| Frontend production preview | `npm --prefix frontend run preview` | Passed outside sandbox with clean startup |
| Missing socket URL | `VITE_SOCKET_URL= npm --prefix frontend run build` | Passed: expected exit 1 naming VITE_SOCKET_URL |
| Source boundary and explicit any | `rg -n -e '\bany\b' -e 'from.*backend' -e 'import.*backend' frontend/src frontend/vite.config.ts frontend/scripts` | No matches (rg exit 1); lint also enforces boundary/explicit-any rules |
| Development two-tab results | Frontend browser steps above | Passed in Playwright Chromium: both tabs showed HTTP pong and WebSocket pong; retry buttons passed |
| Production two-tab results | Preview browser steps above | Passed in Playwright Chromium: both tabs showed both pongs, zero console errors/warnings |
| Narrow layout | Resize a browser tab to 390px wide | Passed: scroll width 390px, both pongs present, no horizontal overflow |
| Other browsers/accessibility audit | Not run | Not verified: outside this skeleton check |

See [ARCHITECTURE.md](ARCHITECTURE.md) for layer rules, [DECISIONS.md](DECISIONS.md)
for rationale, and [DEVLOG.md](DEVLOG.md) for checks and failures.
