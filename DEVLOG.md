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

## 2026-10-13T04:33:01+06:00 — feature/backend-health

- Ran `git checkout dev && git pull`, then `git checkout -b feature/backend-health` from merge `76f29a5`. Stated the branch's use cases/ports in five lines before starting. Added the requested one-page ARCHITECTURE.md: inward dependencies, plain application use cases and ports, Nest token/factory wiring, application transaction boundaries, query models, and required future idempotency/outbox tests. Health remains flat.
- Added ping/health controller, service, response types, and a dedicated SELECT 1 query class. Added shared application configuration and one real HTTP e2e test using the full Nest app, PostgreSQL, Node test runner, and fetch. Added test compilation/typechecking and ignored generated test output. No dependencies were added.
- Passed: `docker compose up -d --wait`, `npm --prefix backend run format`, `npm --prefix backend run typecheck`, `rtk proxy npm --prefix backend run lint`, `npm --prefix backend run build`, `npm --prefix backend run format:check`, and `git diff --check`. Typecheck/lint include test source. Context7 supplied current NestJS and Node test-runner documentation.
- Passed `npm --prefix backend test`: one GET /api/ping e2e test, zero failures; the application and database pool were closed by the test cleanup hook. Database and HTTP tests ran outside the sandbox due previously established network/listener restrictions.
- Passed `npm --prefix backend start`, `curl -i --header 'Origin: http://localhost:5173' http://127.0.0.1:3000/api/ping` (200, exact pong JSON, configured CORS), and `curl -i http://127.0.0.1:3000/api/health` (200, status ok/database up).
- Passed outage check: `docker compose stop postgres`, `curl -i --max-time 10 http://127.0.0.1:3000/api/health` (503, sanitized error), and `curl -i --max-time 10 http://127.0.0.1:3000/api/ping` (200, pong). Then `docker compose up -d --wait postgres` and the health curl returned 200 again without restarting the backend.
- Stopped the smoke-test backend with Ctrl+C; `docker compose down` passed and retained the PostgreSQL volume. No unexpected failures occurred. Install/migration checks, development watch mode, and Mailpit HTTP were not rerun; previous results remain labeled in README.
- Not implemented or tested: business features, business transaction/idempotency/outbox rules, WebSockets, frontend, two browser tabs, or the simulator. Their architecture is documented only. The exact `/status` model label remains inaccessible. No push or merge was performed; waiting for developer review before realtime work.

## 2026-10-13T05:10:10+06:00 — feature/backend-realtime

- Stated use cases/ports in five lines before starting. Ran `git checkout dev && git pull`, then `git checkout -b feature/backend-realtime` from merge `efefba3`. Kept the trivial realtime module flat and added no business use cases or ports.
- Checked npm versions and peers, then installed `@nestjs/websockets@12.1.3`, `@nestjs/platform-socket.io@12.1.3`, and `socket.io@4.8.4` with `npm install --save-exact` in backend. Context7 supplied current Nest gateway/adapter and Socket.IO protocol/CORS documentation.
- Added a gateway/service/pong type and a custom adapter using the validated FRONTEND_ORIGIN. Socket.IO shares the HTTP listener, uses /socket.io/, and replies only to the requesting client. Added a real WebSocket e2e test using Node's built-in WebSocket and the documented Engine.IO/Socket.IO handshake; no test-client dependency was added.
- Failure and workflow exception: the initial adapter typecheck failed because Nest declares full ServerOptions while its Socket.IO factory accepts partial options. I committed `363e03b` before inspecting that failure, so that intermediate commit does not typecheck, contrary to the requested buildable-commit rule. Corrected the checked library boundary in new commit `be2baef`; subsequent typecheck, lint, and build passed. History was not rewritten. The first failed check chain did not reach lint/build.
- Passed after clean install: `npm --prefix backend ci`, `rtk proxy npm --prefix backend run lint`, `npm --prefix backend run format:check`, `npm --prefix backend run typecheck`, `npm --prefix backend run build`, `npm --prefix backend test` (two tests, zero failures), and `git diff --check`. Also ran `npm --prefix backend run format`. Tests close applications and WebSocket connections.
- Passed: `docker compose up -d --wait`, `npm --prefix backend start`, and `curl -i --header 'Origin: http://localhost:5173' 'http://127.0.0.1:3000/socket.io/?EIO=4&transport=polling'` (200, Engine.IO open packet, configured CORS header). `curl -i http://127.0.0.1:3000/api/ping` and `curl -i http://127.0.0.1:3000/api/health` both returned 200 with the expected JSON. Database/network operations ran outside sandbox due established restrictions.
- Stopped the backend with Ctrl+C and passed `docker compose down`; the PostgreSQL volume remains. Migration, outage, development watch-mode, and Mailpit HTTP checks were not repeated; README preserves their previous results.
- Not verified: browser clients, two tabs, reconnection, frontend integration, or exact `/status` model label. No business features, simulator, scheduling, push, or merge were implemented/performed. Documented commands and results in README and decisions in DECISIONS.md; waiting for developer merge before frontend initialization.

## 2026-10-13T05:42:14+06:00 — feature/frontend-foundation

