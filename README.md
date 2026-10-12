# MD sales outlet ranking

Retail-chain dashboard foundation. Local infrastructure, the NestJS backend,
PostgreSQL connection, empty first migration, and ping/health endpoints are
available, including Socket.IO ping/pong. The independent React frontend shows
HTTP ping and WebSocket pong. Business features are not implemented yet.

Prerequisites: Node.js 24.11 or newer (observed `v24.21.0`), npm, Docker Engine,
and Docker Compose v2.

## Local infrastructure

Run from the repository root:

```sh
cp .env.example .env
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
curl -i --header 'Origin: http://localhost:5173' http://127.0.0.1:3000/api/ping
curl -i http://127.0.0.1:3000/api/health
```

Expect HTTP 200 with `{"message":"pong"}` from ping and
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

Open <http://localhost:5173/> in two tabs while the backend and infrastructure
are running. Each tab should show **HTTP ping: pong** and **WebSocket pong: pong**.
Click **Check connections** in each tab and expect both results to return to pong.
Each tab owns its socket; the client uses WebSocket transport and sends a new ping
on connection/reconnection. The frontend has no imports from backend code.

Quality and production commands:

```sh
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run format:check
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

Expect exit 1 naming `VITE_SOCKET_URL`. To reproduce reconnect behavior, stop the
backend with Ctrl+C while both tabs remain open, then restart it using
`npm --prefix backend start`. Both live results should return to pong without
reloading. If an HTTP check failed during the outage, click **Check connections**
after restart to retry it.

Browser checks used two actual Playwright Chromium tabs in development and
production preview. Both cards showed pong in both tabs, and retry buttons worked
in development. Both live connections recovered after a backend restart. Fresh
production pages had zero console errors/warnings; the deliberate outage produced
expected connection errors. A 390px viewport had no horizontal overflow.
These checks do not cover other browsers or a full accessibility audit.

## Backend test and outage check

With PostgreSQL running, execute:

```sh
npm --prefix backend test
```

The two e2e tests boot the actual application, connect to PostgreSQL, and listen
on ephemeral localhost ports. They check `/api/ping` and a Socket.IO ping/pong
exchange over WebSocket, then close their applications and connections.
They use Node's built-in test runner, fetch, and WebSocket; no test-runner or
additional test-client package is required.
TypeScript compiles source and tests into ignored `.test-dist`; the runner loads
root `.env` before importing the app. Typecheck and lint include the test files.

To check a database outage, leave the backend running in another terminal:

```sh
docker compose stop postgres
curl -i --max-time 10 http://127.0.0.1:3000/api/health
curl -i --max-time 10 http://127.0.0.1:3000/api/ping
docker compose up -d --wait postgres
curl -i --max-time 10 http://127.0.0.1:3000/api/health
```

Expect health HTTP 503 during the outage, ping HTTP 200, then health HTTP 200
after PostgreSQL becomes ready. This check does not write domain data.

## Realtime ping/pong

Socket.IO shares the backend HTTP server and uses `/socket.io/`, separate from
the `/api` prefix. Use the backend origin as the client URL: with the example
env, `http://localhost:3000`. Its CORS origin comes from `FRONTEND_ORIGIN`.

Clients emit `ping` with no payload and listen for `pong`, whose payload is
`{"message":"pong"}`. Each reply goes to the requesting client.

With the backend running, check the polling handshake and CORS header:

```sh
curl -i --header 'Origin: http://localhost:5173' 'http://127.0.0.1:3000/socket.io/?EIO=4&transport=polling'
```

Expect HTTP 200, `Access-Control-Allow-Origin: http://localhost:5173`, and an
Engine.IO open packet beginning with `0`. Reproduce the actual WebSocket event
exchange with `npm --prefix backend test`; its protocol helper connects the
Socket.IO namespace before sending the application ping. The frontend uses
socket.io-client rather than this test-only protocol helper.

Socket.IO CORS applies to HTTP polling; browser WebSocket upgrades do not use
CORS checks.

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

The first migration is intentionally empty. TypeORM creates its `migrations`
history table and records `Initialize1791841766550`; no domain schema is created.
After execution, `migration:show` displays `[X]`. Running `migration:run` again
reports no pending migrations. Application startup never synchronizes schemas or
runs migrations automatically.

To revert the latest migration locally, then reapply it:

```sh
npm --prefix backend run migration:revert
npm --prefix backend run migration:show
npm --prefix backend run migration:run
```

For this empty migration, rollback only removes its history row; the history
table remains. Inspect pending migration changes before running later rollbacks.

Inspect local table names and migration history:

```sh
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename;" -c "SELECT name, count(*) FROM migrations GROUP BY name;"'
```

On this foundation's local database, the only public table is `migrations`, with
one history row for the initial migration.

Check database env validation without contacting PostgreSQL:

```sh
POSTGRES_PORT=invalid npm --prefix backend run migration:show
```

Expect a nonzero exit and an error naming `POSTGRES_PORT`.

## Review workflow

`main` is stable and `dev` is integration. Feature branches start from `dev`;
the developer reviews, pushes, and merges them. After each merge the assistant
runs `git checkout dev` and `git pull` before starting the next feature.
A release branch is created from `dev` only at the end.

## Verified / Not verified

Updated at the end of every branch. Commands reproduce the checks.
Results retain earlier branch checks and are updated when rerun. Migration checks
are from `feature/backend-database`; database-outage checks are from `feature/backend-health`.
Backend quality/e2e and frontend/browser checks were run in
`feature/frontend-foundation`. Results describe only checks actually run.
Infrastructure and smoke-test servers are stopped; the applied migration is
retained in the PostgreSQL volume.

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
