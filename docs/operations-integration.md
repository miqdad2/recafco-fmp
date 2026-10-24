# Operations integration (FMP-OPS-01)

Read-only connection from FMP to the external RECAFCO Operations system
(`https://management.recafco.online`), where Technical, Production, Delivery and Erection work is done.
FMP keeps ownership of contracts. FMP never writes to the source, never creates a project there, and never
exposes a new public endpoint.

**State on 22 Oct 2026:** built and locally verified. **Live synchronization is OFF**: no integration account
has been provisioned, so nothing has been retrieved from the real source and every real-source statement
below comes from the supplied documents, not from observation.

## 1. How it works

```
Operations system  <--(HTTPS, server-side, one session)--  worker  -->  PostgreSQL  <--  API  <--  Next.js screens
                                                          (only caller)   (accepted local data)
```

- Only the **worker** (`apps/worker/src/operations-sync/`) talks to the source. The API and the web app have no
  HTTP client for it (a test enforces this); screens read accepted local data and never wait on the source.
- Requests are the three documented ones: `POST /api/login`, `GET /api/projects/{id}/report?group_by=building&columns=total,issued,produced,delivered,installed&format=json`, `POST /api/logout`. The broad `/api/contracts/{id}` endpoint is **not** called.
- The session cookie (`recafco_session`) lives in worker memory only. Passwords/cookies are never stored, logged or put in snapshots.
- Polling, not push: described to users as "updated automatically about every N seconds (not instant)".

### Synchronization rules (all unit-tested; most also run against real PostgreSQL)

| Rule | Behaviour |
|---|---|
| Validation | Project id must equal the requested id; the six totals must be non-negative integers; `generated_at` must be ISO-8601 **with** a time zone and not >10 min in the future. Anything else rejects the whole response. |
| Missing ≠ zero | A missing/null/non-integer figure rejects the response; it is never read as 0 or as a deletion. |
| Invalid response | The previous accepted snapshot is untouched; the attempt is logged and the failure counted. |
| Ordering | A response generated before the newest accepted one (`last_generated_at`) is ignored (`REJECTED_OLDER`). |
| Duplicates | Content hash excludes `generated_at`; an identical poll only moves `last_success_at`/`last_generated_at` (no new row). |
| Atomic publish | Snapshot insert + project pointer update in one transaction under a row lock; the decision is re-made inside the lock. |
| Corrections | Lower figures are accepted and flagged *info* ("revisions and corrections can legitimately reduce figures"). |
| Documented-rule flags | `delivered > produced` (a delivered piece is also counted as produced) → warning. All-zero after progress → warning. Source job order/factory change on a known project → warning. No invented thresholds. |
| No overlap | `FOR UPDATE SKIP LOCKED` + lease; plus an in-process guard. Concurrency is bounded (default 2, max 4). |
| Timeouts/size | Default 15 s timeout, 2 MB cap (Content-Length and streamed), JSON content-type required, redirects never followed. |
| Session expiry | A 401/redirect triggers exactly one re-login and one retry. |
| Backoff | Per project: `poll × 2^failures`, capped (default 15 min), ±10 % jitter. |
| Circuit breaker | 5 consecutive source-level failures (network/timeout/5xx) pause **all** calls with doubling cooldown; a rejected sign-in pauses for 30 min (no login retry loops, protects the account from lockout). 403/404/invalid-body are per-project and do not pause others. |
| Refresh | The Refresh button only sets `refresh_requested_at` (atomic, max one per project per 15 s, ignored while a request is queued, ignored after 3 consecutive failures). The worker performs the call. |
| Fixture safety | Snapshots carry `origin` (LIVE/FIXTURE); a FIXTURE snapshot is always shown with a red "FIXTURE — not live" banner. No fixture is shipped in any seed or migration. |

### Time concepts shown separately

1. **Last successful update** — when FMP last retrieved and accepted a response (`last_success_at`).
2. **Source response generated** — `generated_at` of the newest accepted response. *Not* last activity.
3. **Figures last changed** — `generated_at` of the current snapshot.
4. **Source activity time** — always "Not supplied by source" (the documented response has no such field).

## 2. Phase 1 — verified source capabilities and field inventory

> **Superseded in part (22 Oct 2026):** the full report and the project list were later read through the supplied demo sign-in — see §8.1. The statements about `rows`, `tree`, `historical`, `review_required`, `notes` and the missing project list below describe the position *before* that verification.