- Followed the revised plan: combined frontend initialization/ping in one branch, with six focused commits; no README branch. Stated use cases/ports in five lines, ran `git checkout dev && git pull`, and created `feature/frontend-foundation` from merge `5f0fdc0`. Markdown consolidation remains the developer's task; no existing branches were deleted or rewritten.
- Added independent React/Vite package, strict TS app/config projects, typed env declarations, ESLint/Prettier, and api/realtime/components/pages/types folders. Added validated HTTP ping, an owned Socket.IO connection, response guards, status cards, and retry control. No backend source/type imports, router, UI framework, business logic, or test-runner dependency was added.
- npm engine/peer checks and Context7 React/Vite/Socket.IO documentation guided React/React DOM 19.3.0, Vite 8.3.4, React plugin 6.1.2, Socket.IO client 4.8.4, TypeScript 6.0.3, and compatible lint packages on Node v24.21.0. Updated .env.example with FRONTEND_HOST/PORT; appended only missing keys to ignored local .env without printing its contents or replacing existing values.
- Passed clean install with `npm --prefix frontend ci`; passed both projects' `run typecheck`, `run lint` (via `rtk proxy`), `run format:check`, and `run build` using their respective npm prefixes. Frontend formatting also ran. `npm --prefix backend test` passed two tests with zero failures. `git diff --check` passed. README contains exact runnable commands; backend install/migration/outage checks from previous branches were retained rather than rerun.
- Real browser checks used two simultaneously open Playwright Chromium tabs (HeadlessChrome/155.0.0.0) at http://localhost:5173/. In dev and production preview, both tabs showed HTTP ping pong and WebSocket pong with success status. Clicked Check connections in each development tab and observed both pongs again. Fresh pages after fixes had zero console errors/warnings. At 390x844, the measured document width was 390px with no horizontal overflow and both pong outputs present.
- Stopped/restarted the backend while both dev tabs remained open: live cards reported unavailable and both regained pong without reload. A failed HTTP retry showed its error and recovered through Check connections after restart. Connection-refused console errors during the deliberate outage were expected; a cancelled initial HTTP request in StrictMode was also expected and did not change UI state.
- Corrections: the first dev load warned about a socket closed before opening; cancellable microtask scheduling removed the warning. Shared root NODE_ENV=development produced a development React bundle and a preview config warning; small build/preview wrappers now set production before Vite resolves configuration. Build passed and checked development/DB markers disappeared from assets. No additional env helper dependency or shell-specific syntax was needed. Two README patches were rejected for mismatched context without changing files; corrected after reading exact text.
- Passed negative config check: `VITE_SOCKET_URL= npm --prefix frontend run build` exited 1 naming VITE_SOCKET_URL. `rg -n -e '\bany\b' -e 'from.*backend' -e 'import.*backend' frontend/src frontend/vite.config.ts frontend/scripts` returned no matches (expected rg exit 1); lint enforces explicit-any and backend-import restrictions. Bundle scan for React development markers and the sample database-password marker also returned no matches.
- Passed `docker compose up -d --wait`, backend start, frontend dev, and production preview. Closed only the two verification tabs, stopped own servers with Ctrl+C, and passed `docker compose down`; retained the database volume. Added .playwright-mcp to ignore generated verification artifacts.
- Not verified: other browsers, a full accessibility audit, backend watch-mode restart, or the exact model label from /status (no session/model status tool is exposed). Business features, simulator, scheduling, SMTP worker, push, merge, and release branch are not implemented/performed here. Waiting for developer review and merge; README, DECISIONS.md, and this log were updated within this branch.

## 2026-10-13T08:21:11+06:00 — feature/backend-domain-design

- Received explicit approval for step 2 with eight simplifications and accepted
  at-least-once email delivery. Stated use cases/ports in five lines, checked clean
  dev and Node v24.21.0, ran git pull (already up to date), and created the branch
  from feb4c6a. No push, merge, branch deletion, timestamp override or package install.
- Added docs/API_CONTRACT.md and docs/DOMAIN_MODEL.md, pure domain records, query
  models, application port interfaces, transaction-scoped port bundle and empty
  infrastructure/presentation folders. No use-case implementation, module wiring,
  migration, endpoint, gateway, business test or runtime change. README.md and
  ARCHITECTURE.md were not modified; the existing dependency layers still apply.
- Approved changes: no alerts.* socket events, flags inside ranking rows; no
  outbox leases; hour dynamics only; last-write-wins settings; quantity-derived
  return amount; validated sale line total; unique ranks ordered by outlet_id;
  coalesced ranking refresh around configurable 250 ms. Recorded stable Message-ID
  and the possible duplicate after SMTP acceptance followed by a worker crash.
- Read only git show backup/first-pass:src/rankings.ts and both migrations
  db/migrations/001_initial.sql and 002_outlet_activity.sql. Lessons: occurred_at
  filtering, SQL numeric average, per-outlet local-midnight conversion, left joins
  for zero-activity outlets and acceptance-time activity. These old queries were
  not executed here. Re-read before future schema implementation; do not blindly
  retain fractional quantities, old uniqueness scope or in-memory counters.
- Passed: npm --prefix backend run typecheck (twice, including existing tests),
  rtk proxy npm --prefix backend run lint, npm --prefix backend run format:check,
  npm --prefix backend run build, git diff --check. Used the installed backend
  Prettier binary to format only new docs/types. No failed checks. No current
  Docker, browser, HTTP, WebSocket, migration or business behavior was tested;
  the changes are type-only. Frontend checks were not rerun (frontend unchanged).
- Exact time recorded with date --iso-8601=seconds. The precise /status model
  label remains unavailable; DECISIONS preserves that limitation honestly.

### Developer reasoning (verbatim prompt log)

"по бизнес логике здесь один большой эндпоинт который высылает ивенты, а вот
по интерфейсу уже масса use case которые делают настройку дают нужные данные.
я думаю здесь есть смысл создать один агрегат и к нему подстроить методы,
тогда в папках юзкейсах хэндлерах и репозитории будет обращение к одному
агрегату и не будет много лишнего кода"

Verdict: the desire to avoid redundant code is sound, but one endpoint is not one
aggregate. A chain-wide aggregate couples independent outlet traffic, return
validation, read queries and notification delivery. Two small aggregates
(SaleReceipt and Outlet), one shared ingestion orchestration, read-query ports
and atomic episode/outbox records give less coupling without redundant handlers.

