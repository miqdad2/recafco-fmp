# Management Intelligence Center (FMP-MIC-01)

Read-only reporting workspace inside RECAFCO FMP for management users. Same login page, same session, same user table.

## Access
- Permission `management_intelligence.read`; role `MANAGEMENT_INTELLIGENCE_VIEWER` (this permission only).
- Create an account in Administration > Users > New User > Custom > Management Intelligence Viewer. Do not grant Full Platform Access or operational roles to management-only users.
- Management-only users land on `/management/intelligence` and cannot open operational routes (web layout redirect) or operational APIs (they hold no operational permission). Users with operational permissions keep their normal landing page.
- SUPER_ADMIN/ADMIN do not get the permission automatically; assign the role (or add the permission to a role) deliberately.

## Data-source boundary
Every figure shown in this area must come from RECAFCO Factory Management at `http://192.168.0.12:8080`, never from FMP contract, technical, production, storage, MMS or Factory Performance data. The FMP database holds only accounts, roles and permissions for this feature.

Endpoints discovered (browser-authenticated 200, unauthenticated 401):
- `GET /api/operations/summary`
- `GET /api/projects/{project-id}/dashboard`
- `GET /api/management/report`

## Planned integration (not built)
- A server-side, read-only client in `apps/api/src/management-intelligence/`, called only by routes guarded with `management_intelligence.read`; the browser never talks to Factory Management and never sees its credentials.
- Credentials via environment variables (approved service credential or API key), never personal logins, copied cookies or scraping.
- Pages then replace `ConnectionPending` with KPI cards/charts from `_components/report-foundation.tsx`, showing `DataFreshness` and explicit error/empty states.

## Pending
Approved integration credential from the Factory Management owners; decision on whether dual-access users get a link to the Center from the operational sidebar.

## Creating a management account (FMP-MIC-01C)
Administration > Users > New User > Account Access > "Management Intelligence Viewer". Enter full name, email (the login) and optionally an employee number; review; Create User. The existing temporary password and first-login change apply. The account gets only the role `MANAGEMENT_INTELLIGENCE_VIEWER`, no Full Platform Access and no module access, and signs in at the normal `/login`, landing on `/management/intelligence`.

Server rules: the web action resolves the role itself by code; the API refuses the role if it holds anything but `management_intelligence.*`, and refuses Full Platform Access or module-access changes for such an account. Changing an existing operational user's role to this one through Edit User is not covered by these checks.