Credentials were unavailable, so the **full** report response could not be inspected. "Verified" below means
*stated in the source owner's READ-ME-FIRST / API reference (21 Oct 2026) or enforced by their example client*,
not observed live.

| Field | Meaning | Unit / scope | FMP use | Status | Warning |
|---|---|---|---|---|---|
| `project.id` | Stable source project id (`shapoorji-2025-92`) | string | Confirmed link key; response identity check | Verified (excerpt + client check) | Identity check rejects any other id |
| `project.code` | Job order (`92/25`) | string | Matching evidence, display | Verified (excerpt) | PC and HC can share numbers — never match on code alone |
| `project.project_type` | Factory/branch (`PC`) | string | Matching evidence, display | Verified (excerpt); meaning from the doc's "Factory: PC" | Needs the factory→plant mapping |
| `project.name` | Display name | string | Display, suggestions only | Verified (excerpt) | May change; never triggers auto-link; rename never breaks a link |
| `totals.total` | Current approved GA requirements | pieces, project aggregate | Requirement | Verified | Use once; do not add to rows/tree |
| `totals.issued` | Issued for production (recorded + confirmed "Done – pending input") | pieces, cumulative | Technical card | Verified | Not technical completion |
| `totals.produced` | Produced | pieces, cumulative | Production card | Verified | Overlaps delivered/erected |
| `totals.delivered` | Delivered (also counted in produced) | pieces, cumulative | Delivery card | Verified | Overlaps |
| `totals.installed` | Erected | pieces, cumulative | Erection card | Verified | Overlaps; never sum the three |
| `totals.pending_inputs` | Pieces with outstanding earlier-stage input details | pieces | Always-visible warning | Verified | Keep visible |
| `generated_at` | When the response was generated | ISO-8601 (`+00:00` in the example) | "Source response generated" | Verified | Not last-activity time |
| `review_required` | Referenced by the example client; **shape unknown** | unknown | Stored verbatim (capped); flag only if boolean | Unclear | Interpreted only when boolean |
| `notes` | Referenced by the example client (`[]` default); presumed list of text | unknown | Shown if a list of strings | Unclear | Otherwise dropped with a shape warning |
| `historical` | "Separately describes retained physical history" | unknown | Presence recorded only | Unclear | Structure not interpreted |
| rows (grouping) | "Rows provide the requested grouping" | unknown structure | Not stored | Unclear | Key name only recorded; never added to totals |
| tree subtotals | Mentioned in prose; field name unknown | unknown | Not used | Unclear | Never added to totals/rows |
| Activity time | — | — | "Not supplied by source" | **Absent** | |
| Deletion / cancellation of pieces | — | — | — | **Absent** (semantics unknown) | Missing ≠ deleted |
| Groupings `building, family, level, elevation, priority, zone, mark`; filters `building_id, level, zone, priority, family` | Optional breakdowns | — | Not requested by default | Documented, unused | Fetch only when a screen needs one |
| `columns` parameter | Selects report columns | — | Fixed to the five documented | Documented | **Not** an authorization boundary |
| Project list / creation notice | — | — | — | **Absent** | Automatic discovery blocked |
| `GET /api/contracts/{id}` | BOQ + unrelated internal detail | — | **Not called** | Documented | Source contract is Draft; no approved measurement links |

Login: `POST /api/login` with JSON `{username, password}`, success judged by a `recafco_session` cookie (from the
example client; the response body is not used). Error codes handled: 400, 401, 403, 404, 429 (+`Retry-After`), 5xx.

## 3. Missing capabilities — exact questions for the source owner