- Final scope check: git diff --name-only dev showed no README, architecture,
  existing runtime or dependency changes. backend/node_modules/.bin/prettier
  --check docs/API_CONTRACT.md docs/DOMAIN_MODEL.md passed. Source scan
  `rg -n 'any|@nestjs|typeorm' backend/src/events backend/src/rankings backend/src/outlets backend/src/products backend/src/alerts backend/src/notifications backend/src/shared`
  found no matches (expected exit 1, not a failed quality check).

## 2026-10-13T14:06:08+06:00 — feature/events-ingestion review fixes

- Stayed on feature/events-ingestion. Existing MYLOG.md edits were present at
  setup and left untouched/uncommitted. No push, merge, force push, branch deletion
  or artificial commit dates. git ls-files CLAUDE.md returned no tracked file;
  the file was also absent locally, so nothing was added or committed for it.
- Original setup: docker compose up -d --wait passed (PostgreSQL and Mailpit
  healthy). npm --prefix backend run migration:run failed on existing orphan
  accepted_events.outlet_id references when adding the outlet FK; the migration
  transaction rolled back. npm --prefix backend test failed on missing
  sale_receipts. No original rows were deleted, patched or constraints weakened.
- Created a separate local review database with
  `docker compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" sales_ranking_fix_review_20261013'`.
  Applied migrations with
  `POSTGRES_DB=sales_ranking_fix_review_20261013 npm --prefix backend run migration:run`.
  Before any source fix or test data, all five new migrations reverted successfully
  using the same POSTGRES_DB prefix and `npm --prefix backend run migration:revert`
  five times. Reapplied all five with migration:run successfully. This round-trip
  used empty business tables; downgrading bigint quantities containing values
  outside integer range was not attempted. Original database remains blocked.
- Real unchanged baseline in the migrated review database:
  `POSTGRES_DB=sales_ranking_fix_review_20261013 npm --prefix backend test`
  passed 74 tests, zero failures. Infrastructure/database commands required
  execution outside the sandbox. Root .env was not edited.
- Parser fixes: non-object/array line elements give 422 invalid_request;
  timestamp fractions beyond three digits give 422 timestamp_precision;
  all five UUID fields are lowercased after shape validation and before domain
  duplicate checks/hash creation. Added unit and HTTP regression tests for nested
  lines, precision, normalized retry acceptance and case-only duplicate line IDs.
- Exception filter now sanitizes recognized direct/wrapped connection failures
  as 503 database_unavailable; other errors delegate to Nest's BaseExceptionFilter.
  Context7 Nest documentation supplied the existing-filter fallback. HTTP tests
  inject connection errors and unrelated SQL/application errors, checking sanitized
  503 and preserved 500 responses. No real PostgreSQL outage was performed.
- Extracted exactly two private IngestEvent methods: handleRetry and checkProducts.
  No new classes, files, abstractions, dependencies or isolation override. Added
  one integration test for the same event_id concurrently at two different outlets:
  one created, one EventConflictError, one ledger row and no losing receipt/lines.
- Intermediate tests passed 76, 78, 81, 83 and finally 84 cases as fixes were added.
  One intermediate lint run failed on two unbound method saves in the HTTP tests;
  binding the saved method fixed it before the exception-filter commit. Typecheck
  and subsequent lint/test runs passed. No failed version was committed.
- Final checks passed: npm --prefix backend run typecheck;
  rtk proxy npm --prefix backend run lint; npm --prefix backend run format:check;
  npm --prefix backend run build; and
  POSTGRES_DB=sales_ranking_fix_review_20261013 npm --prefix backend test
  (84 tests, zero failures). New API/domain docs passed
  backend/node_modules/.bin/prettier --check docs/API_CONTRACT.md docs/DOMAIN_MODEL.md;
  git diff --check passed. Used installed Prettier to format changed source/tests.
- Updated API_CONTRACT.md: sale-only implemented scope, pending returns with
  current 422 unsupported_kind, nonnegative acceptance amounts/free sales,
  millisecond precision, lowercase UUID normalization and sanitized DB failure
  body. DOMAIN_MODEL.md records matching time/UUID rules. README and architecture
  layers were not changed; frontend checks were not rerun (frontend unchanged).
- Deliberately skipped parallel HTTP conflicting-payload coverage and test-data
  cleanup as requested. Tests retained their records in the separate review DB;
  no databases were dropped. PostgreSQL and Mailpit remain running for re-review.
  The exact /status model variant was not accessible or newly asserted.

## 2026-10-13T14:27:46+06:00 — feature/events-ingestion final main-database verification

- Developer explicitly authorized resetting this project's disposable Docker
  volume, committing, pushing feature/events-ingestion and opening a PR into dev.
  Confirmed the feature branch and preserved the pre-existing MYLOG.md change.
  Did not edit/commit MYLOG.md, README.md or CLAUDE.md, touch backup/first-pass,
  change timestamps, rewrite history, delete Git refs, or merge anything.
- Passed `docker compose down -v && docker compose up -d --wait`; only this
  Compose project's PostgreSQL volume was removed/recreated. PostgreSQL and
  Mailpit became healthy. This reset also removed the earlier isolated review DB.
- Passed `npm --prefix backend run migration:run`: all six migrations applied
  to the fresh main database. Before tests inserted large quantities, passed
  `npm --prefix backend run migration:revert` once (newest WidenSaleLineQuantity),
  then `npm --prefix backend run migration:run` reapplied it. No POSTGRES_DB
  override was used. The preceding fix-phase entry separately records all five
  new migrations reverting/reapplying on empty business tables.
- Main-database baseline passed: `npm --prefix backend run typecheck`,
  `rtk proxy npm --prefix backend run lint`,
  `npm --prefix backend run format:check`, `npm --prefix backend run build`,
  and `npm --prefix backend test` (84 tests, seven suites, 84 passed, zero failed,
  cancelled, skipped or todo). No unexpected failure required a code fix.
