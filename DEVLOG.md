# Development log

Entries use local time from `date --iso-8601=seconds` and report only checks actually run.

## 2026-10-13T02:29:51+06:00 — feature/repo-setup

- Created `dev` from `main`, then this feature branch from `dev`; left `backup/first-pass` and the pre-existing untracked `MYLOG.md` untouched.
- Added root ignore rules, local env examples, PostgreSQL/Mailpit Compose services, decisions, setup documentation, and a simulator README placeholder. Replaced the original two-line README.
- Passed: `node --version` (v24.21.0), `docker compose version` (2.40.3+ds1-0ubuntu1~24.04.1), `docker info` outside sandbox, `cp .env.example .env`, `docker compose config --quiet`, `docker compose up -d --wait`, `docker compose ps` (both healthy), `docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`, `curl --fail --silent --show-error http://localhost:8025/ -o /dev/null` outside sandbox, `docker compose down`, and `git diff --check`.
- Initial failures: sandbox Git branch creation encountered read-only `.git`; sandbox Docker access was denied; sandbox Mailpit curl could not connect. Approved outside-sandbox retries passed. A file search matched no AGENTS.md and returned exit 1; a draft patch targeting README twice was rejected without changing files and corrected.
- Used Context7 Docker Compose documentation and official PostgreSQL/Mailpit image documentation. No packages were installed.
- Not run: application tests, lint, typecheck, build, migrations, HTTP/socket ping, or two-tab browser checks; application projects do not exist yet. The exact `/status` model label remains unverified because the agent cannot access that command.
- Infrastructure was stopped with the documented command; its named PostgreSQL volume was retained. No push or merge was performed. Waiting for developer review and merge.

## 2026-10-13T03:02:19+06:00 — feature/backend-init

- Confirmed local `dev` contains merge commit `05d5b6b`; the developer had already updated it, so no further pull was needed. Created `feature/backend-init` from `dev`; preserved the untracked `MYLOG.md` and existing branches.
- Added the standalone NestJS package, strict TypeScript/ESM compiler setup, root-env config module and validator, API prefix, env-driven CORS, global DTO validation, shutdown hooks, and ESLint/Prettier scripts. Added exact backend commands and results to README and recorded compatibility decisions.
- Queried npm stable versions and engine/peer constraints. Used NestJS 12.1.3, Config 12.0.1, CLI 12.0.8, TypeScript 6.0.3, ESLint 10.12.0, and typescript-eslint 8.71.2 on Node v24.21.0. Latest TypeScript 7.0.2 was rejected because the CLI uses TypeScript 6 and typescript-eslint requires TypeScript below 6.1.
- Installs passed outside sandbox: `npm install --save-exact @nestjs/common@12.1.3 @nestjs/core@12.1.3 @nestjs/platform-express@12.1.3 @nestjs/config@12.0.1 reflect-metadata@latest rxjs@latest`; `npm install --save-dev --save-exact @nestjs/cli@12.0.8 typescript@6.0.3 @types/node@24.19.2`; `npm install --save-exact class-validator@0.15.1 class-transformer@0.5.1`; and `npm install --save-dev --save-exact eslint@10.12.0 @eslint/js@10.0.1 typescript-eslint@8.71.2 eslint-config-prettier@10.1.8 prettier@3.9.10` (all run in backend). Exact resolved versions are recorded in package.json and package-lock.json.
- Passed: `npm --prefix backend ci`, `rtk proxy npm --prefix backend run lint`, `npm --prefix backend run format:check`, `npm --prefix backend run typecheck`, `npm --prefix backend run build`, and `git diff --check`. Also ran `npm run format` in backend successfully.
- Startup passed outside sandbox for `npm --prefix backend start` and `npm --prefix backend run start:dev`. The documented `curl -i --header 'Origin: http://localhost:5173' http://127.0.0.1:3000/api` returned HTTP 404 and the expected CORS header in both modes. Both smoke-test processes were stopped with Ctrl+C; no endpoint exists yet.
- Negative checks passed: `BACKEND_PORT=invalid npm --prefix backend start` and `FRONTEND_ORIGIN=http://localhost:5173/path npm --prefix backend start` both exited 1 with the expected variable named in the error.
- Initial failures: sandbox npm lookup returned ENOTFOUND; approved external lookup passed. First typecheck rejected CommonJS imports of NestJS 12 ESM packages; changed to native ESM and subsequent checks passed. Sandbox startup failed with listen EPERM; external startup passed. The RTK lint-output wrapper returned a JSON parse failure; the prescribed `rtk proxy npm run lint` rerun passed without source changes.
- Consulted Context7 NestJS configuration/bootstrap and typescript-eslint documentation. No TypeORM, Socket.IO, scheduling, test runner, or business dependencies were added.
- Not run: database integration/migration, ping/health/e2e, WebSocket pong, frontend/browser checks, or watch-mode restart on a source edit; these were not part of this branch. Infrastructure checks were not repeated. Exact `/status` model label remains inaccessible.
- No push or merge was performed. Waiting for developer review and merge before database initialization.

## 2026-10-13T04:10:23+06:00 — feature/backend-database

- Ran `git checkout dev && git pull`, then `git checkout -b feature/backend-database`; preserved the developer's import-grouping changes from `fed344a`. Working tree was clean at branch creation.
- Added TypeORM 1.1.2, Nest adapter 12.0.2, and pg 8.23.1 with `npm install --save-exact @nestjs/typeorm@12.0.2 typeorm@1.1.2 pg@8.23.1` in backend. Checked npm engines/peers against Node v24.21.0; updated the package and lockfile minimum to Node 24.11.0. Context7 supplied TypeORM, Nest adapter, and Node env-file documentation.
- Added shared PostgreSQL options, Nest database module, CLI data source, database env validation, and the first empty migration. Synchronization and automatic migrations are disabled. Migration filename timestamp came from `date +%s%3N` (1791841766550); no Git timestamps were altered.
- Passed: `docker compose config --quiet && docker compose up -d --wait`, `npm --prefix backend start`, and the README CORS curl command after TypeORM initialization. Stopped the backend with Ctrl+C.
- Passed: `npm --prefix backend run migration:show` (pending then applied), `npm --prefix backend run migration:run` (applied, then no pending migrations), and `npm --prefix backend run migration:revert` (reverted, then reapplied). The README PostgreSQL inspection command showed only the migrations table and exactly one initial migration row.
- Passed negative check: `POSTGRES_PORT=invalid npm --prefix backend run migration:show` exited 1 naming POSTGRES_PORT before connecting; shell overrides the env-file value. No unexpected implementation failures occurred. The AGENTS.md file search returned exit 1 because no file matched.
- Passed: `npm --prefix backend ci`, `npm --prefix backend run format`, `rtk proxy npm --prefix backend run lint`, `npm --prefix backend run format:check`, `npm --prefix backend run typecheck`, `npm --prefix backend run build`, and `git diff --check`. Database/network operations ran outside sandbox due previously established restrictions.
- Passed `docker compose down`; the PostgreSQL volume retains the applied empty migration. No domain logic, health/ping feature, WebSocket, frontend, or tests were implemented. Development watch mode and Mailpit HTTP were not rerun on this branch; their previous results are labeled in README. The exact `/status` model label remains inaccessible.
- No push or merge was performed. Waiting for developer review and merge before backend health work.
