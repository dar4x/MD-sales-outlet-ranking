# Decisions

These decisions were made by the developer and implemented with AI assistance.
The original two-line README.md was replaced with setup and verification instructions.

- NestJS and strict TypeScript enforce readable feature modules and controller/service boundaries; an unstructured Express app was rejected.
- Backend initialization uses current stable NestJS 12.1.3 with native ESM on Node 24. TypeScript 6.0.3 matches Nest CLI 12 and typescript-eslint 8 support; TypeScript 7 is newer but outside their supported range, so it was rejected for this foundation.
- A dedicated config module loads the root `.env` and validates startup settings with class-validator/class-transformer. The global API prefix, CORS origin, DTO validation, and shutdown hooks share one setup function used by bootstrap and e2e tests.
- Business features follow the developer's lightweight Clean Architecture rule in ARCHITECTURE.md, with plain domain/application code and Nest provider wiring at the module boundary. Flat health and realtime ping/pong avoid unnecessary business layers.
- Health executes a real SELECT 1 through a dedicated query class; relying only on TypeORM's initialized flag would miss a database outage. Ping remains stateless after startup, and database failures produce HTTP 503 without exposing driver details.
- The HTTP e2e test uses Node's built-in test runner, native fetch, and the actual app/PostgreSQL connection. Separate test compilation preserves decorator metadata and strict checking; another test runner or Nest testing adapter is unnecessary for this one endpoint.
- Type-aware ESLint reports errors without changing files, and Prettier formats source separately; combining formatting with lint fixes was unnecessary. Exact dependency versions and a package lockfile make `npm ci` repeatable.
- TypeORM migrations make schema changes reviewable; automatic synchronization is disabled.
- Database initialization uses TypeORM 1.1.2, Nest adapter 12.0.2, and pg 8.23.1; their engine and peer requirements match Node 24.21.0 and NestJS 12. The backend minimum is Node 24.11.0 to match TypeORM's requirement.
- NestJS and the migration CLI share a PostgreSQL options factory and env validation. Migration scripts build first and use Node's native env-file support to load compiled ESM; adding ts-node or a second env-loading dependency was unnecessary.
- The first migration has empty up/down methods and creates no domain schema; TypeORM records it in its history table. Migrations run only through explicit CLI commands, keeping startup free of schema writes.
- PostgreSQL is the source of truth for future SQL rankings and email outbox; a separate ranking cache is unnecessary now.
- Socket.IO supports browser reconnection; raw WebSockets would require additional connection handling.
- Realtime initialization uses NestJS WebSocket/Socket.IO adapters 12.1.3 and Socket.IO 4.8.4 on the existing HTTP server. A flat gateway delegates the pong payload to a service; a custom adapter reads the validated frontend origin at bootstrap instead of reading env during decorator evaluation.
- The realtime e2e test uses Node's native WebSocket and the documented Engine.IO/Socket.IO handshake. This tests the actual WebSocket transport without adding a test-client dependency; frontend code will use socket.io-client. Polling CORS is checked separately, since WebSocket upgrades do not use browser CORS checks.
- React, TypeScript, and Vite keep the frontend independent; a router and UI framework are unnecessary for one page.
- Environment variables configure connections and origins; checked-in example credentials are public local defaults, never production secrets.
- Docker Compose runs PostgreSQL and Mailpit with localhost ports and a named database volume; application containers are unnecessary now.
- The official `postgres:18` image uses `/var/lib/postgresql` for its volume. The official `axllent/mailpit:latest` image is for local development; image references are configurable, and immutable deployment pins are deferred.
- Only packages needed by the current branch will be installed; scheduling, business features, simulators, and workers are deferred.
- The developer pushes and merges feature branches into `dev`; the assistant does neither.

The tool used is OpenAI Codex; the session identifies the agent as GPT-6, but the exact model label shown by `/status` is not accessible to the agent and remains unverified.
The developer chose AI assistance to accelerate scaffolding while retaining review and merge control; this record does not infer a more specific model variant.

References: [PostgreSQL official image](https://hub.docker.com/_/postgres), [Mailpit Docker installation](https://mailpit.axllent.org/docs/install/docker/), [Docker Compose documentation](https://docs.docker.com/compose/).
