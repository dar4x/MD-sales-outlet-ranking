# MD sales outlet ranking

Retail-chain dashboard foundation. Local infrastructure, the NestJS backend,
PostgreSQL connection, empty first migration, and ping/health endpoints are
available. Business features, WebSockets, and frontend are not implemented yet.

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
Frontend installation and start commands remain pending its initialization
branch; it will not import backend code. No packages are installed at the root.

## Backend test and outage check

With PostgreSQL running, execute:

```sh
npm --prefix backend test
```

The single e2e test boots the actual application, connects to PostgreSQL, listens
on an ephemeral localhost port, checks `/api/ping`, and closes the app afterward.
It uses Node's built-in test runner and fetch; no test-runner package is required.
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
are from `feature/backend-database`; HTTP health and e2e checks are from
`feature/backend-health`. Frontend checks remain pending.
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
| Backend e2e | `npm --prefix backend test` | Passed: 1 test, 0 failures |
| WebSocket pong | Commands pending realtime branch | Not verified: not implemented |
| Backend install | `npm --prefix backend ci` | Passed outside sandbox |
| Backend typecheck | `npm --prefix backend run typecheck` | Passed |
| Backend lint | `npm --prefix backend run lint` | Passed via RTK proxy |
| Backend formatting | `npm --prefix backend run format:check` | Passed; `npm run format` also ran in backend |
| Backend build | `npm --prefix backend run build` | Passed |
| Backend compiled start | `npm --prefix backend start` | Passed outside sandbox with TypeORM connection initialized |
| Backend development start | `npm --prefix backend run start:dev` | Passed in backend-init; not rerun in health branch; file-change restart not tested |
| Backend HTTP listener and CORS | Ping curl command above | Passed: HTTP 200 and configured CORS header |
| Invalid backend port | `BACKEND_PORT=invalid npm --prefix backend start` | Passed: expected exit 1 naming BACKEND_PORT |
| Invalid frontend origin | `FRONTEND_ORIGIN=http://localhost:5173/path npm --prefix backend start` | Passed: expected exit 1 naming FRONTEND_ORIGIN |
| Migration run | `npm --prefix backend run migration:run` | Passed: empty migration recorded; repeat reported no pending migrations |
| Migration status | `npm --prefix backend run migration:show` | Passed: pending before run, applied afterward |
| Migration rollback | `npm --prefix backend run migration:revert` | Passed: status became pending; reapplied afterward |
| Schema and history inspection | PostgreSQL inspection command above | Passed: only migrations table, one initial migration row |
| Invalid database port | `POSTGRES_PORT=invalid npm --prefix backend run migration:show` | Passed: expected exit 1 naming POSTGRES_PORT; confirms shell overrides env file |
| Frontend typecheck, lint, build | Commands pending frontend branch | Not verified: not implemented |
| Frontend HTTP and socket in two tabs | Browser steps pending frontend branch | Not verified: not implemented |

See [ARCHITECTURE.md](ARCHITECTURE.md) for layer rules, [DECISIONS.md](DECISIONS.md)
for rationale, and [DEVLOG.md](DEVLOG.md) for checks and failures.
