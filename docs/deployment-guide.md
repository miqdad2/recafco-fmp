# RECAFCO FMP — Deployment Guide

Target environment: **Windows Server**, hostname `fmp.recafco.local`, internal network only.

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|-----------------|-------|
| Node.js | 20 LTS | Install via nvm-windows |
| pnpm | 9.x | `npm install -g pnpm` |
| pm2 | 5.x | `npm install -g pm2` |
| PostgreSQL | 15+ | Service must be running |
| Git | 2.x | For pulling updates |

---

## First-time server setup

### 1. Clone the repository

```powershell
cd C:\apps
git clone <repo-url> recafco-fmp
cd recafco-fmp
```

### 2. Create `.env`

```powershell
Copy-Item .env.example .env
notepad .env   # fill in real values — see docs\environment-variables.md
```

### 3. Create the logs directory

```powershell
New-Item -ItemType Directory -Path .\logs
```

### 4. Install dependencies

```powershell
pnpm install --frozen-lockfile
```

### 5. Build all workspaces

```powershell
pnpm run build
```

### 6. Apply database migrations

```powershell
Set-Location packages\database
pnpm exec prisma migrate deploy
Set-Location ..\..
```

### 7. Bootstrap the first admin account

```powershell
Set-Location apps\api
pnpm run bootstrap:admin
Set-Location ..\..
```

This creates the `SUPER_ADMIN` role and initial admin user. Credentials are printed once — record them securely and change the password on first login.

### 8. Start with PM2

```powershell
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # follow the output instructions to register the Windows startup task
```

### 9. Verify

```powershell
pm2 status
Invoke-WebRequest http://localhost:4000/health
Invoke-WebRequest http://localhost:4000/ready
```

---

## Routine updates

```powershell
cd C:\apps\recafco-fmp
.\scripts\pre-deploy-check.ps1   # must pass before proceeding
.\scripts\deploy.ps1
```

The deploy script:
1. Pulls `origin/main`
2. Installs dependencies (`--frozen-lockfile`)
3. Builds all workspaces
4. Runs `prisma migrate deploy` (never resets)
5. Gracefully reloads PM2 (`pm2 reload`, not restart)
6. Verifies `/health` returns 200

---

## Rollback

```powershell
.\scripts\rollback.ps1
```

Restores the code to the commit captured at the start of the last deploy, rebuilds, and reloads PM2. Does **not** reverse applied Prisma migrations (schema changes are additive). If a migration itself caused a data issue, restore from a `pg_dump` backup.

---

## Database backups

Run `pg_dump` before every deploy:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
& "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" `
    -U recafco_fmp `
    -d recafco_fmp `
    -F c `
    -f "C:\backups\recafco-fmp-$stamp.dump"
```

Automate this via Windows Task Scheduler.

---

## PM2 process names

| Name | App | Port |
|------|-----|------|
| `recafco-fmp-api` | NestJS API | 4000 |
| `recafco-fmp-web` | Next.js frontend | 3000 |
| `recafco-fmp-worker` | Background worker | — (not yet active) |

---

## Log locations

All logs are written to `<repo-root>\logs\`:

| File | Contents |
|------|----------|
| `api-out.log` | API stdout (pino JSON) |
| `api-error.log` | API stderr |
| `web-out.log` | Next.js stdout |
| `web-error.log` | Next.js stderr |
| `last-deploy-commit.txt` | Commit hash used for rollback |

---

## Health checks

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /health` | None | Always 200; confirms process is alive |
| `GET /ready` | None | 503 until DB is connected and app initialized; 200 with checks on ready |

---

## Security notes

- All cookies are `HttpOnly`, `SameSite=strict`, and `Secure` in production.
- Never expose port 4000 directly to the internet. Use a reverse proxy (Nginx/IIS ARR) in front of port 3000 only.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must each be at least 32 random characters. Generate with:
  ```powershell
  [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
  ```
- `CORS_ALLOWED_ORIGINS` must list only `http://fmp.recafco.local` in production. Wildcard (`*`) is rejected by the API env validation.
