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

The worker is not yet active (BullMQ/Redis integration pending). These variables are reserved.

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