1. Please provision a **dedicated, project-scoped, read-only integration account** (or the documented API key) and confirm its username for FMP. Which projects should it see?
2. What is the **session lifetime** of `recafco_session` (idle and absolute), and does `POST /api/login` ever redirect? (FMP treats a redirect as failure.)
3. What are the **request limits** (per minute / per account)? Is polling each linked project every **60 s** acceptable, or should we use a longer interval? Is there a bulk endpoint for several projects?
4. Is there a **project-list API** (or a "project created/updated" notification) FMP may call to discover new projects automatically? Until then new projects are registered manually by id.
5. Is `project.project_type` always the factory/branch (`PC`/`HC`)? Are there other values?
6. Job-order format: does `project.code` ever carry a prefix (FMP writes `JO-0092/25`, the source `92/25`)? FMP currently strips a leading `JO`, treats `-` and `\` as `/`, and drops leading zeros — please confirm this equivalence is safe.
7. What are the exact structures of `review_required`, `notes`, `historical`, the **rows** and the **tree subtotals** in the full response? Which of them should FMP display?
8. Is there any **last-activity timestamp** (per project or per stage) the source can expose?
9. How are **deletions/cancellations** represented (a piece removed from the requirement vs. a count that drops)? Which count decreases are expected corrections and which indicate a problem — is there a documented business rule/threshold we should flag?
10. Is `generated_at` always timezone-aware and monotonic per project? Can two responses carry the same `generated_at` with different content?
11. Is the **same `report` response** valid for projects of both PC and HC factories? Any per-factory differences?
12. Will the source offer an **authenticated webhook**? If so, FMP is internal-only: a new inbound path needs network approval (VPN/reverse tunnel) — please describe the mechanism and signing method before anything is exposed.
13. Which approved baseline should FMP use for BOQ progress once **measurement links** exist, and which endpoint would supply only the agreed fields (not the broad contract detail)?

## 4. Configuration and migration requirements

### Database (additive, already applied to the **local** dev database only)

- `20261024000000_add_operations_source_integration` — 5 enums, 6 tables (`operations_source_projects`, `operations_progress_snapshots`, `operations_sync_runs`, `operations_source_status`, `operations_factory_mappings`, `operations_project_link_events`), indexes, FKs, a counts CHECK, permission `contracts.operations_link` granted to `SUPER_ADMIN` and `CONTRACT_MANAGER`.
- `20261024000001_add_operations_last_generated_at` — one nullable column.
- No existing table, column, role mapping or user is changed. Apply elsewhere with `pnpm db:migrate:deploy` after review; take a backup first (`docs/runbooks/database-migrations.md`).
- The `prisma migrate diff` against the dev database also listed unrelated historical constraint/index renames; those were deliberately **not** copied into the migration.

### Worker environment (all optional; nothing is called without them)

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — | Worker needs the same PostgreSQL URL as the API. Without it the worker does not start the sync. |
| `OPERATIONS_SYNC_ENABLED` | `false` | Only the literal `true` enables live calls. |
| `OPERATIONS_SOURCE_BASE_URL` | `https://management.recafco.online` | |
| `OPERATIONS_SOURCE_USERNAME` / `OPERATIONS_SOURCE_PASSWORD` | — | Dedicated integration account only. Never an administrator's. Keep in the protected runtime `.env`. |
| `OPERATIONS_SYNC_POLL_INTERVAL_SECONDS` | `60` | Floor 15. Proposed, **subject to the source's limits** (question 3). |
| `OPERATIONS_SYNC_REQUEST_TIMEOUT_MS` | `15000` | |
| `OPERATIONS_SYNC_MAX_RESPONSE_BYTES` | `2000000` | |
| `OPERATIONS_SYNC_CONCURRENCY` | `2` | Max 4. |
| `OPERATIONS_SYNC_MAX_BACKOFF_SECONDS` | `900` | |

The API and web app need **no** new variables.

### Rollout checklist (do not skip)

1. Review and apply the migrations; **restart** the API (new routes), the worker (new code) and the web app. The current `turbo dev` processes started before these changes and must be restarted to pick them up.
2. `pnpm --filter @recafco/shared build && pnpm --filter @recafco/config build && pnpm --filter @recafco/worker build`.
3. `ecosystem.config.js` keeps the worker with `autorestart: false` (set when it was a heartbeat stub). Decide whether it should now auto-restart; a stopped worker simply means figures go stale and the screens say so.
4. After the account is provisioned: set the credentials and `OPERATIONS_SYNC_ENABLED=true`, restart the worker, then on **Contracts → Operations Links**: map factory `PC` to its plant, add project id `shapoorji-2025-92`, and confirm the link to the `[TEST] New Al Sabah Hospital` contract.
5. Watch `operations_sync_runs` and the connection banner for the first hour before adding more projects.

Assign the `contracts.operations_link` permission through a role (not only SUPER_ADMIN/CONTRACT_MANAGER) to whoever follows up contracts.

