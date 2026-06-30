# Architecture

## Style

Use a pnpm monorepo with a modular-monolith NestJS backend, a Next.js frontend, a background worker, and one PostgreSQL database with explicit module ownership.

Do not start with distributed microservices.

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | Next.js App Router + React + TypeScript |
| Backend | NestJS + TypeScript |
| Worker | Node.js/NestJS worker + BullMQ |
| Database | PostgreSQL |
| ORM | Prisma |
| Queue/Cache | Redis-compatible server |
| File Storage | MinIO |
| UI | Tailwind CSS + shadcn/ui + Radix |
| Tables | TanStack Table |
| Charts | Apache ECharts or Recharts, one final approved choice |
| API | REST + OpenAPI |
| Proxy | Nginx or Caddy |
| Process Manager | PM2 initially |
| Monitoring | Prometheus + Grafana |
| Logs | Structured logs; Loki later if needed |
| Error Tracking | GlitchTip later if needed |
| SAP | SAP Business One 9.3 for SAP HANA |
| SAP Interface | Service Layer preferred |
| Testing | Jest/Vitest, Supertest, Playwright |

## Repository Structure

```text
/
├── CLAUDE.md
├── context/
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
├── packages/
│   ├── database/
│   ├── shared/
│   ├── ui/
│   ├── config/
│   └── observability/
├── infrastructure/
└── docs/
```

## Backend Modules

```text
auth
identity
departments
locations
permissions
dashboard
production
tasks
incidents
maintenance
safety
contracts
attachments
comments
activities
notifications
approvals
reporting
sap-integration
audit
administration
health
```

## Storage Model

### PostgreSQL

Business metadata, users, permissions, module records, comments, activity, approvals, notifications, audit logs, file metadata, SAP mappings, and sync status.

### MinIO

Documents, images, evidence, generated reports, and retained exports.

### Redis-Compatible Service

Queues, retries, locks, and short-lived cache only. It is never the sole source of truth.

### SAP Business One

Authoritative for SAP-owned business records.

## SAP Boundary

```text
Next.js
  ↓
NestJS API
  ↓
SAP integration service
  ↓
persistent sync/outbox tables
  ↓
worker
  ↓
SAP Business One Service Layer
```

Rules:

- No browser-to-SAP calls.
- No SAP credentials in frontend code.
- Read-only first.
- Test company before production.
- Direct HANA writes are prohibited.
- Future writes require idempotency and reconciliation.
- Integration failures must be visible to administrators.

## Deployment

Recommended internal hostname: `fmp.recafco.local`

Suggested PM2 names:

- `recafco-fmp-web`
- `recafco-fmp-api`
- `recafco-fmp-worker`

Use separate ports, database, Redis namespace, MinIO buckets, logs, and backups from all other applications.

## Invariants

1. Permanent production software.
2. Existing systems must not be disrupted.
3. Never stop all Node.js processes.
4. Production data survives deployments.
5. Every protected operation is authorized on the backend.
6. Every material state change is auditable.
7. No direct SAP HANA writes.
8. SAP integration begins read-only.
9. Files live in MinIO; metadata lives in PostgreSQL.
10. Long-running work runs in the worker.
11. No mandatory paid SaaS without approval.
12. Missing requirements are documented, not guessed.
