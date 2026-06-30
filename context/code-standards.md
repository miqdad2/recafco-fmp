# Code Standards

## Engineering

- Read context files first.
- One implementation unit at a time.
- Scope is sacred.
- Fix root causes.
- Never invent business rules.
- Every unit must be testable.
- Prefer simple readable code.
- Preserve working behavior unless change is explicit.

## TypeScript

- Strict mode.
- Never use `any`.
- Use `unknown` and narrow.
- Explicit parameters and return types.
- Exhaustive status handling.
- No floating promises.
- Avoid assertions unless documented.

## Next.js

- App Router only.
- Server Components by default.
- Client Components only when necessary.
- Use a typed API client.
- No business authorization only in the frontend.
- Every page handles loading, empty, error, forbidden, and success.
- Never expose secrets in public variables.

## NestJS

- Thin controllers.
- Business logic in application/domain services.
- Modules own DTOs, policies, persistence, events, and tests.
- Permission and record scope before mutation.
- Transactions for atomic changes.
- Long work goes to the worker.
- Typed, sanitized external-integration errors.

## API

Use consistent responses:

```json
{ "data": {}, "meta": {}, "error": null }
```

```json
{
  "data": null,
  "meta": { "requestId": "..." },
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Safe user-facing message",
    "details": {}
  }
}
```

Validate all inputs, paginate lists, use stable error codes, document routes with OpenAPI, and never expose internals.

## Authentication and Authorization

- Argon2id
- Short-lived access token
- Revocable/rotated refresh session
- Rate-limit sensitive endpoints
- Forced reset
- Backend permission checks
- Record-scope checks
- Explicit audited super-admin bypass
- Never log secrets or tokens

## Prisma/PostgreSQL

- Every schema change has a migration.
- Review SQL.
- Prefer additive changes.
- Never reset production.
- Use exact numeric types.
- Use constraints and indexes.
- Store UTC.
- Avoid N+1.
- Audit critical changes in the same transaction where practical.

## Workflows

- Explicit transition maps.
- No arbitrary status update DTOs.
- Reasons for high-impact transitions.
- Preserve approval history.
- Closed records are not silently editable.
- Reopen requires permission, reason, and audit.

## SAP

- No browser-to-SAP.
- No direct HANA writes.
- Read-only first.
- Dedicated restricted account.
- Timeout, retry, circuit breaker, reconciliation.
- Future writes require idempotency.
- SAP-specific types remain inside the integration boundary.
- Display source and freshness.

## Jobs

- Persist intent before enqueueing.
- Jobs are idempotent or duplicate-protected.
- PostgreSQL stores final state.
- Bounded retries.
- Failed/manual-review state.
- Worker health/liveness.

## Files

- Binary in MinIO.
- Metadata in PostgreSQL.
- Non-guessable keys.
- Validate type and size.
- Scan where feasible.
- Authorized downloads only.
- Define retention before permanent deletion.

## UI

- Use `ui-tokens.md` and `ui-rules.md`.
- Register reusable UI in `ui-registry.md`.
- No hardcoded product colors.
- Responsive and keyboard accessible.

## Testing

- Unit tests for business rules
- Integration tests for database behavior
- API tests for auth, permission, validation, and transitions
- E2E tests for critical workflows
- Negative tests for forbidden access, scope breaches, duplicate jobs, SAP retries, and file access

## Required Commands

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not claim success when a required command was skipped or failed.

## Dependencies

Before adding a package, verify need, license, maintenance, self-hosting suitability, and absence of mandatory paid/cloud dependency. Document approved usage in `library-docs.md`.
