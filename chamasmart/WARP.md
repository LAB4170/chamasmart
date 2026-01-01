# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Key commands

All commands below are intended to be run from the repository root (`chamasmart/`) unless otherwise noted.

### Root-level workflows

- Install all dependencies (backend + frontend):
  - `npm run install:all`
- Set up PostgreSQL schema and seed sample data:
  - `npm run setup`
- Start integrated production-like server (builds frontend, serves via backend on port 5000):
  - `npm start`
- Development (frontend + backend, separate ports):
  - `npm run dev`
- Build frontend only (production bundle to `frontend/dist`):
  - `npm run build`
- Build then serve integrated app (equivalent to production flow):
  - `npm run serve`

### Backend-only workflows

Run these from the repo root unless a `cd` is specified.

- Development backend server with auto-reload:
  - `cd backend && npm run dev`
- Production-style backend only (expects frontend already built to `frontend/dist`):
  - `cd backend && npm start`
- Database setup (also available via root script):
  - `cd backend && node setup-db.js`
- Database migrations:
  - SQL files live under `backend/migrations/`.
  - For the `007_performance_optimization_pgadmin.sql` migration, follow the detailed steps in `backend/MIGRATION_INSTRUCTIONS.md` (pgAdmin auto-commit requirements, verification queries, and `refresh_all_statistics()` helper).

### Frontend-only workflows

- Development server (Vite, typically on port 5173):
  - `cd frontend && npm run dev`
- Lint frontend only:
  - `cd frontend && npm run lint`
- Build frontend bundle only:
  - `cd frontend && npm run build`

### Linting

- Lint entire repo (backend + root + any shared utilities):
  - `npm run lint`
- Lint and apply autofixes:
  - `npm run lint:fix`

### Testing

Jest is configured at the repo root via `jest.config.js` and `jest.setup.js`. Backend integration tests live under `backend/tests/`.

- Run all Jest tests:
  - `npm test`
- Watch mode during development:
  - `npm run test:watch`
- Coverage report (output to `coverage/`):
  - `npm run test:coverage`
- Update Jest snapshots:
  - `npm run test:update`
- Run a single test file (example for backend auth tests):
  - `npm test -- backend/tests/auth.test.js`
- Run focused backend security tests:
  - Metrics protection: `npm test -- backend/tests/metrics.test.js`
  - Auth error handling (prod vs non-prod): `npm test -- backend/tests/authErrors.test.js`
  - Socket auth (reject unauthenticated): `npm test -- backend/tests/socketAuth.test.js`

Backend tests rely on `backend/tests/setup.js`, which expects a separate PostgreSQL database (e.g. `chamasmart_test`) to exist and configures `NODE_ENV=test` plus logger mocks.

## Architecture overview

### Monorepo layout

- `backend/` – Express.js API server, PostgreSQL access, Redis integration, background jobs, logging, metrics, and WebSocket (Socket.io) integration.
- `frontend/` – React + Vite SPA, using React Router, context providers, and service modules for API calls.
- `src/` – Shared utilities used by Jest and potentially by both frontend and backend (currently contains `src/utils/`).
- Root config – `jest.config.js`, `jest.setup.js`, `.babelrc`, `.hintrc`, and root `package.json` orchestrate builds, testing, and linting across the repo.

For onboarding, environment variables, and a high-level feature list, prefer `README.md`. This section focuses on how the code is structured for agents working across multiple files.

### Backend (Express + PostgreSQL + Redis)

The main entry point is `backend/server.js`:

- Loads environment variables with `dotenv` and initializes the PostgreSQL pool via `backend/config/db.js`.
- Creates an Express app, enables security middleware (Helmet, rate limiting, CORS via `backend/config/cors.js`), JSON/urlencoded parsers, and a structured Winston logger from `backend/utils/logger.js`.
- Attaches:
  - `requestLogger` middleware (`backend/middleware/requestLogger.js`) for sanitized request logging.
  - `metricsMiddleware` from `backend/middleware/metrics.js` to instrument HTTP requests, DB queries, cache operations, and business events.
- Registers API route modules under `/api/*` via files in `backend/routes/`:
  - `auth.js`, `users.js` – authentication and user management.
  - `chamas.js`, `members.js`, `contributions.js`, `loans.js`, `payouts.js`, `roscaRoutes.js` – core chama lifecycle, membership, contributions, loans/repayments, payouts, and ROSCA-specific flows.
  - `meetings.js`, `joinRequests.js`, `notifications.js`, `invites.js` – governance, onboarding, and notification flows.
- Exposes observability endpoints:
  - `/api/health` and `/api/ready` – health and readiness checks.
  - `/metrics` – Prometheus metrics (see `PHASE1_COMPLETE.md` and `backend/middleware/metrics.js`).
- In production (`NODE_ENV=production`), serves the built React app from `frontend/dist` and falls back to `index.html` for client-side routing; in development it responds on `/` with a simple message and expects the UI to run on Vite (port 5173).
- Configures a global error handler that logs via `logger.logError` and returns JSON responses, plus process-level handlers for unhandled rejections and uncaught exceptions.

