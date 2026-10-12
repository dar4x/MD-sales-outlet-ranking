# MD sales outlet ranking

Retail-chain dashboard foundation. This branch prepares infrastructure only;
backend, frontend, and business features are not implemented yet.

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

## Application commands

No application packages exist on this branch. Install, application env setup,
backend/frontend start, tests, builds, migration, and ping commands are unavailable.
Exact commands will be added with each runnable project. Do not run npm commands
from the root. The frontend will not import backend code.

## Review workflow

`main` is stable and `dev` is integration. Feature branches start from `dev`;
the developer reviews, pushes, and merges them. After each merge the assistant
runs `git checkout dev` and `git pull` before starting the next feature.
A release branch is created from `dev` only at the end.

## Verified / Not verified

Updated at the end of every branch. Commands reproduce the checks.

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
| Both projects: typecheck, lint, build | Commands pending application branches | Not verified: not implemented |
| Frontend HTTP and socket in two tabs | Browser steps pending frontend branch | Not verified: not implemented |

See [DECISIONS.md](DECISIONS.md) for rationale and [DEVLOG.md](DEVLOG.md) for checks and failures.
