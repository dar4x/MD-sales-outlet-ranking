# Decisions

These decisions were made by the developer and implemented with AI assistance.
The original two-line README.md was replaced with setup and verification instructions.

- NestJS and strict TypeScript enforce readable feature modules and controller/service boundaries; an unstructured Express app was rejected.
- Backend initialization uses current stable NestJS 12.1.3 with native ESM on Node 24. TypeScript 6.0.3 matches Nest CLI 12 and typescript-eslint 8 support; TypeScript 7 is newer but outside their supported range, so it was rejected for this foundation.
- A dedicated config module loads the root `.env` and validates startup settings with class-validator/class-transformer. The global API prefix, CORS origin, DTO validation, and shutdown hooks are configured once at bootstrap; feature controllers remain deferred.
- Type-aware ESLint reports errors without changing files, and Prettier formats source separately; combining formatting with lint fixes was unnecessary. Exact dependency versions and a package lockfile make `npm ci` repeatable.
- TypeORM migrations make schema changes reviewable; automatic synchronization is disabled.
- PostgreSQL is the source of truth for future SQL rankings and email outbox; a separate ranking cache is unnecessary now.
- Socket.IO supports browser reconnection; raw WebSockets would require additional connection handling.
- React, TypeScript, and Vite keep the frontend independent; a router and UI framework are unnecessary for one page.
- Environment variables configure connections and origins; checked-in example credentials are public local defaults, never production secrets.
- Docker Compose runs PostgreSQL and Mailpit with localhost ports and a named database volume; application containers are unnecessary now.
- The official `postgres:18` image uses `/var/lib/postgresql` for its volume. The official `axllent/mailpit:latest` image is for local development; image references are configurable, and immutable deployment pins are deferred.
- Only packages needed by the current branch will be installed; scheduling, business features, simulators, and workers are deferred.
- The developer pushes and merges feature branches into `dev`; the assistant does neither.

The tool used is OpenAI Codex; the session identifies the agent as GPT-6, but the exact model label shown by `/status` is not accessible to the agent and remains unverified.
The developer chose AI assistance to accelerate scaffolding while retaining review and merge control; this record does not infer a more specific model variant.

References: [PostgreSQL official image](https://hub.docker.com/_/postgres), [Mailpit Docker installation](https://mailpit.axllent.org/docs/install/docker/), [Docker Compose documentation](https://docs.docker.com/compose/).
