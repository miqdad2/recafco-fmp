# Library Docs

Read the relevant section before implementing any third-party integration.

## Authority Order

1. Current official documentation
2. Installed project skills/MCP if available
3. This file
4. General training knowledge

## Dependency Policy

Dependencies must be necessary, maintained, appropriately licensed, self-hostable where relevant, and free of mandatory paid SaaS requirements.

## Next.js
App Router, Server Components by default, typed NestJS API access, and current official docs for version-sensitive behavior.

## NestJS
One module per business boundary, thin controllers, guards/policies, OpenAPI, and background work in the worker.

## Prisma/PostgreSQL
Schema and migrations in `packages/database`, reviewed SQL, no production reset, exact numeric types, constraints, transactions.

## Redis-Compatible Server/BullMQ
Queues, retries, locks, and short-lived cache only. PostgreSQL remains authoritative. Use bounded retries, stable job IDs, and visible failed jobs.

## MinIO
Private buckets, non-guessable keys, metadata in PostgreSQL, authorized backend flow, no admin credentials in frontend, coordinated backup.

## shadcn/ui/Radix/Tailwind
Base components in shared UI, preserve accessibility, compose feature UI outside base components, use semantic tokens, update UI registry.

## TanStack Table
Server-side pagination/filtering for large lists. Never send restricted columns to unauthorized users.

## Charts
Choose Apache ECharts or Recharts once and document the decision. Every chart needs loading, empty, error, accessible summary, source, and freshness states.

## Argon2/Sessions
Argon2id, short-lived access, revocable refresh sessions, secure HttpOnly cookies where applicable, no secrets in logs.

## OpenAPI
Document production routes, DTOs, and stable error codes. Restrict production docs if needed.

## PM2
Use `recafco-fmp-web`, `recafco-fmp-api`, and `recafco-fmp-worker`. Never stop all Node processes. Configure startup persistence and log rotation.

## Nginx/Caddy
Final choice must be documented. Owns internal hostname, TLS, routing, request limits, compression, and security headers.

## Prometheus/Grafana/Loki/GlitchTip
Self-hosted observability. Scrub sensitive data. Monitor API, worker, queue, database, MinIO, and SAP sync health.

## ClamAV
Where feasible, scan uploaded files and record scan state.

## SAP Business One Service Layer
Preferred interface. Confirm availability and test-company access. Server-side only, restricted user, read-only initially, validated responses, retries, circuit breaker, reconciliation, and sanitized logs.

## Integration Framework/DI API
Use only when Service Layer cannot support an approved need. Isolate DI API in a Windows connector when necessary.

## PDF/Excel
Final libraries are not yet approved. They must be open-source, server-side, worker-friendly, and store retained output in MinIO.
