# Backend PR drafts

All targets: `dev`. These are local, cumulative feature branches in the order below. Publish only with explicit user approval; never merge automatically. Later PRs include their prerequisites until those prerequisites reach dev. Focused fixes were also applied to the corresponding earlier branches without rewriting history.

## Implement transactional partial return ingestion

Branch: `feature/return-ingestion`; base: `dev`.

### What

Receipt locking, cumulative quantity limits, server-calculated exact refunds, canonical retries, conflicts and rollback; rankings subtract refunds by occurred_at.

### Why

Complete the mandatory backend contract before frontend work.

### Decisions worth a look

Concurrent duplicates/overreturns and failed persistence leave no partial transaction.

### How to verify

From backend: `npm run test:db:setup`, `npm run typecheck`, `rtk proxy npm run lint`, `npm run format:check`, `npm run build`, `npm test`. PostgreSQL and Mailpit must be available.

### Verified

Combined final backend: 143 tests across 17 suites passed; typecheck, lint, formatting and build passed. Both additive migrations applied on test and development databases. Development existing counts unchanged. Feature-specific tests and the combined HTTP/Socket.IO/Mailpit flow passed.

### Not verified

Each final intermediate branch head was not separately re-tested after cherry-picking fixes. Production deployment, browser UI and sustained-load testing were not performed.

### Notes

PR #12 was already merged into dev. No push, PR creation or merge performed. MYLOG.md retains its pre-existing local modification.

## Implement outlet card read model

Branch: `feature/outlet-details`; base: `dev`.

### What

Net statistics, fixed clipped series, net top products and local daily-plan progress.

### Why

Complete the mandatory backend contract before frontend work.

### Decisions worth a look

Civil-day boundaries use IANA zones; DST days are not assumed to have 24 hours.

### How to verify

From backend: `npm run test:db:setup`, `npm run typecheck`, `rtk proxy npm run lint`, `npm run format:check`, `npm run build`, `npm test`. PostgreSQL and Mailpit must be available.

### Verified

Combined final backend: 143 tests across 17 suites passed; typecheck, lint, formatting and build passed. Both additive migrations applied on test and development databases. Development existing counts unchanged. Feature-specific tests and the combined HTTP/Socket.IO/Mailpit flow passed.

### Not verified

Each final intermediate branch head was not separately re-tested after cherry-picking fixes. Production deployment, browser UI and sustained-load testing were not performed.

### Notes

PR #12 was already merged into dev. No push, PR creation or merge performed. MYLOG.md retains its pre-existing local modification.

## Implement outlet plan and contact settings

Branch: `feature/outlet-settings`; base: `dev`.

### What

Validated partial settings updates under outlet locking, with post-commit ranking refresh.

### Why

Complete the mandatory backend contract before frontend work.

### Decisions worth a look

Money stays decimal strings; omitted fields remain unchanged.

### How to verify

From backend: `npm run test:db:setup`, `npm run typecheck`, `rtk proxy npm run lint`, `npm run format:check`, `npm run build`, `npm test`. PostgreSQL and Mailpit must be available.

### Verified

Combined final backend: 143 tests across 17 suites passed; typecheck, lint, formatting and build passed. Both additive migrations applied on test and development databases. Development existing counts unchanged. Feature-specific tests and the combined HTTP/Socket.IO/Mailpit flow passed.

### Not verified

Each final intermediate branch head was not separately re-tested after cherry-picking fixes. Production deployment, browser UI and sustained-load testing were not performed.

### Notes

PR #12 was already merged into dev. No push, PR creation or merge performed. MYLOG.md retains its pre-existing local modification.

## Implement stale alert episodes

Branch: `feature/stale-alerts`; base: `dev`.

### What

Configured inactivity detection, resolution on accepted activity, atomic notification jobs and ranking flags.

### Why

Complete the mandatory backend contract before frontend work.

### Decisions worth a look

Duplicate events do not refresh activity or resolve stale episodes.

### How to verify

From backend: `npm run test:db:setup`, `npm run typecheck`, `rtk proxy npm run lint`, `npm run format:check`, `npm run build`, `npm test`. PostgreSQL and Mailpit must be available.

### Verified

Combined final backend: 143 tests across 17 suites passed; typecheck, lint, formatting and build passed. Both additive migrations applied on test and development databases. Development existing counts unchanged. Feature-specific tests and the combined HTTP/Socket.IO/Mailpit flow passed.

### Not verified

Each final intermediate branch head was not separately re-tested after cherry-picking fixes. Production deployment, browser UI and sustained-load testing were not performed.

### Notes

PR #12 was already merged into dev. No push, PR creation or merge performed. MYLOG.md retains its pre-existing local modification.

## Implement persistent civil-noon plan assessments

Branch: `feature/midday-alerts`; base: `dev`.

### What

Strict below-50-percent decisions, persisted negative decisions, missed-date catch-up and midnight expiration.

### Why

Complete the mandatory backend contract before frontend work.

### Decisions worth a look

Late data and settings changes never rewrite an assessed day.

### How to verify

From backend: `npm run test:db:setup`, `npm run typecheck`, `rtk proxy npm run lint`, `npm run format:check`, `npm run build`, `npm test`. PostgreSQL and Mailpit must be available.

### Verified

Combined final backend: 143 tests across 17 suites passed; typecheck, lint, formatting and build passed. Both additive migrations applied on test and development databases. Development existing counts unchanged. Feature-specific tests and the combined HTTP/Socket.IO/Mailpit flow passed.

### Not verified

Each final intermediate branch head was not separately re-tested after cherry-picking fixes. Production deployment, browser UI and sustained-load testing were not performed.

### Notes

PR #12 was already merged into dev. No push, PR creation or merge performed. MYLOG.md retains its pre-existing local modification.

## Deliver durable alert notifications through Mailpit

Branch: `feature/alert-email`; base: `dev`.

### What

SMTP delivery, persisted backoff, advisory worker exclusion, timer cleanup and full HTTP/Socket.IO/Mailpit integration.

### Why

Complete the mandatory backend contract before frontend work.

### Decisions worth a look

At-least-once delivery: SMTP acceptance followed by a failed sent-status write may cause a duplicate with the same Message-ID.

### How to verify

From backend: `npm run test:db:setup`, `npm run typecheck`, `rtk proxy npm run lint`, `npm run format:check`, `npm run build`, `npm test`. PostgreSQL and Mailpit must be available.

### Verified

Combined final backend: 143 tests across 17 suites passed; typecheck, lint, formatting and build passed. Both additive migrations applied on test and development databases. Development existing counts unchanged. Feature-specific tests and the combined HTTP/Socket.IO/Mailpit flow passed.

### Not verified

Each final intermediate branch head was not separately re-tested after cherry-picking fixes. Production deployment, browser UI and sustained-load testing were not performed.

### Notes

PR #12 was already merged into dev. No push, PR creation or merge performed. MYLOG.md retains its pre-existing local modification.