Additional backend pieces that frequently matter for multi-file changes:

- **Database access and performance**
  - `backend/config/db.js` centralizes PostgreSQL connection pooling and query helpers, and is instrumented to emit performance metrics and logs (see `PHASE1_COMPLETE.md`).
  - SQL migrations live in `backend/migrations/`, including performance-oriented indexes and materialized views (`mv_chama_statistics`, `mv_user_statistics`) with helper functions like `refresh_all_statistics()`.
- **Redis, queues, and real-time features**
  - `backend/config/redis.js` configures Redis connections used by the rate limiter, queues (Bull), and Socket.io adapter.
  - `backend/socket.js` wires Socket.io to the HTTP server created in `server.js`, applying the same CORS policy and using the shared logger.
- **Scheduling and background work**
  - `backend/scheduler.js` is initialized from `server.js` and uses `node-cron` (and Redis/DB) for periodic jobs like penalty calculations, statistics refreshes, or cleanup tasks.
- **Security and hardening**
  - Request validation typically lives in controllers and middleware under `backend/controllers/` and `backend/middleware/` using `joi` where appropriate.
  - `PHASE1_COMPLETE.md` documents the security and logging work: sanitized logging, origin whitelisting via `ALLOWED_ORIGINS`, socket CORS tightening, and structured security-event logging.

When adding or modifying backend features, expect to touch:

- A route in `backend/routes/*.js`.
- A controller or service in `backend/controllers/` or `backend/services/`.
- Optionally DB access helpers, SQL migrations, and metrics/logging calls.

### Frontend (React + Vite)

The frontend is a Vite-powered React SPA located under `frontend/`:

- Entry points:
  - `frontend/index.html` – Vite HTML template.
  - `frontend/src/main.jsx` – bootstraps React, router, and context providers.
  - `frontend/src/App.jsx` – top-level routing and layout.
- Structure under `frontend/src/`:
  - `components/` – shared UI components (tables, forms, navigation, layout pieces).
  - `pages/` – top-level views corresponding to routes like dashboard, chama detail, meetings, loans, etc.
  - `context/` – React context providers for auth, current chama, user/session state, and possibly real-time updates.
  - `services/` – API client modules (Axios-based) that encapsulate HTTP calls to the backend routes (`/api/auth`, `/api/chamas`, `/api/contributions`, etc.), and may also manage WebSocket (Socket.io) connections for real-time updates.
  - `utils/` – client-side helpers (formatting, validation, data transforms, report/export helpers with `jspdf`, `xlsx`, etc.).
  - `assets/` – static assets and styling (`index.css`).

The frontend is designed to be served either by Vite in development or as a static build (`frontend/dist`) served by the backend in production, with React Router handling navigation under paths like `/login`, `/register`, `/dashboard`, and `/chamas/*`.

## Testing, logging, and observability

### Testing strategy

- **Root Jest config** (`jest.config.js` + `jest.setup.js`):
  - Uses the `jsdom` environment to support DOM-based tests.
  - Maps `@/` imports to `src/` and mocks CSS modules.
  - Collects coverage from `src/**/*` by default.
  - `jest.setup.js` adds `@testing-library/jest-dom` and mocks `localStorage`, `matchMedia`, and `fetch`.
- **Backend tests** (`backend/tests/`):
  - Integration tests (e.g. `auth.test.js`, `requestLogger.test.js`) rely on Jest + Supertest, and use `backend/tests/setup.js` to configure a separate test database and silence logger output.
  - When writing new backend tests, place them under `backend/tests/` and ensure they import the same server/db setup pattern as existing tests.

If tests fail due to missing databases, create the `chamasmart_test` PostgreSQL database and ensure connection details in `backend/tests/setup.js` (and any `.env` overrides) match your local environment.

### Logging and metrics

The logging and metrics stack is central to how the backend is expected to behave and should be preserved when making changes:

- **Logging** (`backend/utils/logger.js` and `PHASE1_COMPLETE.md`):
  - Winston with daily-rotated files under `backend/logs/` (`error-YYYY-MM-DD.log`, `combined-YYYY-MM-DD.log`, `exceptions-*.log`, `rejections-*.log`).
  - Helper methods like `logRequest`, `logError`, `logDatabaseQuery`, and `logSecurityEvent` are used across middleware, DB utilities, and feature modules.
- **Request logging** (`backend/middleware/requestLogger.js`):
  - Logs incoming requests with PII/sensitive fields sanitized (passwords, tokens, auth headers partially redacted).
  - Skips noisy endpoints like health checks.
- **Metrics** (`backend/middleware/metrics.js`):
  - Exposes Prometheus metrics at `/metrics` using `prom-client`.
  - In production, when `METRICS_AUTH_TOKEN` is set, `/metrics` requires the `X-Metrics-Token` header with the matching value (see `README.md` for an example cURL invocation).
  - Tracks request duration, request counts by method/route/status, active connections, DB query timings, cache metrics, and business counters.