- Ran `/tmp/events-ingestion-mutations.py` to temporarily remove one fix at a
  time and run the entire `npm --prefix backend test` suite without DB overrides.
  Each run compiled the changed source. try/finally restored the exact original
  source bytes; no mutation was committed. Temporary output logs were written
  only under /tmp, not in the repository. The script also compared protected-file
  SHA-256 hashes and found no change.

| Removed fix | Tests that actually failed | Result |
| --- | --- | --- |
| non-object line guard | returns 422 for an array used as a sale line; rejects non-object line elements instead of throwing TypeError | exit 1; 82 passed / 2 failed; HTTP 500 instead of 422 and TypeError |
| millisecond precision check | returns 422 timestamp_precision for sub-millisecond input; rejects timestamp precision beyond milliseconds with its own code | exit 1; 82 passed / 2 failed; HTTP 201 instead of 422 and missing expected exception |
| five UUID lowercase conversions | returns the original acceptance when UUID casing changes; returns 422 for sale line IDs differing only in UUID casing; normalizes every UUID to lowercase | exit 1; 81 passed / 3 failed; HTTP 409 instead of 200, HTTP 500 instead of 422 and uppercase UUID retained |
| connection-failure 503 branch | sanitizes database connection failures as 503 | exit 1; 83 passed / 1 failed; HTTP 500 instead of 503 |

- After restoration, `git diff --exit-code -- backend docs/API_CONTRACT.md
  docs/DOMAIN_MODEL.md ARCHITECTURE.md` passed and `git diff --check` passed.
  The only existing working-tree difference was MYLOG.md; it was not erased to
  claim a globally clean working tree. Source/code diff was clean.
- Final restored checks passed again: `npm --prefix backend run typecheck`,
  `rtk proxy npm --prefix backend run lint`,
  `npm --prefix backend run format:check`, `npm --prefix backend run build`,
  `npm --prefix backend test` (84 tests, seven suites, 84 passed, zero failed,
  cancelled, skipped or todo), all on the main database without overrides.
- Self-reviewed `git log --oneline fd1b24d..HEAD` and the relevant implementation /
  contracts: findings 1–5 are covered by parser normalization/validation and
  sanitized connection errors; finding 8 has the two requested private methods
  handleRetry/checkProducts; finding 9 documents pending returns. No new
  dependencies, abstractions or additional production fixes were necessary.
- Not verified: a real database outage, browser sales UI, returns, ranking SQL,
  alert/outbox worker behavior, live broadcasts, or intermediate historical
  commit builds. SQL-error preservation uses real HTTP with injected use-case
  errors, not a live server outage. Cross-outlet contention, identity conflicts,
  original retry acceptance, money limits, atomic rollback and activity behavior
  passed their existing real-database tests. Test-data cleanup and parallel HTTP
  differing-payload coverage remain intentionally deferred by the developer.
- The entry timestamp came from `date --iso-8601=seconds`. Docker services remain
  running for review. Publication follows this verification-record commit:
  `git push -u origin feature/events-ingestion`, then `gh --version` and
  `gh auth status`; create a PR with base dev only if gh is installed/logged in.
  This entry does not claim those later commands already succeeded.


## Rankings — 2026-10-13T15:07:15+06:00

- Continued feature/rankings after `git status --short --branch` and
  `git log --oneline -3`; initial HEAD was aaba509. The existing MYLOG.md
  change was left untouched and excluded from every commit.
- Added GetRankings, the existing RankingQuery port's optional asOf,
  PostgresRankingQuery and thin rankings HTTP presentation/module wiring.
  One parameterized SQL statement captures the clock once, calculates
  occurrence-time half-open windows, all-outlet totals, rounded decimal-string
  averages, stable unique ranks, preceding-hour dynamics and flags.
  Business-day midnight uses each outlet's IANA zone, including DST.
  Return ingestion remains pending with one empty return_totals CTE;
  stale and behind_plan remain false.
- Test scripts override POSTGRES_DB with sales_ranking_test and use
  --test-concurrency=1. assertTestDatabase rejects other databases before test
  connections. Rankings beforeEach truncates only sale_lines, sale_receipts and
  accepted_events; outlet enumeration is checked against SELECT outlet_id FROM
  outlets. The single-outlet test uses a rolled-back temporary view and never
  deletes catalogue rows. No command migrated, reset or ingested into dev.
- `cd backend && npm run test:db:setup` passed: connects to postgres,
  creates sales_ranking_test if missing and applies migrations to that database.
  Baseline `npm test`: 85 tests passed, zero failed.
- Observed red tests before implementation: average null versus
  "4611686018427387904"; ranks all zero versus 1..N; business-day hour start
  versus outlet midnight; dynamics null versus previous revenue "3".
  Each feature's matching tests passed after implementation in its small commit.
  Setup initially failed TS2345 for the union of TypeORM driver options;
  narrowing the driver to postgres fixed it before connecting.
  Backend lint initially reported no-floating-promises on the guard test;
  awaiting it() fixed the error, and lint/typecheck passed again.
