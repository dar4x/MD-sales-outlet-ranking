# Architecture

Developer-defined rules, implemented with AI assistance. Use lightweight Clean
Architecture inside NestJS; add layers only when a business feature needs them.

```text
backend/src/
  config/                       env loading and validation
  database/                     shared TypeORM setup and migrations
  health/                       flat controller, service, query, types
  realtime/                     flat ping/pong gateway
  <business-feature>/           events, rankings, outlets, alerts, notifications
    domain/                     pure TypeScript types and rules
    application/
      <use-case>.ts             one class with execute() per use case
      ports/                    interfaces and injection tokens
    infrastructure/             TypeORM/SQL/SMTP implementations of ports
    presentation/               controllers, DTOs, WebSocket gateways
    <feature>.module.ts         Nest provider wiring
backend/test/                   HTTP e2e tests
frontend/src/                   independent API, realtime, UI, and types
simulator/                      separate runnable script when introduced
```

**Dependencies point inward.** Domain uses pure TypeScript and depends on no
framework, persistence, or I/O. Application depends only on domain and its port
interfaces. Infrastructure implements ports; presentation translates transport
input/output and calls use cases. Neither domain nor application imports NestJS,
TypeORM, controllers, or infrastructure. Do not import backend code into frontend.

**Composition stays in Nest modules.** Define plain interfaces and tokens for
ports such as EventRepository, RankingQuery, OutboxRepository, Mailer, and
TransactionRunner. Modules bind tokens to adapters and construct plain application
classes through provider factories; constructor injection keeps application code
free of Nest decorators. Controllers and gateways do not contain business rules,
SQL, or transaction boundaries.

**Transactions belong to application orchestration.** A use case opens a
transaction through TransactionRunner and uses transaction-scoped ports. The
infrastructure adapter handles the actual database transaction. State changes and
outbox writes must commit or roll back together. Idempotent ingestion, backed by
a unique event_id constraint, is an application concern. Both idempotency and
atomic state-change/outbox behavior require tests before their features ship.

**Rankings are query models.** Put read-only ranking SQL behind RankingQuery;
return typed read models instead of forcing rankings through domain entities.
SQL lives in infrastructure repositories or dedicated query files. TypeORM
entities stay in infrastructure; explicit migrations control schema changes.

**Keep trivial modules flat.** Health and realtime ping/pong use normal Nest
controllers/gateways and services; layered business use cases and ports are
unnecessary. Before each feature branch, state in five lines which use cases and
ports it adds. Keep functions small, strict types, and tests focused on behavior.