- **Health/Readiness**:
  - `/api/health` and `/api/ready` are wired through the metrics middleware and DB/Redis checks, and are used both for manual diagnostics and orchestrator readiness probes.

When modifying server behavior (e.g. adding new routes, changing DB calls, or introducing new background jobs), hook into the logger and metrics utilities rather than using `console.log`, and preserve the existing health/metrics contracts.

### Database migrations and performance views

Performance-critical indexes and materialized views live in:

- `backend/migrations/007_performance_optimization.sql` – uses `CREATE INDEX CONCURRENTLY` and is intended for CLI (`psql`) or non-transactional runners.
- `backend/migrations/007_performance_optimization_pgadmin.sql` – pgAdmin-friendly version without `CONCURRENTLY` (see `backend/MIGRATION_INSTRUCTIONS.md` for step-by-step usage and verification queries).

When changing dashboard/reporting queries or contribution/loan heavy paths:

- Prefer extending the existing indexes in `007_*` migrations rather than adding ad-hoc indexes elsewhere.
- Keep `mv_chama_statistics` and `mv_user_statistics` in sync with any new columns used on dashboards; update the associated `refresh_*` functions if the view shape changes.
- If you introduce new materialized views or heavy aggregations, mirror the existing pattern: create a pgAdmin-safe file alongside any concurrent-index/CLI version and update `MIGRATION_INSTRUCTIONS.md` with how to run it.

### Load testing

The backend includes a k6 scenario at `backend/tests/load-test.js` that exercises key endpoints and validates SLOs:

- Targets `BASE_URL` (defaults to `http://localhost:5000`) and runs multi-stage traffic from 20→50→100 virtual users.
- Covers `/api/health`, `/api/chamas/user/my-chamas` (authorized with a freshly registered user), `/api/chamas`, and `/metrics`, with thresholds on latency and error rates.

To run or adapt load tests:

- Use k6 from the repo root or `backend/`:
  - `k6 run backend/tests/load-test.js` (set `BASE_URL` env var if not using `localhost:5000`).
- When adding new load scenarios, follow the existing pattern: centralize `BASE_URL`, reuse the registration/auth bootstrap in `setup()`, and assert on both HTTP status and latency so results remain comparable over time.

### Sockets and real-time behavior

Real-time presence and chama-level updates are managed via Socket.io in `backend/socket.js`:

- The `init(httpServer)` function:
  - Configures CORS via `socketCorsOptions` from `backend/config/cors.js` (driven by `ALLOWED_ORIGINS`).
  - Sets conservative transport/timeouts and optionally wires a Redis adapter when `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` are present; otherwise falls back to an in-memory adapter.
  - Enforces JWT-based authentication using the same `JWT_SECRET` as HTTP auth; authenticated sockets get `socket.userId` and `socket.userEmail`.
- Connection lifecycle and rooms:
  - Tracks active connections and updates `metrics.socketConnections` (`chamasmart_socket_connections`).
  - Joins an authenticated user to a personal room `user_<userId>` and emits `presence_update` when users connect or disconnect.
  - Supports chama-level rooms via `join_chama` / `leave_chama` events and emits `user_joined`, `user_left`, and `user_typing` events to room members.

When extending real-time features:

- Reuse the existing room naming conventions (`user_<id>`, `chama_<id>`) and authentication middleware.
- Record significant socket lifecycle or error events through `logger` and, where appropriate, new Prometheus metrics co-located with `backend/middleware/metrics.js`.
- Keep CORS and auth behavior consistent between HTTP (`corsOptions`) and sockets (`socketCorsOptions`) so frontends only need one set of allowed origins and tokens.

### Penalty scheduler (ROSCA auto-penalties)

`backend/scheduler.js` defines `initScheduler`, which currently schedules a daily cron job to run `checkAndApplyPenalties()` for active ROSCA cycles:

- It queries `rosca_cycles` joined with `chamas` to find active cycles where `constitution_config.late_payment.enabled` is `true`, then is intended to compute due dates and apply penalties based on grace periods and amounts defined in the JSON constitution.
- All work is wrapped in an explicit DB transaction with `BEGIN`/`COMMIT` and proper `ROLLBACK` on errors, and uses `logger` to record both expected activity and failures.

When evolving the scheduler:

- Keep the cron entry point (`initScheduler`) light; push complex logic into separate, testable helper functions/modules that can be called from tests without triggering cron.
- Reuse the existing transaction pattern: acquire a client from the pool, `BEGIN`, perform all reads/writes for a batch of cycles, then `COMMIT` or `ROLLBACK` with structured logging.
- Mirror the business rules already encoded in `constitution_config.late_payment` so penalties remain fully data-driven; avoid hard-coding grace periods or amounts in JavaScript.
- If you add new periodic jobs (e.g. statistics refresh using `refresh_all_statistics()`), keep them in this file, tagged with clear log messages, and consider wiring Prometheus counters/gauges if they become performance-sensitive.
