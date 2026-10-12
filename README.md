# MD sales outlet ranking

Retail-chain dashboard foundation. Local infrastructure and the NestJS backend
shell are available. Feature endpoints, database integration, and frontend are
not implemented yet.

Prerequisites: Node.js (observed `v24.21.0`), npm, Docker Engine, and Docker Compose v2.

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
validated at startup; an invalid configuration prevents the app from listening.
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

Press Ctrl+C to stop the backend. Database infrastructure is not required by this
branch. The API prefix is `/api`, and CORS uses `FRONTEND_ORIGIN`.

While the backend runs, check the HTTP listener and CORS headers in another terminal:

```sh
curl -i --header 'Origin: http://localhost:5173' http://127.0.0.1:3000/api
```

With the example env, expect HTTP 404 (no controller yet) and
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
E2e tests and their `npm test` command will be added with the health feature.
Migration commands will be added with database integration. Frontend installation
and start commands remain pending its initialization branch; it will not import
backend code. No packages are installed at the repository root.

## Review workflow

`main` is stable and `dev` is integration. Feature branches start from `dev`;
the developer reviews, pushes, and merges them. After each merge the assistant
runs `git checkout dev` and `git pull` before starting the next feature.
A release branch is created from `dev` only at the end.

## Verified / Not verified

Updated at the end of every branch. Commands reproduce the checks.
Infrastructure results below are from `feature/repo-setup`; backend results are
from `feature/backend-init`. Infrastructure and smoke-test servers are stopped.

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
| Backend ping, DB health, socket pong, e2e, migration | Commands pending backend branches | Not verified: not implemented |
| Backend install | `npm --prefix backend ci` | Passed outside sandbox |
| Backend typecheck | `npm --prefix backend run typecheck` | Passed |
| Backend lint | `npm --prefix backend run lint` | Passed via RTK proxy; initial output wrapper failed |
| Backend formatting | `npm --prefix backend run format:check` | Passed; `npm run format` also ran in backend |
| Backend build | `npm --prefix backend run build` | Passed |
| Backend compiled start | `npm --prefix backend start` | Passed outside sandbox; sandbox listener failed with EPERM |
| Backend development start | `npm --prefix backend run start:dev` | Passed outside sandbox: zero compile errors, listening; file-change restart not tested |
| Backend HTTP listener and CORS | `curl -i --header 'Origin: http://localhost:5173' http://127.0.0.1:3000/api` | Passed outside sandbox in compiled and development modes: HTTP 404 and configured CORS header |
| Invalid backend port | `BACKEND_PORT=invalid npm --prefix backend start` | Passed: expected exit 1 naming BACKEND_PORT |
| Invalid frontend origin | `FRONTEND_ORIGIN=http://localhost:5173/path npm --prefix backend start` | Passed: expected exit 1 naming FRONTEND_ORIGIN |
| Frontend typecheck, lint, build | Commands pending frontend branch | Not verified: not implemented |
| Frontend HTTP and socket in two tabs | Browser steps pending frontend branch | Not verified: not implemented |

See [DECISIONS.md](DECISIONS.md) for rationale and [DEVLOG.md](DEVLOG.md) for checks and failures.
