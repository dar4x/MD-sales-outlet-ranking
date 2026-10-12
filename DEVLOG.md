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
