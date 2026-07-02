# RECAFCO FMP — Release Checklist

Use this checklist before promoting any commit to the production server.

---

## Pre-release (developer)

- [ ] All tests pass: `pnpm run test` (490+ tests expected across all workspaces)
- [ ] No TypeScript errors: `pnpm run typecheck`
- [ ] No lint errors: `pnpm run lint` (web) and `tsc --noEmit` (api/worker)
- [ ] Production build succeeds: `pnpm run build`
- [ ] `.env.example` is up to date with any new variables
- [ ] `context/progress-tracker.md` updated
- [ ] All new controllers have `@UseGuards(JwtAuthGuard, PermissionGuard)` at class level
- [ ] All controller methods have `@Permissions('...')` decorator
- [ ] No role-name authorization used (only permission codes)
- [ ] Any new list queries have `pageSize` cap or bounded result set
- [ ] No `console.log` with secrets or PII in committed code
- [ ] No hard-delete endpoints added (soft-delete / lifecycle only)
- [ ] New Prisma migrations are additive (no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`)
- [ ] `endpoint-permissions.md` updated with any new endpoints

---

## Deployment (on server)

- [ ] Run `.\scripts\pre-deploy-check.ps1` — must exit 0
- [ ] Create `pg_dump` backup before deploying
- [ ] Run `.\scripts\deploy.ps1`
- [ ] Verify `pm2 status` shows all processes `online`
- [ ] Verify `GET /health` returns `{ status: 'ok' }`
- [ ] Verify `GET /ready` returns `{ data: { checks: { database: 'ok' } } }`
- [ ] Log into the web app and confirm the dashboard loads
- [ ] Confirm each implemented module page loads without errors
- [ ] Check PM2 logs for unexpected errors: `pm2 logs --lines 50`

---

## Post-release

- [ ] Record the deployed commit hash in the team chat / wiki
- [ ] If any database migration was applied, note it in the changelog
- [ ] Close / resolve any related GitHub issues
- [ ] Verify scheduled tasks (session cleanup) are still registered in Task Scheduler

---

## Security regression checks (run after each deploy)

These are validated by the unit test suite (`pnpm run test`), but also verify manually in the running system:

| Scenario | Expected |
|----------|----------|
| Request with no `Authorization` header to any protected endpoint | 401 `UNAUTHORIZED` |
| Request with expired or revoked token | 401 `UNAUTHORIZED` |
| Request from a deactivated user | 401 `UNAUTHORIZED` |
| Request from a user with `mustChangePassword=true` to a non-exempt endpoint | 403 `MUST_CHANGE_PASSWORD` |
| Request missing a required permission | 403 `FORBIDDEN` |
| Optimistic concurrency: PATCH with a stale `version` | 409 `CONFLICT` |
| Attempt to DELETE a production entry, comment, or activity | 404 (route does not exist) |

---

## Rollback trigger conditions

Roll back immediately if:
- Any PM2 process enters `errored` state and does not self-recover
- `GET /health` returns non-200 for more than 30 seconds after deploy
- Database connection drops (observable via `GET /ready`)
- Authentication or RBAC behaves incorrectly in smoke testing

To rollback: `.\scripts\rollback.ps1`
