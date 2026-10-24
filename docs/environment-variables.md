# RECAFCO FMP — Environment Variables

All environment variables are loaded from `.env` at the repo root.

**Never commit `.env` to git.** Use `.env.example` as the template.

---

## API (`apps/api`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Runtime environment | `production` |
| `PORT` | No | API listen port (default: 4000) | `4000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://` or `postgres://`) | `postgresql://recafco_fmp:PASSWORD@localhost:5432/recafco_fmp` |
| `SHADOW_DATABASE_URL` | No | Shadow DB for Prisma migrate dev (not needed in production) | — |
| `JWT_ACCESS_SECRET` | Yes | HMAC-HS256 secret for access tokens. **Minimum 32 characters.** | Generate randomly |
| `JWT_REFRESH_SECRET` | Yes | HMAC-HS256 secret for refresh tokens. **Minimum 32 characters.** | Generate randomly |
| `JWT_ACCESS_EXPIRES_IN` | No | Access token TTL (default: `15m`) | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token TTL (default: `7d`) | `7d` |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated allowed origins. Wildcard `*` is **rejected** in production. | `http://fmp.recafco.local` |
| `LOG_LEVEL` | No | Pino log level (default: `info`) | `info` |
| `MMS_BASE_URL` | No | **Internal** MMS address. Used only by the FMP API to call MMS server-to-server. Never sent to the browser or shown to users (default: `http://192.168.1.17:81`). | `http://192.168.1.17:81` |
| `MMS_PUBLIC_BASE_URL` | No | **Public** MMS address. Every link a user can click on the Maintenance dashboard is built on it; links MMS sends on the internal address are moved onto it (default: `https://maintenance.recafco.online`). FMP never calls this address. | `https://maintenance.recafco.online` |
| `MMS_LIVE_DASHBOARD_ENDPOINT` | No | Path of MMS's read-only live dashboard API (default shown) | `/api/integrations/fmp/maintenance-dashboard/live` |
| `MMS_INTEGRATION_KEY` | No | **Secret.** Must equal MMS's `FMP_INTEGRATION_KEY`. Sent only server-to-server in `x-fmp-integration-key`; never exposed to the browser or logged. Unset = dashboard shows "MMS integration not configured". See [mms-integration.md](runbooks/mms-integration.md). | Generate randomly (≥ 32 chars) |
| `MMS_QUERY_TIMEOUT_MS` | No | Timeout for each MMS request (default: `8000`) | `8000` |
| `MMS_LIVE_REFRESH_SECONDS` | No | Browser auto-refresh interval for the live dashboard (default `30`, minimum `15`) | `30` |

### Generating secrets

```powershell
# Generate a 48-byte base64 secret (~64 chars)
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

---

## Web (`apps/web`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `API_BASE_URL` | Yes | Internal URL of the NestJS API (server-side fetch) | `http://localhost:4000` |
| `NEXT_PUBLIC_API_URL` | No | Public API URL exposed to browser (if different) | `http://fmp.recafco.local/api` |

> Next.js picks up variables prefixed with `NEXT_PUBLIC_` into the browser bundle. Variables without that prefix are server-only.

---

## Worker (`apps/worker`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Runtime environment | `production` |
| `DATABASE_URL` | Yes | Same PostgreSQL URL as the API | same as API |

The BullMQ/Redis queue is not active. Since FMP-OPS-01 the worker runs the read-only **Operations synchronization** (PostgreSQL-backed; no Redis needed). All variables below are optional; with none set the worker makes no external call and reports the connection as not configured.

| Variable | Default | Description |
|----------|---------|-------------|
| `OPERATIONS_SYNC_ENABLED` | `false` | Only the literal `true` enables live calls to the source |
| `OPERATIONS_SOURCE_BASE_URL` | `https://management.recafco.online` | Source host |
| `OPERATIONS_SOURCE_USERNAME` / `OPERATIONS_SOURCE_PASSWORD` | — | Dedicated read-only integration account (secret) |
| `OPERATIONS_SYNC_POLL_INTERVAL_SECONDS` | `60` | Per-project poll; minimum 15 |
| `OPERATIONS_SYNC_REQUEST_TIMEOUT_MS` | `15000` | Per request |
| `OPERATIONS_SYNC_MAX_RESPONSE_BYTES` | `2000000` | Larger responses are discarded |
| `OPERATIONS_SYNC_CONCURRENCY` | `2` | Max 4 |
| `OPERATIONS_SYNC_MAX_BACKOFF_SECONDS` | `900` | Retry backoff cap |
| `OPERATIONS_SOURCE_AUTH_MODE` | `password` | `password` (dedicated account) or `demo` (the source's demo sign-in, which depends on its demo access). Any other value is a startup error; there is no fallback between modes |
| `OPERATIONS_SOURCE_DEMO_FACTORY` / `_ROLE` / `_WORKSPACE` | `precast` / `manager` / `existing` | Demo sign-in payload |
| `OPERATIONS_DISCOVERY_ENABLED` | `false` | Read the source project list and link unique job-order + factory matches |
| `OPERATIONS_DISCOVERY_INTERVAL_SECONDS` | `900` | Minimum 300 |
| `OPERATIONS_EXCLUDED_PROJECT_IDS` | `project_b29b21f0f3fb` | Comma list of test projects to exclude (in addition to `is_training`); empty clears it |
| `OPERATIONS_PROJECT_LIST_MAX_BYTES` | `5000000` | Larger lists are discarded |
| `OPERATIONS_SYNC_STAGGER_MS` | `300` | Delay between starting concurrent progress requests |

See [operations-integration.md](operations-integration.md).

---

## Development-only Operations demonstration (FMP-OPS-02)

| Variable | Where | Description |
|----------|-------|-------------|
| `OPERATIONS_DEMO_ENABLED` | root `.env` (API) **and** `apps/web/.env.local` (web) | `true` enables the isolated demonstration contract, fixture snapshots and `/dev/operations-demo`. **Never set on the company server:** the API refuses to start in production with it set, and demo routes/data/controls are hidden in production regardless. |

---

## Validation on startup

The API performs fail-fast validation in `packages/config/src/env/api.ts`. If any required variable is missing or invalid, the process exits before accepting connections. Validation rules:

- `DATABASE_URL` must start with `postgresql://` or `postgres://`
- `JWT_ACCESS_SECRET` must be ≥ 32 characters
- `JWT_REFRESH_SECRET` must be ≥ 32 characters
- `CORS_ALLOWED_ORIGINS` must not be `*` when `NODE_ENV=production`

---

## .env.example

See [`.env.example`](../.env.example) at the repo root for a template with placeholders.