- Final restored backend checks all exited 0:
  `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `npm run build`, `npm test`.
  Final suite: 97 tests, 9 suites, 97 passed, 0 failed/cancelled/skipped/todo,
  duration 6170.25189 ms. Includes real PostgreSQL rankings and HTTP POST sales
  followed by GET rankings; ties, exact bigint-limit averages, both hour
  boundaries, two zones' midnight and late events, spring/autumn Berlin DST,
  previous-hour bounds, equal/one-outlet flags and HTTP query validation.
- Frontend `npm run typecheck`, `npm run format:check` and
  `npm run build` exited 0; Vite built 54 modules in 246 ms.
  First frontend lint output was garbled by RTK;
  `rtk proxy npm run lint` exited 0 with no warnings/errors.
- Mutation checks compiled each changed source with
  `node_modules/.bin/tsc -p test/tsconfig.json` and ran
  `POSTGRES_DB=sales_ranking_test node --env-file-if-exists=../.env --test
  --test-name-pattern=<matching test> .test-dist/test/rankings.integration-spec.js`.
  Inclusive end: 1 test failed, "1009" versus "10".
  UTC midnight: 1 test failed, 00:00Z versus previous-date 18:00Z.
  Descending outlet_id: 1 test failed, reversed outlet ordering.
  All three exited 1. A Python try/finally restored the exact source bytes;
  no mutation was committed. Logs remain under /tmp/rankings-mutation-*.log.
  After restoration `git diff --exit-code -- backend docs .env.example DEVLOG.md`
  and `git diff --check` exited 0, then the full backend checks passed again.
  The working tree still contains the pre-existing MYLOG.md edit.
- Contract decisions: requested docs changes authorize whole-unit averages and
  no flags when revenues are all equal, replacing the prior fractional/tied
  behavior; DOMAIN_MODEL wording was aligned. Missing window continues to default
  to business_day because API_CONTRACT was explicitly the source of truth and
  its default was not in the requested contract change list. Bad/empty/repeated
  window values and unknown fields get 422. CURRENCY is validated as KGS with a
  KGS default and documented in .env.example.
- Not verified: live database outage, browser rankings UI, return ingestion,
  alert evaluation, live ranking broadcasts, production deployment, performance
  under load, or each historical intermediate commit in isolation.
- `gh auth status` confirmed authenticated dar4x access.
  This entry uses real `date --iso-8601=seconds` output.
  Push and PR creation follow this log commit; their success is not claimed here.


## Realtime rankings — 2026-10-13T15:27:35+06:00

- Started with git status --short --branch; checked out dev and ran
  git pull --ff-only. gh pr view 10 --json state,mergedAt,mergeCommit
  showed MERGED at a71f5c119f7ad6b960425fa0d20c557a7cc6ddaa,
  mergedAt 2026-10-13T09:10:53Z. git log --oneline -8 and rankings source
  confirmed the merge. Created feature/realtime-rankings from dev.
  The pre-existing MYLOG.md edit was left untouched and never staged.
- Added validated REALTIME_REFRESH_INTERVAL_MS=5000 and REALTIME_COALESCE_MS=250
  defaults and .env.example entries. Both are positive integer milliseconds
  capped at 2147483647.
- Renamed the existing RankingRefresh port to RankingRefreshRequester rather
  than adding a competing port. Added a plain CoalescedRankingRefresh adapter,
  PublishRankings use case and RankingsGateway. Nest factories wire the layers;
  application code imports neither Nest nor Socket.IO.
- Subscriptions use only Socket.IO rooms, one ranking window per client.
  Subscribe acknowledges then sends GetRankings' initial snapshot to that
  client only. Invalid subscribe/unsubscribe payloads acknowledge errors without
  changing rooms. Reconnect loses the subscription. PublishRankings computes
  once for each subscribed window and broadcasts that snapshot to its room.
  Existing flat realtime ping/pong was unchanged and its real WebSocket test passes.
- IngestEvent now awaits TransactionRunner and calls the requester only for
  outcome created, after commit. A separate pool connection test observes the
  committed receipt when request() is called. Retries and 409/422 rejections
  produce no ranking refresh. Existing standalone ingestion tests explicitly
  supply a no-op request callback.
- The event delay is trailing: each queued event request resets the timeout.
  Requests during a running read set one pending follow-up; reads never overlap.
  Refresh failures are logged and later refreshes continue. Periodic ticks
  request rolling-window refresh, leave already queued delays alone, and both
  timers are cleared on shutdown.
- Real Socket.IO tests reuse the existing frontend socket.io-client dependency
  via createRequire; no dependency or lockfile was added or changed.
  Set short test configuration before dynamically importing AppModule so
  ConfigModule validates the intended values. Database remains sales_ranking_test;
  npm test still forces this name and --test-concurrency=1. New rankings tests
  clear only sale_lines, sale_receipts and accepted_events, guarded by
  assertTestDatabase. No development database migration/reset/ingestion was run.
- Observed failures before fixes: missing reflect-metadata produced
  TypeError: Reflect.getMetadata is not a function; coalescer tests initially
  failed TS2307 before implementation, then TS2345 because assert.fail did not
  accept unknown. Explicit error-to-string assertion callbacks fixed it.
  Subscribe tests timed out before gateway implementation; the created-sale
  snapshot and timer-only tests timed out before their hooks were implemented.
  A new short-interval test saw zero refreshes when ticks reset the delay forever;
  leaving a queued timeout alone fixed it. Malformed unsubscribe returned
  ok:true before validation; the added test passed after the fix.
- Initial config/coalescer commits were followed by corrective test commits
  because the first shell commands continued after a failed check. Subsequent
  mutation/verification commands used explicit checks or set -e.
  No history was rewritten and tests were neither deleted nor weakened.
- Initial npm run lint output was garbled by RTK. Re-ran rtk proxy npm run lint:
  10 errors (require-await in publisher/test callbacks and inline import type).
  Explicit Promise.resolve/Promise.reject returns and a type-only client module
  import fixed these errors; subsequent lint/typecheck exited 0.
- Full pre-mutation backend checks passed: npm run typecheck,
  rtk proxy npm run lint, npm run format:check, npm run build, npm test.
  Baseline: 115 tests, 10 suites, 115 passed, zero failed/cancelled/skipped/todo;
  duration 10502.09635 ms.
- Mutation checks used a temporary Python script with try/finally restoration.
  Each source mutation was compiled using node_modules/.bin/tsc -p test/tsconfig.json,
  then tested using POSTGRES_DB=sales_ranking_test node
  --env-file-if-exists=../.env --test --test-name-pattern=<matching test>
  .test-dist/test/<matching test file>.js. All four compiled and each test exited 1:
  removing coalescing: 50 refreshes versus 1;
  refreshing duplicates: 3 snapshots versus 2;
  removing the pending trailing read: 1 refresh versus 2;
  removing periodic request(): timer-only test failed with Snapshot timeout.
  Logs are /tmp/realtime-rankings-mutation-*.log; no mutation was committed.
- Restored source passed git diff --exit-code -- backend docs .env.example DEVLOG.md
  and git diff --check. Only the original MYLOG.md edit remained in the working
  tree. Then reran all backend checks: npm run typecheck, rtk proxy npm run lint,
  npm run format:check, npm run build, npm test; all exited 0.
  Final suite: 115 tests, 10 suites, 115 passed, zero failed/cancelled/skipped/todo;
  duration 10510.616503 ms.
- The final concurrency test sent 50 parallel HTTP sales, ten each at five
  outlets, to two subscribed clients. Observed one broadcast per client.
  Both final snapshots were identical, and each matched current GET rankings'
  outlet revenue, receipt counts and ranks (excluding time/identity comparison
  against HTTP). Timer-only refresh, reconnect, room switching, malformed input,
  initial client-only snapshot, error recovery, non-overlap and cleanup tests pass.
- Frontend checks also exited 0: npm run typecheck, rtk proxy npm run lint,
  npm run format:check, npm run build. Vite built 54 modules in 232 ms.
- Updated API_CONTRACT in a separate docs commit for initial snapshots,
  one-window rooms, reconnect loss, both config keys, trailing coalescing,
  no-overlap, timer behavior and error recovery. DOMAIN_MODEL port names now
  match RankingRefreshRequester. No prompt/contract conflict was found.
- Not verified: actual browser-tab UI, production deployment, live database
  outage recovery (unit callback rejection was used), distributed Socket.IO
  adapters/multiple processes, long-running load behavior, returns/alerts,
  or isolated success of every intermediate historical commit.
- gh auth status confirmed authenticated dar4x access. Timestamp above is actual
  date --iso-8601=seconds output. Push and PR creation follow this log commit;
  their success is not claimed in this entry.


## Simulator and catalogue reads — 2026-10-13T16:04:54+06:00

- Ran git status --short --branch, git checkout dev and git pull --ff-only.
  gh pr view 11 --json state,mergedAt,mergeCommit confirmed MERGED:
  cce54c1b01eb6b18719b2b12f55e7e2afb444a69 at 2026-10-13T09:32:28Z.
  git log --oneline -5 showed the realtime rankings merge. Created
  feature/simulator from dev. The existing MYLOG.md edit stayed untouched and
  was excluded from every commit.
- Added ListProducts using the existing ProductCatalogueQuery and PostgreSQL
  adapter; the controller encodes bigint catalogue prices as decimal strings.
  Added ListOutlets using OutletQuery and a PostgreSQL adapter returning only
  outlet_id, name and time_zone. Removed the unused planned OutletQuery.find
  reservation so this port only requires the implemented list operation; no
  settings/card route or speculative find adapter was added.
  Both real HTTP tests first failed 404 versus 200, then passed by comparing
  the response with SQL against sales_ranking_test.
- Added a standalone simulator package with strict TypeScript, no any and no
  backend imports. Only the six allowed devDependencies were installed at
  backend's exact versions: typescript, eslint, @eslint/js, typescript-eslint,
  eslint-config-prettier and prettier. No runtime dependency was added.
  npm install --ignore-scripts installed 98 packages, reported zero vulnerabilities.
  Because @types/node was outside the allowlist, src/node.d.ts declares only
  the Node APIs used. Package/versions/no-import audit passed.
- Scaffold typecheck, lint, format:check, build, test, start and start:all ran
  successfully; scaffold test count was 1. Builder tests preceded implementation
  (TS2307 for the missing module), then covered fresh lowercase UUIDs, distinct
  products, whole quantities, exact BigInt amounts, UTC millisecond timestamps,
  bounds and seeded choices. CLI tests similarly preceded parsing code and
  cover defaults/env overrides, malformed flags and invalid combinations.
- Sender tests use tiny node:http servers, never backend imports or a live
  database. They verify exact serialized body reuse after 503 and dropped
  connection, terminal 409/422 with logged error bodies, duplicate acknowledgments
  and bounded attempt exhaustion. Startup loads both HTTP catalogues, retries
  four times at 500 ms intervals and fails clearly if unavailable.
  Sale transport uses a 3 second timeout and five total attempts, with 500 ms
  exponential pauses capped at 5 seconds; 409/422 never retry.
- Implemented jittered scheduling, ten-second stats and SIGINT/SIGTERM shutdown.
  Intentional duplicates preserve the complete receipt. Simulated outages
  keep generating into a FIFO queue; flush preserves original occurred_at,
  including a shutdown flush. Late counts successful queued receipts once each.
  The launcher uses child_process, starts up to five outlets with distinct rates,
  prefixes output, forwards flags and waits for children on shutdown.
- Observed feature/fix failures before correction: formatting checked generated
  dist files and reported eight warnings; .prettierignore fixed that without
  changing source tests. The initial duplicate edit sent one body instead of two;
  the test caught it before commit, and the completed resend path passed.
  The outage test observed no queued receipts before queue implementation.
  No test was weakened or deleted.
- Simulator README documents commands, flags, retry/outage semantics and limits.
  API_CONTRACT implementation status now includes the two lists; its request
  and response shapes required no change. No prompt/contract conflict was found.
  Seeds reproduce choices, not UUIDs/timestamps. Generation pauses during sending
  and retry/flush; the queue is in memory. Observed 201 totals cannot prove all
  inserts if a real connection is lost after commit and the retry returns 200.
- Full pre-mutation backend checks all exited 0: npm run typecheck,
  rtk proxy npm run lint, npm run format:check, npm run build, npm test.
  Baseline: 117 tests, 10 suites, 117 passed, zero failed/cancelled/skipped/todo;
  duration 12188.566606 ms. Tests force sales_ranking_test and serial files.
- Full pre-mutation simulator checks all exited 0: npm run typecheck,
  rtk proxy npm run lint, npm run format:check, npm run build, npm test.
  Baseline: 12 tests, zero suites, 12 passed, zero failed/cancelled/skipped/todo;
  duration 2749.310096 ms.
- Mutation checks compiled each changed simulator using node_modules/.bin/tsc,
  then ran node --test --test-name-pattern=<matching test>
  dist/test/<matching file>.unit-spec.js. Each compiled and exited 1:
  new retry event_id caused exact-body inequality;
  late send-time substitution caused original occurred_at inequality;
  new intentional-duplicate event_id caused exact-body inequality.
  try/finally restored exact source bytes, followed by a fresh simulator build.
  Logs are /tmp/simulator-mutation-*.log; no mutation was committed.
  git diff --exit-code -- backend simulator docs .env.example DEVLOG.md and
  git diff --check passed after restoration.
- Live check used /tmp/simulator-live-check.py and a real Socket.IO client in
  /tmp/simulator-live-observer.mjs, reusing the installed frontend client.
  docker compose up -d --wait succeeded; PostgreSQL/Mailpit were already running
  and their container IDs did not change. npm run migration:run in backend
  succeeded with no migrations pending. Started backend with
  node --env-file=../.env dist/main.js, subscribed the observer to hour, then ran:
  npm run start:all -- --duplicate-percent 10 --outage-every-seconds 8
  --outage-duration-seconds 3 --seed live-check.
- The first live harness completed 30 seconds but failed its launcher-PID match:
  Cannot find our launcher process. It incorrectly required argv without flags.
  Its finally cleanup stopped all started process groups. Corrected only the
  throwaway harness to recognize argv with flags and reran against fresh counts;
  the first run's receipts remained in dev. No database was reset or cleaned.
- Successful live run generated for 30 seconds; elapsed through final checks was
  31.584 seconds. psql before/after counts came from:
  SELECT o.outlet_id, count(s.receipt_id) FROM outlets o LEFT JOIN sale_receipts s
  USING (outlet_id) GROUP BY o.outlet_id, wrapped in json_object_agg for capture.
  Every outlet's delta exactly equaled its simulator-created count:

| Outlet | Before | After | New rows | Created | Duplicates | Late |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bishkek Center | 156 | 166 | 10 | 10 | 1 | 2 |
| Almaty Mall | 20 | 35 | 15 | 15 | 2 | 6 |
| Tashkent Bazaar | 20 | 40 | 20 | 20 | 2 | 7 |
| Moscow Arbat | 24 | 48 | 24 | 24 | 3 | 9 |
| Berlin Mitte | 29 | 58 | 29 | 29 | 3 | 11 |

- Live totals: 98 created rows, 11 duplicate acknowledgments, 35 late receipts,
  zero rejected/failed/queued at shutdown. psql joined sale_receipts and
  accepted_events by event_id for all queued log IDs; all 35 persisted
  occurred_at strings exactly matched queued originals. Maximum acceptance delay
  was 4.884 seconds. Duplicate requests added no extra rows.
- The observer received 42 snapshots. Its last snapshot matched
  GET /api/rankings?window=hour for every outlet's net_revenue_minor,
  receipt_count and rank (as_of/identity excluded).
  Launcher received SIGINT, forwarded shutdown, flushed children and exited 0.
  Observer exited 0; backend was stopped with SIGTERM. ps confirmed all three
  task process groups absent and ss showed port 3000 free. Existing Docker
  services were preserved. Results/logs are /tmp/simulator-live-results.json,
  /tmp/simulator-live-before.json, /tmp/simulator-live-after.json and
  /tmp/simulator-live-*.log.
- Final restored backend checks again all exited 0: npm run typecheck,
  rtk proxy npm run lint, npm run format:check, npm run build, npm test:
  117 tests in 10 suites, 117 passed, zero failed/cancelled/skipped/todo,
  duration 12091.340417 ms.
- Final restored simulator checks again all exited 0: npm run typecheck,
  rtk proxy npm run lint, npm run format:check, npm run build, npm test:
  12 tests, zero suites, 12 passed, zero failed/cancelled/skipped/todo,
  duration 2734.677292 ms. Real entrypoint checks for --rate 0, --unknown 1 and
  --api-url http://127.0.0.1:9/api each exited 1 with a clear message; unavailable
  startup reported failure after four attempts.
- Not verified: browser UI, production deployment, sustained load, process-crash
  queue durability, actual backend outage recovery in the live run (fake HTTP
  servers covered retry behavior), returns/alerts, or isolated verification of
  every historical commit. Frontend checks were not rerun for this branch.
- Final source diff was clean except the original MYLOG.md edit. gh auth status
  confirmed authenticated dar4x access. Timestamp above is real
  date --iso-8601=seconds output; no git timestamps were overridden.
  Push/PR creation follow this log commit and are not claimed here.


## Backend completion — 2026-10-13T18:52:51+06:00

- Read API_CONTRACT.md, DOMAIN_MODEL.md and ARCHITECTURE.md before implementation.
  `gh pr view 12` confirmed MERGED, merge commit
  12767cc97af53e82591f9095d71cd741d9f55c51, merged 2026-10-13T11:43:35Z.
  `git checkout dev` and `git pull --ff-only` completed before branching.
- Created six cumulative local feature branches: return-ingestion, outlet-details,
  outlet-settings, stale-alerts, midday-alerts, alert-email. Focused commits implement
  partial locked returns, exact server refunds, idempotency/conflicts/rollback,
  outlet cards/settings, stale episodes, persistent IANA civil-noon assessments,
  catch-up/expiration, transactional outbox, SMTP retry and worker exclusion.
- Essential tests cover concurrency, rollback after persistence and alert resolution,
  DST civil days, clipped five-minute bins, plan thresholds/frozen assessments,
  SMTP failures/timeouts, persisted retries and the accepted-SMTP/failed-status-write
  duplicate-delivery limitation. Real HTTP/Socket.IO/Mailpit integration passed.
- Observed pre-fix failures included UPDATE result-shape HTTP 500, valid JSON null
  receiving 400 instead of contract 422, cancelled card-suite hooks, and fixed-bin
  test expecting 13 clipped bins but receiving 12. Implementations corrected these;
  tests retained and passed. Intermediate failed checks were not reported as passing.
- `npm run test:db:setup` applied migrations to isolated sales_ranking_test.
  Final backend commands: `npm run typecheck`, `rtk proxy npm run lint`,
  `npm run format:check`, `npm run build`, `npm test`; all exited 0.
  Final tests: 143 tests, 17 suites, 143 passed, 0 failed/cancelled/skipped/todo,
  duration 24632.838405 ms; output /tmp/backend-completed-final.log.
- `npm run migration:run` applied CreateReturns1791900000000 and
  CreateAlertsAndOutbox1791901000000 to development without resetting data.
  `npm run migration:show` showed all eight migrations applied.
  psql counts before and after were identical: sale_receipts 437, sale_lines 986,
  accepted_events 467, outlets 41, products 6; diff exited 0.
  Count evidence: /tmp/backend-dev-counts-before.txt and -after.txt.
- Backend test-only socket.io-client 4.8.4 now declared locally, removing dependency
  on frontend node_modules. No new runtime dependencies or frontend edits.
- Contract implementation notes aligned with completed behavior. PR descriptions
  prepared in docs/BACKEND_PR_DRAFTS.md, all targeting dev.
- Not verified: production deployment, browser UI, sustained load, or each final
  intermediate branch head independently after cherry-picked fixes. The combined
  final backend is verified. No mandatory functionality remains incomplete locally.
- No push, PR creation or merge: user explicitly requires approval before pushing.
  MYLOG.md was neither edited nor staged; its pre-existing change remains.
  No protected root documentation changed. No git dates overridden.


## Frontend rankings dashboard — 2026-10-13

- Resumed after laptop shutdown by checking branch, working tree, files and
  Compose. feature/dashboard already existed at latest dev (c3ab20e); no
  implementation files had been written. Preserved the pre-existing MYLOG.md
  change. Its diff SHA-256 remained
  5785eda9e80a1a99d16aeee6da70231cecc0c75b0678b6568818ce685927eb6e.
  Did not recreate the branch, discard changes or reset database data.
- Inspected independent React/Vite frontend, contract/domain/architecture,
  backend controllers and RankingSnapshot/Socket.IO subscription implementation.
  Used current Context7 React and Socket.IO documentation for cleanup, reconnect
  and transport fallback. No dependencies were installed or added.
- Connected GET /api/rankings, exact hour/business_day selector, localStorage
  restoration, validated unknown responses, cancellation/timeout and retry.
  Added basic HTML ranking table with ranks, exact BigInt-formatted money,
  receipts, movement and leader/laggard/stale/behind_plan flags. Kept design rough.
- Added owned sockets, subscriptions on every reconnect, acknowledgement and
  initial-snapshot timeouts, named listener cleanup and unsubscribe/disconnect.
  Same-window duplicate/older snapshots do not overwrite newer data.
  Production rapid switching exposed cancelled polling-upgrade console errors;
  fixed with WebSocket-first plus tryAllTransports polling fallback and reran
  production checks successfully.
- Frontend typecheck, lint, format:check, build and node:test all passed; final
  tests: 10 passed, zero failures. Tests use the existing Vite transform and Node
  test runner, including contract/money/order/table/socket lifecycle/timeout.
- Real Playwright Chromium development checks passed: both windows rendered 41
  existing outlets; direct PostgreSQL SQL agreed with Bishkek business-day
  revenue 55340232221132258342 and 166 receipts. Both tabs received real simulator
  sales without reload; differing subscriptions worked, saved-window reload
  restored rows, and backend restart retained tables then produced fresh live
  snapshots without reload.
- Only after those checks, audited and removed application ping/pong UI, helpers,
  HTTP endpoint, gateway/service/module/types and obsolete demo tests. Startup
  and Compose depend on database health, not the demo. Kept /api/health and the
  shared Socket.IO adapter/transport heartbeat. Added health success, sanitized
  503 and real PostgreSQL e2e coverage. Current source/tests/API contract contain
  no ping/pong demonstration references; historical logs remain intact.
- Backend typecheck, lint, format:check and build passed after removal. Compiled
  all tests, then ran all unit tests plus health.e2e-spec and
  realtime-rankings-timer.e2e-spec using sales_ranking_test: 52 passed, zero
  failures. Did not run the full suite because several tests truncate existing
  test data. No truncate/delete/reset commands or migrations were executed.
- Post-removal real checks passed: health 200, removed ping 404, both browser tabs
  received simulator updates and showed rank movement. High-rate sales reset the
  backend's existing trailing refresh delay until the burst stops; observed and
  documented rather than changing backend protocol behavior.
- Real simulator totals: 52 Almaty sales plus 412 Moscow sales, zero rejected or
  failed. Development has 901 receipts and 931 accepted events afterward; all
  41 outlets and historical records remain. Simulators stopped normally.
- Final production preview checks passed in two actual tabs: hour/business_day,
  periodic snapshots, one HTTP request per mount, exact outgoing subscribe and
  unsubscribe frames, zero console errors/warnings in fresh pages. Deliberate
  WebSocket handshake failure fell back to actual HTTP polling and live updates.
  Mocked production browser checks passed loading/empty/503/retry/disconnected
  states and blocked localStorage. Early browser harness attempts that closed
  WebSocket gracefully or threw synchronously were not valid handshake-error
  simulations; the successful fallback test used an actual failed upgrade URL.
- README now documents current setup, integration checks, safe test subset,
  transport behavior and limitations. Earlier foundation checks are labeled
  historical. Other browsers, deployment and visual design remain unverified.
  Outlet details were not started. No merge to dev or main was performed.
