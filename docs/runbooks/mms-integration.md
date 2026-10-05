# Runbook — Live MMS Integration (FMP-MAINT-01 / FMP-MAINT-02)

The FMP Maintenance Management dashboard (`/maintenance/dashboard`) shows live data
from the existing **RECAFCO Maintenance Management System (MMS)** at
`https://maintenance.recafco.online` (internal address `http://192.168.1.17:81`). MMS stays the
system of record. FMP only **reads**.

## Where it appears

The same Maintenance Control Center is shown at `/maintenance/executive` (Platform Dashboard
card, executive sidebar, module switcher) and `/maintenance/dashboard` (department sidebar).

After deploying FMP-MAINT-01/02/03, **restart the FMP API process**. An API process started
before these units returns 404 for `GET /maintenance/dashboard/live`, and the page then shows
the red "unavailable" banner regardless of MMS's real state.

## How it works

```
Browser ──► FMP web (/maintenance/dashboard)
              └─► FMP API  GET /maintenance/dashboard/live          (FMP session + maintenance.read)
                    └─► MMS  GET /api/integrations/fmp/maintenance-dashboard/live[?userEmail=…]
                         header: x-fmp-integration-key: <MMS_INTEGRATION_KEY>   (server-to-server only)
```

- The browser only ever calls FMP. The integration key lives in the FMP API's `.env`. It is sent only in the request header to MMS, and is never returned, logged, or bundled into the web app.
- The MMS endpoint is read-only. It writes no audit logs and creates no notifications. MMS caches its results for 10 s.
- The FMP API never follows redirects to MMS, so the key can't be forwarded to another URL. It also adds its own 10 s per-user cache and merges concurrent requests, so many open tabs don't multiply calls to MMS. Failed calls are never cached.
- The browser auto-refreshes every `MMS_LIVE_REFRESH_SECONDS` (default 30, never below 15). Polling pauses while the tab is hidden and refreshes once when it becomes visible again.
- FMP-MAINT-01's direct read-only database mode (`MMS_DATABASE_URL`) has been **removed**. FMP no longer needs any MMS database access.

## Setup

1. **On MMS** (MMS team): deploy the MMS build that includes `/api/integrations/fmp/*` and its
   `proxy.ts` session bypass. Set `FMP_INTEGRATION_KEY` (≥ 32 characters) and
   `MMS_PUBLIC_BASE_URL=https://maintenance.recafco.online`.
2. **On FMP** (repo-root `.env` on the FMP server; never commit it):

   ```
   MMS_BASE_URL=http://192.168.1.17:81
   MMS_PUBLIC_BASE_URL=https://maintenance.recafco.online
   MMS_LIVE_DASHBOARD_ENDPOINT=/api/integrations/fmp/maintenance-dashboard/live
   MMS_INTEGRATION_KEY=<exactly the same value as MMS FMP_INTEGRATION_KEY>
   MMS_QUERY_TIMEOUT_MS=8000
   MMS_LIVE_REFRESH_SECONDS=30
   ```

3. Restart **only the FMP API process**. Do not use `pm2 restart all`.

Generate a key (PowerShell):
`[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))`

## Who sees live data

- Users need `maintenance.read`, **and** an **ALL_DEPARTMENTS** Maintenance module scope. MMS
  returns company-wide data and its departments don't map to FMP departments, so
  department-scoped users see a "restricted" notice and FMP doesn't call MMS for them.
- **Assigned To Me:** FMP sends the signed-in user's FMP email as `userEmail`.
  - No FMP email → the card shows "Unavailable — FMP user email not set". It never shows 0 in this case.
  - MMS rejects the email (HTTP 400) → FMP retries without it and says so.
  - Email sent, but there is no matching MMS account → MMS deliberately returns `0`, so the endpoint can't be used to check whether an email exists.

## Card definitions (computed by MMS)

| Card | MMS rule |
|---|---|
| Open Requests | Not draft and not closed/cancelled/rejected |
| In Progress | Status `In Progress` |
| Waiting For Parts | Status `Waiting Materials` / `Partially Issued` (+ legacy waiting statuses) |
| **Overdue / Past Start Time** | In-flight job cards whose **start date/time has passed**. MMS has no due-date field. The Needs Attention reason "Overdue" is shown as "Past start time". |
| Assigned To Me | Open job cards where the matched MMS user is a technician or the supervisor |
| Completed This Month | `Closed` and updated this calendar month |

### Internal and public addresses (FMP-MAINT-06)

| Variable | Used for | Seen by users |
|---|---|---|
| `MMS_BASE_URL` (`http://192.168.1.17:81`) | The FMP API's server-to-server call to MMS, with the integration key | Never |
| `MMS_PUBLIC_BASE_URL` (`https://maintenance.recafco.online`) | Every link on the dashboard: the "Open Maintenance Management System" button, quick actions, module rows, and each item's link | Yes |

The FMP API rewrites every link MMS sends before it reaches the browser (`safeMmsUrl`):

| MMS sends | FMP returns |
|---|---|
| A relative path (`/assets/vehicles`) | The public address + that path |
| A link on the public host (http or https) | The same path on the public address |
| A link on the internal host (`192.168.1.17:81`) | The same path on the public address |
| Any other domain, `javascript:`, garbage, or nothing | A real MMS route on the public address (the job card, or that section's list page) |

So the internal address never reaches the browser, and an MMS payload cannot send a user to
another site. FMP never calls the public address and never sends the integration key to it.

## Dashboard states and troubleshooting

| FMP shows | MMS response | Fix |
|---|---|---|
| Live from MMS · Last synced … | 200 | — |
| MMS integration not configured | (not called) | Set `MMS_INTEGRATION_KEY` on the FMP API |
| MMS integration authentication failed | 401 / 403 | The FMP and MMS keys don't match |
| MMS live integration not enabled | 503 | `FMP_INTEGRATION_KEY` is missing or shorter than 32 characters on MMS |
| MMS live integration not enabled (redirected) | 3xx to `/login` | MMS is running a build without the endpoint or its `proxy.ts` bypass. **This was the state on 2026-10-01.** |
| Maintenance MMS is currently unavailable | 5xx, timeout, network, bad JSON/shape | Check that MMS is up. The API log line is `MMS live dashboard request failed: …` (the key is never logged). |
| Live MMS data restricted | (not called) | Give the user ALL_DEPARTMENTS Maintenance scope |