## 5. Screens and permissions

| Where | What | Needs |
|---|---|---|
| Contract Overview | "Operations progress" summary card (counts, freshness, warnings) | `contracts.read` + department scope |
| `/contracts/{id}/operations` | Full progress, freshness, warnings, change history, Request refresh | `contracts.read` + department scope |
| `/contracts/operations-links` | Linked / suggested / conflicting / awaiting projects, register by id, factory mapping | read: `contracts.read`; change: `contracts.operations_link` |
| API `GET /contracts/:id/operations-progress[/history]`, `POST …/refresh` | | `contracts.read` |
| API `GET /operations-source/projects|status` | | `contracts.read` |
| API `POST /operations-source/projects`, `PUT …/projects/:id/link`, `POST …/unlink`, `PUT|DELETE …/factory-mappings` | | `contracts.operations_link` |

The 13 approved contract tabs were **not** changed; the detail page is a route reached from the Overview card.
Adding a 14th tab is a one-line change in `contract-workspace-tabs.ts` once approved.

## 6. Remaining limitations

- **Never run against the real source.** Behaviour against the real responses (shape of `review_required`, `notes`, rows, session lifetime, rate limits) is unconfirmed.
- **Automatic discovery is blocked** (no documented project list / creation notice). Projects are registered manually by id.
- **Automatic linking needs a factory→plant mapping**; the local data has no contract with a PC/HC plant, so until mapping is set up, matches are suggestions only.
- A contract can link to **one** source project (unique index); a project to one contract.
- Job-order normalization (JO prefix, `-`/`\`→`/`, leading zeros) is an FMP convention awaiting the source owner's confirmation.
- Pending-input and measurement gaps are shown from `pending_inputs` and `notes` only; per-piece detail is not fetched.
- BOQ progress, schedule delay and commercial approval are **not derived** and show as "Not supplied by source".
- Webhooks are not implemented (nothing documented; FMP is internal-only).
- The worker is a single process; a database outage pauses sync and the screens keep the last accepted data.
- Pre-existing, unrelated: `email-login-identity.test.ts` (login placeholder) fails in the web suite.

---

## 7. Contract monitoring for the Contract Manager and management (FMP-OPS-02)

The Operations information now lives **inside the existing contract screens**; no standalone Operations page is needed
and there is no 14th tab. The old internal workflow is preserved but moved aside.

### One data source for every screen

`OperationsSourceService.resolveViews()` is the single resolver. The Contract List (compact `ProgressSummary`),
the Overview "Progress Summary" and the Technical / Production & Planning / Delivery / Erection tabs all read the same
accepted local snapshot through it, so they cannot disagree. It returns the contract/source project identity, the accepted
snapshot id, the quantities, per-field availability, the last successful retrieval time, the connection state and the
data-quality warnings. It never contacts the source and never falls back to old local workflow figures.

API: `GET /operations-source/monitoring?ids=` (one call per list page), `GET /operations-source/monitoring/fingerprint?ids=`
(change detector for open screens), plus the per-contract `GET /contracts/:id/operations-progress`. All need `contracts.read`
and apply the contract's department scope (contracts outside it are silently dropped from batches, 403 on single reads).

### The five operational states (never the commercial status)

| State | Meaning | Shown as |
|---|---|---|
| `NOT_LINKED` | No source project linked | "Not connected to Operations" (no zeros, no local progress) |
| `WAITING_FIRST_UPDATE` | Linked, nothing accepted yet | "Linked, waiting for first update" |
| `UPDATED` | Fresh accepted snapshot | "Updated successfully" |
| `DELAYED` | Last figures kept, latest update failed/overdue/sync off | "Update delayed or source unavailable" + retrieval time + reason |
| `DEMONSTRATION` | Fixture data (development only) | "Demonstration data — live source not connected" |

The state is computed from the link and the snapshot only; it is not an input to, and never changes, DRAFT/ACTIVE/… .

### Field wording (approved)

`total` Current approved GA requirements (pieces) · `issued` Issued for production (includes confirmed "Done – pending input";
not technical completion) · `produced` Produced elements (cumulative) · `delivered` Delivered elements (cumulative, includes erected) ·
`installed` Erected elements (not final acceptance or contract completion) · `pending_inputs` Outstanding earlier-stage input details.
The three overlapping counts are never added; no percentage, "Done" or "Not started" is shown. Drawing counts, casting schedule,
storage figures, rejected quantities, BOQ progress and activity time show "Not supplied by source".

### Automatic updates without reloads

Open screens run `OperationsLiveRefresh`: every 15 s (4 s in demonstration) it asks FMP for a fingerprint of the visible
contracts and calls `router.refresh()` only when it changed (new snapshot, new retrieval time, delayed/recovered). It reads FMP only,
pauses while the tab is hidden, and adds no source requests however many people watch. The repo has no query library, so this reuses
Next's server-action + `router.refresh()` mechanism already used by the Operations screens. The real source is still polled by the
worker at the configured interval (default 60 s) — updates are automatic, not instant.

### Role and permission model (actual roles, dev database)

Monitoring access = existing `contracts.read` (+ contract department scope). No role was changed and no migration was needed.
Verified roles: ADMIN, CONTRACT_MANAGER, CONTRACT_MANAGEMENT_USER, EXECUTIVE_MANAGER, SUPER_ADMIN, VIEWER can open the list,
Overview and the four tabs; CONTRACT_STAFF stays task-only (redirected to My Tasks); MANAGEMENT_INTELLIGENCE_VIEWER stays isolated;
TECHNICAL_MANAGER and SALES_VIEWER have no contract access. Editing keeps `contracts.update`/`create`; linking, relinking, factory
mapping and the demonstration controls need `contracts.operations_link` (SUPER_ADMIN, CONTRACT_MANAGER).

### Previous Internal Workflow

Route `/previous-workflow` (sidebar group "Previous Internal Workflow"). Visible to administrators and people who work in the old
workflow (they hold `technical.update|manage`, `production.update|manage`, `storage_delivery.update`, `erection.update`,
`users.assign_role` or `roles.update`); a read permission alone is not enough. It links to the unchanged routes: `/technical`,
`/production/dashboard`, `/storage-delivery/pieces`, `/contracts/erection-dashboard`, `/erection/pieces`. Removed from normal
monitoring: the four "Open …" buttons, the Overview workflow-task progress card and production card, the list's BOQ column / BOQ button
/ old stage badges / two old quick filters, and the sidebar "Related Workflows" operational links. All routes, tables, records and
permissions remain (e.g. `/contracts/:id/boq-progress`, the old executive dashboards). Old figures are never combined with Operations figures.

### Development-only demonstration

Switch: `OPERATIONS_DEMO_ENABLED=true` in the repo-root `.env` (API) **and** `apps/web/.env.local` (web). The API refuses to start in
production with it set; in production the demo routes do not exist (404), the controls page is 404, and any demo project/fixture is
treated as not linked. The demo uses the isolated contract `CONTRACT-2026-970001` ("[DEMO] New Al Sabah Hospital — Operations monitoring
demonstration", job order `DEMO-92/25`) linked to source id `demo-shapoorji-2025-92`; the worker never syncs `demo-%` projects. Controls
live only at `/dev/operations-demo` (needs `contracts.operations_link`): create/check, simulate update, simulate outage, simulate recovery, reset.

### Still needed for the real source

Authorized integration credentials (question 1 in §3), the factory→plant mapping, confirmation of the job-order convention, a project
registered by id, and `OPERATIONS_SYNC_ENABLED=true` for the worker. Until then every contract that is not the demonstration reads
"Not connected to Operations".

---

## 8. Verified source access, project discovery and the richer report (FMP-OPS-03)

### 8.1 What was actually verified against the real source (22 Oct 2026)

Two bounded sessions, each: sign in → read → sign out, own cookie jar, no secret value printed or saved, nothing written to the source.

1. A raw script using exactly the supplied flow.
2. The **implemented** client and parsers (`OperationsSourceClient` in demo mode + `parseProjectList` + `parseProgressReport`), with no database access.

| Check | Result |
|---|---|
| `POST /api/demo-login` `{"factory":"precast","role":"manager","workspace":"existing"}` | **200**, one `Set-Cookie`: `recafco_session` (HttpOnly, SameSite, `Max-Age=28800` = 8 h). Body is the signed-in user object (not used or stored). |
| Extra session / CSRF requirements | **None observed**: no CSRF/XSRF cookie, response header or body field; the single cookie was enough for every GET. |
| `GET /api/projects` | **200**, JSON array, 421 projects, ~107 KB, ~0.4 s. Fields: `id, code, name, client, contractor, description, created, project_type, coordinator, is_training` (all strings except the boolean). `project_type`: PC 348, HC 72, one empty (the training project). `is_training`: 1 true. |
| Job-order sharing | 351 distinct codes; **70 shared** by more than one project; **no (code, factory) pair repeats**. Among eligible projects no normalized (job order, factory) identity repeats. |
| `project_b29b21f0f3fb` | code `0001`, PC, `is_training=false`, description says "Test records only" → excluded by configuration (see 8.3). |
| `GET /api/projects/shapoorji-2025-92/report?group_by=building&columns=total,issued,produced,delivered,installed&format=json` | **200**, ~9.7 KB, ~1 s. Keys: `project, totals, rows, tree, historical, kpis, notes, review_required, review_notes, conflict_marks, generated_at` plus presentation metadata (`fields, columns, column_labels, group_labels, export_basename, level, building_id, building_name, filtered, legend`). The implemented parser accepted it with **no unrecognised keys and no shape warnings**: 44 optional figures, 1 breakdown row, history present. |
| `POST /api/logout` | **200**; the same session then gets **401** on `GET /api/projects`. |

**Not verified** (and therefore still fixtures/assumptions): behaviour after the 8 h session expires on its own (expiry is simulated with a 401 stand-in), rate limits, behaviour with an integration (password) account, other roles/factories/workspaces (deliberately not tried), the HC report, and anything about how the source treats a long-running poller. The demo sign-in is the source's demo mode: it is **not** a provisioned integration account and works only while the source keeps it available.

### 8.2 Authentication modes (explicit, no fallback)

`OPERATIONS_SOURCE_AUTH_MODE=password` (default) uses `POST /api/login` with the dedicated account. `=demo` uses `POST /api/demo-login` with `OPERATIONS_SOURCE_DEMO_FACTORY/ROLE/WORKSPACE` (defaults are exactly the supplied `precast`/`manager`/`existing`). Any other value is a startup error. A failed sign-in in one mode never tries the other. The worker records the mode in `operations_source_status.auth_mode`; the Operations Links page then shows "Demo sign-in … works only while the source keeps its demo access available". Live synchronization is still **off by default** (`OPERATIONS_SYNC_ENABLED`).

### 8.3 Project discovery

Off by default (`OPERATIONS_DISCOVERY_ENABLED=true`). One `GET /api/projects` per interval (default 15 min, never < 5 min), on its own database claim, size-capped (5 MB) and validated (array, ≤ 5000 entries, no repeated id; malformed entries are skipped and counted).

- **Upsert by source id.** Identity columns (code, normalized job order, factory, name, training flag) are refreshed; a rename or re-code never touches a confirmed link.
- **Eligibility:** only projects the source explicitly says are *not* training, that carry a factory, and that are not in `OPERATIONS_EXCLUDED_PROJECT_IDS` (default `project_b29b21f0f3fb`). Excluded projects (`excluded_reason`: `TRAINING`, `CONFIGURED_EXCLUSION`, `TRAINING_STATUS_UNKNOWN`, `NO_FACTORY`) are never suggested, linked (even by a person), fetched, or counted as a conflict.
- **Matching:** unchanged and strict — unique normalized job order **and** mapped factory, no conflict; names only suggest. Ambiguity (two source projects or two contracts with the same job order + factory) produces a suggestion/conflict for a person, never a link.
- **No destructive effects:** discovery never creates a commercial contract, never edits contract details, never deletes or unlinks. A project missing from a response only gets `missing_from_list_since` (cleared when it returns); a list shorter than half the last one is not trusted at all.
- **Progress is fetched only for linked, eligible projects** (plus a one-time identity fetch for manually registered, never-listed projects). Newly linked projects get their first fetch spread over the poll window; concurrent fetch starts are staggered (`OPERATIONS_SYNC_STAGGER_MS`, default 300 ms) on top of the existing bounded concurrency, leases, backoff and circuit breaker.

### 8.4 The richer report — mapping and rules

All figures come from `totals` (project level, used once) or `rows` (breakdown by building). `tree` and `kpis` duplicate them in other shapes and are **recognised but never stored or used**, so no two representations can be added together. A response with `filtered=true` or a non-"All" `level`/`building_id`/`building_name` is rejected (`SCOPE_MISMATCH`): it is not the whole-project report.

| Source field | FMP label / place | Rule |
|---|---|---|
| `total` | Current approved GA requirements, pieces | |
| `issued` | Issued for production (Technical tab) | Never "technical completion" |
| `produced`, `balance_produce`, `stock`, `scheduled` | Produced elements; Balance to produce; Stock; Scheduled (Production tab) | Balance and stock are **calculated by the source**; FMP shows them as supplied |
| `delivered`, `balance_deliver` | Delivered elements; Balance to deliver (Delivery tab) | Cumulative, includes erected |
| `installed` | Erected elements (Erection tab) | Not final acceptance |
| `*_pct` | "81.4% of GA requirement" | Source-supplied ratios only; FMP computes none |
| `total/produced/delivered/installed_volume\|area\|length`, `cast_volume` | m³ / m² / LM on the matching tab | Always with the source's `missing_*` counts ("204 pieces have no known volume"); unknown is never zero |
| `missing_concrete`, `missing_cast_volume` | Measurement-gap warning | Visible on every tab |
| `rows` | "By building / area" table | Per-row counts as supplied; no total row; never added to the totals |
| `historical.*` | "Whole-project history" panel | Separate; **current `cast_volume` (4,719.547) and historical (4,687.351) differ and both are shown, with a note — never reconciled** |
| `review_required`, `review_notes`, `conflict_marks` | Warnings (count of conflicts; each note) | |
| `notes`, `pending_inputs`, `generated_at` | As before | `generated_at` is generation time, not activity |
| `drawings` | **Stored, not displayed** | The source does not label it (absent from `column_labels`) |

Missing values stay absent ("Not supplied by source"); a supplied zero is data. Old snapshots (before this change) simply lack the richer figures and show them as not supplied. The contract list, Overview and the four tabs still read one accepted snapshot through the same resolver.

### 8.5 New questions for the source owner

14. What does the `drawings` figure (764 for 92/25) mean? It has no column label.
15. Is `is_training=false` guaranteed for real projects? `project_b29b21f0f3fb` is described as test records yet flagged `false`; is there a reliable field (other than free text) to identify such projects?
16. Will the demo sign-in remain available for FMP, or should we wait for the integration account? What is the lifetime of the demo session in practice, and does it count against any user/seat limit?
17. Is `GET /api/projects` complete (no paging) and safe to call every 15 minutes? Does it ever omit archived or restricted projects?
18. Is the HC report the same shape (volume/area/length columns, `fields`, `filtered`)?

### 8.6 Configuration added (worker, all optional)

`OPERATIONS_SOURCE_AUTH_MODE` (`password`|`demo`), `OPERATIONS_SOURCE_DEMO_FACTORY|ROLE|WORKSPACE`, `OPERATIONS_DISCOVERY_ENABLED`, `OPERATIONS_DISCOVERY_INTERVAL_SECONDS` (default 900, min 300), `OPERATIONS_EXCLUDED_PROJECT_IDS` (default `project_b29b21f0f3fb`; empty clears it), `OPERATIONS_PROJECT_LIST_MAX_BYTES`, `OPERATIONS_SYNC_STAGGER_MS`. Migration `20261025000000_add_operations_discovery_and_report_detail` is additive (applied to the local dev database only). To go live in demo mode (after review and only if the source owner agrees): `OPERATIONS_SYNC_ENABLED=true`, `OPERATIONS_SOURCE_AUTH_MODE=demo`, optionally `OPERATIONS_DISCOVERY_ENABLED=true`, map factory codes to plants on the Operations Links page, restart the worker.

### 8.7 Limitations after this unit

- The worker has **never run continuously against the real source**; only the two bounded sessions above. Discovery, linking, staggering, expiry and outage behaviour were verified against a stand-in server and the local database, using the real response shapes.
- Session expiry after 8 h is handled by the existing one-renewal rule but was not waited out against the real source.
- Factory-to-plant mapping and a registered contract are still needed before anything links automatically; no contract exists for 92/25 in the local dev data.
- The demo sign-in is a dependency on the source's demo mode, not an integration account.
- No management reports beyond the contract screens exist yet; exclusions are enforced in linking, synchronization and the Operations Links overview.
