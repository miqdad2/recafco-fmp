# Local PostgreSQL Setup — RECAFCO FMP

This runbook describes how to set up PostgreSQL on a developer workstation for local development. It does **not** apply to the production server.

## Prerequisites

- PostgreSQL 14 or later installed and the service running
- `psql` available on `PATH` (or use the full path, e.g. `C:\Program Files\PostgreSQL\18\bin\psql.exe`)
- An authorized PostgreSQL superuser (`postgres`) with a known password

## Do not use the `postgres` superuser as the runtime account

The application runs as a dedicated low-privilege role (`recafco_fmp_app`). The `postgres` superuser is only used once to create the database and role, then never again during normal operation.

## Step 1 — Create the application role

Connect as the `postgres` superuser:

```bash
psql -U postgres
```

Create the application role (replace `strong_password_here` with a secure local password — never commit a real password):

```sql
CREATE ROLE recafco_fmp_app
  WITH LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  PASSWORD 'strong_password_here';
```

## Step 2 — Create the development database

```sql
CREATE DATABASE recafco_fmp_dev
  OWNER recafco_fmp_app
  ENCODING 'UTF8'
  LC_COLLATE 'en_US.UTF-8'
  LC_CTYPE 'en_US.UTF-8'
  TEMPLATE template0;
```

Grant connection privileges (the OWNER already has them, but explicit grants future-proof role changes):

```sql
GRANT CONNECT ON DATABASE recafco_fmp_dev TO recafco_fmp_app;
```

## Step 3 — Create the test database (for automated tests only)

Automated tests must use a dedicated test database — **never** `recafco_fmp_dev`:

```sql
CREATE DATABASE recafco_fmp_test
  OWNER recafco_fmp_app
  ENCODING 'UTF8'
  LC_COLLATE 'en_US.UTF-8'
  LC_CTYPE 'en_US.UTF-8'
  TEMPLATE template0;

GRANT CONNECT ON DATABASE recafco_fmp_test TO recafco_fmp_app;
```

Exit psql:

```sql
\q
```

## Step 4 — Set environment variables

Copy `.env.example` to `.env` at the project root and fill in the real password:

```bash
DATABASE_URL=postgresql://recafco_fmp_app:your_password@localhost:5432/recafco_fmp_dev?schema=public
```

For automated tests set `TEST_DATABASE_URL` in the test environment:

```bash
TEST_DATABASE_URL=postgresql://recafco_fmp_app:your_password@localhost:5432/recafco_fmp_test?schema=public
```

## Step 5 — Verify schema and generate the Prisma client

```bash
pnpm db:validate   # validate schema.prisma — must pass before any migration
pnpm db:generate   # regenerate the TypeScript client
```

## Step 6 — Run the first migration (when ready)

Migrations are covered in `docs/runbooks/database-migrations.md`. Do not run `pnpm db:migrate:dev` until you have authorized local credentials and confirmed the database is reachable.

## Verifying the connection

Test connectivity without running the application:

```bash
psql -U recafco_fmp_app -d recafco_fmp_dev -h localhost -c "SELECT 1;"
```

A result of `1` confirms the role and database exist and the password is correct.

## Windows note

On Windows, `psql` may not be on `PATH`. Use the full path or add PostgreSQL's `bin` directory to the system `PATH`:

```
C:\Program Files\PostgreSQL\18\bin\psql.exe -U postgres
```

## Security reminders

- Never use `postgres` as the `DATABASE_URL` user in `.env` or application code.
- Never commit `.env` to source control — it is in `.gitignore`.
- Never share or log passwords. If a password is compromised, rotate it immediately in PostgreSQL and update `.env`.
- Never run `prisma migrate reset` against `recafco_fmp_dev` or any production database.
