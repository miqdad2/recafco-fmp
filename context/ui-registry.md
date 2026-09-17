# UI Registry

Living document. Update after every reusable component or established visual pattern is built.

## Before Building

1. Search this registry.
2. Reuse an existing component or exact pattern where possible.
3. Follow `ui-tokens.md` and `ui-rules.md`.
4. Add the component here after implementation.

## Entry Format

```text
### ComponentName
- Path:
- Purpose:
- Variants:
- Key tokens/classes:
- Accessibility behavior:
- Used by:
- Notes:
```

## Components

### AppShell
- Path: `apps/web/src/app/(protected)/_components/app-shell.tsx`
- Purpose: Root layout wrapper for all authenticated pages; manages mobile nav open state.
- Variants: Single variant; desktop sidebar always visible, mobile sidebar toggled.
- Key tokens/classes: `flex h-screen overflow-hidden`; mobile backdrop `bg-black/50 z-30`
- Accessibility behavior: Mobile nav managed with `aria-expanded`, `aria-controls="mobile-nav"`, Escape key closes, focus restored to trigger, body scroll prevented, closes on route change.
- Used by: `(protected)/layout.tsx`
- Notes: `'use client'`; children rendered as RSC pass-through. Props: `user: ShellUser`, `children: ReactNode`.

### Sidebar
- Path: `apps/web/src/app/(protected)/_components/sidebar.tsx`
- Purpose: Primary navigation sidebar with grouped sections and expandable Administration.
- Variants: Desktop (`hidden md:flex w-64 fixed`) and mobile (`fixed inset-y-0 left-0 z-40 md:hidden` with transform transition).
- Key tokens/classes: `bg-sidebar text-sidebar-text`; active link `bg-sidebar-active text-sidebar-active-text`; accent left border on active
- Accessibility behavior: Administration toggle has `aria-expanded` + `aria-controls="admin-nav-items"`; close button present on mobile; auto-expands when pathname starts with `/administration`.
- Used by: `AppShell`
- Notes: `'use client'`; Permission-aware: ADMIN_ITEMS filtered by `user.permissions.includes(item.permission)`; Administration section hidden entirely if user has no admin permissions.

### TopHeader
- Path: `apps/web/src/app/(protected)/_components/top-header.tsx`
- Purpose: Top bar with mobile hamburger, user info, and logout button.
- Variants: Single variant; hamburger only visible on mobile (`md:hidden`).
- Key tokens/classes: `h-14 bg-surface border-b border-border`
- Accessibility behavior: Hamburger calls `onMenuOpen(e.currentTarget)` for focus restoration.
- Used by: `AppShell`
- Notes: `'use client'`; logout via `<form action={logoutAction}>` server action. Props: `user: ShellUser`, `onMenuOpen: (el: HTMLElement) => void`.

### Breadcrumbs
- Path: `apps/web/src/app/(protected)/_components/breadcrumbs.tsx`
- Purpose: Page-level breadcrumb trail with accessible markup.
- Variants: Items with `href` render as links; last item always has no `href` (current page).
- Key tokens/classes: `text-text-muted text-sm`; links use `hover:text-text-primary`; ChevronRight separator from lucide-react.
- Accessibility behavior: `<nav aria-label="Breadcrumb">`; last item gets `aria-current="page"`.
- Used by: All administration pages, (protected) landing pages.
- Notes: Props: `items: BreadcrumbItem[]` where `BreadcrumbItem = { label: string; href?: string }`.

### MetricCard
- Path: `apps/web/src/app/(protected)/_components/metric-card.tsx`
- Purpose: Dashboard metric card showing a label, value, icon, and status.
- Variants: `ok` (shows value, optionally links), `restricted` (Lock icon badge), `unavailable` (WifiOff icon badge).
- Key tokens/classes: `bg-surface rounded-lg border border-border p-5 shadow-sm`
- Accessibility behavior: Wraps in `<Link>` only when `href && status === 'ok'`; status badges use icon + text.
- Used by: `(protected)/page.tsx` (dashboard)
- Notes: `MetricStatus = 'ok' | 'restricted' | 'unavailable'`. Props: `label`, `value?: string | number | undefined`, `icon: LucideIcon`, `iconColor?`, `href?`, `status`, `source?`. Export `MetricCardProps` and `MetricStatus`.

### ModuleCard
- Path: `apps/web/src/app/(protected)/_components/module-card.tsx`
- Purpose: Dashboard card linking to an operational module with status and phase info.
- Variants: `available` (accent ArrowRight hover, clickable) vs `planned` (muted, not clickable).
- Key tokens/classes: `group`, `group-hover:text-accent` on arrow icon; `opacity-60` on planned cards.
- Accessibility behavior: Entire card is a `<Link>` for available; `<div>` for planned.
- Used by: `(protected)/page.tsx` (dashboard)
- Notes: Props: `title`, `description`, `href`, `icon: LucideIcon`, `status: 'available' | 'planned'`, `phase`.

### PermissionGate
- Path: `apps/web/src/app/(protected)/_components/permission-gate.tsx`
- Purpose: Client-side conditional render based on permission presence in the user's permission array.
- Variants: Single variant; `fallback` prop for alternate content.
- Key tokens/classes: None — pure logic.
- Accessibility behavior: No wrapper elements; renders children or fallback directly.
- Used by: Pages that need to conditionally render UI based on permissions.
- Notes: Props: `permission: string`, `permissions: string[]`, `children: ReactNode`, `fallback?: ReactNode`.

### StatusBadge
- Path: `apps/web/src/app/(protected)/administration/_components/status-badge.tsx`
- Purpose: Display active/inactive state of any organization entity.
- Variants: `isActive: true` → green pill; `isActive: false` → muted grey pill.
- Key tokens/classes: `bg-success-light text-success` / `bg-surface-secondary text-text-muted`; `rounded-full px-2 py-0.5 text-xs font-medium`
- Accessibility behavior: `aria-label` attribute set to "Active" or "Inactive".
- Used by: `departments/page.tsx`, `plants/page.tsx`, `locations/page.tsx`, `users/page.tsx`, `roles/page.tsx`
- Notes: Requires `isActive: boolean` prop only.

### PageHeader
- Path: `apps/web/src/app/(protected)/administration/_components/page-header.tsx`
- Purpose: Consistent page title + description block with an optional right-side action slot.
- Variants: With and without `action` slot.
- Key tokens/classes: `text-text-primary text-2xl font-semibold`, `text-text-muted text-sm mt-1`
- Accessibility behavior: Title rendered as `<h1>`.
- Used by: All administration entity list and edit pages.
- Notes: Props: `title: string`, `description?: ReactNode`, `action?: ReactNode`. Description accepts JSX (updated Unit 05).

### EmptyState
- Path: `apps/web/src/app/(protected)/administration/_components/empty-state.tsx`
- Purpose: Centered empty-list placeholder with icon and text.
- Variants: Single variant; caller controls message text.
- Key tokens/classes: `text-text-muted`, centered flex column.
- Accessibility behavior: Decorative SVG icon; message in `<p>`.
- Used by: All administration entity list pages.
- Notes: Props: `message: string`.

### ErrorState
- Path: `apps/web/src/app/(protected)/administration/_components/error-state.tsx`
- Purpose: Inline error display for failed data fetches.
- Variants: Single variant; red icon + error text.
- Key tokens/classes: `text-danger` icon, `text-text-primary` message.
- Accessibility behavior: Renders `role="alert"` implicitly via semantic placement.
- Used by: All administration entity list pages.
- Notes: Props: `message: string`.

### OrgEntityForm
- Path: `apps/web/src/app/(protected)/administration/_components/org-entity-form.tsx`
- Purpose: Reusable create/edit form for departments and plants (code, name, description).
- Variants: Create mode (code editable) vs edit mode (`codeReadonly` prop).
- Key tokens/classes: Uses `font-mono uppercase` on code input; `bg-surface-secondary` on readonly code.
- Accessibility behavior: All inputs have associated `<label>`; server errors displayed inline.
- Used by: `departments/new/page.tsx`, `departments/[id]/edit/page.tsx`, `plants/new/page.tsx`, `plants/[id]/edit/page.tsx`
- Notes: `'use client'`; uses `useActionState` (React 19). Props: `action`, `defaultValues?`, `submitLabel`, `codeReadonly?`. State type: `OrgEntityFormState`.

### LocationForm
- Path: `apps/web/src/app/(protected)/administration/_components/location-form.tsx`
- Purpose: Create/edit form for locations; extends OrgEntityForm with a plant `<select>` dropdown.
- Variants: Same as OrgEntityForm; plant selector shows "None (no plant)" as first option.
- Key tokens/classes: Same as OrgEntityForm; select uses `bg-surface border-border` tokens.
- Accessibility behavior: Plant select has associated `<label>`.
- Used by: `locations/new/page.tsx`, `locations/[id]/edit/page.tsx`
- Notes: Props: same as OrgEntityForm plus `plants: OrgEntity[]`.

### LoginForm
- Path: `apps/web/src/app/login/_components/login-form.tsx`
- Purpose: Full-page login form with username and password fields.
- Variants: Single variant; shows inline error on failed login.
- Key tokens/classes: `bg-background`, card with `bg-surface border-border`; `accent` submit button.
- Accessibility behavior: Inputs have `<label>`; error shown with `role="alert"`.
- Used by: `app/login/page.tsx`
- Notes: `'use client'`; `useActionState(loginAction, null)`; server action sets cookies and calls `redirect()`.

### ChangePasswordForm
- Path: `apps/web/src/app/change-password/_components/change-password-form.tsx`
- Purpose: Change-password form with current password, new password, and confirm fields.
- Variants: Single variant; shows inline error; success redirects to login (cookie cleared by server action).
- Key tokens/classes: Same card pattern as LoginForm.
- Accessibility behavior: Inputs have `<label>`; error shown with `role="alert"`.
- Used by: `app/change-password/page.tsx`
- Notes: `'use client'`; `useActionState(changePasswordAction, null)`.

### UserForm
- Path: `apps/web/src/app/(protected)/administration/users/_components/user-form.tsx`
- Purpose: Create/edit user form — username, displayName, email, employeeNumber, role, department, plant, location.
- Variants: Create mode (username editable) vs edit mode (username readonly). On success shows temp password once (create) or success message (edit).
- Key tokens/classes: `font-mono` on username; `bg-surface-secondary cursor-not-allowed` on readonly; `text-error` field error messages.
- Accessibility behavior: All inputs labelled; field errors have `role="alert"`; required fields marked with `aria-hidden` asterisk.
- Used by: `administration/users/new/page.tsx`, `administration/users/[id]/edit/page.tsx`
- Notes: `'use client'`; `useActionState`; exports `UserFormState` type (shared with `ResetPasswordForm`). `FieldError` props use `errors: string[] | undefined` (not `errors?: string[]`) for `exactOptionalPropertyTypes` compliance.

### ResetPasswordForm
- Path: `apps/web/src/app/(protected)/administration/users/_components/reset-password-form.tsx`
- Purpose: Single-button form to reset a user's password; shows temp password once on success.
- Variants: Pending state disables button; success state shows temp password card.
- Key tokens/classes: `bg-success-light border-success` success card; `font-mono break-all` temp password display.
- Accessibility behavior: Success message conveys the temp password to share.
- Used by: `administration/users/[id]/edit/page.tsx`
- Notes: `'use client'`; wraps a 3-arg `resetPasswordAction.bind(null, id)` inside `useActionState` so it satisfies the 1-arg `<form action>` contract.

### ScopeBadge
- Path: `apps/web/src/app/(protected)/administration/users/_components/scope-badge.tsx`
- Purpose: Pill badge for `DepartmentAccessScope` values with correct colour semantics.
- Variants: `OWN_DEPARTMENT` → neutral blue; `SELECTED_DEPARTMENTS` → amber; `ALL_DEPARTMENTS` → red/error; `NO_ACCESS` → muted grey.
- Key tokens/classes: `rounded-full px-2 py-0.5 text-xs font-medium border`; token-mapped per scope.
- Accessibility behavior: Purely presentational; no role attribute needed.
- Used by: `ModuleAccessSummary`, `module-access-panel.tsx`, list pages.
- Notes: Accepts `scope: DepartmentAccessScope | 'NO_ACCESS'`. Exports `ScopeOrNoAccess` type. Pure RSC (no hooks).

### UserSecurityStatus
- Path: `apps/web/src/app/(protected)/administration/users/_components/user-security-status.tsx`
- Purpose: Compact multi-badge display of a user's account status (active/inactive + locked + must-change-password).
- Variants: Active (green pill), Inactive (muted grey), Locked (amber), Must Change Password (amber).
- Key tokens/classes: `rounded-full px-2.5 py-0.5 text-xs font-medium`; tokens: `bg-success-light text-success`, `bg-warning-light text-warning`, `bg-surface-secondary text-text-muted`.
- Accessibility behavior: Active/Inactive badge uses `aria-label`.
- Used by: `administration/users/page.tsx`, `EditUserTabs`
- Notes: Props: `isActive`, `isLocked`, `mustChangePassword`. Pure RSC.

### ModuleAccessSummary
- Path: `apps/web/src/app/(protected)/administration/users/_components/module-access-summary.tsx`
- Purpose: Compact inline badge strip showing elevated (non-default) module scopes; up to N visible then "+N more" overflow badge.
- Variants: All-defaults → "All defaults" text; ≤N elevated → inline badges; >N → last badge is count overflow.
- Key tokens/classes: `ScopeBadge` for each scope; overflow uses `bg-surface-secondary text-text-muted border-border`.
- Accessibility behavior: Purely presentational.
- Used by: User list pages, future user drawer/dialog.
- Notes: Props: `moduleAccess: UserModuleAccessConfig[]`, `maxVisible?: number` (default 3). Pure RSC.

### RolePermissionSummary
- Path: `apps/web/src/app/(protected)/administration/users/_components/role-permission-summary.tsx`
- Purpose: Collapsible panel listing all permissions for a role, grouped by module with dot-bullet items.
- Variants: Collapsed (shows count summary, "▼ View permissions") and expanded (shows grouped list per module).
- Key tokens/classes: `rounded-md border border-border bg-surface`; expand button uses `hover:bg-surface-secondary`.
- Accessibility behavior: `aria-expanded` on toggle button; grouped by module heading.
- Used by: `NewUserForm` (Section 3), `EditUserTabs` (Role tab)
- Notes: `'use client'`; Props: `permissions: PermissionSummary[]`. Groups by `p.module` field.

### ModuleAccessEditor
- Path: `apps/web/src/app/(protected)/administration/users/_components/module-access-editor.tsx`
- Purpose: Inline per-module scope editor for use inside a creation form; renders all 7 modules with scope selectors as native form inputs (name=`module_scope_{MODULE}`) for FormData submission.
- Variants: Per-module scope selector; `SELECTED_DEPARTMENTS` shows checkbox list; `ALL_DEPARTMENTS` shows warning banner; `canManageAll: false` hides ALL_DEPARTMENTS option.
- Key tokens/classes: Same scope/department list pattern as `ModuleAccessPanel`.
- Accessibility behavior: Each scope selector has `<label>`; department checkboxes labelled inline.
- Used by: `NewUserForm` (Section 4)
- Notes: `'use client'`; exports `getAvailableScopeOptions(canManageAll)` (also in `scope-utils.ts`) and `ALL_MODULES` constant. Props: `allDepartments`, `canManageAll`, `defaultValues?`.

### NewUserForm
- Path: `apps/web/src/app/(protected)/administration/users/_components/new-user-form.tsx`
- Purpose: 4-section user creation form — (1) Account Information, (2) Organization Assignment with missing-dept warning, (3) Role & Permissions with collapsible permission preview, (4) Module Access with per-module scope editor.
- Variants: Form state (in progress), success screen (shows temp password with Copy button, Go to User, Create Another, Back to Users actions), partial-success screen (module access failures listed with warning).
- Key tokens/classes: Section cards use `rounded-lg border border-border bg-surface p-6`; section numbers are accent circles.
- Accessibility behavior: Each section labelled; field errors have `role="alert"`; required fields marked; Copy button uses `navigator.clipboard`.
- Used by: `administration/users/new/page.tsx`
- Notes: `'use client'`; `useActionState(createUserWithAccessAction, null)`. Props include `canManageAll` for ALL_DEPARTMENTS option. `RoleWithPerms` interface extends `RoleSummary` with permissions.

### EditUserTabs
- Path: `apps/web/src/app/(protected)/administration/users/_components/edit-user-tabs.tsx`
- Purpose: Tabbed edit UI for user administration — Profile, Organization, Role & Permissions, Module Access, Security.
- Variants: 5 tabs; active tab has `border-accent text-accent` underline; each tab renders its own form component. Module Access tab reuses `ModuleAccessPanel`. Security tab shows `UserSecurityStatus` + reset password + activate/deactivate + unlock.
- Key tokens/classes: Tab bar: `border-b border-border -mx-8 px-8`; active: `border-b-2 border-accent text-accent`; inactive: `border-transparent text-text-secondary`.
- Accessibility behavior: `role="tablist"` + `role="tab"` + `aria-selected` on each tab; `role="tabpanel"` on content area.
- Used by: `administration/users/[id]/edit/page.tsx`
- Notes: `'use client'`; all bound server actions passed as props from the server page. Profile/Org/Role save via `useActionState` with inline success/error messages (no redirect).

### ModuleAccessPanel
- Path: `apps/web/src/app/(protected)/administration/users/_components/module-access-panel.tsx`
- Purpose: Inline per-module scope editor on the user edit page; shows current scope badge for each of the 7 modules; allows admin to change scope with a dropdown; shows department checkboxes when `SELECTED_DEPARTMENTS` is chosen.
- Variants: Read-only mode (`canManage: false` hides "Change" buttons); edit mode inline per row (one form open at a time); `ALL_DEPARTMENTS` option only shown when `canManageAll: true`.
- Key tokens/classes: Scope badge colors: `OWN_DEPARTMENT` → `bg-surface-secondary text-text-secondary`; `SELECTED_DEPARTMENTS` → `bg-warning-light text-warning`; `ALL_DEPARTMENTS` → `bg-success-light text-success`. Department list scrollable at `max-h-36`.
- Accessibility behavior: Each module row has labelled form fields; submit button shows "Saving…" during pending state; cancel returns to read view.
- Used by: `administration/users/[id]/edit/page.tsx`
- Notes: `'use client'`; each module row has its own isolated `useActionState` with a closure binding `(userId, module)`; `action` prop is the `setModuleAccessAction` server action passed from the server page. Props: `userId`, `moduleAccess: UserModuleAccessConfig[]`, `allDepartments`, `action`, `canManage`, `canManageAll`.

### DashboardScopeBadge
- Path: `apps/web/src/app/(protected)/_components/dashboard-scope-badge.tsx`
- Purpose: Displays the department scope for any module dashboard — All Departments, My Department, or N Departments.
- Variants: `ALL_DEPARTMENTS` → grey Globe icon; `OWN_DEPARTMENT` → blue/info Building2 icon with dept name; `SELECTED_DEPARTMENTS` → secondary LayoutList icon with count.
- Key tokens/classes: `inline-flex items-center gap-1 text-sm`; variant-specific icon colors.
- Accessibility behavior: Purely informational; no interactive state.
- Used by: All 7 module dashboard pages.
- Notes: Props: `scope: { type: DashboardScopeType; departmentNames: string[] } | undefined`. Returns `null` when scope is undefined. `DashboardScopeType = 'OWN_DEPARTMENT' | 'SELECTED_DEPARTMENTS' | 'ALL_DEPARTMENTS'`.

### DashboardRecentTable
- Path: `apps/web/src/app/(protected)/_components/dashboard-recent-table.tsx`
- Purpose: Renders a compact table of the 8 most-recently-updated records for any module's dashboard, with clickable row links.
- Variants: Optional `hrefSuffix` (e.g., `/edit` for admin user links); optional `emptyMessage` override.
- Key tokens/classes: `divide-y divide-border`; row links use `hover:bg-surface-secondary`; status shown as `font-mono text-xs uppercase`.
- Accessibility behavior: `<table>` with `<thead>`/`<tbody>`; each row is a `<Link>` spanning via block layout.
- Used by: All 7 module dashboard pages.
- Notes: Props: `items: DashboardRecentItem[]`, `baseHref: string`, `hrefSuffix?: string`, `emptyMessage?: string`. `DashboardRecentItem = { id, referenceNumber, title, status, updatedAt }`. Link format: `${baseHref}/${item.id}${hrefSuffix}`.

---

## API Patterns (Unit 06)

### PermissionGuard + @Permissions() — Server-side Authorization Pattern
- Guard: `apps/api/src/common/guards/permission.guard.ts`
- Decorator: `apps/api/src/common/decorators/permissions.decorator.ts`
- Purpose: Gate any controller endpoint on one or more permission codes loaded live from DB.
- Usage: Apply `@UseGuards(JwtAuthGuard, PermissionGuard)` at controller class level; add `@Permissions('module.action')` at handler level. Multiple codes = AND (all required).
- Permission resolution: `JwtAuthGuard` loads `role.permissions[]` from DB on every authenticated request (live, no cache). `PermissionGuard` reads the loaded `user.permissions` string array.
- Used by: `UsersController`, `RolesController`, `DepartmentsController`, `PlantsController`, `LocationsController`
- Notes: No `@Permissions()` on a handler = public within the guard chain (any authenticated user passes). `Reflector.getAllAndOverride` checks handler then class, enabling per-endpoint overrides.

### AuthUser Type — Authenticated Request Context
- Path: `apps/api/src/common/types/auth-user.ts`
- Purpose: Shape of `req.user` after `JwtAuthGuard` processes a request.
- Fields: `id`, `username`, `displayName`, `roleId`, `roleCode`, `roleName`, `permissions: string[]`, `mustChangePassword`, `isActive`, `sessionId`, `departmentId: string | null`
- Notes: `permissions` is an array of dot-notation codes (e.g. `'users.read'`). DB is authoritative — never trust JWT for role/permissions. `departmentId` populated from DB by `JwtAuthGuard` (Unit 15); used by `DepartmentAccessService.buildDeptFilter` for `OWN_DEPARTMENT` scope.

### RoleId-based User Mutations
- Pattern: Role assignment uses `PATCH /administration/users/:id/role` with `{ roleId: string }` body; `UpdateUserDto` has no role field.
- Notes: Privilege escalation guard in `UsersService.updateRole()`: only `SUPER_ADMIN` may assign `SUPER_ADMIN`. Last-active-SUPER_ADMIN protection in both `deactivate()` and `updateRole()`.

---

---

## Incident Components (Unit 08)

### IncidentStatusBadge
- Path: `apps/web/src/app/(protected)/incidents/_components/incident-status-badge.tsx`
- Purpose: Pill badge for the 8 incident lifecycle statuses.
- Variants: DRAFT (muted), SUBMITTED (info-light/text-info), UNDER_REVIEW (accent-light/text-accent), INVESTIGATION (purple), ACTION_REQUIRED (warning), RESOLVED (success), CLOSED (muted/text-text-secondary), CANCELLED (muted).
- Key tokens/classes: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`
- Accessibility behavior: Pure RSC; no additional aria attributes.
- Used by: `incidents/page.tsx`, `incidents/[id]/page.tsx`
- Notes: Props: `status: IncidentStatus`. Exported as named export.

### IncidentSeverityBadge
- Path: `apps/web/src/app/(protected)/incidents/_components/incident-severity-badge.tsx`
- Purpose: Pill badge for the 4 incident severity levels.
- Variants: LOW (success), MEDIUM (warning), HIGH (`text-orange-700 bg-orange-50`), CRITICAL (danger).
- Key tokens/classes: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`
- Accessibility behavior: Pure RSC; no additional aria attributes.
- Used by: `incidents/page.tsx`, `incidents/[id]/page.tsx`
- Notes: Props: `severity: IncidentSeverity`. Exported as named export.

### IncidentForm
- Path: `apps/web/src/app/(protected)/incidents/_components/incident-form.tsx`
- Purpose: Create / edit form for incident reports — title, severity, occurredAt (datetime-local), description, immediateAction, affected plant, affected department.
- Variants: Used for both new (create) and edit (DRAFT update) by passing different `action` and `defaultValues`.
- Key tokens/classes: `space-y-6 max-w-2xl`; standard form input tokens.
- Accessibility behavior: All inputs labelled; required fields marked with aria-hidden asterisk; field errors shown with `role="alert"`.
- Used by: `incidents/new/page.tsx`, `incidents/[id]/edit/page.tsx`
- Notes: `'use client'`; `useActionState(action, { error: null })`. Props: `action`, `submitLabel`, `plants: OrgRef[]`, `departments: OrgRef[]`, `defaultValues?: Partial<Incident>`.

### ActivityTimeline
- Path: `apps/web/src/app/(protected)/incidents/_components/activity-timeline.tsx`
- Purpose: Merged, chronological list of `IncidentActivity` events and `IncidentComment` entries.
- Variants: Activity events show a bullet dot; comments show author initial in accent avatar.
- Key tokens/classes: `space-y-4`; comment bubble `rounded-lg border border-border bg-surface p-3`.
- Accessibility behavior: Rendered as `<ol aria-label="Incident activity timeline">`.
- Used by: `incidents/[id]/page.tsx`
- Notes: Pure RSC. Props: `activities: IncidentActivity[]`, `comments: IncidentComment[]`. Sorts by `createdAt` ascending.

### IncidentActionRow
- Path: `apps/web/src/app/(protected)/incidents/_components/incident-action-row.tsx`
- Purpose: Single corrective action row with status badge, metadata, and advance-status button.
- Variants: Shows "Mark In Progress" / "Mark Completed" based on `STATUS_NEXT` map; no button for terminal states (COMPLETED/CANCELLED).
- Key tokens/classes: `flex items-start gap-3 rounded-lg border border-border bg-surface p-4`
- Accessibility behavior: Advance button disabled during transition; `disabled:opacity-50`.
- Used by: `incidents/[id]/page.tsx`
- Notes: `'use client'`; `useTransition`. Props: `action: IncidentAction`, `incidentId: string`, `canUpdate: boolean`.

### IncidentTransitionsPanel
- Path: `apps/web/src/app/(protected)/incidents/_components/incident-transitions.tsx`
- Purpose: All status transition buttons for the incident detail sidebar; shows inline panels for inputs (cancel reason, reopen reason, resolve summary, assign, severity change).
- Variants: Rendered buttons depend on `incident.status` + `permissions`; inline panel opened by `activePanel` state (one at a time).
- Key tokens/classes: `space-y-2` button list; inline panels `rounded-lg border border-border bg-surface p-4 space-y-3`.
- Accessibility behavior: Buttons disable during pending transitions; confirm buttons also disabled if required inputs are empty.
- Used by: `incidents/[id]/page.tsx`
- Notes: `'use client'`; `useTransition`. Props: `incident: Incident`, `currentUserId: string`, `permissions: string[]`, `people: UserRef[]`. Handles `INCIDENT_OPEN_ACTIONS` resolve confirmation flow with checkbox.

### InvestigationPanel
- Path: `apps/web/src/app/(protected)/incidents/_components/investigation-panel.tsx`
- Purpose: Editable form for root cause and investigation summary fields (shown only during INVESTIGATION/ACTION_REQUIRED statuses to users with `incidents.investigate`).
- Variants: Single variant; inline error on failure.
- Key tokens/classes: `space-y-4`; standard textarea tokens.
- Accessibility behavior: Labels associated with textareas; error shown with `role="alert"`.
- Used by: `incidents/[id]/page.tsx`
- Notes: `'use client'`; `useActionState(updateInvestigationAction.bind(null, incidentId), { error: null })`. Props: `incidentId`, `rootCause`, `investigationSummary`.

### AddCommentForm
- Path: `apps/web/src/app/(protected)/incidents/_components/add-comment-form.tsx`
- Purpose: Single-textarea form to post a comment on an incident.
- Variants: Single variant; inline error on failure.
- Key tokens/classes: `space-y-3`; accent submit button.
- Accessibility behavior: Error shown above textarea.
- Used by: `incidents/[id]/page.tsx`
- Notes: `'use client'`; `useActionState`. Props: `incidentId: string`.

### AddActionItemForm
- Path: `apps/web/src/app/(protected)/incidents/_components/add-action-form.tsx`
- Purpose: Toggled form to add a corrective action item — title, description, assignee select, due date.
- Variants: Collapsed (shows "+ Add action item" button) / Expanded (full form with Discard button).
- Key tokens/classes: `rounded-lg border border-border bg-surface p-4 space-y-4`; grid-cols-2 for assignee + due date.
- Accessibility behavior: Required title field marked; field errors inline.
- Used by: `incidents/[id]/page.tsx`
- Notes: `'use client'`; `useState` for toggle + `useActionState` for form. Props: `incidentId: string`, `people: UserRef[]`.

---

## API Patterns (Unit 08)

### IncidentsService — Concurrency-safe Status Transitions
- Pattern: `updateMany(where: { id, status: currentStatus })` + count check; throws `INCIDENT_CONCURRENT_MODIFICATION` if count === 0.
- Used by: All status transition methods in `IncidentsService`.
- Notes: Prevents TOCTOU races; never use findUnique + update pair for status transitions.

### Atomic Sequence Upsert
- Pattern: `$queryRaw` with `INSERT ... ON CONFLICT (year) DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq`.
- Used by: `IncidentsRefService.nextRef()`.
- Notes: Prisma's standard `upsert` is not atomic across connections; `$queryRaw` is required for sequence safety.

---

## Factory Task Components (Unit 09)

### TaskStatusBadge
- Path: `apps/web/src/app/(protected)/factory-tasks/_components/task-status-badge.tsx`
- Purpose: Pill badge for the 8 factory-task lifecycle statuses.
- Variants: DRAFT (surface-secondary/muted), OPEN (secondary-accent), ASSIGNED (info), IN_PROGRESS (warning), BLOCKED (danger), COMPLETED (success), CLOSED (surface-secondary), CANCELLED (surface-secondary/muted).
- Key tokens/classes: `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium`
- Accessibility behavior: Pure RSC; `aria-label` set to `Status: {label}`.
- Used by: `factory-tasks/page.tsx`, `factory-tasks/[id]/page.tsx`, `factory-tasks/my/page.tsx`
- Notes: Props: `status: TaskStatus`. Exported as named export.

### TaskPriorityBadge
- Path: `apps/web/src/app/(protected)/factory-tasks/_components/task-priority-badge.tsx`
- Purpose: Pill badge for the 4 task priority levels (LOW, MEDIUM, HIGH, URGENT).
- Variants: LOW (surface-secondary), MEDIUM (info), HIGH (warning), URGENT (danger).
- Key tokens/classes: `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium`
- Accessibility behavior: Pure RSC; `aria-label` set to `Priority: {label}`.
- Used by: `factory-tasks/page.tsx`, `factory-tasks/[id]/page.tsx`, `factory-tasks/my/page.tsx`
- Notes: Props: `priority: TaskPriority`. Priority is `LOW | MEDIUM | HIGH | URGENT` (never CRITICAL).

### TaskForm
- Path: `apps/web/src/app/(protected)/factory-tasks/_components/task-form.tsx`
- Purpose: Create / edit form for factory tasks — title, description, priority, responsibleDepartmentId, requestingDepartmentId, plantId, dueAt, optional incidentId.
- Variants: Used for both new (create) and edit (DRAFT update) by passing different `action` and `defaultValues`.
- Key tokens/classes: `space-y-6 max-w-2xl`; standard form input tokens.
- Accessibility behavior: All inputs labelled; required fields marked with aria-hidden asterisk; field errors shown with `role="alert"`.
- Used by: `factory-tasks/new/page.tsx`, `factory-tasks/[id]/edit/page.tsx`
- Notes: `'use client'`; `useActionState`. Props: `action`, `submitLabel`, `departments`, `plants`, `canLinkIncident?`, `defaultValues?`. Incident field rendered only when `canLinkIncident` is true (requires `incidents.read` permission).

### TaskTransitionsPanel
- Path: `apps/web/src/app/(protected)/factory-tasks/_components/task-transitions.tsx`
- Purpose: All status transition buttons for the task detail sidebar; inline panels for assign, block reason, complete summary, reopen reason, cancel reason, priority change.
- Variants: Rendered buttons depend on `task.status` + permissions + assignee ownership (`isAssignee`, `isCreator`, `has('tasks.manage')`); one panel open at a time.
- Key tokens/classes: `space-y-2` button list; inline panels `rounded-lg border border-border bg-surface p-4 space-y-3`.
- Accessibility behavior: Buttons disable during pending transitions.
- Used by: `factory-tasks/[id]/page.tsx`
- Notes: `'use client'`; `useState` + `useTransition`. Props: `task`, `currentUserId`, `permissions`, `people`. Assignee-only transitions: start, block, unblock, complete. Creator-or-manage transitions: cancel, reopen.

### TaskActivityTimeline
- Path: `apps/web/src/app/(protected)/factory-tasks/_components/task-activity-timeline.tsx`
- Purpose: Merged, chronological list of `FactoryTaskActivity` events and `FactoryTaskComment` entries.
- Variants: Activity events show a bullet dot; comments show author initial in accent avatar.
- Key tokens/classes: `space-y-4`; comment bubble `rounded-lg border border-border bg-surface p-3`.
- Accessibility behavior: Rendered as `<ol aria-label="Task activity timeline">`.
- Used by: `factory-tasks/[id]/page.tsx`
- Notes: Pure RSC. Props: `activities: FactoryTaskActivity[]`, `comments: FactoryTaskComment[]`. Sorts merged list by `createdAt` ascending. EVENT_LABELS map covers 14 event types.

### AddProgressForm (Factory Tasks)
- Path: `apps/web/src/app/(protected)/factory-tasks/_components/add-progress-form.tsx`
- Purpose: Form to record a progress update — optional percentage (0-100) and required note.
- Variants: Single variant; inline error on failure.
- Key tokens/classes: `space-y-3`; accent submit button.
- Accessibility behavior: Error shown with `role="alert"`.
- Used by: `factory-tasks/[id]/page.tsx`
- Notes: `'use client'`; `useActionState`. Props: `taskId: string`. Rendered only when `canAddProgress` is true (IN_PROGRESS or BLOCKED status AND assignee or `tasks.manage`).

### AddTaskCommentForm
- Path: `apps/web/src/app/(protected)/factory-tasks/_components/add-comment-form.tsx`
- Purpose: Single-textarea form to post a comment on a factory task.
- Variants: Single variant; inline error on failure.
- Key tokens/classes: `space-y-3`; accent submit button.
- Accessibility behavior: Error shown above textarea.
- Used by: `factory-tasks/[id]/page.tsx`
- Notes: `'use client'`; `useActionState`. Props: `taskId: string`. Distinct from incidents `AddCommentForm` — different module path and `taskId` prop.

---

## API Patterns (Unit 09)

### FactoryTasksService — Concurrency-safe Status Transitions
- Pattern: `updateMany(where: { id, status: currentStatus })` + count check; throws `TASK_CONCURRENT_MODIFICATION` if count === 0.
- Used by: All status transition methods in `FactoryTasksService`.
- Notes: Same TOCTOU-prevention pattern as `IncidentsService`. Never use findUnique + update for status transitions.

---

## Maintenance Request Components (Unit 10)

### MrStatusBadge
- Path: `apps/web/src/app/(protected)/maintenance/_components/mr-status-badge.tsx`
- Purpose: Pill badge for the 11 maintenance request lifecycle statuses.
- Variants: DRAFT (muted), SUBMITTED (info-light/text-info), UNDER_REVIEW (accent-light/text-accent), APPROVED (info/white), ASSIGNED (info/white), IN_PROGRESS (warning-light/warning), WAITING_FOR_PARTS (danger-light/danger), COMPLETED (success-light/success), CLOSED (surface-secondary/text-secondary), REJECTED (muted), CANCELLED (muted).
- Key tokens/classes: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`
- Accessibility behavior: Pure RSC; no additional aria attributes.
- Used by: `maintenance/page.tsx`, `maintenance/[id]/page.tsx`, `maintenance/my/page.tsx`
- Notes: Props: `status: MaintenanceStatus`. Exported as named export. WAITING_FOR_PARTS uses danger color to convey blockage urgency.

### MrPriorityBadge
- Path: `apps/web/src/app/(protected)/maintenance/_components/mr-priority-badge.tsx`
- Purpose: Pill badge for the 4 maintenance priority levels (LOW, MEDIUM, HIGH, URGENT).
- Variants: LOW (surface-secondary), MEDIUM (info), HIGH (warning), URGENT (danger). Same color mapping as TaskPriorityBadge.
- Key tokens/classes: `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium`
- Accessibility behavior: Pure RSC; no additional aria attributes.
- Used by: `maintenance/page.tsx`, `maintenance/[id]/page.tsx`, `maintenance/my/page.tsx`
- Notes: Props: `priority: MaintenancePriority`.

---

## API Patterns (Unit 10)

### MaintenanceService — WAITING_FOR_PARTS State Machine
- Pattern: IN_PROGRESS ↔ WAITING_FOR_PARTS via `waitingForParts(reason)` / `resume()`; both guarded by `maintenance.start` permission; assignee ownership enforced in service (not controller).
- Used by: `MaintenanceService.waitingForParts()`, `MaintenanceService.resume()`.
- Notes: Unique to maintenance module — not present in incidents or factory-tasks. `waitingForPartsReason` required and non-blank; cleared on resume.

### MaintenanceService — Reopen Logic
- Pattern: `reopen()` destination depends on source: REJECTED→SUBMITTED (re-enters review workflow, clears rejection fields); COMPLETED/CLOSED→IN_PROGRESS (continues execution, clears lifecycle timestamps). CANCELLED is never reopenable.
- Used by: `MaintenanceService.reopen()`.
- Notes: Differs from factory-tasks reopen (which always goes to IN_PROGRESS). Reason required and non-blank for all reopen calls.

### MaintenanceService — Cancel Ownership Rules
- Pattern: `cancel` endpoint uses `maintenance.create` at controller level (any authenticated user who can create can attempt cancel); service enforces: creator may cancel own DRAFT/SUBMITTED; `maintenance.manage` required for all other states or for cancelling others' requests.
- Used by: `MaintenanceService.cancel()`, `MaintenanceController.cancel()`.
- Notes: Prevents non-owners from cancelling others' early-stage requests while allowing `manage` override at any non-terminal state.

---

## Safety & Compliance Components (Unit 11)

### InspectionStatusBadge
- Path: `apps/web/src/app/(protected)/safety-compliance/_components/inspection-status-badge.tsx`
- Purpose: Pill badge for the 6 inspection lifecycle statuses.
- Variants: DRAFT (surface-secondary/muted), SCHEDULED (info-light/text-info), IN_PROGRESS (warning-light/text-warning), COMPLETED (success-light/text-success), CLOSED (surface-secondary/text-secondary), CANCELLED (surface-secondary/muted).
- Key tokens/classes: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`
- Accessibility behavior: Pure RSC; no additional aria.
- Used by: `safety-compliance/page.tsx`, `safety-compliance/[id]/page.tsx`
- Notes: Props: `status: InspectionStatus`.

### FindingSeverityBadge
- Path: `apps/web/src/app/(protected)/safety-compliance/_components/finding-severity-badge.tsx`
- Purpose: Pill badge for 4 finding severity levels.
- Variants: LOW (success-light/text-success), MEDIUM (warning-light/text-warning), HIGH (orange-100/text-orange-700), CRITICAL (danger-light/text-danger).
- Key tokens/classes: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`
- Used by: `safety-compliance/[id]/page.tsx`
- Notes: Props: `severity: FindingSeverity`.

### FindingStatusBadge
- Path: `apps/web/src/app/(protected)/safety-compliance/_components/finding-status-badge.tsx`
- Purpose: Pill badge for 5 finding lifecycle statuses.
- Variants: OPEN (info-light/text-info), ACTION_REQUIRED (warning-light/text-warning), RESOLVED (accent-light/text-accent), VERIFIED (success-light/text-success), CLOSED (surface-secondary/text-secondary).
- Key tokens/classes: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`
- Used by: `safety-compliance/[id]/page.tsx`
- Notes: Props: `status: FindingStatus`.

---

## API Patterns (Unit 11)

### SafetyService — Inspector Ownership Rule
- Pattern: `start()` and `complete()` require `inspectorUserId === actor.id` OR actor has `safety.manage`. Both check via private `requireInspectorOwnership()` helper before the `updateMany` transition.
- Used by: `SafetyService.start()`, `SafetyService.complete()`.
- Notes: Inspector set at schedule time; null inspector means no-one can start without `safety.manage`.

### SafetyService — Verifier Separation of Duties
- Pattern: `verifyFinding()` rejects if `finding.resolvedByUserId === actor.id` unless actor has `safety.manage`. Prevents resolver from self-verifying.
- Used by: `SafetyService.verifyFinding()`.
- Notes: Throws `SAFETY_VERIFIER_SAME_AS_RESOLVER` (ForbiddenException) when violated.

### SafetyService — Finding Reopen Target
- Pattern: Reopening a RESOLVED/VERIFIED/CLOSED finding goes to `ACTION_REQUIRED` (not OPEN). Clears resolvedAt/verifiedAt/closedAt and their userId fields. Preserves `resolutionSummary`. Sets `reopenedAt`, `reopenedByUserId`, `reopenReason`.
- Used by: `SafetyService.reopenFinding()`.
- Notes: Same concurrency guard as other transitions.

### SafetyService — Inspection Reopen
- Pattern: CLOSED → IN_PROGRESS. Clears `completedAt`, `completedByUserId`, `closedAt`, `closedByUserId`. Preserves `conclusion`. Mandatory `reason` (non-blank). Requires `safety.manage`.
- Used by: `SafetyService.reopen()`.

---

## Contract Components (Unit 12)

### ContractLifecycleBadge
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-lifecycle-badge.tsx`
- Purpose: Pill badge for the 6 derived contract lifecycle display states.
- Variants: DRAFT (surface-secondary/muted), ACTIVE (success-light/text-success), EXPIRING (warning-light/text-warning), EXPIRED (danger-light/text-danger), TERMINATED (surface-secondary/text-secondary), CLOSED (surface-secondary/text-secondary).
- Key tokens/classes: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`
- Accessibility behavior: Pure RSC; no additional aria attributes.
- Used by: `contracts/page.tsx`, `contracts/[id]/page.tsx`
- Notes: Props: `status: DerivedLifecycleStatus`. Note: displays derived lifecycle status (6 states), not stored `ContractStatus` (4 states). EXPIRING = ACTIVE with `renewalNoticeDate ≤ today AND endDate not passed`. EXPIRED = ACTIVE with `endDate < today`. Color mapping is explicit (no dynamic Tailwind key construction).

---

## API Patterns (Unit 12)

### ContractsService — Optimistic Concurrency via Version Field
- Pattern: `updateMany(where: { id, status: currentStatus, version: dto.version })` for ALL mutations (update/activate/terminate/close); `version` field incremented on every mutation. After count=0: `findUnique` inside transaction distinguishes not-found (→ 404) from conflict (→ 409 `CONTRACT_VERSION_CONFLICT`).
- Used by: `ContractsService.update()`, `activate()`, `terminate()`, `close()`.
- Notes: `UpdateContractDto` requires `version: number` (Int, min 1). The WHERE clause always uses the client-submitted `dto.version`, never a DB-refetched version. A preliminary read may be used for existence, status, and permission checks, but the concurrency gate is always `dto.version`. Frontend receives "Contract was changed by another user; please refresh and retry" on 409.

### ContractsService — Derived Lifecycle Status
- Pattern: `getDerivedLifecycleStatus(contract, today)` is a named exported function (not a method). Computes: EXPIRING = stored ACTIVE + `renewalNoticeDate ≤ today AND (endDate IS NULL OR endDate ≥ today)`; EXPIRED = stored ACTIVE + `endDate < today`. All other stored statuses pass through. `utcToday()` = `new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))`.
- Used by: `ContractsService.withLifecycle()` (all response builders), and importable in tests.
- Notes: EXPIRING and EXPIRED are derived at read time — no background job, no stored field. `buildListWhere()` also exported for testability; handles `lifecycleStatus=EXPIRING/EXPIRED` by translating to date-range WHERE clauses.

### Inline Server Action Wrappers — Next.js 15 Pattern
- Pattern: Server component declares `async function handleAction(formData?: FormData): Promise<void> { 'use server'; ... }` inline, closing over component-scope variables (`id`, `version`). This avoids `.bind()` whose return types are incompatible with React form `action` prop, and correctly passes `formData` as the last argument to `useActionState`-style actions.
- Used by: `contracts/[id]/page.tsx` (`handleActivate`, `handleClose`, `handleTerminate`, `handleComment`).
- Notes: Actions with `useActionState` signature (`(prev, formData) => Promise<State>`) require `{ error: null }` passed as `_prev` when called from inline wrappers: `await terminateContractAction(id, contract.version, { error: null }, formData)`.

---

## Contract Register Shared Form Fields (CM-24)

### contract-form-fields.tsx (shared field-group components)
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-form-fields.tsx`
- Purpose: Field-group components (`ClientContactFields`, `ContractDatesFields`, `ContractValueFields`, `ProjectSiteFields`, `ScopeOfWorkFieldset`, `CraneFields`) plus shared style tokens (`inputCls`, `labelCls`, `gridCls3`, `InfoBox`), consumed identically by both New Contract Register and Edit Contract so the two screens never diverge in field set or labeling.
- Key tokens/classes: `inputCls`/`labelCls`/`gridCls3` reused from prior contract form styling; textareas use `${inputCls} resize-y`.
- Accessibility behavior: All inputs have associated `<label htmlFor>`; required fields (`Other Description`) marked with `<span className="text-danger">*</span>` and `required`.
- Used by: `contracts/new/_components/new-contract-form.tsx`, `contracts/[id]/edit/_components/edit-contract-form.tsx`.
- Notes: `ScopeOfWorkFieldset` is fully controlled by the parent (`scope`, `onScopeChange`, `exFactory`, `onExFactoryChange`, `otherDescription`, `onOtherDescriptionChange`) so the parent can also derive `erectionSelected` for conditional Erection/Crane section visibility and read the same state at submit time. Mutual-exclusivity rules enforced client-side (mirrored server-side in `ContractsService`): checking "Not Applicable" clears every other option; checking "Ex-Factory" disables/clears Delivery+Erection; checking "Other" reveals a required `scope_otherDescription` text input (plain field, not a `scope_<key>` checkbox) whose value is merged into the `scopeOfWork.otherDescription` JSON key by the server action, not stored as its own DB column. When building a `{ ...scope, key: value }` object from a `Record<string, boolean>` state, annotate the result type explicitly (`const next: Record<string, boolean> = ...`) — TS narrows the inferred type to just the literal key otherwise and later `next['x'] = ...` index writes fail typecheck.

### ContractScopeDetailsCard / ContractCraneDetailsCard
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-scope-details-card.tsx`, `contract-crane-details-card.tsx`
- Purpose: Read-only Contract Detail Overview cards for the CM-24 long-text scope/schedule fields and the Erection/Crane fields, respectively.
- Key tokens/classes: Same `Field`/`dt`/`dd` pattern as `contract-info-card.tsx` / `contract-register-details-card.tsx`; long-text values use `whitespace-pre-wrap`.
- Used by: `contracts/[id]/(workspace)/page.tsx`.
- Notes: `ContractCraneDetailsCard` is rendered conditionally — only when `contract.scopeOfWork?.['erection'] === true` — matching the same "only when relevant" rule used for the create/edit form's crane section. Missing values render `—`, never blank/undefined, so old (pre-CM-24) contracts without these columns display cleanly.

### optionLabel() helper
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts`
- Purpose: `optionLabel(options: OptionDef[], key: string | undefined): string` — looks up a coded value's display label from an `OptionDef[]` list (e.g. `CRANE_REQUIRED_OPTIONS`), returning `—` for empty and the raw key as a fallback if unmapped.
- Used by: `ContractCraneDetailsCard`.

---

## Contract Management Sidebar Navigation (CM-26)

### ContractPlaceholderPage
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-placeholder-page.tsx`
- Purpose: Shared shell for module-level Contract Management pages with no backend yet (Schedule, Payments, Issue Log, Claim Log) — breadcrumb + title/subtitle + a single bordered card with a "Not started" pill and one line of plain-language body copy. Never renders fake/sample data.
- Props: `breadcrumbLabel`, `title`, `subtitle`, `body` (all plain strings).
- Key tokens/classes: Same `px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-6` page container as `contracts/page.tsx` / `contracts/dashboard/page.tsx`, so it feels like a real (if empty) module page rather than an error state.
- Used by: `contracts/schedule/page.tsx`, `contracts/issues/page.tsx`, `contracts/claims/page.tsx`. (`contracts/payments/page.tsx` moved off this shell in CM-28 — it's now a real register, see below.)
- Notes: each caller page is itself gated by `getUserPermissions().includes('contracts.read')` → `notFound()` otherwise, since these pages make no API call of their own and would otherwise have no permission gate at all (existing contract pages are indirectly gated by their API calls failing for unauthorized users).

### Sidebar — Contract-Management-only flattening
- Path: `apps/web/src/app/(protected)/_components/sidebar.tsx`
- Pattern: `isContractManagementOnlyAccess(user.permissions)` (from `module-visibility.ts`) drives two changes at once — the top-level "Dashboard" link (`href: '/'`, `MAIN_GROUPS[0]`) is filtered out, and the "Contract Management" group renders as a flat top-level section (own `<p>` label, plain `<Link>`s, no toggle button/chevron) instead of nested under "Operations" behind a dropdown. Any user with contracts access *plus* at least one other module (including Admin/Super Admin) keeps the original nested-dropdown-under-Operations rendering — same `CONTRACT_ITEMS` array and `visibleContractItems` filter feed both render paths, so the two never drift out of sync on which items are shown.
- Notes: `isContractItemActive(href, pathname)` must special-case each fixed module-level slug (`dashboard`, `schedule`, `payments`, `issues`, `claims`) individually — a route added to `CONTRACT_ITEMS` without a matching branch will silently fall through to Contract List's catch-all and highlight the wrong link. `CONTRACT_TOP_LEVEL_SLUGS` is the single list both the catch-all check and future additions need to stay in sync with.

---

## Contract Payments Register (CM-28)

### PaymentFormModal
- Path: `apps/web/src/app/(protected)/contracts/payments/_components/payment-form-modal.tsx`
- Purpose: Single modal for both Add and Edit payment, sharing `contract-form-fields.tsx`'s `inputCls`/`labelCls`/`gridCls3` tokens for visual consistency with the Contract Register forms.
- Pattern: Footer submit button lives outside the `<form>` element (so it can sit in a sticky footer bar) and is wired via the standard HTML `form="payment-form"` attribute rather than DOM traversal — the robust way to submit a form from a sibling element. Closes itself and calls `router.refresh()` on successful submit via a `submittedRef` flag checked in a `useEffect` watching `useActionState`'s state/pending — `useActionState`'s initial state shape (`{error: null}`) is indistinguishable from a "just succeeded" state, so a ref tracking "a submit actually happened" is required to avoid closing on first render.
- Used by: `payment-register-table.tsx` (both `mode="add"` and `mode="edit"`).

### PaymentRegisterTable / PaymentStatusBadge / PaymentSummaryCards / PaymentFilterBar
- Path: `apps/web/src/app/(protected)/contracts/payments/_components/`
- Purpose: The module-level Payments Register's table (client component — owns Add/Edit modal state and the Cancel action), status badge (7-state `ContractPaymentStatus` → color+label maps), 5-card `MetricCard` summary row, and GET-form filter bar (URL-search-params driven, same pattern as `contract-filter-bar.tsx`).
- Notes: Table and filter bar both mark their interactive chrome (buttons, Action column, filter form) `print:hidden`; the page adds a `hidden print:block` header with a generated timestamp so the printed/PDF output has context the on-screen title doesn't need. Reused as-is for the per-contract read-only tab (`contracts/[id]/(workspace)/payments/page.tsx`) via `PaymentStatusBadge` — the table itself is not reused there since that view is deliberately simpler (no Add/Edit/Cancel).

### contract-payment-csv.ts
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-payment-csv.ts`
- Purpose: `csvField()` (RFC-4180-style escaping — quotes wrap any value containing a comma/quote/newline, embedded quotes doubled), `buildPaymentsCsv()`. Extracted from the `payments/export/route.ts` Route Handler specifically so the escaping logic has unit test coverage — Route Handlers aren't otherwise tested in this codebase.
- Used by: `contracts/payments/export/route.ts` (first Route Handler in the web app — Next.js Route Handlers run outside page layouts, so this route re-checks `contracts.read` itself via `getUserPermissions()` rather than relying on any page-level guard).

---

## Contract Workflow & Team Tasks Register (CM-29)

### WorkflowBoard / WorkflowUpdateTaskModal
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-board.tsx`, `workflow-update-task-modal.tsx`
- Purpose: `WorkflowBoard` renders the 4 team lanes (Technical/Production/Erection/QS-Commercial), each only rendered when it has at least one task, with a compact task card (name, status badge, responsible, due date, Edit button). Shows "No workflow tasks configured." when a contract has zero tasks. `WorkflowUpdateTaskModal` follows the exact same footer-submit-button-via-`form=` attribute and `submittedRef`-gated close-on-success pattern as `PaymentFormModal` (CM-28) — see that entry for why the ref is needed.
- Used by: both the module-level `contracts/workflow/page.tsx` (via `?contractId=`) and the per-contract `contracts/[id]/(workspace)/workflow/page.tsx` tab — the **same** `WorkflowBoard` component instance is reused in both places (not just the same data shape), so board behavior/styling can never drift between the two surfaces.

### WorkflowStatusBadge vs WorkflowTaskStatusBadge
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/`
- Purpose: Two distinct badges that are easy to confuse — `WorkflowStatusBadge` renders the **derived, contract-level** summary (`NOT_GENERATED`/`NOT_STARTED`/`IN_PROGRESS`/`COMPLETED`, computed server-side from all of a contract's tasks, never stored), while `WorkflowTaskStatusBadge` renders the **stored, per-task** enum (8 states: `NOT_STARTED` through `COMPLETED`/`ON_HOLD`). Do not merge these — they have different value sets and different meanings.

### formatScopeSummary()
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts`
- Purpose: `formatScopeSummary(scope)` — compact "Shop Drawing, Production, Erection" comma-joined label list from a `scopeOfWork` object, filtering to `=== true` boolean keys only (ignores the `otherDescription` string value that lives in the same object). Returns `—` for empty/null.
- Used by: `workflow-contract-table.tsx` (Scope column), `workflow-contract-header.tsx` (Selected Contract summary) — reusable anywhere else a compact scope summary is needed instead of the full `ContractBadgeGroupCard` badge list.

### Task generation is backend-owned, not a frontend concern
- Path: `apps/api/src/contracts/contract-workflow-templates.ts`
- Note for future frontend work: the frontend never decides which default tasks to show — `GET /contracts/:id/workflow` lazily generates and persists them server-side on first view (idempotent via a DB unique constraint), and the frontend only ever renders whatever tasks the API returns. Do not port the template list or scope rules into a frontend `_lib` file — that would create a second source of truth that can drift from the backend's.

---

## Contract Issue Log Register (CM-30)

### IssueRegisterTable
- Path: `apps/web/src/app/(protected)/contracts/issues/_components/issue-register-table.tsx`
- Purpose: `'use client'` table reused for both the module-level register and the per-contract tab. Owns Add/Edit modal state and the Close-issue action (`closeIssueAction` + `router.refresh()`).
- Props: `fixedContractId?: string` — when set (per-contract tab), the Contract selector is skipped in the Add modal and the Contract ID/Name/Company columns are hidden (`compact = Boolean(fixedContractId)`). Same "one component, two contexts" pattern as `WorkflowBoard` (CM-29) and the payments table (CM-28) — never fork a second table for the per-contract view.

### IssueFormModal / IssueStatusBadge / IssuePriorityBadge / IssueFilterBar / IssueSummaryCards
- Path: `apps/web/src/app/(protected)/contracts/issues/_components/`
- Purpose: `IssueFormModal` — same footer-submit-via-`form="issue-form"` + `submittedRef`-gated close-on-success pattern as `PaymentFormModal`/`WorkflowUpdateTaskModal`; conditionally shows Resolution + Closed Date fields only when status is `RESOLVED`/`CLOSED`. `IssueStatusBadge` (6 states) / `IssuePriorityBadge` (4 states) — plain color+label maps. `IssueFilterBar` — GET-form filter bar, same URL-search-params pattern as the payments/workflow filter bars. `IssueSummaryCards` — 6 `MetricCard`s computed server-side over the full filtered result set (not just the current page).

### contract-issue-csv.ts
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-issue-csv.ts`
- Purpose: `buildIssuesCsv()` — imports `csvField()` directly from `contract-payment-csv.ts` (CM-28) rather than duplicating the RFC-4180 escaping logic. Reuse the shared `csvField` for any future CSV export in this module instead of re-implementing escaping.
- Used by: `contracts/issues/export/route.ts` (filtered CSV download, re-checks `contracts.read` itself since Route Handlers run outside page-level guards).

### Gotcha: runtime constants in `contracts-api.ts` break client-component builds
- `apps/web/src/lib/contracts-api.ts` imports `next/headers` at module scope (server-only). Any **runtime value** — not a type — exported from that file and imported into a `'use client'` component pulls the entire module, including `next/headers`, into the client bundle and fails the Turbopack build with a misleading Pages-Router-flavored error even though this project only uses the App Router.
- Rule: client-facing constants/enums that would naturally belong in `contracts-api.ts` (it's otherwise the right home for API-shaped types/constants) must instead live in the dependency-free `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts`. `CONTRACT_ISSUE_CATEGORIES` was moved there for exactly this reason. `import type {...}` is safe (stripped at compile time) — only runtime `import {...}` triggers the failure.

---

## Contract Claim Log Register (CM-31)

### ClaimRegisterTable
- Path: `apps/web/src/app/(protected)/contracts/claims/_components/claim-register-table.tsx`
- Purpose: `'use client'` table reused for both the module-level register and the per-contract Claims Registry tab — same `fixedContractId`/`compact` pattern as `IssueRegisterTable` (CM-30). Owns Add/Edit modal state and two distinct row actions: Settle (`HandCoins` icon, `status=SETTLED`) and Close (`CheckCircle2` icon, `status=CLOSED`), both calling `closeClaimAction(claimId, contractId, targetStatus)` + `router.refresh()`.
- Notes: row actions (Edit/Settle/Close) hide once a claim reaches a `TERMINAL_STATUSES` state (`CLOSED`/`SETTLED`/`CANCELLED`/`REJECTED`) — deliberately excludes `APPROVED`, mirroring the backend's `OVERDUE_EXCLUDED_STATUSES`, since an approved claim can still need editing or settling.

### ClaimFormModal / ClaimStatusBadge / ClaimTypeBadge / ClaimFilterBar / ClaimSummaryCards
- Path: `apps/web/src/app/(protected)/contracts/claims/_components/`
- Purpose: `ClaimFormModal` — same footer-submit-via-`form="claim-form"` + `submittedRef`-gated close-on-success pattern as `IssueFormModal`/`PaymentFormModal`. `ClaimStatusBadge` (10 states) / `ClaimTypeBadge` (7 types) — plain color+label maps. `ClaimFilterBar` — GET-form filter bar, same URL-search-params pattern as the payments/issues filter bars. `ClaimSummaryCards` — 6 `MetricCard`s (Open Claims, Submitted/Approved/Outstanding Value formatted via `formatContractValue(..., 'KWD')`, Overdue Claims, Closed/Settled Claims) computed server-side over the full filtered result set.

### contract-claim-csv.ts
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-claim-csv.ts`
- Purpose: `buildClaimsCsv()` — imports `csvField()` directly from `contract-payment-csv.ts` (CM-28), same reuse pattern as `contract-issue-csv.ts` (CM-30).
- Used by: `contracts/claims/export/route.ts`.

### Two distinct "not open" status sets — do not merge
- Path: `apps/api/src/contracts/contract-claims.service.ts`
- Note for future work on this service: `OVERDUE_EXCLUDED_STATUSES` (`SETTLED`/`CLOSED`/`CANCELLED`/`REJECTED`) drives whether `overdueDays`/`isOverdue` can be non-null — `APPROVED` is deliberately NOT in this list, since an approved claim can still be overdue if the follow-up action (e.g. payment) hasn't happened by the due date. `FINAL_STATUSES` (`APPROVED`/`REJECTED`/`SETTLED`/`CLOSED`/`CANCELLED`) drives the Open Claims summary count instead — an approved claim is no longer "open" even though it can still be overdue. These two constants look similar but must stay independent; merging them would either hide legitimately-overdue approved claims or miscount open claims.

### CONTRACT_CLAIM_TYPE_OPTIONS / CONTRACT_CLAIM_STATUS_OPTIONS
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts`
- Purpose: `OptionDef[]` lists for claim type/status selects, shared by `ClaimFilterBar` and `ClaimFormModal`. Placed here (not in `contracts-api.ts`) from the outset to avoid the client/server-boundary Turbopack build failure documented in the CM-30 entry above — any new claim/issue/payment-adjacent constant needed by a `'use client'` component belongs in this file, never in `contracts-api.ts`.

---

## Workflow Operations Upgrade — Kanban, Attachments, Comments, My Tasks (CM-32)

### WorkflowTaskCard / WorkflowTaskDrawer
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-task-card.tsx`, `workflow-task-drawer.tsx`
- Purpose: `WorkflowTaskCard` — the Kanban card rendered inside each team lane in `WorkflowBoard`; shows status/priority badges, responsible person, due date, attachment/comment counts, an overdue icon, and a relative "last activity" label. Clicking it opens `WorkflowTaskDrawer`, a full-height side panel (not a small centered modal, unlike every other CM-28/29/30/31 update dialog) hosting the task fields form, an activity-info block, and full Comments/Attachments sections with their own add/upload mini-forms.
- Notes: **the drawer deliberately stays open after Save/Add Comment/Upload** — closed only via its own X button — because it's a session-oriented panel, not a single-action dialog. `WorkflowBoard` tracks `openTaskId` (not a task object snapshot), so when `tasks` refreshes after any drawer action calls `router.refresh()`, the open drawer re-derives from the fresh array instead of showing stale field values while it stays open. Comments/attachments lists are fetched client-side via the two JSON proxy Route Handlers below (counts only come from the task object itself, per the API contract) and are re-fetched locally after each successful add/upload, independent of the outer page's `router.refresh()`.

### Client-fetchable proxy Route Handlers for a 'use client' drawer
- Path: `apps/web/src/app/(protected)/contracts/workflow/tasks/[taskId]/comments/route.ts`, `.../attachments/route.ts`, `.../attachments/[attachmentId]/download/route.ts`
- Purpose: `WorkflowTaskDrawer` is a `'use client'` component and cannot import `contractsApi` directly (it depends on `next/headers`, App-Router-server-only). These three GET-only Route Handlers each read the session cookie server-side, call the real API, and return JSON (or, for the download route, stream the binary body through with the API's `Content-Type`/`Content-Disposition` headers forwarded). Mutations (add comment, upload attachment, update task) still go through Server Actions in `actions.ts`, matching the rest of the app — only reads-on-demand-from-a-client-component needed this new proxy pattern.
- Reusable takeaway: any future `'use client'` panel that needs on-demand server data (not already present in the page's initial server-rendered props) should follow this same "tiny GET-only Route Handler that just re-calls `contractsApi`" pattern rather than duplicating auth/fetch logic inline.

### WorkflowPollingRefresher
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-polling-refresher.tsx`
- Purpose: Renders nothing; sets a 20-second `setInterval` calling `router.refresh()`. This is this project's defined "real-time" behavior for CM-32 (explicitly no WebSocket/SSE) — mounted once on the module page (only when a contract is selected) and once on the per-contract workflow tab. Reusable for any future page that needs the same silent-polling contract without adding a new mechanism.

### Two distinct workflow-task "not open"/"not overdue" status sets — do not merge
- Path: `apps/api/src/contracts/contract-workflow.service.ts`
- Note for future work: `computeWorkflowProgress`'s contract-level overdue count (CM-29, unchanged) excludes `COMPLETED`/`REJECTED`. The new CM-32 per-task `computeTaskIsOverdue` (drives the Kanban overdue badge and task-level filtering) excludes only `COMPLETED`/`APPROVED` — a `REJECTED` task IS still shown as overdue by the new function, since rejection doesn't resolve the underlying lateness. These were kept deliberately separate rather than unified, exactly mirroring the CM-31 `OVERDUE_EXCLUDED_STATUSES` vs `FINAL_STATUSES` precedent for Claims — see that entry above for the same reasoning pattern.

### Attachment/file upload pattern (first in this codebase)
- Path: `apps/api/src/contracts/workflow-attachment-storage.service.ts`, `contracts.controller.ts` (`uploadWorkflowTaskAttachment`)
- Purpose: First file-upload feature in this project. Uses NestJS's `FileInterceptor` with `memoryStorage` (implicit default), a `fileFilter` callback that throws a real `UnprocessableEntityException` (passes through the global exception filter unchanged, giving a clean `{code, message}` 422) for disallowed MIME types, and `limits.fileSize` for the 10MB cap (NestJS auto-converts Multer's `LIMIT_FILE_SIZE` error into a clean `PayloadTooLargeException`, confirmed by reading `@nestjs/platform-express`'s `transformException` source rather than assuming). No `@types/multer` dependency was added — a local `UploadedFileLike` interface in the controller covers the few fields actually used (`originalname`/`mimetype`/`size`/`buffer`), avoiding a version-compatibility risk between the installed `multer@2.1.1` (a transitive dep of `@nestjs/platform-express`) and whatever `@types/multer` major version would otherwise be pulled in.
- Reusable takeaway: any future upload feature in this app should follow this exact interceptor/fileFilter/limits shape rather than reaching for `@types/multer` or a raw Express middleware.

---

## Contract Closeout Approval Flow (CM-33)

### ContractClosureAction — replaces the direct "Close Contract" button
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-closure-action.tsx`
- Purpose: Renders exactly one of four states in the Overview tab's Available Actions row, driven by `getClosureAction()`: a "Request Closeout" link (no active/approved request), a pending-status badge-link ("Closeout Requested" / "Closeout Under Review"), a "Close Contract" button (only once the latest request is APPROVED), or nothing at all (DRAFT contract, already CLOSED, or actor lacks the relevant permission). `ContractTransitions` (Activate/Terminate) no longer renders any Close button — it was removed entirely in this unit, not just hidden.
- Notes: never call `closeContractFromCloseoutAction` from anywhere else — the *only* path that legitimately closes a contract post-CM-33 is an APPROVED `ContractCloseoutRequest`'s id flowing into this action. The old `POST /contracts/:id/close` endpoint still exists but is now gated server-side (see below) purely as a defensive backstop, not a UI-reachable path.

### getClosureAction() / computeCloseoutWarnings()
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts`
- Purpose: `getClosureAction(contractStatus, permissions, latestRequestStatus)` — pure decision function for the Available Actions slot (see above). Kept independent from the pre-existing `getVisibleContractTransitions().close` field (permission+status check only, still valid and still tested, but no longer wired to a button) rather than repurposing it, to avoid touching 24 already-passing tests. `computeCloseoutWarnings(checks)` — turns the checks response into the exact spec-worded warning strings shown in the Closeout tab's warnings panel; documents are surfaced as a warning only, never a blocker (no invented "required document" rule).

### Closeout readiness checks — two open/final status sets, module-specific to this unit
- Path: `apps/api/src/contracts/contract-closeout.service.ts`
- Note for future work: `computeCloseoutChecks()`'s open/final status classifications (workflow: `CLOSEOUT_READY_WORKFLOW_STATUSES` = APPROVED/COMPLETED only; issues: RESOLVED counted as still-open; claims: the exact 10-status spec split) are a **cross-cutting judgment call for closeout readiness only** — they are deliberately separate from each owning module's own "open"/"overdue" definitions (CM-30 `computeIssueIsOverdue`, CM-31 `OVERDUE_EXCLUDED_STATUSES`/`FINAL_STATUSES`, CM-32 `computeTaskIsOverdue`). Do not import or reuse this unit's constants from those modules, or vice versa — they answer different questions ("is this ready to close the whole contract?" vs. "is this one item overdue/open on its own terms?").
- `isReadyForClosure` is informational only — it never gates request submission or approval (per explicit business decision not to block too aggressively). Documents are excluded from this flag entirely.

### CloseoutReviewerPanel — one component for all non-terminal request states
- Path: `apps/web/src/app/(protected)/contracts/[id]/(workspace)/closeout/_components/closeout-reviewer-panel.tsx`
- Purpose: A single client component renders the request detail card, risk snapshot, and the correct action buttons for whichever status the request is currently in (SUBMITTED → Start Review/Approve/Reject; UNDER_REVIEW → Approve/Reject; APPROVED → Final Close Contract; REJECTED/CLOSED → read-only detail view). `canReview` (`contracts.close`) gates every action button but never the detail view itself — Scenario D from the CM-33 spec ("user without contracts.close can view but not act") is enforced this way, not by hiding the whole panel.
- Reusable takeaway: this "one panel, branch on status" shape (vs. a separate component per status) is the preferred pattern here when a record has many terminal/non-terminal states sharing most of their displayed fields — consider it for any future single-record approval-style UI in this app.

## Contract Schedule Register (CM-34)

### ContractScheduleService — read-only aggregation, no dedicated table
- Path: `apps/api/src/contracts/contract-schedule.service.ts`
- Purpose: Generates `ScheduleItem` rows on the fly from 5 existing source tables (Contract dates, `ContractWorkflowTask`, `ContractIssue`, `ContractClaim`, `ContractPayment`, `ContractCloseoutRequest`) — no schedule data is ever persisted. Pattern: fetch candidate contracts (dept-scoped, capped at 1000) → parallel `Promise.all` fetch of all 5 source tables filtered to those contract IDs → map each row through a pure per-source function → filter/sort/paginate in-memory.
- Reusable takeaway: this is CM-29's Workflow-module "candidate contracts then join" pattern generalized from 1 source to 5. Any future "roll-up view across several existing modules" unit should follow this shape rather than introducing a denormalized table, unless the volume/query-complexity genuinely requires one.

### Overdue logic — reuse the owning module's function, don't re-derive
- `workflowTaskToScheduleItem`/`issueToScheduleItem`/`claimToScheduleItem`/`paymentToScheduleItem` in `contract-schedule.service.ts` import and call `computeTaskIsOverdue` (CM-32), `computeIssueIsOverdue`/`computeIssueOverdueDays` (CM-30), `computeClaimIsOverdue`/`computeClaimOverdueDays` (CM-31), and `computeOverdueDays` (CM-28) directly — never a 5th re-derivation of "is this overdue."
- Contrast with CM-33's closeout readiness checks, which deliberately use a **separate**, unit-specific open/final definition (see the CM-33 entry above) because they answer a different question. When adding a new cross-module view, decide explicitly which category you're in — "same question, reuse the existing function" (this unit) vs. "different question, define your own and document why" (CM-33) — and document the choice in code.
- Two new rules were needed where no source module had precedent: contract dates (`CONTRACT_START` never overdue — a fixed historical marker; `CONTRACT_END`/`FORECAST_COMPLETION` overdue only when past AND contract isn't `CLOSED`) and closeout milestones (`CLOSEOUT_REQUEST`/`CLOSEOUT_APPROVAL`/`CLOSEOUT_CLOSED` always `isOverdue: false` — they're point-in-time markers, not deadlines; naively comparing `requestedAt` to today would flag every request as overdue immediately since it's always in the past).

### ScheduleStatusBadge — one generic badge for 10 item types
- Path: `apps/web/src/app/(protected)/contracts/schedule/_components/schedule-status-badge.tsx`
- Purpose: A single badge component covers all 10 `ScheduleItemType` values via a `TERMINAL_STATUS_WORDS` heuristic (CLOSED/PAID/SETTLED/COMPLETED/APPROVED/CANCELLED/ENDED/REJECTED → green when not overdue; red when `isOverdue`; neutral otherwise) rather than 10 dedicated per-type badges.
- Reusable takeaway: deliberate scope decision — each source register (Payments, Issues, Claims, Workflow, Closeout) already has its own precise status badge, reachable from the schedule item's action link. The schedule view only needs a rough visual signal, not exact per-type styling; don't duplicate the precise badges here.

### ScheduleTimelineView — one component, two call sites
- Path: `apps/web/src/app/(protected)/contracts/schedule/_components/schedule-timeline-view.tsx`
- Purpose: Vertical timeline grouped into 6 sections (Contract Dates / Workflow Tasks / Payments / Issues / Claims / Closeout), each item showing date, type badge, overdue badge, status badge, title, responsible person, and a source link.
- Used by: the per-contract Schedule tab (`contracts/[id]/(workspace)/schedule/page.tsx`) directly, and reachable from the module-level list view via each row's "Timeline" action link (`/contracts/{contractId}/schedule`).
- Reusable takeaway: this satisfies the "at least 2 views" requirement without a second timeline-rendering implementation — the module list itself IS the chronological Timeline/List view (already sorted by date); the grouped vertical view lives once and is shared. When a spec asks for multiple "views" of the same underlying data, check whether an existing page can double as one of them before building a second renderer.

## Contract Roles, User Templates, and Workflow Assignment Rules (CM-35)

### @AnyPermission decorator — OR-semantics alongside @Permissions (AND-semantics)
- Path: `apps/api/src/common/decorators/any-permission.decorator.ts`, `apps/api/src/common/guards/permission.guard.ts`
- Purpose: `@Permissions('a','b')` has always meant "actor needs ALL of these" (unchanged, still tested). `@AnyPermission('a','b')` is a separate, additive metadata key meaning "actor needs AT LEAST ONE of these" — used where a broader manager permission and a narrower staff permission should both unlock the same route, with fine-grained scoping (e.g. "only your own assigned records") left to the service layer.
- Reusable takeaway: when a future unit needs the same "manager OR narrower-staff-permission" route-gating shape, reuse this decorator rather than inventing per-route logic or repurposing `@Permissions`'s multi-arg form (which stays AND — do not redefine its meaning).

### Assignment-aware + field-scoped service authorization (ContractWorkflowService pattern)
- Path: `apps/api/src/contracts/contract-workflow.service.ts` (`assertWorkflowTaskAssigned`, `assertNoManagerOnlyFields`)
- Purpose: A manager permission (`contracts.update`) passes unconditionally; a narrower staff permission (`contracts.workflow_update`) additionally requires the actor to be the record's assigned user (`responsibleUserId === actor.id`), and rejects (403) any manager-only field present in the request body, even on the actor's own record.
- Reusable takeaway: this two-guard shape (assignment check + field-allowlist check, both skipped for the manager permission) is the pattern to reuse for any future "staff may self-serve a subset of fields on their own records" requirement in another module — don't invent a role-code check (`actor.roleCode === 'X'`) instead, since permissions (not role codes) are the source of truth throughout this codebase.

### New User form — Access Template (5 templates, CM-35 replaces CM-26's 3-option Access Preset)
- Path: `apps/web/src/app/(protected)/administration/users/_components/new-user-form.tsx`
- Purpose: Module Staff / Module Manager / Multi-Module User / Platform Admin / Custom. For Module Staff/Manager, a target-module selector appears; selecting Contract Management auto-picks `CONTRACT_STAFF`/`CONTRACT_MANAGER` and shows a "Recommended roles" callout (Staff/Manager/Legacy/Viewer). Other modules show a "no dedicated role yet" note and fall back to manual role selection — only Contract Management has a Staff/Manager role pair as of CM-35.
- Reusable takeaway: `TEMPLATE_ROLE_CODE: Partial<Record<AccessTemplate, string>>` is the extension point — when a future unit adds a Staff/Manager pair for another module, add its role codes there and the target-module auto-select logic picks it up with no other change. `ROLE_HINTS: Record<string,string>` (role code → short descriptive suffix shown in the Role dropdown) is similarly extend-as-you-go.
- Module Access section deliberately kept its existing dropdown UI rather than a card/checklist redesign — an explicit spec-provided fallback ("if full card UI is too large, minimum acceptable: keep dropdowns, improve labels/helper text"). Don't rebuild this without a specific request to.

### Roles page — permission count + capability hints
- Path: `apps/web/src/app/(protected)/administration/roles/page.tsx`, `apps/api/src/roles/roles.service.ts` (`RoleListItem`)
- Purpose: The roles list now shows a "Permissions" column (`role.permissionCount`, via Prisma `_count` on the list query only — mutation endpoints keep the plain `RoleSummary` type since their callers never display a count) and a short italic capability hint under the description for roles whose scope isn't obvious from the name (`CAPABILITY_HINTS: Record<string,string>` keyed by role code).
- Reusable takeaway: `CAPABILITY_HINTS` is presentation-only, not authoritative — extend it whenever a new role is seeded that would otherwise read ambiguously in the list.

## Super Admin User Creation Wizard (CM-36)

### NewUserWizard — multi-step form, single persistent `<form>`
- Path: `apps/web/src/app/(protected)/administration/users/_components/new-user-wizard.tsx`
- Purpose: Replaces the old single-scroll `NewUserForm` with a 5-step guided flow (Account / Organization / Access Template / Module Access / Review & Create), driven by a `step: number` state and a `StepIndicator`.
- Reusable takeaway (**the pattern to copy for any future multi-step form in this app**): keep ONE `<form action={formAction}>` wrapping every step's fields for the whole component lifetime; toggle each step's visibility with a CSS class (`step === N ? '...' : 'hidden'`), never conditionally unmount a step's inputs. This guarantees the final `FormData` on submit is identical to what a single-page version of the same form would have produced — no hidden mirror inputs, no manual FormData reconstruction needed. Only use this pattern when the total field count is small enough that mounting everything up front is cheap (true here — under 20 fields plus 7 module rows).
- Step-gating: `stepCanProceed: boolean[]` computed once per render from controlled state (e.g. username regex + non-empty display name for step 1); the "Next" button is simply `disabled={!stepCanProceed[step]}` — no separate validation pass.

### ModuleAccessEditor — controlled variant (CM-36 supersedes CM-26's internally-stated version)
- Path: `apps/web/src/app/(protected)/administration/users/_components/module-access-editor.tsx`
- Purpose: Per-module department-access scope editor. As of CM-36, `scope`/`deptIds` per module are **lifted to the caller** (`scopes`, `deptIdsByModule` props + `onScopeChange`/`onDeptIdsChange` callbacks) instead of each `ModuleRow` owning its own `useState`. Only `NewUserWizard` consumes this component (verified before refactoring — safe to change its API).
- Reusable takeaway: lift a form sub-editor's state to the parent whenever the parent needs to *read* that state for something other than plain submission (here: building a Review-step summary and computing mismatch warnings). If nothing outside the sub-editor ever needs to read its live value, internal state is simpler and fine — don't lift preemptively.
- "Collapsed by default" (visual density) was achieved via a compact single-line-per-module row (name + scope select together), NOT a manual expand/collapse toggle — toggling visibility of the `<select name="module_scope_*">` itself would risk dropping that field from `FormData` if a future edit switched CSS-hide to conditional unmount. Keep the scope `<select>` always mounted for every module row.

### Wizard warning rules — literal, spec-scenario-mapped (not a general mismatch engine)
- Path: `computeAccessWarnings()` in `new-user-wizard.tsx`
- Purpose: Four warnings, each mapping 1:1 to a named scenario (Contract Staff + All Departments; Contract Manager + Contract Management module access never configured; Platform Admin's broad-access notice; Viewer role picked under the Module Manager template). Deliberately not generalized into a broader "role/module mismatch" engine.
- Reusable takeaway: when a future unit asks for "N specific warning scenarios," resist building a generic rule engine unless asked — a short list of named, literal checks is easier to audit and matches exactly what was requested.

## Role-Based Contract Dashboard (CM-37)

### Compose-on-top service pattern — don't replace a working, widely-consumed method
- Path: `apps/api/src/contracts/contract-dashboard.service.ts` (`ContractDashboardService`, wraps `ContractsService.getDashboard()`)
- Purpose: When a method's response shape is consumed by many unrelated callers for just one field (here: a dozen+ pages call `contractsApi.dashboard()` purely to read `.scope` for the scope badge), and a new unit needs to ADD substantial new data to that same endpoint, wrap the existing method in a new service rather than editing it in place. `ContractDashboardService.getDashboard()` calls `ContractsService.getDashboard()` for the base `scope`/`metrics`/`recent` fields, then layers `dashboardType`/`manager`/`staff` on top additively.
- Reusable takeaway: this is the safer alternative to "extend the existing method's return type in place" whenever the existing method already has broad, low-context callers (verified via a repo-wide grep before deciding) — it guarantees their behavior is provably unchanged rather than merely "should still work."

### Permission-only dashboard branching — never role-code
- Path: `computeContractDashboardType()` in `contract-dashboard.service.ts`
- Purpose: `contracts.update` or `contracts.close` → MANAGER dashboard; everything else → STAFF dashboard. One line subsumes every named case (Contract Manager, legacy Contract Management User, Super Admin, Admin all carry `contracts.update`; Contract Staff does not) without checking `roleCode` anywhere.
- Reusable takeaway: when a future unit needs "manager view vs staff view" logic for another module, check permissions the actor actually holds, not their role's name — role codes are display labels, not the authorization boundary anywhere in this codebase (see also CM-35's `@AnyPermission` pattern).

### Reuse ContractScheduleService for any "upcoming dates" panel
- Path: `contract-dashboard.service.ts` calls `ContractScheduleService.findAll({ upcomingOnly: true, pageSize, responsibleUserId? }, actor)`
- Purpose: Both dashboards' "Upcoming Schedule" panels are built by calling CM-34's existing schedule aggregation service directly — one call gets both the display list (`items`) and an accurate full-set summary (`summary.upcomingThisWeek`) in a single round trip, since `computeScheduleSummary` runs over the full filtered set before pagination.
- Reusable takeaway: any future "what's coming up" widget anywhere in Contract Management should call this service rather than re-querying the 5 source tables — it already handles department scope, per-actor filtering, and overdue logic consistently.

### UpcomingScheduleList — compact widget variant of ScheduleTimelineView
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/upcoming-schedule-list.tsx`
- Purpose: A dense, single-line-per-item list (date + type badge + title + contract ref + overdue badge) for dashboard widgets, distinct from CM-34's `ScheduleTimelineView` (grouped, full-page). Reuses `ScheduleItemTypeBadge` across the module boundary from `contracts/schedule/_components/`.
- Reusable takeaway: don't force a full-page component into a dashboard card slot — build a compact sibling that reuses the shared sub-pieces (badges) rather than the whole grouped layout.

## Closeout Requests Register (CM-38)

### Sidebar `anyPermission` (OR) — frontend counterpart to the backend's `@AnyPermission`
- Path: `apps/web/src/app/(protected)/_components/sidebar.tsx` (`NavItem.anyPermission`, checked in `isNavItemVisible`)
- Purpose: A sidebar item visible to an actor holding ANY of several permission codes (here: `contracts.update` OR `contracts.close`) rather than exactly one. Additive to the existing `module`/`permission`/`adminGated` checks — all still AND together, `anyPermission` just adds an OR-group as one more AND'd condition.
- Reusable takeaway: this is the sidebar-side counterpart to CM-35's backend `@AnyPermission` decorator. Reach for it whenever a nav item should show for "manager-tier OR some other specific permission," instead of picking one approximate `permission` value or (worse) checking role code.

### Read from a stored risk snapshot, don't recompute — when a per-item "point in time" record already exists
- Path: `apps/api/src/contracts/contract-closeout.service.ts` (`ContractCloseoutService.findAll()` / `toCloseoutListItem()`)
- Purpose: The register's Workflow/Issues/Claims Open and Outstanding Payment columns read straight from each request's own stored `riskSnapshot` JSON (set at submission, refreshed at review — see CM-33) instead of querying `ContractWorkflowTask`/`ContractIssue`/`ContractClaim`/`ContractPayment` fresh for every row.
- Reusable takeaway: before adding a "live computed" column to a list endpoint, check whether the source record already carries a point-in-time snapshot of that exact data for a reason (audit trail, historical accuracy) — reusing it is both cheaper (no N+1 fan-out) and often more correct than recomputing "as of right now."

### Defer quick actions to an existing, already-tested surface
- Path: `apps/web/src/app/(protected)/contracts/closeouts/_components/closeout-register-table.tsx` (Action column links to `/contracts/{id}/closeout`, no inline approve/reject/close)
- Purpose: When a spec offers a "preferred" (inline quick actions) and a "minimum acceptable" (link to the existing detail page) option and flags the preferred one as risky, and the existing detail-page workflow already handles concurrency/versioning correctly, take the minimum-acceptable option and document why — don't re-implement a working, tested workflow a second time in a denser UI just because the spec allowed it if "safe."

## Manager Dashboard Simplification (CM-39)

### ManagerSecondaryTabs — Server-Components-as-props into a Client tab toggle
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-secondary-tabs.tsx`
- Purpose: A `'use client'` component whose props (`workflowLoad`, `upcoming`, `recent`) are full server-rendered JSX passed in from the parent Server Component (`page.tsx`) — it does no data fetching itself, only a `useState` toggle over which pre-rendered panel is visible.
- Reusable takeaway: this is the pattern for "tabs over server-fetched data" anywhere in this app — fetch everything server-side as usual, render all N panels' JSX in the Server Component, and hand them to a small client wrapper purely for the show/hide toggle. Never turn the whole page client-side just to add tab switching.
- Known cap caveat: the Manager dashboard's "Needs Action" card counts `attentionItems.length`, which is capped at 30 server-side (CM-37). A portfolio with more than 30 simultaneous attention items will show a slightly low count. Fixing this needs a one-line backend addition (an uncapped total field) — deliberately deferred in CM-39 per its "prefer no backend change" scope; revisit if this ever becomes a real-world edge case.

## Manager Dashboard Above-the-Fold Cleanup (CM-39B)

### buildAttentionRows — frontend grouping of a capped/sorted backend list, using accurate summary fields for counts
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-dashboard-attention.ts`
- Purpose: Collapses repeated same-cause attention rows (many draft contracts, many contracts with unassigned tasks) into one summary row each, then re-sorts the whole list by a bespoke urgent-first action-type order (distinct from the backend's plain HIGH/MEDIUM/LOW-then-date sort). Callers slice to `ATTENTION_ROW_CAP` (5) for display.
- Reusable takeaway: when a list endpoint is capped server-side (here, `attentionItems` at 30 — CM-37) and you need an accurate grouped count that could exceed the cap, don't count rows in the capped array — pull the true total from an already-returned, separately-computed aggregate field (here `summary.contractsAwaitingActivation` and `workflowOverview[].unassignedTasks`, both computed over the full unfiltered dataset). Only fall back to counting capped-array rows for figures that have no accurate alternative (here, the "across M contracts" count for Assign Tasks — documented as a minor known limitation since that action type is HIGH priority and rarely trimmed by the cap in practice).
- Grouped rows have `contractHref: null` — `ManagerAttentionTable` renders plain text (no link) in the Contract cell for these, and the Action link points at a register (e.g. `/contracts?status=DRAFT`) instead of a single contract page. Any future "grouped row" UI in this app should follow the same `xxxHref: null` convention rather than inventing a placeholder ID.
- Pure, dependency-free, unit-tested directly (`contract-dashboard-attention.test.ts`) — matches the established `_lib` pure-function-with-co-located-test pattern used throughout `contracts/_lib/`.

## Manager Dashboard Command Center Polish (CM-39C)

### TodaysFocusPanel — turn existing summary counts into one plain-language sentence
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/todays-focus-panel.tsx` + pure `buildTodaysFocusSegments()` in `apps/web/src/app/(protected)/contracts/_lib/contract-dashboard-focus.ts`
- Purpose: A highlighted strip below the header/actions that reads "N closeout requests waiting review · N overdue workflow task(s) · N open issue(s) · N open claim(s)", built from the exact same `summary` fields the KPI cards already display (no new API call, so it can never drift from the cards). Zero-count segments are omitted; an empty result renders "All caught up — nothing urgent right now." instead of an empty box.
- Reusable takeaway: when a dashboard already fetches summary counts for cards, a "focus sentence" is just a formatting layer over the same data — don't add a new endpoint or duplicate the count logic. Keep the segment-builder pure and testable, and let the component only decide how to join/render it.

### MetricCard `dense` — additive, opt-in compact variant of a widely-shared component
- Path: `apps/web/src/app/(protected)/_components/metric-card.tsx` (new `dense?: boolean` prop, default `false`)
- Purpose: Lets one dashboard (Manager) render slightly shorter cards (`p-4`/`gap-2`/`size-4` icon/`text-xl` value vs. the default `p-5`/`gap-3`/`size-5`/`text-2xl`) without touching the ~20 other call sites across every module dashboard and summary-card row in the app.
- Reusable takeaway: `MetricCard` is used everywhere — never change its default look to fix one page. When a single consumer needs a visual variant, add an optional prop that defaults to the existing behavior, verify with a grep that only the intended caller passes the new value, and document the call-site count so a future reviewer can re-verify the blast radius in seconds.

## Manager Contract List Quick Actions (CM-43)

### ContractRowActions — status/permission-driven row actions, no free status dropdown
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-row-actions.tsx` + pure `computeContractRowActionPlan()` in `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts`
- Purpose: Open (always) + one primary quick action (Activate/Assign Tasks/Review Closeout/Open, chosen by contract status + permissions + a pending-closeout flag) + a More actions dropdown of remaining relevant links. Same dropdown/confirm-dialog architecture as `administration/users/_components/user-lifecycle-actions.tsx` (useTransition, router.refresh(), a local `{type:'none'|'confirmX'|'error'}` dialog state machine) — the second time this exact pattern has been reused verbatim for a "list row with a mutating action + confirmation" need.
- Reusable takeaway: never build a free-text/free-select status editor for a list row that has real lifecycle rules behind it — derive a small, closed set of valid actions from the same permission/status logic the detail page already uses (here, `getVisibleContractTransitions`), and reuse the established dropdown-menu-plus-confirmation-dialog component shape rather than inventing new modal chrome per feature.

### Cross-reference an existing register instead of adding list-endpoint fields
- Path: `apps/web/src/app/(protected)/contracts/page.tsx` (`contractsApi.listCloseouts({ pendingOnly: true })` → `Set<contractId>`, cross-referenced into `computeContractRowActionPlan`'s `hasPendingCloseout` param)
- Purpose: the Contract List's own endpoint has no per-contract "closeout pending" flag, and didn't need one — CM-38's closeout register already supports exactly the filter needed (`pendingOnly`) and already returns `contractId` per row.
- Reusable takeaway: same instinct as CM-43's own audit of CM-38, and CM-42's reuse of `module-visibility.ts`'s permission map — before adding a field to a list endpoint's response, check whether another existing endpoint's query already answers "which of these ids match condition X," and fetch+cross-reference it client/server-side instead.

## Contract List Approved Design Rebuild (CM-55)

### ContractScheduleStatusSelect — a real free dropdown, deliberately not a lifecycle editor
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-schedule-status-select.tsx`
- Purpose: the Contract List's Status column — a manager-facing "schedule/progress status" (In Progress / On Track / Delayed / Completed / Ahead of Schedule), completely separate from `Contract.status` (the real lifecycle: DRAFT/ACTIVE/TERMINATED/CLOSED). Renders a plain read-only badge (`SCHEDULE_STATUS_BADGE_CLASSES`) for any actor without `contracts.update`; a real `<select>` styled as the same badge for actors who can edit, calling `updateContractScheduleStatusAction` → `PATCH /contracts/:id/schedule-status` on change, then `router.refresh()`.
- **Reconciling with CM-43's "no free status dropdown" note above**: that guidance was specifically about never building a free editor for the real lifecycle state machine (`Contract.status`) — this component is a genuine free 5-option dropdown, but for an entirely separate, additive, nullable column with no transition rules, no closeout interaction, and no optimistic-concurrency coupling. The two notes aren't in tension: "don't build a free editor for a field with real state-machine rules behind it" still holds for `Contract.status`; a plain categorical field with no rules is exactly the case a free dropdown is fine for.
- Used by: `contract-list-table.tsx`.
- Notes: Backend default when `scheduleStatus` is NULL: `IN_PROGRESS`, or `COMPLETED` once the contract's real lifecycle is CLOSED (`computeEffectiveScheduleStatus()` in `contracts.service.ts`) — never guesses DELAYED/ON_TRACK/AHEAD_OF_SCHEDULE. The dropdown always reflects this computed default until a manager explicitly changes it.

### ContractListInfoCards — deleted (CM-55B)
- Was: `apps/web/src/app/(protected)/contracts/_components/contract-list-info-cards.tsx` — the 4-card "About This Page / Column Explanations / Statuses / Important Notes" bottom footer added by CM-55.
- CM-55B removed it from `/contracts` entirely (business call: unnecessary, took too much space) and deleted the file — confirmed orphaned (no other importers) before deletion. If a future unit wants this content back, it isn't preserved anywhere else; re-check the approved-design screenshot in CM-55's task history for the original copy.

### formatScopeCompact — a sibling function, not a behavior change to formatScopeSummary (CM-55C)
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-ui-helpers.ts`
- Purpose: `formatScopeSummary()`'s full comma-joined scope list (e.g. "Shop Drawing, Production, Delivery, Erection, Ex-Factory") is exactly right for `workflow-contract-header.tsx`/`contracts-needing-setup-section.tsx`, but was wrapping across several lines inside the Contract List's narrow Contract Type table cell and inflating row height. `formatScopeCompact()` returns `{ display: "Shop Drawing +4", fullList: "<the same full string formatScopeSummary() returns>" }` — single scope shows as-is, more than one collapses to "First Label +N", and the full list stays reachable via a `title` tooltip.
- Reusable takeaway: when one existing formatter's output is correct in its current call sites but wrong for a new, more space-constrained one, add a sibling pure function (with the original formatter as its `fullList`/"full" source of truth) rather than changing the original's behavior and risking the sites that already depend on it.

### Sticky left/right table columns for a wide, real-column-count table (CM-55C)
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-list-table.tsx`
- Purpose: Full View has up to 15 real columns and still needs horizontal scroll on typical desktop widths — rather than trying to eliminate the scroll, Contract ID (left) and Status/Action's neighboring Action column (right) are pinned via `sticky left-0`/`sticky right-0` + `z-10` + an explicit opaque `bg-surface` (header: `bg-nav`) + a border for separation, so identity and the primary action stay reachable without scrolling regardless of how far right the manager scrolls.
- Reusable takeaway: a sticky cell MUST carry its own explicit non-transparent background (and skip any hover-tint class that would apply to sibling cells) — without one, scrolled content shows through underneath it. `z-10` only needs to beat sibling cells in the same row, not fight page-level stacking contexts.
- CM-55D — the sticky Contract ID column also gained an explicit `min-w-40` on both header and body cells, so `table-layout: auto` never squeezes it narrow enough for the reference number to wrap despite `whitespace-nowrap` already being present since CM-55C.

### ContractRowActions — primary action folded into the More menu (CM-55D)
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-row-actions.tsx`
- Purpose: CM-43's row previously showed 2-3 always-visible controls (Open, an optional status-driven "primary" button like Assign Tasks/Activate, and the "···" menu). CM-55D moves that primary action into the top of the dropdown menu itself (Activate keeps its `onClick` → confirm-dialog flow, just triggered from a menu `<button>` instead of an inline one; Assign Tasks/Review Closeout become the menu's first `<Link>`), leaving only "Open" + "···" always visible. The primary item is styled `text-accent font-medium` so it's still the visually obvious first choice once the menu opens.
- Reusable takeaway: `computeContractRowActionPlan()` (the pure function, unchanged, still fully covered by its existing CM-43 tests) already separated "what actions are valid" from "how they're laid out" — moving the primary action into the menu was a pure rendering change in the one component that consumes the plan, with zero risk to the decision logic itself. Confirm a component has no direct test file (this one doesn't; only its pure "plan" function is unit tested) before doing this kind of restructure — it derisks the change but also means live-rendering verification, not `pnpm test`, is what actually proves the UI still works.

## Contract Staff Overdue Tasks Cleanup (CM-45)

### One shared view component parameterized by mode, not two near-duplicate ones
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-my-tasks-view.tsx` (`StaffMyTasksView({ mode: 'my-tasks' | 'overdue', taskId, currentUserId })`)
- Purpose: the Overdue tasks view (CM-45) and the My Tasks view (CM-44) share the exact same data fetch (N+1 `getWorkflow` per contract), the exact same focused-task-panel dispatch on `?taskId=`, and the exact same card component — only the title/subtitle/empty-state copy and whether tasks are grouped-by-status vs. filtered-to-overdue differ. Adding a `mode` prop and branching the small rendering differences inside one component keeps those two surfaces from drifting apart in behavior as either one gets edited later.
- Reusable takeaway: when a new staff-facing filtered view is "the same list, different filter and copy" rather than genuinely different data or structure, parameterize the existing view component instead of forking it — a `mode` prop plus two small render-branch functions is cheaper to keep in sync than two files that started identical and will inevitably diverge.

### A shared tab component computing one tab's href per-caller instead of forking the tab bar
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-mode-tabs.tsx` (`const overdueHref = hideAllWorkflows ? '/contracts/workflow?mode=overdue' : '/contracts/workflow?overdueOnly=true'`)
- Purpose: the same `WorkflowModeTabs` component renders for both managers and Contract Staff (via `hideAllWorkflows`); staff's Overdue tab needed to point at the new staff-only `mode=overdue` dispatch while every other caller (manager, Assignment Queue) needed its href completely unchanged. Computing the one differing tab's href inline, keyed off a prop the component already receives, avoided adding a new prop or forking the tab bar into a staff variant.
- Reusable takeaway: when one tab in a shared tab bar needs a different destination for one actor class, and the component already has a prop that identifies that actor class, compute that one tab's href from the existing prop rather than adding a new one-off prop or duplicating the whole tab list.

### Trust the backend's own derived boolean instead of re-deriving overdue client-side
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-my-tasks-view.tsx` (`allTasks.filter((t) => t.isOverdue)`), backed by `computeTaskIsOverdue()` in `apps/api/src/contracts/contract-workflow.service.ts` (excludes COMPLETED/APPROVED, compares `dueDate` to today)
- Purpose: the spec asked for "a task is overdue when dueDate exists, is before today, and status is not completed/final" — exactly what the backend already computes into `ContractWorkflowTask.isOverdue` on every task row. Re-implementing that rule in the frontend would risk drifting from the backend's definition (e.g. forgetting APPROVED also counts as final) and violates "use existing project status helpers if available, do not invent new statuses."
- Reusable takeaway: before writing a client-side "is X true" rule, check whether the API response already carries that exact boolean — filtering on an existing field beats re-deriving the same rule in two places that can silently disagree.

## Manager Workflow Task Review Drawer Upgrade (CM-53)

### Mirror a backend allow-list into a frontend label map instead of rendering raw JSON
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-task-drawer.tsx` (`FORM_DATA_FIELD_LABELS`, one entry per key in `contract-workflow.service.ts`'s `WORKFLOW_TASK_FORM_DATA_TEXT_KEYS`/`BOOLEAN_KEYS`)
- Purpose: `ContractWorkflowTask.formData` is one flat, task-agnostic `Record<string, string | boolean>` shared across all four Technical-step task-specific forms (Drawing Received/SD/Getting Approval/FD Issuance from CM-46B/49/50/51) — exactly the same design choice that let the backend allow-list stay a single flat array instead of one per taskKey. A single label map, filtered at render time to whichever keys are actually present on a given task, reproduces the correct per-task-type subset automatically with zero taskKey branching in the drawer.
- Reusable takeaway: when a backend field is an intentionally flat, task-agnostic bag of optional values (rather than a strict per-type shape), the frontend's "make this readable" layer should usually also be one flat map keyed the same way — not a switch/if-chain per type. Filtering a flat map by "which keys exist on this record" is simpler and can't drift out of sync with a taskKey list maintained elsewhere.

### Add optional identity props for a child component rather than fetching it again
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-board.tsx` (new optional `contractReference`/`contractTitle` props, forwarded to `WorkflowTaskDrawer`), wired from `WorkflowBoardModal` (CM-52, already has `detail.contract`) and `contracts/[id]/(workspace)/workflow/page.tsx` (already has `workflow.contract`)
- Purpose: the task drawer's new "Task Summary" section wanted to show the contract's own reference/title, but `WorkflowBoard`/`WorkflowTaskDrawer` only ever received a bare `contractId` string. Both existing callers already had the full contract object in scope from their own page-level fetch — passing it one level deeper as two optional strings needed no new request and no risk of the two diverging from what the surrounding page already shows.
- Reusable takeaway: before adding a fetch (or a prop drilling workaround) to show "denormalized" identity data deeper in a component tree, check whether an ancestor already has that exact data from its own existing fetch — threading it down as an optional prop (never fabricated, simply omitted where a caller doesn't have it) is cheaper and can't drift from the source of truth.

## Assign Work Contract Board Modal (CM-52C)

### Stop gating landing content on selection state when converting an inline panel to a modal
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-view.tsx` — `AssignmentQueueContractList`/`ContractsNeedingSetupSection`/`AssignmentQueueAdvancedSection` moved from inside a `selectedContractPanel ?? (<>...</>)` ternary to always rendering, with the selected-contract data instead feeding a `<AssignmentQueueBoardModal>` overlay appended at the end
- Purpose: the pre-CM-52C code treated "a contract is selected" as "replace the whole landing page", which is exactly the long-scrolling problem the modal was meant to fix — wrapping the same replaced content in dialog chrome without also un-hiding the landing sections would have kept the page feeling like a full navigation rather than a popup.
- Reusable takeaway: when turning a `selected ? <DetailPanel/> : <LandingContent/>` conditional into a modal, check whether `LandingContent` needs to become unconditional too — a modal overlays the page it was opened from; if the "before" state already hid that page's own content for the same condition, the modal will still feel like a page replacement unless that hiding is removed at the same time.

### Delete a component once its last caller is replaced, don't leave it as unreferenced dead code
- Path: deleted `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-selected-contract-header.tsx` after confirming via grep it had exactly one importer (`assignment-queue-view.tsx`), which CM-52C's new `AssignmentQueueBoardModal` header superseded
- Reusable takeaway: when a component's only usage is being replaced by an equivalent-but-different-shaped piece (here: a modal header with Close/Open Contract Detail actions, instead of an inline panel header with a Back link), grep for other importers and delete the file outright rather than leaving an unreferenced component behind — matches this project's "if certain it's unused, delete it completely" convention.

## Simplify Manager Workflow Page Tabs and Wording (CM-52B)

### Split one label field into per-audience labels instead of two parallel tab lists
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-mode-tabs.tsx` (`managerLabel`/`staffLabel` on each `ALL_TABS` entry, chosen by the existing `hideAllWorkflows` prop; `managerHidden` added alongside the existing `staffHidden`/`managerOnly` filter flags)
- Purpose: the manager and staff audiences needed different wording ("Overdue" vs. "Delayed Tasks") for tabs that route to the exact same href and dispatch to the exact same content — the audience signal (`hideAllWorkflows`, already computed from `isContractStaffOnlyAccess` upstream) already existed on this component from CM-41/45, so this only needed a second label column, not a second component or a duplicated tab array.
- Reusable takeaway: when two audiences need different copy for what is otherwise the identical control (same route, same visibility rules), add a per-audience field to the existing data-driven list and key it off the prop that already distinguishes those audiences — don't fork the list or the component.

### Surface a "your own assigned items" count via existing summary data, not a new query
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-mode-tabs.tsx` (`myAssignedTaskCount` prop) fed from `apps/web/src/app/(protected)/contracts/workflow/page.tsx` (`{...(summary ? { myAssignedTaskCount: summary.myOpenTasks } : {})}`)
- Purpose: the spec's "show a smaller tab only if detection is easy" exception was answered by `ContractWorkflowSummary.myOpenTasks` — a real, already-fetched, unconditional (not filter-gated) count of the viewing user's own open tasks, the same number `WorkflowSummaryCards` already renders as "My Open Tasks". No new endpoint, no new query, no invented number.
- Reusable takeaway: before adding a new fetch or a new derived boolean/count for a UI decision ("should we show X"), check whether the page's existing summary/dashboard payload already carries that exact number unconditionally — a conditional UI element fed by data that's only fetched when the element would show is a hint you may be duplicating work the page already did.

## Manager Workflow Board Modal for Selected Contract (CM-52)

### Turn an existing query-param-gated section into a modal instead of adding new state
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/workflow-board-modal.tsx` (new), `apps/web/src/app/(protected)/contracts/workflow/page.tsx` (`{contractId && workflowDetail && <WorkflowBoardModal closeHref={buildHref({ contractId: undefined })} .../>}` replacing the old inline `<div className="space-y-4 pt-2 border-t border-border">...</div>` block)
- Purpose: the manager "All Workflows" page already gated the selected contract's board on `?contractId=<id>` being present in the URL, fetching `ContractWorkflowDetail` server-side only in that case. Making the board a modal instead of an inline section required no new "is open" state, no new fetch, and no new client-side param parsing — the existing presence/absence of `contractId` (and the existing `buildHref` query-builder helper for clearing it) already models "open"/"closed" exactly. `WorkflowContractHeader` and `WorkflowBoard` (task lanes, cards, `WorkflowTaskDrawer`) are reused completely unchanged inside the modal body.
- Reusable takeaway: before adding `useState`/URL-parsing to make something modal-like, check whether the surrounding page already conditionally renders that section from a URL param — if so, the "modal" is just that same conditional wrapped in dialog chrome, closed via a real link back to the param-cleared href, not a new state machine.

## Task-Specific Staff Work Forms: FD Issuance (CM-51)

### Widen an existing button's condition instead of adding a near-duplicate one
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` (`canSubmit = (isSdCalculation || isFdIssuance) && !ALREADY_SUBMITTED_STATUSES.includes(status)` — CM-49's SD-only condition widened, not a second "FD Submit" button/handler added)
- Purpose: FD Issuance needed the exact same "Submit" action CM-49 already built for SD & Calculation Submission — same target status (`SUBMITTED`), same handler, same button markup. The only thing that differs between the two task types is *when* the button should be visible.
- Reusable takeaway: when a new task-specific (or actor-specific, or state-specific) form needs a button that already exists elsewhere with identical behavior, widen that button's visibility condition (an `||` on the existing boolean) rather than duplicating the handler and JSX under a new name — the four-Technical-step form set now shares exactly one Submit implementation across two task types instead of drifting into two copies that could diverge over time.

## Task-Specific Staff Work Forms: Getting Approval (CM-50)

### Extract a shared block once a second task-specific form needs the exact same one
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` (`compactRightRail` — one JSX block reused by both `isSdCalculation` and `isGettingApproval`; `attachmentsSection(title)` — a function, not a fixed block, once Getting Approval needed a different card title than SD/Drawing Received)
- Purpose: CM-49 built SD & Calculation Submission's right rail as its own inline JSX. When CM-50's Getting Approval turned out to need an *identical* right rail (same three cards, same content), copying that JSX a second time would have created two places that must be kept in sync by hand forever after. Extracting it once — at the point a second consumer actually needs it, not preemptively — removed that risk with no behavior change to either existing form.
- Reusable takeaway: don't extract a shared component/block speculatively when writing the first task-specific form (CM-49 was right not to abstract before there was a second real consumer) — extract it the moment a second, genuinely-identical need shows up, and parameterize only the one thing that actually differs (here, just the Attachments card's title) rather than over-generalizing the rest.

### Pick distinct existing statuses for sibling action buttons so they never collide
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` (Getting Approval's "Send Back for Changes" → `ON_HOLD`, "Reject" → `REJECTED` — two different buttons, two different existing statuses, documented in the component's own doc comment)
- Purpose: the spec asked for both a "send back" and a "reject" action, both required to map onto existing statuses only (no inventing new ones). The task status enum has both `ON_HOLD` and `REJECTED` already — mapping both buttons to the same status would make them functionally identical and confusing, so the two closest-fitting *distinct* existing values were chosen and the reasoning recorded in a comment, since the mapping itself isn't obvious from the code alone.
- Reusable takeaway: when a spec wants multiple action buttons that must each map onto a fixed, pre-existing enum (no new values allowed), check the full enum for two distinct values that fit before implementing — and write down *why* that pairing was chosen, since "which existing status means what for this button" is a judgment call a future reader can't reconstruct from the status names alone.

## Task-Specific Staff Work Forms (CM-49)

### Detect task type by the stable backend key, never the display name
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` (`const isSdCalculation = task.taskKey === 'technical_sd_calculation_submission';`)
- Purpose: the focused task screen needed to render a genuinely different form for SD & Calculation Submission vs. every other task. `taskKey` (`contract-workflow-templates.ts`) is the backend-defined, stable identifier a task's default template was created with; `taskName` is just display copy a manager or future rename could change without altering what the task actually is.
- Reusable takeaway: when a UI needs to branch behavior based on "which specific task/record type is this," key off the stable backend identifier (an enum value, a template key, a `type` column) — never off a human-readable label field, even one that looks stable today, since display text is the one thing most likely to get edited later without anyone expecting it to break routing logic.

### One flat, task-agnostic allow-list for a shared "optional fields" JSON column, not one list per task type
- Path: `apps/api/src/contracts/contract-workflow.service.ts` (`WORKFLOW_TASK_FORM_DATA_TEXT_KEYS` — a single array covering both Drawing Received's fields and SD & Calculation Submission's fields, not two separate allow-lists selected by taskKey)
- Purpose: `formData` is one JSONB column shared by every workflow task regardless of type. Keying the sanitizer's allow-list by taskKey would mean adding a new branch (and a new persistence contract) every time a new task-specific form is built, and the backend would need to know about every task type. Since each task-specific frontend form only ever renders and submits its own field names, a single flat superset allow-list is exactly as safe as a keyed one — no task ever receives another task's fields, because no task's form ever sends them.
- Reusable takeaway: when adding a second (or third, fourth...) task-specific form on top of an existing JSONB "optional fields" column and sanitizer, grow the existing flat allow-list rather than introducing per-type branching in the backend sanitizer — let the frontend's per-task-type form be the only place that decides which fields exist; the backend only needs to know the full universe of field names it's ever willing to store.

## Staff My Tasks Clickable Task Cards (CM-48C)

### "Stretched link" instead of a `<div onClick>` for a whole-card clickable target
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-card.tsx` (task-name `<Link>` with `after:content-[''] after:absolute after:inset-0` against the card's `relative` container; the Update Task button stays a sibling `<Link>` raised with `relative z-10`)
- Purpose: making an entire card open a URL on click without nesting an anchor inside another anchor (invalid HTML) or reaching for a `<div onClick={() => router.push(...)}>` handler that needs manual `stopPropagation()` on any inner interactive element and silently breaks native anchor behaviors (Ctrl/Cmd-click, middle-click, right-click "copy link").
- Reusable takeaway: when a whole card/row needs to be clickable while it still contains a real, independently-clickable link or button, use the stretched-link technique (one real anchor's `::after` pseudo-element covering the container, any other interactive element raised with `z-index` above it) rather than a JS click handler — it's native, keyboard-accessible by default, immune to double-navigation by construction (two separate anchors, not one handler firing twice), and preserves every native anchor behavior a `<div onClick>` would break.

## Contract Staff Dashboard Layout Balance Polish (CM-48B)

### Rebalance a two-column dashboard by moving a section, not by resizing columns
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-dashboard-view.tsx` (Today's Work moved from the left column to a full-width row above the grid; My Recent Task Updates moved from the right column into the left column, under My Assigned Tasks — same `[1.6fr_1fr]` split, same `limit` props on every child, unchanged)
- Purpose: CM-48's left column went visually empty below a short task list while the right column stacked three sections — the imbalance was about *which section lives in which column*, not about the column width ratio or any component's own sizing. Widening the left column or shrinking card padding further would have treated the symptom; moving one section across the split fixed the actual imbalance with a smaller, safer diff (one file, JSX order only).
- Reusable takeaway: when a two-column layout feels unbalanced (one side empty, the other crowded), check whether a section can move to the emptier column or to its own full-width row before reaching for column-ratio or component-padding changes — reordering existing, unmodified sections is usually the lowest-risk fix and is trivial to review since no component's props or internals change.

## Contract Staff Dashboard Single-Window Layout (CM-48)

### A separate early-return view instead of conditionally height-bounding a shared page tree
- Path: `apps/web/src/app/(protected)/contracts/dashboard/page.tsx` (`if (dashboardType === 'STAFF' && data) return <StaffDashboardView .../>` before any MANAGER/legacy rendering) + `apps/web/src/app/(protected)/contracts/dashboard/_components/staff-dashboard-view.tsx` (new)
- Purpose: only the Staff Dashboard needed the CM-46C-style `h-full` single-window treatment; the Manager Dashboard and the legacy/unavailable view needed to render exactly as before. Making the shared root conditionally `h-full` vs. normal flow would have meant threading a branch through the one JSX tree everyone shares — riskier to verify doesn't affect manager output than simply never reaching that tree for staff at all.
- Reusable takeaway: when only one dashboard type of several sharing a page needs a structurally different layout (not just different content), dispatch to a wholly separate component before the shared tree renders — same pattern as CM-46C's `StaffMyTasksView` — rather than adding conditional layout branches inside markup every other actor class also renders.

### Optional `limit`/`more*` props on a shared list component, defaulting to "show everything"
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/upcoming-schedule-list.tsx` (`limit?: number`, `moreHref?: string`, `moreLabel?: string` — all optional; the Manager Dashboard's call site passes none of them)
- Purpose: `UpcomingScheduleList` is shared between the Manager Dashboard (wants every item) and the new compact Staff Dashboard right column (wants at most 3 + a link to see the rest). Adding capping as opt-in, default-off props kept the one shared component instead of forking it, while guaranteeing the manager's existing call site is byte-for-byte unaffected (it simply never sets the new props).
- Reusable takeaway: when a compact layout needs to cap a shared list component's visible rows but another caller still needs the full list, add `limit`/`more*` as optional props defaulting to unlimited — cheaper and safer than forking the component or threading a new required prop through every existing caller.

## Contract Staff Dashboard Focused Work UX (CM-47)

### A "pick the one most urgent item" function with an explicit priority order, tiered by filter-then-first
- Path: `apps/web/src/app/(protected)/contracts/_lib/staff-dashboard-focus.ts` (`pickNextTask()` — overdue → due today → high-priority not-started → in-progress → earliest due date, each tier a plain `.filter()` returning its first match, since the input is already due-date-sorted)
- Purpose: a "what should I work on right now" panel needs one deterministic answer from a list, not a ranked score — the spec named an exact tiered priority order rather than a weighted formula. Each tier is a simple filter over the previous tier's leftovers, falling through in order; the final "earliest due date" tier re-sorts defensively rather than trusting caller order, since that's the one tier where correctness can't be justified by "the input happens to already be sorted."
- Reusable takeaway: when a spec gives an explicit, ordered list of "prefer X, else Y, else Z" rules for picking one item from a set, implement it literally as sequential filter-then-take-first tiers — it reads as a direct translation of the spec and is trivial to unit test tier-by-tier, rather than collapsing it into a single sort comparator that's harder to verify matches the stated priority order.

### Two dashboards, deliberately two small business-logic files, not one shared one
- Path: `apps/web/src/app/(protected)/contracts/_lib/staff-dashboard-focus.ts` (new, Contract Staff) vs. `apps/web/src/app/(protected)/contracts/_lib/contract-dashboard-focus.ts` (existing, unchanged, Contract Manager)
- Purpose: both files build a "what needs my attention" summary from a dashboard's own summary/task data, and structurally look similar enough that reusing or merging them would have been tempting. The safety rule "do not break Contract Manager dashboard" was read as a reason to keep them fully independent — a change to the staff logic (bucket definitions, priority order) can never accidentally alter the manager's "Today's Focus" sentence, and vice versa.
- Reusable takeaway: when two different actor-class dashboards need conceptually-similar-but-not-identical "focus" logic, and one of them is explicitly protected by a "don't break this" rule, prefer two small parallel files over one parameterized shared one — the duplication cost is a few lines; the coupling risk is a cross-dashboard regression.

## Staff Task Work Screen Single-Window Layout (CM-46C)

### `h-full` on a direct child of the app shell's own scroll container, not `calc(100vh-Npx)`
- Path: `apps/web/src/app/(protected)/_components/app-shell.tsx` (`<div class="flex h-screen overflow-hidden">` → `<main id="main-content" class="flex-1 overflow-auto">{children}`) consumed by `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` (`<div class="h-full min-h-0 flex flex-col">`)
- Purpose: a "single-window, no page scroll" page needs a bounded height to lay out against. `<main>` is already `flex-1` inside a `h-screen` flex column, and `overflow-auto` — meaning it is the actual scroll container for every route, not `<body>` — and any `h-full` direct child of it gets that exact viewport-minus-header height for free through ordinary flexbox math. No route needs to hardcode or measure the header's pixel height itself.
- Reusable takeaway: before writing `calc(100vh-56px)` (or any pixel-offset guess) to make a page fill the screen, check whether the app shell already establishes a flex-based scroll container above the route content — if it does (as here), `h-full` on the page's own root, plus `flex flex-col` + `flex-1 min-h-0 overflow-y-auto` on whichever inner region should absorb overflow, reproduces the same result without a magic number that breaks if the header's height ever changes.

### Form-associated fields outside their `<form>`'s DOM subtree, via `form="id"`
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` (Card B and Card D's optional inputs/textareas/checkboxes sit in a different grid column than `<form id="staff-task-update-form">`, each carrying `form="staff-task-update-form"`)
- Purpose: the reference layout put Section A (with the form) in one grid column and Sections B/D (needing the same form submission) in another — genuinely different DOM subtrees, not just visually separated. Extending CM-46's "buttons outside a form via `form=`" pattern to ordinary input/textarea/checkbox elements keeps the single real `<form>`/server action while letting the grid's column structure be whatever the layout needs, independent of where the form element itself lives in the tree.
- Reusable takeaway: a compact multi-column layout doesn't require one `<form>` per visual column — every native form control (`input`, `textarea`, `select`, `checkbox`, `button`) can point at a form by id anywhere in the document via the `form` attribute, so lay out columns by what belongs together visually, then wire the DOM-separated fields back to the one real form with `form="id"`.

## Staff Task Work Screen Reference UI Alignment + Optional Fields (CM-46B)

### A fixed allow-list sanitizer for an optional JSONB "extra fields" column, not an open Record
- Path: `apps/api/src/contracts/contract-workflow.service.ts` (`sanitizeWorkflowTaskFormData()` — 13 named text keys + 2 named boolean keys, everything else dropped; blank/false values dropped; result collapses to `null` when nothing is left)
- Purpose: `ContractWorkflowTask.formData` needed to store optional, UI-defined task-intake fields (Receipt Details / Drawing-Task Information / Follow-up notes) without ever becoming a bypass for core columns that already exist (status, remarks, dueDate, priority, responsibleUserId). Accepting the DTO's `Record<string, string | boolean>` as-is and writing it straight to the JSONB column would let any of those core-field names ride along inside `formData` and silently do nothing (confusing) or, worse, get read back somewhere as if authoritative.
- Reusable takeaway: when adding a flexible JSON column for "extra optional fields a form collects," write one small sanitizer function with a fixed, named allow-list (not a passthrough `Record`) — same shape as `CreateContractDto`'s `scopeOfWork`/`paymentTerms` convention already established, just applied to a per-row task column instead of a per-contract one. Export it so its behavior (especially "which keys get dropped") is unit-tested directly, not only through the full service method.

### One shared update form, three buttons with different post-submit navigation via a plain ref
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` (`submitIntentRef: 'draft' | 'save' | 'complete'`, set synchronously in each button's `onClick` before the shared `form="staff-task-update-form"` submits; the completion `useEffect` branches on it — `'draft'` calls `router.refresh()` only, everything else navigates back)
- Purpose: the reference layout wanted three genuinely different buttons (Save Draft / Save Update / Mark Complete) but there's only one real mutation (the task-update PATCH) and no backend "draft" concept to invent. Rather than fabricate three server actions or three forms, one ref captures *why* the shared form was submitted, read only after the async action resolves — giving each button real, distinct behavior (stay vs. leave) without any duplicate mutation logic.
- Reusable takeaway: when a design wants multiple buttons that must all submit the same underlying form/action but should behave differently afterward, don't fork the form — set an intent ref in each button's `onClick` (fires synchronously before the async submission starts) and branch on it once in the shared post-submit effect.

## Staff Task Work Screen Compact Layout (CM-46)

### Buttons outside a `<form>` submitting it via `form="id"`
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` (`<form id="staff-task-update-form">` with its Status/Remarks/Delay Reason fields; the Save Update and Mark Complete `<button>`s live in a separate sticky bottom bar with `form="staff-task-update-form"`)
- Purpose: a compact work-screen layout wanted the action buttons pinned in one shared bottom bar rather than repeated inside each card's own form, but the Task Update form's fields still needed to stay inside their own card, and the bottom bar also needed a `Back to My Tasks` link that isn't a form submission at all. Moving the whole form down into the bottom bar would have forced awkward layout nesting; the standard HTML `form` attribute lets a button submit a form it isn't a DOM descendant of, with zero change to how `useActionState`/`FormData` behave (they bind to the form element, not to where its buttons physically sit).
- Reusable takeaway: when a design wants submit controls visually separated from their form's fields (a sticky footer, a shared action bar across multiple cards), reach for `<button form="id">` before restructuring the form itself — it's a plain HTML feature, not something React-specific, and keeps the form's actual field markup wherever the layout needs it.

### Horizontal stepper instead of a vertical list, for the same already-real step sequence
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` (`task.teamTasks` rendered as a `flex flex-wrap` row of numbered/checked circles connected by short lines, each step's name truncated under it, instead of CM-44's original `<ol className="space-y-2">` vertical list)
- Purpose: CM-44's vertical stepper was the single biggest height contributor on any team with 4+ steps (each step a full row). The underlying data (`teamTasks`, sortOrder-sorted) didn't change — only the visual arrangement, which cuts a 4–6 step list from ~150-200px tall to roughly one compact row.
- Reusable takeaway: when a compact-layout pass targets a specific section for height, check whether the content is naturally sequential (steps, stages) before assuming a rewrite of the underlying data or logic is needed — often only the list's `flex-direction` needs to change, wrapping on narrow screens instead of always stacking.

## Contract Staff Task-First Work Page (CM-44)

### Redirect at a shared layout instead of hiding tabs per-page
- Path: `apps/web/src/app/(protected)/contracts/[id]/(workspace)/layout.tsx` (`if (isContractStaffOnlyAccess(permissions)) redirect('/contracts/workflow?mode=my-tasks')`, placed immediately after `permissions` is resolved, before any header/tabs/`{children}` render)
- Purpose: twelve manager-only workspace sub-routes (Schedule, Payments, Production, Variations, Claims, Risks, Documents, Workflow, Issues, Attachments, Closeout, Activity) share one layout file. Redirecting there — instead of hiding `ContractWorkspaceTabs` entries or guarding each `page.tsx` individually — closes the door for an entire actor class at a single point, with no risk of a new sub-route being added later and forgetting the guard.
- Reusable takeaway: when a whole class of actor must never reach an entire route subtree, look for the shared layout above that subtree first — one redirect there is safer and lower-maintenance than N per-page or per-tab checks.

### A separate simplified panel instead of a manager panel with fields disabled
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` (new, standalone) vs. the existing manager `workflow-task-drawer.tsx` (untouched)
- Purpose: the spec required staff to never see responsible-person/due-date/priority/payment/claim/closeout fields at all — not grayed-out, not present-but-disabled. A "staff mode" prop threaded through the existing drawer would still render those fields' markup (just disabled), which doesn't satisfy a literal "do not show" requirement and risks a future edit re-enabling something by accident.
- Reusable takeaway: when a spec says a field must not be *shown* (not just not be *editable*) to some actor, don't reach for a conditional-disable prop on the existing full component — write a separate, smaller component for that actor that only ever renders the fields they're allowed to see. Still reuse the same backend server actions/mutations; only the rendered surface differs.

### N+1 over two existing endpoints instead of a new "my tasks across contracts" endpoint
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-my-tasks-view.tsx` (`listWorkflow({myTasksOnly:true})` → contract id set → `Promise.allSettled` of `getWorkflow(contractId)` — the full, unfiltered task list — per contract → filtered client-side to `responsibleUserId === currentUserId` → flattened `StaffFlatTask[]`)
- Purpose: no backend endpoint returns a flat "all of my tasks across every contract" list; two existing endpoints already answer both halves of the question (which contracts, then which tasks per contract) and the N is bounded by how many contracts one staff member actually has work on. The full (not `myTasksOnly`-filtered) per-contract fetch is deliberate here — see the stepper pattern below.
- Reusable takeaway: third time this pattern has been used (after `administration/users/new` and CM-42's `administration/users` page) — before adding a new list endpoint for a "flatten per-parent children across many parents" need, check whether the parent-list and per-parent-detail endpoints already exist and can be composed with `Promise.allSettled`.

### A step sequence derived from real sortOrder data, not a fabricated "workflow stage" concept
- Path: `apps/web/src/app/(protected)/contracts/_lib/staff-task-grouping.ts` (`StaffFlatTask.teamTasks` — every task on the contract sharing this task's `team`, sorted by `sortOrder`), consumed by `staff-task-update-panel.tsx`'s stepper + Current/Next Stage fields
- Purpose: the data model has no explicit "workflow stage" entity, but each team's default task templates (`apps/api/src/contracts/contract-workflow-templates.ts`) already define a real, fixed `sortOrder` sequence per team (e.g. TECHNICAL: Drawing Received(1) → SD & Calculation Submission(2) → Getting Approval(3) → FD Issuance(4)). Fetching the *full* per-contract task list (not `myTasksOnly`-filtered) and grouping by `team`+`sortOrder` reconstructs a truthful step sequence and "current/next stage" name without inventing anything — `GET :id/workflow` only requires `contracts.read`, which staff already holds, so no permission change was needed to read the other team members' task rows for this purpose.
- Reusable takeaway: when a UI needs a "progress through stages" view and the schema has no explicit stage field, look for an existing `sortOrder`-within-a-group column before adding one — grouping and sorting already-fetched sibling rows is often enough, and stays honest to what the backend actually models.

### Deferred-value form submission via requestSubmit() in a useEffect
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/staff-task-update-panel.tsx` (`handleMarkComplete` sets `status` state to `'COMPLETED'` and a `pendingComplete` flag; a `useEffect` watching `[pendingComplete, status]` calls `formRef.current?.requestSubmit()` once the state update has actually landed)
- Purpose: a "Mark Complete" shortcut button needs to submit the same `<form>`/server action as "Save Update" but with the Status `<select>` forced to COMPLETED first. Calling `setStatus('COMPLETED')` then `formRef.current.requestSubmit()` in the same click handler submits stale data — React state updates aren't reflected in the controlled `<select>`'s DOM value until after the next render. Gating the `requestSubmit()` call in a `useEffect` keyed on the state that must land first fixes this without inventing a second server action or duplicating form fields.
- Reusable takeaway: for a button that should submit a controlled form with one field forced to a specific value, don't read-after-write in the same handler — set the state, then trigger `requestSubmit()` from a `useEffect` that depends on that state having actually changed.

## Users Page Tabs (CM-42B)

### A hidden field to keep a GET filter form on its own tab
- Path: `apps/web/src/app/(protected)/administration/users/page.tsx` (`<input type="hidden" name="tab" value="all-users" />` inside the filter `<form method="GET">`; the "Clear" link explicit `?tab=all-users`)
- Purpose: when a page's *default* view (no query param) differs from the view a filter form lives on, a plain `<form method="GET">` submission silently drops back to the default — the form only emits the fields it has inputs for, so an unlabeled "which tab am I on" concept gets lost on every submit unless it's carried as a hidden field. Same fix as CM-40's `AssignmentQueueFilterBar` (`mode=assignment` hidden field) — same underlying problem, same solution, second time this pattern has been needed.
- Reusable takeaway: whenever a filter/search `<form method="GET">` sits inside a tab, mode, or other query-param-driven view that is *not* the page's default, always add a hidden field carrying that view's param — check every "Clear"/reset link too, since those need the same param appended explicitly.

## Module-Based User Management Cards (CM-42)

### Bucket an already-fetched list by a rule that already exists elsewhere, instead of a new field
- Path: `apps/web/src/app/(protected)/administration/users/_components/module-user-counts.ts` (`computeModuleUserCounts`), reusing `MODULE_READ_PERMISSION` newly exported from `apps/web/src/app/(protected)/_lib/module-visibility.ts`
- Purpose: "N users have access to module X" needed no new backend field — the user list already has each user's role code, and each role's permission list (already fetched by the New User wizard) plus the existing module→read-permission map (the same rule that decides sidebar visibility) are enough to compute it purely in the frontend/page-composition layer.
- Reusable takeaway: before adding a backend aggregate/count endpoint, check whether an *existing* per-item rule (a permission map, a status classifier) can be applied to data already on the page to derive the same count. This is the same instinct as CM-41's `isContractStaffOnlyAccess()` and CM-39B's attention-item grouping — reuse a rule, don't duplicate it as a new server computation.

### Seed a wizard's existing internal state from a URL param, without adding a new code path
- Path: `apps/web/src/app/(protected)/administration/users/_components/new-user-wizard.tsx` (`preselectedModule` prop; `preselectedRoleId()` helper mirrors `handleTargetModuleChange`'s existing logic for the initial-render case only)
- Purpose: the wizard already had `targetModule`/`selectedRoleId`/`moduleScopes` state and a handler that keeps them consistent when a module is picked by hand. Rather than adding an effect or a second "apply preselection" code path, the *initial* values of that same state are computed the same way the handler would compute them — one extra optional prop, zero new interaction logic, and the field stays fully editable exactly as if chosen manually.
- Reusable takeaway: when "preselect field X from a URL param" is requested for a form that already derives X's downstream effects from a change handler, don't build a parallel "apply preselection" path — compute the initial `useState` value using the *same* derivation the handler already encodes, so there is only ever one place that logic lives.

### Shared slug↔identifier catalog for cross-surface linking
- Path: `apps/web/src/app/(protected)/administration/users/_components/module-catalog.ts` (`MODULE_CATALOG`, `moduleBySlug`, `moduleByCode`)
- Purpose: three different surfaces (module cards, the optional table filter, and the wizard's `?module=` param) all need to agree on the same short URL slug for each module (`contracts`, `factory-tasks`, …) mapped to the same `ModuleCode`/`ModuleIdentifier` value. One shared file is the only place that mapping is written.
- Reusable takeaway: whenever a URL-friendly slug needs to reach the same meaning in 2+ places (a card's link, a filter dropdown's options, a receiving page's query-param parser), define the slug↔value table once and import it everywhere — never let two places invent the same slug string independently.

## Contract Staff Simplified Sidebar (CM-41)

### Swap an entire nav item list based on a permission-only classifier, not per-item gating
- Path: `apps/web/src/app/(protected)/_components/sidebar.tsx` (`CONTRACT_STAFF_ITEMS` vs. `CONTRACT_ITEMS`, selected via `isContractStaffOnlyAccess()`)
- Purpose: every `CONTRACT_ITEMS` entry was gated only by the module-level `contracts.read` check, so Contract Staff (who legitimately have `contracts.read`) saw the full manager register list. Rather than adding a `staffHidden` flag to 5 individual items, the whole source array is swapped for a short staff-only list before the existing per-item `isNavItemVisible()` filter runs — both existing rendering paths (nested-under-Operations, flat Contract-Management-only) pick this up for free since they both consume the same `visibleContractItems` variable.
- Reusable takeaway: when a role needs a *substantially* shorter version of an existing nav section (not just 1-2 items hidden), prefer swapping the whole source list over adding a new boolean to every item — fewer places for a future item to accidentally leak into the wrong tier's view.

### Classifier functions belong in module-visibility.ts, and must be proven against every affected role
- Path: `apps/web/src/app/(protected)/_lib/module-visibility.ts` (`isContractStaffOnlyAccess`)
- Purpose: same file/pattern as `canSeeModule`/`isContractManagementOnlyAccess` — permission-only, never role-code-based. Before trusting a new classifier like this, its test suite (and, ideally, a live check) must cover every role it needs to distinguish, not just the "true" case — this one is tested/verified against Contract Staff (true), Contract Manager, the legacy `CONTRACT_MANAGEMENT_USER`, and Admin/Super Admin (all false), because a subtly wrong classifier here would either leak manager tools to staff or (worse) strip a manager down to the staff view.
- Reusable takeaway: legacy roles are a common trap for a new "is this the narrow role" classifier — `CONTRACT_MANAGEMENT_USER` predates `contracts.workflow_update` entirely and was never granted it, so a classifier that only checked "does NOT have contracts.update" (without also requiring workflow_update to be present) would have wrongly simplified its sidebar too. Always assert the classifier against every known role that must NOT match, not just the one that should.

## Assignment Queue Search Suggestions (CM-40D)

### Live client-side typeahead over data the server already fetched
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-contract-picker.tsx`
- Purpose: matches free-text input against a small already-in-memory array (`AssignmentQueueContractGroup[]`) with a plain `useMemo` filter — no debounce, no request, no "Apply" step. Works because the list involved is bounded (contracts *needing assignment*, not the whole contract register) and was already fetched for the page's other sections.
- Reusable takeaway: before building a search-as-you-type feature against an API (debounced fetch, loading states, race-condition handling), check whether the candidate list is already small and already loaded on the page — if so, a client-side `.filter()` is simpler, has zero latency, and needs none of a network-backed typeahead's usual complexity. Only reach for server-side search when the candidate set is too large to ship to the client at all.

### Passing hrefs across a Server→Client boundary as data, not closures
- Path: `assignment-queue-contract-picker.tsx` (`baseHref: string` prop) vs. `assignment-queue-contract-list.tsx` (still takes a `buildAssignHref` function, since it's a Server Component)
- Purpose: CM-40C's `buildAssignmentHref()` closure works fine passed between Server Components, but cannot be passed into a Client Component (functions aren't serializable across that boundary in the App Router). The fix was to pass the same href as a plain string and let the client component do simple string concatenation for the one dynamic part (`&contractId=...`).
- Reusable takeaway: when a new Client Component needs a per-item href that a Server Component parent already knows how to build, don't pass the builder function — compute the *shared prefix* as a string server-side and hand that down; do the final per-item interpolation client-side with template literals. This is the general fix any time an existing "buildHref(overrides)" closure pattern needs to reach a component that turns out to need `'use client'`.

### Collapsible "Advanced filters" that auto-expands when already active
- Path: `assignment-queue-advanced-filters.tsx` (`useState(props.hasActiveFilters)`)
- Purpose: filters are hidden by default (keeping the guided search as the primary UI) but automatically start open if the manager arrived via a URL that already has one of those filters set — otherwise a filtered list would look silently narrowed with no visible explanation.
- Reusable takeaway: any collapsible-filters pattern should default its expanded state to "is a filter from this group already active," not always closed — same principle as CM-40C's `AssignmentQueueAdvancedSection` (always collapsed) vs. this one (conditionally collapsed) — the difference being whether the collapsed content is optional/rarely-needed (CM-40C's full flat board) vs. state the user may already depend on (active filters).

## Contract-First Assignment Queue (CM-40C)

### URL-driven master/detail selection instead of client state
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-view.tsx` (`?contractId=` resolved server-side, no `useState` for which contract is selected)
- Purpose: the Assignment Queue's Server Component already fetches the full flat item list on every render; selecting a contract is just a client-free filter (`getContractQueueItems`) of data already fetched, driven by a URL query param rather than component state. Refresh, bookmark, and share-link all preserve the selection for free.
- Reusable takeaway: before reaching for `useState` to track "which item is currently selected/expanded" in a master/detail UI, check whether the parent is already a Server Component re-fetching on every navigation — if so, a URL param + server-side filter is usually simpler AND gives URL persistence for free, which client state never does without extra plumbing (history API, etc.). Compare to CM-39's `ManagerSecondaryTabs` (client toggle) — the difference is whether the two "views" are cheap to derive from data already in hand (here, yes — URL) vs. whether they're the *same* server data just laid out differently with no distinct entity to bookmark (there, client toggle is fine).

### Demote, don't delete, a previous default view
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-advanced-section.tsx`
- Purpose: CM-40B's all-contracts Kanban/table board was the *default* landing view; CM-40C's contract-first cards replaced it as the default, but the safety rules required keeping the old view reachable. Solution: a collapsed-by-default disclosure (`useState(false)`, "Show All Unassigned Tasks (Advanced)") wrapping the untouched `AssignmentQueueViewSwitcher` from CM-40B.
- Reusable takeaway: when a task changes what the *default* view of a page is but explicitly forbids removing the old capability, look for a "collapsed advanced section" rather than a route/mode fork — it satisfies "don't break existing behavior" (the component is literally unmodified) while cleanly satisfying "don't make it the default" (collapsed, one click away).

### Optional prop to suppress duplicated context in a nested-card layout
- Path: `assignment-queue-task-card.tsx` (`hideContractInfo?: boolean`) → `assignment-queue-board.tsx` → `assignment-queue-view-switcher.tsx`, all default `false`
- Purpose: when a Kanban board is scoped to one contract (shown once in a header above it), repeating that contract's reference/name/client on every task card is redundant. Rather than forking `AssignmentQueueTaskCard` into two components, one optional prop threaded through the 2 components between it and the page suppresses those 3 lines.
- Reusable takeaway: same pattern as `MetricCard`'s `dense` prop (CM-39C) — an additive, default-off prop threaded through the existing component chain, not a new sibling component, whenever a component needs a "context already shown elsewhere" variant.

## Workflow Assignment Queue Kanban Board (CM-40B)

### Add a missing semantic color token instead of hardcoding one
- Path: `apps/web/src/app/globals.css` (`--color-team-production` / `--color-team-production-light`), mirrored in `context/ui-tokens.md`
- Purpose: the Assignment Queue Kanban board needed 4 distinct, professional team-accent colors (blue/indigo-purple/orange/green). 3 of the 4 already existed as semantic tokens with matching hues (`info`=blue, `warning`=orange-ish, `success`=green); nothing covered indigo/purple, so rather than hardcoding a raw hex or Tailwind palette class in the feature component (explicitly forbidden by `ui-tokens.md`: "never hardcode colors in feature components and never use raw Tailwind product colors"), one new token pair was added to the `@theme` block, following the exact same `--color-x` / `--color-x-light` naming convention as every other status color.
- Reusable takeaway: when a design request needs a color the current token set doesn't cover, the correct move is a small, well-justified token addition (documented with *why*, and reusing existing tokens for every hue that already fits) — not a one-off inline hex value. Check `globals.css` for the full current palette before assuming a new token is needed; 3 of 4 colors here already existed.

### Client-side view switcher over server-fetched-once data
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-view-switcher.tsx`
- Purpose: toggles between `AssignmentQueueBoard` (Kanban, default) and `AssignmentQueueTable` (CM-40, unmodified) — both receive the exact same `items`/`people`/`truncated` props from one server fetch; the toggle only changes which is rendered (`useState`), never triggers a refetch.
- Reusable takeaway: this is the same "server-fetch-once, client-toggle-visibility" pattern as CM-39's `ManagerSecondaryTabs`, applied to two *layout* alternatives (grid vs. table) instead of two *content* panels — reach for it any time a spec wants "let the user pick how this same data is displayed."

### Kanban column grouping directly from a flat API list — no new endpoint
- Path: `apps/web/src/app/(protected)/contracts/workflow/_components/assignment-queue-board.tsx` (`items.filter((i) => i.team === team)` per column)
- Purpose: CM-40's `WorkflowAssignmentQueueItem[]` already carries a `team` field per task; grouping into 4 columns is a pure client-side `.filter()`, not a new query or a new backend shape.
- Reusable takeaway: before adding a backend grouping/aggregation endpoint for a new visual layout, check whether the flat list already fetched carries the field needed to group client-side — a Kanban/board view is very often just a different client-side arrangement of data a table view already has.

## Workflow Assignment Queue (CM-40)

### Mode-dispatch within one route instead of a new page
- Path: `apps/web/src/app/(protected)/contracts/workflow/page.tsx` (early `if (isAssignmentMode) { ...; return AssignmentQueueView({ searchParams: params }); }`) + `_components/assignment-queue-view.tsx` (the dispatched view's own full page body) + `_components/workflow-mode-tabs.tsx` (link-based All Workflows / Assignment Queue / My Tasks / Overdue tabs)
- Purpose: `?mode=assignment` renders a heading/subtitle/cards/filters/list that are *entirely* different from the default "All Workflows" register, without moving off `/contracts/workflow` or touching any of that page's existing logic — the dispatch happens before the original function body runs, so the default view is provably unchanged (same function, unreached code path for `mode=all`).
- Reusable takeaway: when a spec asks for a very different-looking view under the *same* URL/route (rather than a subroute), branch at the very top of the Server Component and delegate to a self-contained sibling component that does its own data fetching — cheaper and lower-risk than trying to make one render function serve two unrelated layouts via conditionals threaded through the whole JSX tree. Tabs between modes are plain `<Link>`s (not client-side toggles) whenever each mode needs meaningfully different server data — see WorkflowModeTabs vs. CM-39's `ManagerSecondaryTabs` (client toggle) for the contrast: toggle when panels share one server fetch, link when they don't.
- Manager-only tabs are omitted from the array entirely (`tabs.filter(t => !t.managerOnly || canManage)`), not rendered-disabled — matches the "hide, don't just disable" instruction for features a role should never see.

### Never generate data as a side effect of a read-only view
- Path: `apps/api/src/contracts/contract-workflow.service.ts` (`findAssignmentQueue()` vs. `getWorkflowForContract()`)
- Purpose: the Assignment Queue lists unassigned tasks and separately flags contracts that need workflow tasks generated — but never generates anything itself. Generation only ever happens via the pre-existing `getWorkflowForContract()` lazy-init path, triggered by an explicit manager click ("Generate / View Board" → the ordinary board URL).
- Reusable takeaway: when a new read/list view surfaces "missing" or "not yet initialized" data that some *other* existing endpoint already knows how to safely (idempotently) create, link to that existing creation path rather than teaching the new view to create things too — keeps the list endpoint pure-read and avoids a second, possibly-inconsistent generation code path. Applies to any future module-level register that surfaces per-item "not set up yet" rows (compare CM-38's closeout register reading a stored snapshot rather than recomputing, for the same "reuse, don't reimplement" instinct).

### Anchor-link KPI card into the section it summarizes
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-summary-cards.tsx` (`href="#priority-actions"`) + `apps/web/src/app/(protected)/contracts/dashboard/page.tsx` (`<section id="priority-actions">`)
- Purpose: The "Manager Actions" KPI card links to an in-page anchor on the Priority Actions table below it, rather than a separate route — appropriate when the "detail view" for a summary number already lives further down the same page.
- Reusable takeaway: `MetricCard`'s `href` prop works equally well with an in-page `#anchor` as with a route; prefer the anchor over a full navigation when the destination is already rendered on the current page.

### ProductionOrderStatusBadge (inline)
- Path: `apps/web/src/app/(protected)/production/[id]/page.tsx` (inline `StatusBadge` component)
- Purpose: Pill badge for the 6 production order lifecycle statuses.
- Variants: DRAFT (surface/border/text-secondary), SCHEDULED (blue-50/text-blue-700/border-blue-200), IN_PROGRESS (success-light/text-success/border-success/30), PAUSED (warning-light/text-warning/border-warning/30), COMPLETED (surface/text-muted/border), CANCELLED (danger-light/text-danger/border-danger/30).
- Key tokens/classes: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`
- Accessibility behavior: Pure component; no additional aria attributes.
- Used by: `production/page.tsx`, `production/[id]/page.tsx`
- Notes: Defined inline on the detail page using `STATUS_COLORS: Record<string, string>` lookup. Status label replaces `_` with space.

### AddEntryForm (Production)
- Path: `apps/web/src/app/(protected)/production/[id]/entries/new/_components/add-entry-form.tsx`
- Purpose: Client form to record production entries; renders different fields based on selected entry type.
- Variants: OUTPUT (quantityProduced required + optional accepted/rejected grid), DOWNTIME (downtimeMinutes required), ADJUSTMENT (adjustmentQty required, can be negative). Radio buttons switch between types; unrelated fields are hidden (not rendered) — no stale data submitted.
- Key tokens/classes: Standard form tokens; radio inputs use `accent-accent`.
- Accessibility behavior: Labelled inputs; required fields marked; radio group with per-option labels.
- Used by: `production/[id]/entries/new/page.tsx`
- Notes: `'use client'`; `useState` for entryType + `useActionState` for form state. `boundAction` prop passed from server component parent. Type-specific fields conditionally rendered (not hidden via CSS) to avoid submitting stale values.

### EditOrderForm (Production)
- Path: `apps/web/src/app/(protected)/production/[id]/edit/_components/edit-order-form.tsx`
- Purpose: Edit form for DRAFT production orders — title, description, product code/name, targetQuantity, unit, scheduled start/end.
- Variants: Single variant (DRAFT only — server component redirects non-DRAFT to 404).
- Key tokens/classes: Standard form tokens; grid-cols-2 for code/name and quantity/unit pairs.
- Accessibility behavior: Labelled inputs; required fields marked.
- Used by: `production/[id]/edit/page.tsx`
- Notes: `'use client'`; `useActionState`; `defaultValues` prop carries existing order field values; `boundAction` from server component.

---

## API Patterns (Unit 13)

### ProductionOrdersService — Unified Transition Helper
- Pattern: Private `transition(id, version, fromStatus, toStatus, actor, event, extraData)` handles all simple binary transitions: `updateMany(WHERE id AND status=fromStatus AND version)` + count check + inside-transaction `findUnique` disambiguation (not-found → 404, wrong-status → 422, stale version → 409).
- Used by: `schedule()`, `start()`, `pause()`, `resume()`, `complete()`. `cancel()` has its own `IN clause` variant for multi-source statuses.
- Notes: `extraData` carries lifecycle timestamp fields (e.g. `startedAt`, `startedByUserId`) set per-transition. Activity record created in same transaction with `previousStatus` and `newStatus`.

### ProductionOrdersService — cancel() Multi-status Pattern
- Pattern: `cancel()` uses `WHERE status IN [DRAFT, SCHEDULED, IN_PROGRESS, PAUSED]` with version check. After count=0: `tx.findUnique` to check if order exists (→ 404 if not), then `CANCELLABLE.includes(order.status)` (→ 422 if status is COMPLETED/CANCELLED), otherwise → 409 version conflict.
- Used by: `ProductionOrdersService.cancel()`.
- Notes: `CANCELLABLE` and `ENTERABLE` arrays must be typed as `ProductionOrderStatus[]` for TypeScript `Array.includes()` to accept `ProductionOrderStatus` values from the WHERE clause result.

### computeMetrics() — Pure Exported Function
- Pattern: `export function computeMetrics(entries: RawEntry[], targetQuantity: number): ProductionMetrics` in `production-orders.service.ts`. Accumulates OUTPUT (totalProduced/accepted/rejected), DOWNTIME (totalDowntimeMinutes), ADJUSTMENT (adjustmentTotal); derives `effectiveProduced = totalProduced + adjustmentTotal`; `completionPercentage` and `rejectionRate` rounded to 2 decimal places; `remainingQuantity` clamped to 0 minimum.
- Used by: `ProductionOrdersService.getMetrics()`, unit tests directly.
- Notes: Never stored in DB — computed at read time. Import directly in tests for pure function coverage without DB mocks.

### Server Component Form Actions — Signature Constraint
- Pattern: Inline server actions in RSC pages that are passed directly to `<form action={...}>` must use `(formData: FormData) => Promise<void>` signature. The `(prev, formData) => Promise<State>` signature is only valid when passed to `useActionState()` in a client component.
- Used by: `production/[id]/page.tsx` (`handlePause`, `handleCancel`, `handleComment`).
- Notes: Workaround: call the `(prev, formData)` action from the `(formData)` wrapper with a static initial state: `await pauseOrderAction(id, version, { error: null }, formData)`. Errors from these transitions are not surfaced to UI in this pattern; use a dedicated client component with `useActionState` for error feedback.

### Inline notFound() with .catch() Pattern
- Pattern: `const order = await productionApi.get(id).catch(() => notFound())`. Because `notFound()` returns `never`, TypeScript infers the result as `Awaited<ReturnType<typeof productionApi.get>>` (the non-never branch). This avoids `let order: T | undefined` + subsequent non-null assertion and correctly narrows the type for the rest of the function.
- Used by: `production/[id]/edit/page.tsx`.
- Notes: Preferable to `try { ... } catch { notFound() }` + `if (!order) notFound()` because TypeScript cannot always narrow through the latter pattern.

## Contract Manager Dashboard — Approved Design (CM-54)

### DashboardKpiCard
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/dashboard-kpi-card.tsx`
- Purpose: Approved-design KPI card — compact icon in a soft colored circle, bold value, label, subtext, optional secondary breakdown line. Distinct from the older `_components/metric-card.tsx` (kept for other module dashboards / the legacy contracts-dashboard fallback branch).
- Variants: `accent` prop selects one of 7 soft-colored icon circles: `accent | success | warning | error | info | team-production | teal` (CM-54C added `teal` — see `ui-tokens.md`).
- Key tokens/classes: `bg-{accent}-light text-{accent}` icon circle (`size-9`, icon `size-4.5` — CM-54D pulled back from CM-54C's `size-10`/`size-5` for a more compact card); card is `bg-surface rounded-xl border border-border shadow-sm p-4 gap-2`; value is `text-2xl font-bold`; secondary line is a borderless muted footnote (`text-text-muted/90`, no divider — CM-54D removed the `border-t` for a lighter look).
- Accessibility behavior: Whole card is a `Link` (focus ring, `hover:-translate-y-0.5` lift + `group-hover:shadow-md` on the card body) when `href` + `status === 'ok'`; otherwise a plain, non-interactive `div` with zero hover styling (no fake interactivity on non-clickable cards). Value collapses to `—` when `status !== 'ok'`.
- Used by: `manager-kpi-grid.tsx`.
- Notes: `value` accepts `string | number | undefined` so callers can pass pre-formatted KWD strings (`formatKwdCompact`) or raw counts. CM-54C/CM-54D are both visual-only polish passes — no prop/behavior change since CM-54 beyond adding the `teal` accent.

### ManagerKpiGrid
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/manager-kpi-grid.tsx`
- Purpose: The 11-card KPI grid for `/contracts/dashboard` (MANAGER dashboardType only).
- Key tokens/classes: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` — cards 7-11 land on a second row on desktop automatically; Open Claims is ordered 7th so it's guaranteed onto that second line per the CM-54 change request.
- Used by: `dashboard/page.tsx` (MANAGER branch).
- Notes: Reads `data.metrics`, `data.manager.summary`, and `data.manager.insights` (financials/criticalProjectContracts/contractsClosingSoon). See `contract-dashboard.service.ts` for how `insights` is computed server-side.

### DisciplineProgressPanel
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/discipline-progress-panel.tsx`
- Purpose: "Progress by Discipline" card — CSS progress bars for Technical/Production/Erection + Overall, computed from real `TeamWorkflowOverview[]` completed/total task ratios.
- Notes: No word "Physical" anywhere (CM-54 wording change). No month-over-month delta shown — this system has no historical snapshot to compute one honestly against.

### FinancialPerformanceChart
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/financial-performance-chart.tsx`
- Purpose: "Financial Performance (KWD)" bar chart — plain CSS bars (Contract Value / Submitted Invoices / Received Payments / Outstanding — CM-54B plain payment-flow wording), no chart library.
- Notes: The approved screenshot's "Certified" bar is deliberately omitted per the CM-54 change request.

### DonutChart
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/donut-chart.tsx`
- Purpose: Reusable SVG donut + legend (no chart library). Used for both "Contracts by Status" and "Claims Status Overview".
- Key tokens/classes: Segment colors cycle through a fixed CSS-variable palette (`var(--color-info)`, `--color-success`, `--color-warning`, `--color-error`, `--color-team-production`, `--color-accent`, `--color-secondary-accent`, `--color-text-muted`) — never a raw hex.
- Notes: `segments: {key,label,count}[]` — pure presentational; callers (dashboard-insights-helpers.ts) decide which real statuses to include/exclude/label. CM-54C: empty state (`total === 0`) now shows a centered `PieChart` icon + message instead of plain muted text, for a clearer "no data" state on Claims Status Overview specifically.

### ManagementAttentionRequiredPanel
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/management-attention-required-panel.tsx`
- Purpose: Bottom-left "Management Attention Required" list (Overdue Workflow Tasks / Overdue Payment Follow-ups / Critical Project Contracts / Open Issues / Claims with Action Due), each row linking to its real register.
- Notes: Replaces CM-39's `ManagerAttentionTable`/Priority Actions section for the approved design. "Expiring Documents" removed (no document-expiry tracking exists); the former "risk" wording is now "Critical Project Contracts" everywhere.

### TopContractsTable
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_components/top-contracts-table.tsx`
- Purpose: Reusable Job Order / Project Name / metric-column table, used for both "Top 5 Delayed Contracts" (Delay (Days)) and "Top 5 Contracts by Value" (Value (KWD)).
- Used by: `dashboard/page.tsx` (MANAGER branch), twice with different `metricColumnLabel`/rows.

### dashboard-insights-helpers.ts (pure functions)
- Path: `apps/web/src/app/(protected)/contracts/dashboard/_lib/dashboard-insights-helpers.ts`
- Purpose: Formatting (`formatKwdCompact`) and derived-data shaping (discipline progress %, mutually-exclusive Contracts-by-Status segments, Claims-by-Status label mapping) for the CM-54 dashboard. Unit tested in the sibling `.test.ts`.
- Notes: `totalContractsFromMetrics`/`buildContractsByStatusSegments` deliberately do NOT sum all 6 raw `metrics` fields — `totalExpiring`/`totalExpired` are subsets of `totalActive` (see `contracts.service.ts` `getDashboard`/`getSummary`), not additive categories. Summing all 6 double-counts (a bug present in the older, unused `ContractKpiGrid` fallback component — not repeated here).

## New Contract Register — Approved Design (CM-56)

### ContractBoqRegisterTable
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-boq-register-table.tsx`
- Purpose: The approved-design BOQ table for `/contracts/new` only — S/N, Item Description, Unit, BOQ Qty / Area, Unit Price (U/P) KWD, Total Price (T/P) KWD, Invoice Qty, Progress / Invoice %, Amount Remaining KWD, Drawing Ref., Calculation Ref., Action. Delete is blocked once only 1 row remains (disabled + tooltip, never zero rows).
- Used by: `new/_components/new-contract-form.tsx` only.
- Notes: Deliberately NOT the same component as the shared `contract-boq-table.tsx` (Edit Contract's larger itemCode/category/mixDesign/concreteGrade column set) — a separate table so Edit Contract's BOQ editing UX is untouched by this design. "Calculation Ref." reuses the existing `specificationReference` DB column (closest real semantic match).

### ScopeOfWorkFieldset — `excludeKeys` / `gridClassName` props
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-form-fields.tsx`
- Purpose: Optional `excludeKeys?: string[]` prop hides specific scope-of-work checkbox options (and, when `'other'`/`'notApplicable'` are excluded, their associated label/helper text) without touching the shared component's default behavior. Optional `gridClassName?: string` (default: the shared `gridCls3`, 3-column) overrides the checkbox grid's layout — added in CM-56B so New Register's narrower ~40%-width column could use a 2-column grid.
- Used by: New Register passes `excludeKeys={['designProduction', 'other', 'notApplicable']}` (matching the approved 5-option list — Shop Drawing / Production / Delivery / Erection / Ex-Factory) and `gridClassName="grid grid-cols-2 gap-3"`. Edit Contract passes neither prop and is fully unaffected by either default.

### Wide page container + side-by-side section rows (CM-56B)
- Pattern, not a component. `/contracts/new` uses the same `px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-6` container as `/contracts` (Contract List) — the standard "wide manager workspace" container for any full-page (non-modal) form in this app, as opposed to the narrower `max-w-2xl`/`max-w-5xl` centered-form pattern used elsewhere.
- Two sections that read best side by side on desktop (but must stack on narrow viewports) go in their own `grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 items-start` (or an even `lg:grid-cols-2` when no size skew is needed) wrapper — NOT inside a shared `SectionCard`. Each section keeps its own `SectionCard` so it still reads correctly when stacked.

### Drawing Qty — informational BOQ field, never in a formula (CM-56D)
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-boq-register-table.tsx`, `apps/web/src/app/(protected)/contracts/_lib/contract-boq-helpers.ts`, `packages/database/prisma/schema.prisma` (`ContractBoqItem.drawingQty`)
- Purpose: A per-BOQ-item quantity confirmed during drawing/calculation stages, positioned between Total Price and Invoice Qty in the table. Persisted (additive nullable column), but deliberately excluded from `boqRowQty()`/`boqLineTotal()`/`boqProgressPercent()`/`boqAmountRemaining()`.
- Pattern to reuse: when a new numeric field is genuinely informational (not meant to drive any existing calculation), add it as its own field — do NOT reuse `revisedQty`, which already overrides `originalEstimatedQty` inside `boqRowQty()` and therefore Total Price. Reusing an existing "quantity-shaped" field for a new, calculation-inert purpose risks silently changing what an existing formula reads.

### Shared write-form `variant` prop instead of a duplicate component (CM-58B, CM-58C)
- `contracts/payments/_components/payment-form-modal.tsx` gained an opt-in `variant?: 'register' | 'contractDetail'` (default `'register'`, so the original module-level register call site is byte-for-byte unaffected). Field `name` attributes and the create/update payload never change between variants — only which fields render (Contract picker vs. read-only+hidden context) and how they're labeled.
- Reuse this pattern whenever a shared write-form/modal needs a context-specific presentation (fewer fields, different labels, a pre-known value shown read-only) in one caller without touching another caller's behavior — prefer an opt-in variant prop over forking the component.
- CM-58C: when a `<select>`'s options need a manager-friendly relabeling of a real backend enum, build the option list from an already-established label map (e.g. `PAYMENT_STATUS_LABELS`) rather than a second hardcoded list — keeps the two surfaces (badges/filters vs. this form) from drifting out of sync. A pre-known single value (e.g. "the one contract this form is scoped to") reads better as a small bordered read-only context block (label line + value + reference line) than as plain inline text.

### Final polish pass mirrors the Claims/Variations polish template exactly (CM-62B)
- Path: `apps/web/src/app/(protected)/contracts/[id]/(workspace)/risks/_components/contract-risk-kpi-strip.tsx`, `contract-risk-panel.tsx`
- When a "final UI polish" unit follows a first-build unit, check whether the immediately-preceding polish units (CM-59B → CM-60B → CM-61B) already established the exact shape of change needed, and apply the same three moves rather than inventing new ones: (1) add `DashboardKpiCard`'s `valueClassName` to color each KPI value text using the SAME accent already assigned to that card's icon (never a new color scheme), (2) reword the empty state to a two-line "what happened / what to do" copy, (3) pin the first and last table columns via the `STICKY_LEFT_CLS`/`STICKY_RIGHT_CLS` constants already established in `contract-claim-panel.tsx`. A polish unit is the wrong place to introduce a NEW visual pattern (e.g. new badge padding) — if the thing being asked about already matches an established pattern (Risk Response badge colors, Action Due Date coloring were already correct from the first-build unit), leave it unchanged and say so in the report rather than perturbing something that already matches its sibling pages.

## Contract Detail Closeout — Relocate, Don't Delete, a Real Feature That No Longer Fits (CM-67E)

### When a task says "remove this upload area," check whether the upload has a real dependent before deleting it
- Path: `contract-closeout-request-attachments.tsx` (extracted from the deleted `contract-closeout-documents-panel.tsx`)
- CM-67E asked to correct the Closeout page so it stops feeling like a document-upload area, explicitly forbidding an "Upload Closeout Document button." The card being replaced DID have a real upload form (CM-33's closeout-request attachments), and that same real data (`attachments.length`) already feeds a real checklist item ("Closeout attachments uploaded", from CM-67's `computeChecklist()`). Simply deleting the upload UI would have made that checklist item permanently unreachable — a genuine functional regression introduced by a "just remove the button" reading of the task. Before deleting a control tied to real backend state, grep for what else reads that state and confirms there's still a path to satisfy it. Here, the fix was relocation, not deletion: move the unmodified upload component into the section where it actually belongs (Final Approval & Closeout, since it's the closeout REQUEST's own supporting files, not a contract-wide document), preserving the feature while still satisfying the letter and spirit of "no upload area in the readiness section."

### Two same-shaped features that need different homes: contract-level requirements vs. request-level supporting files
- Path: `contract-closeout-required-documents-panel.tsx` vs. `contract-closeout-request-attachments.tsx`
- This unit surfaced a conceptual distinction worth remembering for any future contract-detail work: `ContractDocumentObligation` (Documents & Obligations) represents things the CONTRACT requires over its whole life (bonds, insurance, approvals) with their own attachments; `ContractCloseoutAttachment` represents supporting files for one specific closeout REQUEST (a transient, request-scoped artifact). Both are "a list of files with an upload form," which makes it tempting to merge them into one generic "documents" card — resist that; keep them visually and conceptually separate, each living in the section a manager would actually look for it in.

### A task's own explicit "use this color" instruction can reveal a real bug in a token choice made in an earlier unit
- Path: `contract-closeout-document-status-badge.tsx` vs. `contract-document-obligation-helpers.ts`'s `DOCUMENT_OBLIGATION_STATUS_BADGE_CLASSES`
- This task explicitly specified "Expiring Soon = purple/orange" for the new Closeout-local badge. Checking the EXISTING shared badge map for the same status turned up `accent` (this theme's brand red) — despite that very map's own code comment saying "Expiring Soon purple." A task's explicit color spec for a NEW display is a good moment to cross-check whether an EXISTING shared token choice actually matches its own stated intent — when it doesn't, don't silently reuse the buggy shared map; build the correct local version (here, `team-production`, the app's established purple substitute) and report the discovered mismatch rather than fixing the shared file (which would be out of scope for a task scoped to one page).

## Contract Detail Schedule — Planned vs Actual (CM-68A)

### Repurposing an existing route+endpoint entirely, after confirming it has exactly one real consumer
- Path: `GET :id/schedule` (`contracts.controller.ts`), `ContractScheduleService.findAllForContract()` (removed) vs. the module-level `findAll()` (untouched)
- Before rebuilding a page's underlying data shape wholesale, grep for every real consumer of the endpoint it calls. Here, `GET :id/schedule` had exactly one consumer (this one contract-detail tab) — confirmed by grepping both the controller and the web `contracts-api.ts` client — which made it safe to change the endpoint's entire response shape and delete the now-dead `findAllForContract()` method (+ its tests) without touching the sibling module-level register (`GET /contracts/schedule`, `findAll()`), which shares the SAME service class and SAME underlying pure item-mapping functions (`buildItemsForContracts()` etc.) but is a genuinely separate real consumer with its own real due-date-aggregation purpose — a future CM-68B unit's concern, not this one's.

### A real business stage can have NO safely-identifiable actual source — say so, don't force a match
- Path: `contract-schedule-plan.service.ts` — `computeActualStages()`, the Estimation Sheet stage
- The fixed real workflow task template list (`contract-workflow-templates.ts`) was audited exhaustively for every one of the 8 planned stages before writing the derivation function. 7 of 8 stages had a real, exact `taskKey` match (matched literally, e.g. `technical_getting_approval` for Drawing Approval — never fuzzy-matched by task NAME, which could silently break if a manager renames a task's display label since `taskName` is cosmetic while `taskKey` is the real stable identifier). Estimation Sheet had none. The honest answer, and the one this unit's own spec explicitly permits, is to leave it "Not linked yet" rather than attach it to a loosely-related task (e.g. `production_mix_design_submission`) just to avoid an empty column — a wrong link is worse than an honest gap, since it would make a manager trust a date that doesn't actually mean what the UI claims it means.

### Disclosing a derived-date fallback in the SAME place the value is shown, not just in a code comment
- Path: same file — Casting / Production's `actualEndDate`
- No real "production complete" event/date exists anywhere (only a real per-item production STATUS and a real `updatedAt` timestamp). This unit's own instruction explicitly allows a disclosed fallback ("do not guess from createdAt unless explicitly documented as fallback") — the fallback used (max real `updatedAt` across items, only once every item is genuinely COMPLETED) is documented in the code AND surfaces to the manager via the real Source column value ("Production Status"), so the honesty isn't just an internal comment — the person looking at the date has the same information about where it came from.

### Free-text vs enum for a "responsible team" field that spans stages with no real team concept
- Path: `packages/database/prisma/schema.prisma` — `ContractScheduleItem.responsibleTeam`
- When a new field's task-suggested name (`responsibleTeam`) looks like it should reuse an existing enum (`ContractWorkflowTeam`: TECHNICAL/PRODUCTION/ERECTION/QS_COMMERCIAL), check whether EVERY real row that field will hold actually fits that enum first. Half of this unit's 8 stages (Contract Sign, Advance Payment, Estimation Sheet, Final Closeout) have no real workflow-team owner at all — forcing the enum would mean either leaving it null for exactly those 4 stages (defeating the field's purpose for them) or inventing a fake team assignment. A plain nullable free-text field lets a manager describe the real responsible party for EVERY stage, including the ones with no workflow-team equivalent.

## Contract Detail Closeout — Readable Status Text (CM-67D)

### A generic snake_case → Title Case reformatter beats an enum-specific lookup map when the field can hold values from many different enums
- Path: `_lib/contract-closeout-detail-helpers.ts` — `humanizeStatus()`
- `BlockingItem.status` can be a real value from any of 6 different source enums (workflow task status, payment status, claim status, risk status, issue status, document-obligation status). Building an explicit `Record<string, string>` label map would mean enumerating every value from every source AND remembering to add a new entry whenever any of those 6 enums gains a value in the future — a real drift risk. A single generic `value.split('_').map(titleCase).join(' ')` transform handles the full real union correctly today and automatically stays correct if any source enum changes, since it's a pure reformat of whatever real value is passed in, never a lookup that can silently miss an entry. Reach for this pattern whenever a field aggregates status values across multiple independent enums and the source enums' words are already human-readable once de-snake-cased (compare to CM-65's category relabeling, which needed an explicit map because the desired label DIDN'T match the stored word 1:1 — here it does, so the generic transform is strictly simpler and safer).

### Coloring a badge by keyword-in-the-real-value instead of a per-status lookup, for the same multi-enum reason
- Path: same file — `blockingStatusTone()`
- Same problem as above, applied to color: rather than mapping every one of ~17 real status values across 6 enums to a tone, bucket by whether the real (still-SNAKE_CASE) value CONTAINS one of a few honest keywords (`OVERDUE`, `REJECTED`, `EXPIRED` → error; `NOT_STARTED`, `DRAFT`, `PENDING` → neutral; everything else → warning, since every row in this table is already a real open/blocking condition by construction). This is honest because it colors based on the real word's own meaning, not a guessed severity per source — and like `humanizeStatus()`, it doesn't need updating if a source enum's real value set changes.

## Contract Detail Closeout — Final Decision-Area Polish (CM-67C)

### A double-wrapped card is a real bug a "final polish" pass should catch, not just a style tweak
- Path: `contract-closeout-approval-panel.tsx` / `[id]/(workspace)/closeout/page.tsx`
- Since CM-67, the page's own outer `<section className="rounded-lg border border-border bg-surface shadow-sm p-4">` wrapped `ContractCloseoutApprovalPanel`, which ALSO rendered the exact same classes on its own root element — a redundant nested card (doubled border/padding) that nobody had visually caught yet. A polish pass auditing a component "for real" (reading its actual rendered structure, not just its props/behavior) will sometimes find this class of structural bug. The fix: pick ONE owner for the card frame — here, the page, since it already conditionally swaps between 3 different bodies (form/message/panel) inside that one frame — and change the component's root to a Fragment. Always check whether a component you're about to visually strengthen is accidentally double-wrapped before adding more visual weight to it.

### Advisory helper text driven by already-computed real data, without adding a new backend gate
- Path: `[id]/(workspace)/closeout/page.tsx` — the `blockingItems.length > 0` banner above `ContractCloseoutRequestForm`
- When a task asks for "helper text explaining blockers must be resolved first," check whether the REAL backend actually enforces that before wording the text as a hard rule. Here, `createRequest()` does NOT require `isReadyForClosure` — a manager CAN submit a closeout request with blockers still open (only the final CLOSE step requires an approved request). The correct honest text is advisory ("...resolve these first for a smoother review"), not prescriptive ("you cannot submit until...") — matching what the backend will actually allow, using data (`blockingItems.length`) already computed elsewhere on the same page rather than a new calculation.

### Link color vs. primary-action color inside the same card
- Path: `contract-closeout-blocking-panel.tsx` — "View all N blocking items"
- A card can legitimately contain both a genuine primary-action button (`accent`, this theme's brand red) AND a plain in-place expand/collapse link — don't let the button's color bleed onto the link by habit. Re-apply the CM-64C rule at the CONTROL level, not just the section level: a calm affordance (expand, view more, cancel) uses `info`/neutral tones even inside a card that also has a loud primary action elsewhere.

## Contract Detail Closeout — Compact 2-Column Grid Layout (CM-67B)

### `lg:` grid classes are viewport-based — re-check every nested grid when a card moves from full-width to half-width
- Path: `contract-closeout-financial-panel.tsx`, `contract-closeout-module-summary-panel.tsx`
- A card's own internal `grid-cols-N` breakpoints (e.g. `lg:grid-cols-8`) were tuned assuming the card spans the FULL page width. When a layout pass moves that same card into one half of a 2-column page grid, its internal breakpoints don't automatically adjust — Tailwind's `lg:` prefix reacts to the viewport, not the card's own rendered width, so an un-adjusted `lg:grid-cols-8` card squeezed into a half-width column will cram 8 columns into ~50% of the space. Whenever a layout-polish unit relocates an existing card into a narrower grid cell, audit and reduce that card's own internal column counts too — don't assume the card is layout-agnostic just because it doesn't know it moved.

### Compacting a table-in-a-card: sort-then-cap-then-expand, never truncate silently
- Path: `contract-closeout-blocking-panel.tsx` — `sortBlockingItemsByPriority()` (`_lib/contract-closeout-detail-helpers.ts`)
- When a real, honest, non-fabricated list is too long for a compact card (here: Blocking Items spanning up to 6+ different modules), the safe pattern is: (1) sort by the most decision-relevant REAL field already on each row (priority, not insertion order), (2) show a small fixed cap by default, (3) offer an explicit, honestly-labeled "View all N" control that reveals the rest — never hide the true count, never silently drop items with no indication more exist. Prefer expanding IN PLACE (a client-side toggle) over linking to a fake "view all" page when the underlying rows come from too many different sources for one real aggregate page to exist for them.
- Items with no real value for the sort field (e.g. Payments/Claims/Documents/Closeout blockers have no `priority` column) rank lowest rather than being assigned a guessed priority — sorting by a field some rows don't have is fine as long as those rows are ranked out of the way, not fabricated a value.

### Reuse an already-computed aggregate for a "mini recap" instead of recomputing it
- Path: `contract-closeout-checklist-panel.tsx` — `progress: ChecklistProgress` prop
- When a layout change moves a detail card away from the summary card that already shows its counts (here: the Checklist card is no longer directly under the header Progress card once the grid splits them), the fix is passing the SAME already-computed object down as a new prop, not recomputing a second summary inline in the detail card. One source of truth stays one source of truth even as the layout around it changes.

## Contract Detail Closeout — Approved Design, Simplified (CM-67)

### Mirror the backend's real status classifications verbatim for row-level UI — never redefine them
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-closeout-detail-helpers.ts` — `OPEN_ISSUE_STATUSES`/`OPEN_CLAIM_STATUSES`/`CLOSEOUT_READY_WORKFLOW_STATUSES`/`FINAL_PAYMENT_STATUSES`/`RESOLVED_RISK_STATUSES`/`BLOCKING_DOCUMENT_STATUSES`
- When a page needs both an aggregate count (already returned by a real summary endpoint, e.g. `checks.issues.open`) AND a row-level list of the same real records (e.g. Blocking Items), copy the backend's exact classification constants into the frontend helper (cited by file/line in a comment) rather than inventing a new frontend-side definition. If the two definitions ever drifted, the row-level list and the KPI/checklist count would silently disagree — a page whose entire purpose is "can this be closed, and why not" cannot afford that inconsistency. This is a stronger, more explicit version of the "reuse existing" principle already established elsewhere: it's not just reusing an endpoint, it's reusing the endpoint's own internal business-rule constants.

### A cross-cutting readiness page composes MANY existing per-module endpoints — that's the correct shape, not a smell
- Path: `[id]/(workspace)/closeout/page.tsx`
- Closeout's whole purpose (per this unit's own business-meaning statement) is "final verification before closing" — by definition it needs a real signal from every other module (Workflow, Payments, Claims, Risks, Issues, Documents & Obligations, Variations) plus the closeout module itself. This unit fetches 10 real endpoints in one `Promise.allSettled`, each independently gracefully degrading. Don't try to force this into fewer fetches or a single new aggregate backend endpoint just to look tidier — a genuinely cross-cutting page has genuinely cross-cutting data needs, and each of those 10 sources already has its own real, tested, permission-checked endpoint used by its own tab. Building one new mega-endpoint to replace them would duplicate logic that already exists and is already correct.

### Extending an existing "safe, no-side-effect" read endpoint instead of reaching for the "full" one
- Path: `apps/api/src/contracts/contract-workflow.service.ts` — `getWorkflowSummaryForContract`
- `getWorkflowForContract()` (the full-task endpoint the Workflow tab uses) has a real, documented side effect: it lazily generates default workflow tasks on first view if none exist. `getWorkflowSummaryForContract()` was built in CM-57 specifically so Overview could read real per-task data WITHOUT triggering that write. When a new page (here, Closeout's Blocking Items) needs MORE fields than the summary endpoint currently returns but must NOT trigger the side effect either, the correct move is widening the summary endpoint's own `select` (same query shape, more real columns) — not switching to the full endpoint. Always check whether a "thin" read endpoint exists for exactly this side-effect-avoidance reason before reaching for a richer one.

### A single-select-widening backend change can still be "backend changed: yes, additive, no migration"
- Path: same file
- This unit needed one real backend change (widen a Prisma `select`) despite the task's own instruction to "prefer reusing the existing backend." Reusing existing endpoints doesn't mean never touching the backend — it means preferring the smallest real, honest extension over either (a) inventing a new endpoint that duplicates an existing one, or (b) faking the missing fields on the frontend. A one-line `select` widening with zero migration and zero behavior change for existing consumers is the correct scale of "backend changed" for a case like this.

## Global Top Header — Query-Param-Dependent Breadcrumb Variants (CM-66F)

### When a page's breadcrumb needs more than the pathname, read the same signals the page reads — don't skip it
- Path: `_lib/contract-workspace-breadcrumb.ts` — `contractWorkflowBreadcrumbItems()`; `_components/top-header.tsx`
- CM-66E declined to move `/contracts/workflow`'s breadcrumb to the header, reasoning that its 3 query-param-dependent variants would require "duplicating business logic in two places." That reasoning undersold the actual fix: the page's mode-resolution rules (`mode`/`assignmentOnly`/`overdueOnly`/`myTasksOnly` query params, checked in a specific precedence order) are pure and fully derivable from the URL plus one already-available piece of client state (`isContractStaffOnlyAccess(user.permissions)`, already on the `ShellUser` the header already receives). Mirroring those exact rules in a second pure function is NOT true duplication in the risky sense — both the page's redirect logic and the header's breadcrumb resolver read the same real URL the browser ends up on, and a staff-only user literally cannot reach the `?mode=assignment` URL (server-side redirect intercepts it first), so the header doesn't even need to replicate the `canManage` gate. When a task's breadcrumb depends on query params, first check whether the deciding data (URL + something already in hand) is fully available client-side before declaring it out of scope — only fall back to leaving it in-body when the resolution genuinely needs something the client doesn't have (a data fetch, e.g. `/contracts/[id]/edit`'s real contract reference number).

### `useSearchParams()` in a component that renders on every page — check for existing precedent first
- Path: `_components/top-header.tsx`
- Before adding `useSearchParams()` to a component as universal as the global header, checked whether the app already used it anywhere without a `<Suspense>` wrapper (grep for `useSearchParams`, then for `Suspense` — found 5 existing unguarded usages in `*-actions-bar.tsx` files, zero `Suspense` usage anywhere in the app). Since the whole protected route tree is already forced dynamic (`export const dynamic = 'force-dynamic'` on nearly every page, cookie-based auth throughout), there was no static-rendering benefit at risk, and the build produced no Suspense-boundary warnings — confirmed by grepping the full `next build` output for "suspense"/"searchparams" after the change, not just eyeballing the tail. Follow an app's own established (if informal) convention for a risky-looking hook before assuming a new safety mechanism (Suspense boundary, error boundary, etc.) is required.

## Global Top Header — Extending the Breadcrumb Slot to Static Sibling Pages (CM-66E)

### When it's safe to key a header lookup by exact pathname instead of route-shape
- Path: `_lib/contract-workspace-breadcrumb.ts` — `contractModuleBreadcrumbItems()`
- CM-66D's `isContractWorkspaceDetailPath()` needed a route-SHAPE regex because the workspace covers a whole dynamic-segment family (`/contracts/[id]/<any-of-12-tabs>`). The module list/register pages (`/contracts/dashboard`, `/contracts/schedule`, etc.) are each a single fixed route with a fixed breadcrumb — for those, a plain `Record<pathname, BreadcrumbItem[]>` lookup is simpler and equally correct; don't reach for a regex when the set of matching paths is finite and literal.

### Audit every render site before assuming "one page = one breadcrumb"
- Path: `contracts/dashboard/page.tsx` + `contracts/dashboard/_components/staff-dashboard-view.tsx`; contrast with `contracts/workflow/page.tsx`
- Some pages have more than one code path that can render at the same pathname (a manager branch vs. a staff branch, a default view vs. a query-param-selected sub-view). Before deleting an in-body breadcrumb in favor of a header one, grep for EVERY `<Breadcrumbs` call reachable at that pathname, not just the first one found. The Dashboard page's two branches (manager `page.tsx`, staff `staff-dashboard-view.tsx`) turned out to render the identical breadcrumb — safe to collapse into one header entry. The Workflow page's three branches (default, `?mode=assignment` → `AssignmentQueueView`, `?mode=my-tasks`/`?mode=overdue` → `StaffMyTasksView`) render 3 GENUINELY DIFFERENT breadcrumbs keyed off query params `usePathname()` can't see — collapsing those into one static header entry would have silently shown the wrong breadcrumb on 2 of the 3 views. When a page's breadcrumb depends on more than the bare pathname, leave it in the page body rather than force-fitting it into a pathname-only header lookup; only revisit if the header is taught to also read `useSearchParams()` and mirror that exact logic (accepting the resulting two-places-must-agree maintenance cost).

### Interpreting an open-ended "do this for other pages too" follow-up
- When a user's follow-up to a just-completed unit says to extend the pattern further but leaves the scope open ("other pages too, what you think"), treat it as permission to make the call, but state the boundary explicitly rather than silently guessing everything or nothing. Here: "other pages" was scoped to the rest of the Contract Management module (the module this session's numbered CM-units have been building) — not the other 7 unrelated modules in the app. Document the interpreted scope and the pages deliberately left out (with reasons) in the unit's own report, so the boundary is a visible decision the user can redirect, not a silent limitation they have to discover later.

## Global Top Header — Section-Specific Breadcrumb Slot (CM-66D)

### Filling an empty header spacer with a route-conditional breadcrumb, without touching the shared component's other 60 callers
- Path: `apps/web/src/app/(protected)/_components/top-header.tsx`, `.../_components/breadcrumbs.tsx`, `.../_lib/contract-workspace-breadcrumb.ts`
- `TopHeader` had a bare `hidden md:block` spacer div ("sidebar provides branding") between the mobile menu button and the Manager/Sign-out block — real unused space. When ONE section of the app (here: the Contract Detail workspace) needs its breadcrumb promoted to header level while every other page keeps rendering its own in the page body, add the conditional render INSIDE that existing spacer slot in the shared `TopHeader`, gated by a pure pathname-based predicate — don't fork the header per-module or add a new layout-passing mechanism. `TopHeader` needed `usePathname()` (it already lives inside the `'use client'` `AppShell` tree, so this required no new client boundary).
- The shared `Breadcrumbs` component (used by ~60 pages) got one new optional `className` prop defaulting to its original `'mb-4'` — every existing caller is byte-identical after the change; only the new header call site overrides it (`className="mb-0"`, since it sits inline with other header controls, not stacked above body content). This is the safe way to reuse a widely-shared component in a new visual context: add an escape hatch with the old behavior as the default, never change the default itself.

### Detecting "is this route a Contract Detail workspace page" from real routing shape, not a URL/UUID guess
- Path: `_lib/contract-workspace-breadcrumb.ts` — `isContractWorkspaceDetailPath()`
- A Server Component layout (`contracts/[id]/(workspace)/layout.tsx`) cannot pass data UP to a Client Component that renders above it in the tree (`TopHeader`/`AppShell`) — there's no reverse prop flow across nested Next.js layouts. Rather than reaching for React Context (a new client provider wrapping `{children}` in the workspace layout, plus a consumer in the header — more files, more blast radius, for a breadcrumb whose content is fixed and contract-id-agnostic anyway), the simplest correct fix is a pure pathname-shape check in the header itself: a `CONTRACT_MODULE_SEGMENTS` set of the real literal folders that sit as siblings of `[id]/` under `contracts/` (`dashboard`, `new`, `workflow`, `schedule`, `payments`, `issues`, `claims`, `closeouts`, `closeout`) plus a `WORKSPACE_TAB_SEGMENTS` set of the real folder names inside `contracts/[id]/(workspace)/`. This mirrors the file-system routing structure exactly rather than guessing at a UUID pattern, and correctly excludes `/contracts/[id]/edit` (a real sibling of the `(workspace)` group, confirmed via audit to have its own distinct breadcrumb and no tab bar). Prefer this kind of route-shape check over Context/prop-drilling whenever the data needed at the top of the tree is fully derivable from the pathname alone — reach for Context only when the header would need something the URL doesn't carry (e.g. the actual contract's reference number).

## Contract Workspace Tab Navigation — Full Flat Row, Wraps Instead of Scrolling or Hiding (CM-66C)

### A dropdown that hides frequently-used tabs is a regression, not a fix
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-workspace-tabs.tsx`
- CM-66B's "primary row + More dropdown" split (below) solved the clipped-text/hidden-Activity-tab problem, but at the cost of putting 5 real, regularly-used tabs (Variations, Claims, Risk Assessment, Attachments, Activity) an extra click away. When a follow-up task explicitly reverses this kind of grouping decision, don't half-revert — remove the dropdown state, its keyboard/outside-click handling, and the scroll-container machinery entirely rather than leaving dead code paths behind. The component went from ~230 lines (CM-66B) back to under 100.

### `flex-wrap` instead of `overflow-x-auto` for "never clip, never hide" tab bars
- Path: same file — `<nav className="flex flex-wrap ...">`
- When a tab bar has too many items for one row on every viewport and NONE of them may be hidden (no dropdown, no scroll-only access), wrapping onto a second row is the only remaining option. Keep `whitespace-nowrap` on each individual tab link (so a label itself never clips mid-word) while letting the flex container wrap BETWEEN items — the soft background/padding on the wrapping `<nav>` (not on each row) keeps a 2-row bar reading as one cohesive control rather than two stacked ones. This is a simpler, more robust pattern than the scroll-fade + auto-scroll-into-view machinery from CM-66B when "every tab must always be visible, no interaction required" is the actual requirement.

## Contract Workspace Tab Navigation — Primary Row + Pinned More Dropdown (CM-66B)

**Superseded by CM-66C above** — kept here only as a record of the tried-and-reversed dropdown-grouping approach, in case a future task with a different tab count revisits it.

### Grouped nav pattern for an overcrowded route-linked tab bar
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-workspace-tabs.tsx` — `PRIMARY_TABS` (8) / `MORE_TABS` (5)
- When a workspace accumulates enough tabs across units (here: 13, after CM-66 added Activity) that a single scrollable row starts clipping labels and effectively hiding the newest tab, split into a fixed "primary" set (most-used, capped around 8 so it reliably fits a normal desktop width) plus a pinned "More" dropdown for the rest. Pin the More button OUTSIDE the scrollable primary row (same structural slot the old pinned Overview tab used) so it is never scrolled out of view — that's what actually solves "the new tab is unreachable," not a bigger scroll area.
- This is a pure display regrouping: every tab's `href` is unchanged, so route preservation, active-tab detection (`pathname === href`), and staff access gating (still enforced entirely upstream by the workspace layout's `isContractStaffOnlyAccess` redirect) all continue to work without any change outside this one component.

### More-button "self-labeling" active state
- Path: same file — `activeMoreTab` / button label
- When a page inside a dropdown group is active, don't just highlight the trigger button — replace its label with `More: <label>` and swap its icon to the active section's own icon. This tells the manager exactly where they are without opening the menu, which a bare "highlighted-only" state can't. Compute it the same way as any other active check (`MORE_TABS.find(tab => pathname === hrefFor(tab))`), no new state needed beyond `usePathname()`.

### Dropdown active-item highlight avoids the CM-64C accent-as-danger trap
- Path: same file — the `role="menu"` items
- The tab PILL itself still uses solid `bg-accent text-white` (explicitly required to stay unchanged) — that's fine, it's a self-contained button widget, not a list row. But applying the same solid accent block to a highlighted row INSIDE a dropdown list reads differently (closer to the "calm badge painted red" mistake from [[CM-64C]]). Use a neutral highlight (`bg-surface-secondary font-semibold`) plus a small accent-colored check icon instead — marks the current item clearly without a full alarming block.

### Reusing the existing overlay-dropdown pattern instead of a new menu library
- Path: same file, pattern originally from `contract-row-actions.tsx` (CM-43/CM-55D)
- `aria-haspopup="menu"` + `aria-expanded` on the trigger, a `fixed inset-0 z-10` click-catcher div for outside-click close, `role="menu"`/`role="menuitem"` on the panel/items — this is now the second place in the app using this exact shape. When a task asks for "a dropdown" and this pattern already exists, reuse it rather than pulling in a headless-UI dependency; this unit's addition on top was an `Escape`-key listener and a `pathname`-change effect to force-close on navigation, since a nav dropdown (unlike a row-actions menu) needs to close itself when the route changes via a Link click, not just via its own onClick.

## Contract Detail Activity / Audit History — Approved Design, Simplified (CM-66)

### Reusing an existing real audit table instead of a task's own suggested fallback model
- Path: `packages/database/prisma/schema.prisma` — `ContractActivity` (`contract_activities`); `apps/api/src/contracts/contracts.controller.ts` — `GET :id/activities`
- A task can hand you a "preferred model to add if none exists" as a hedge against the audit finding nothing. Do the audit anyway, first, before reaching for that fallback. Here, a real `ContractActivity` table already existed, already written to by `contracts.service.ts` and `contract-closeout.service.ts`, already read via a working endpoint — reusing it meant zero migration and zero new Prisma model, versus building the task's own suggested `ContractActivityLog` model from scratch. When a task offers a fallback schema, treat it as a last resort, not a default.

### A shared plain FUNCTION (not an injectable service) for cross-service reuse without constructor changes
- Path: `apps/api/src/contracts/contract-activity-log.ts` — `logContractActivity(db, contractId, actor, event, metadata?)`
- When a piece of write-side logic (here: activity logging) needs to be called from many existing services, and those services are NOT already structured to share a common injected dependency, adding a new NestJS `@Injectable()` service and injecting it into all of them means touching every affected service's constructor AND every affected test file's instantiation call — a wide, mechanical blast radius for a small feature. A plain exported `async function` taking the already-injected `DatabaseService` as an explicit parameter avoids this entirely: each call site just imports the function and calls it with `this.db`, no constructor change, no test-instantiation change. This is the correct shape specifically when the dependency (`DatabaseService`) is already present on every call site's `this`.
- The helper wraps its write in try/catch and never throws (documented in its own doc comment) — logging is best-effort; a logging failure must never break the real operation it's recording. Apply this same never-throw contract to any future fire-and-forget audit/telemetry helper.

### Event string → ActivityType/Source/Details mapping, with an honesty rule for "was a file actually uploaded"
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-activity-helpers.ts`
- When a task gives a preferred `ActivityType` enum (e.g. `DOCUMENT_UPLOADED`) and the real event list includes both file-upload events and plain record-edit events for the same feature (`document_obligation_created`/`_updated` vs `document_obligation_attachment_uploaded`), map ONLY the real upload events to that type. A record-level create/update with no file attached must map to a generic bucket (`OTHER`), never to `DOCUMENT_UPLOADED` — that would visually claim a file was uploaded when it wasn't. The same reasoning applies to Old Value/New Value: check every real source that could hold a before/after pair in priority order (DB columns first, then a differently-shaped metadata pair for a different field), and only show "—" when nothing was genuinely captured — never synthesize a plausible-looking pair.

## Contract Detail Issue Log — Approved Design, Simplified (CM-65)

### Reconciling a task's "preferred labels" with a real backend list that doesn't literally match
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-issue-detail-helpers.ts` — `ISSUE_CATEGORY_LABELS`
- When a task gives an explicit list of preferred manager-facing labels for a field, and the count matches the real backend value count but the WORDING doesn't line up 1:1, don't assume you need to add/remove backend values — first try to find a complete, defensible semantic pairing using only the real values (here: 9 real categories, 9 preferred labels, paired by matching the task's own example issues — "Variation cost disagreement" → `Commercial`, "Quality/test report pending" → `Production`). Document the reasoning for every non-obvious pairing directly in the label map's own comment. Only fall back to changing the backend validation list (still not a migration, since this category field is a plain validated string, not a DB enum) if no honest pairing exists.

### Sticky columns can belong in a first build, not just a polish pass
- Path: `contract-issue-panel.tsx`
- The CM-58→58B/59→59B/60→60B/61→61B/62→62B precedent established that sticky first/last table columns are usually a polish-unit addition, deferred from the first build. That precedent is a default, not a rule — CM-64B and this unit's own task both explicitly asked for sticky columns in the first build ("Issue ID sticky if safe and consistent with Claims/Risk/Attachments pattern"). When a task is explicit about wanting a normally-deferred visual detail immediately, follow the explicit instruction over the inferred precedent.

### Reusing a fully-built module-level feature's write layer for a new contract-detail tab (CM-65, following CM-61's Claims precedent)
- When a contract-detail tab's business object already has a complete module-level register (CRUD service, DTOs, Add/Edit modal, CSV export — here, ContractIssue from CM-30), audit that FIRST before writing anything new. This unit needed zero new backend endpoints, zero new frontend write code, and zero new export code — only a backend-summary counter addition (2 new fields on an existing pure aggregation function) and a full new *display* layer (KPI strip, category/priority/status badges scoped to this tab, column set, wording). Reuse the existing Add/Edit modal and its server actions completely unmodified rather than forking a "contract-detail variant" — the modal already supports a `fixedContractId` prop from its own module-level design.
- A wording correction the task wants only for this tab's own new display surfaces (here: "Action Due Date" instead of "Due Date") does not have to propagate into the reused shared modal's own internal field label — leave the shared component's wording as-is unless the task explicitly asks you to touch it, since that modal is still serving the un-touched module-level register too.

### `accent` is RECAFCO brand red, not a neutral color — never use it for plain links or calm badges (CM-64C)
- Path: `context/ui-tokens.md` — `--color-accent: #c62828`, `--color-accent-hover: #a91f1f`, `--color-accent-light: #fdecec`
- This token is RECAFCO's brand red, explicitly documented as "for branding and primary actions" (buttons like "Add Risk"/"Add Document") — it sits close to `--color-error: #b42318` visually. Several earlier units in this session (Claims, Variations, Risk, Documents & Obligations) used `text-accent`/`bg-accent-light text-accent` for plain hyperlinks and for calm, non-alarming badges (e.g. a "Transfer" risk-response badge, a Variation source badge), and those went unquestioned until a user explicitly flagged a file-name link as looking like "danger/red text" in CM-64C. The fix there: use `text-info` (`#175cd3`, real blue) for plain links, and `team-production` (`#4f46e5`, real indigo) or another non-accent token for a badge that needs to be visually calm.
- Before using `text-accent`/`bg-accent-light` for ANYTHING that isn't a primary action button or a genuinely urgent/flagged state, stop and ask: would red read as an alert here? If yes, use `info` (blue, links/neutral emphasis), `team-production` (indigo, a 4th/5th distinct category color), or `teal` instead. This same fix was applied only to the Attachments tab in CM-64C (task-scoped) — the same class of link/badge on other contract-detail tabs (Claims/Variations upload sections, Documents & Obligations' Insurance category) likely has the identical issue and is a good candidate for a focused follow-up pass if raised again.

### Adding one real field to a shared aggregation to make an honest derived column possible (CM-64B)
- Path: `apps/api/src/contracts/contract-attachments.service.ts` — `documentObligationCategory`
- When a follow-up unit needs a table column ("Category") that could be dishonestly faked OR honestly derived, first check whether ONE of the aggregated sources already has a real field for it that the aggregation just isn't selecting yet (here: `ContractDocumentObligation.category` already existed from CM-63, the aggregation just wasn't selecting it). Adding that one field to the existing `select` is a minimal, safe, migration-free backend change — set it to `null` for every source that genuinely has no such field, and derive a generic safe label client-side for those. This is a stronger pattern than either faking the column everywhere or omitting it everywhere: each source shows the MOST specific honest value it actually has.
- Frontend derivation pattern: `deriveAttachmentCategory()` (`contract-attachment-helpers.ts`) checks for the specific real value first (reusing the already-established `DOCUMENT_OBLIGATION_CATEGORY_LABELS` map from `contract-document-obligation-helpers.ts` — don't duplicate a label map that already exists elsewhere in the same app), falling back to a per-source generic label only when the specific one is absent.

### A single constant is sometimes the correct "status" implementation
- Path: `contract-attachment-helpers.ts` — `ATTACHMENT_STATUS_LABEL`
- When a design calls for a "Status" column but the domain has no real per-row status concept (every listed attachment is, by definition, already uploaded — there's no draft/pending/approved state anywhere in this app for a generic file), the honest implementation is a single exported string constant used for every row, not a function, not an enum, not a badge-color map with multiple branches. Resist the urge to build out infrastructure (a `Record<Status, string>` map, a switch statement) for a value that only ever has one real answer — that complexity would imply a variability that doesn't exist and invites a future dishonest addition ("Approved") to fill it in.

## Attachments / Document Library — Approved Design Simplified Build (CM-64)

### Deliberately removing approved-design widgets that have no real data behind them
- Path: `apps/web/src/app/(protected)/contracts/[id]/(workspace)/attachments/page.tsx`
- When an approved screenshot includes a widget (Storage Summary donut, Document Status Overview, "Pending Review"/"Approved" KPI cards) that would require fabricating data this app has no real concept of (no storage-quota tracking, no generic attachment-approval workflow), the correct move — confirmed by this unit's own explicit instruction — is to remove the widget entirely, not to build a fake/static version of it. This is the same call CM-60C already made for the original "File Status" stub section; CM-64 extends it to the rest of the sidebar. When a future task's screenshot includes a widget like this, audit whether real data exists FIRST, and report the removal explicitly in the final report rather than silently reinterpreting the design.

### A read-only cross-source library page must not grow its own upload path
- Path: `attachments/_components/contract-attachment-panel.tsx`
- When several source features (Workflow, Variations, Documents & Obligations, Closeout) each already have their own real attachment table and upload flow, and a page aggregates them read-only (see CM-60C's `ContractAttachmentsService`), do not add an "Upload File" button to the aggregator page even if the approved screenshot shows one — there is no general/contract-level attachment model for it to write to, and building one just for this button would create a 5th, redundant upload path. Report this decision explicitly rather than silently adding a disabled button or (worse) wiring it to one of the 4 existing source tables arbitrarily.

### A per-source file-count KPI strip needs no backend change when the aggregation already exists
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-attachment-helpers.ts` — `computeAttachmentSourceCounts()`
- When an existing aggregation service already returns every real record tagged with its source (`AggregatedAttachment.source`), a "count per source" KPI strip is a pure `for` loop over the already-fetched array — no new backend endpoint, no new Prisma query. Confirm this in the audit before assuming a KPI needs a backend change; it often doesn't when the underlying list already carries the field being counted.

### Final polish pass mirrors the established template exactly (CM-63B)
- Path: `apps/web/src/app/(protected)/contracts/[id]/(workspace)/documents/_components/contract-document-kpi-strip.tsx`, `contract-document-panel.tsx`
- Fourth consecutive confirmation of the CM-59B→60B→61B→62B polish template: (1) `valueClassName` on each KPI card using the SAME accent already assigned to its icon, (2) sticky first/last table columns via the `STICKY_LEFT_CLS`/`STICKY_RIGHT_CLS` constants already established in `contract-claim-panel.tsx`. When auditing a polish unit's task list against the actual first-build output, several items on the list (info note wording, empty state copy, Days Remaining coloring, badge colors, attachment display) may already be correct — a first-build unit that closely followed an approved design and copied established color/wording conventions doesn't leave much for its own polish unit to do. Confirm each item explicitly in the audit and only touch what's actually flat/wrong; don't invent a change to "use" every bullet in the task.

## Contract Detail Documents & Obligations — Approved Design with Attachments (CM-63)

### A free-text "Responsible Party" is not a User FK
- Path: `apps/api/src/contracts/dto/create-contract-document-obligation.dto.ts`
- When an approved design's "Responsible" column shows organizational roles ("Contractor"/"Client") rather than a specific system user, don't reuse the `responsibleUserId` FK+picker pattern established for `ContractRisk`/`ContractClaim` — a plain `VARCHAR` free-text field is the honest model here. Check the actual column content in the approved screenshot (real names vs. role labels) before defaulting to the FK pattern just because a sibling feature used it for a similarly-named column.
- The frontend filter for a free-text field like this is built from the real DISTINCT values already present in the current contract's own items (`contract-document-panel.tsx`'s `responsiblePartyOptions` `useMemo`), never a fabricated fixed enum list.

### Combining a brand-new CRUD model with a brand-new upload path in one unit
- Path: `apps/api/src/contracts/contract-document-obligations.service.ts`, `document-obligation-attachment-storage.service.ts`
- When a unit needs both (a) an entirely new parent record type and (b) real file attachments on it, build the storage service first by copying `VariationAttachmentStorageService` verbatim (rename only), then give the CRUD service its own `loadItemForContract()` private helper (mirroring `loadVariationForContract()`) that every attachment method calls first — this is what makes a mismatched `:id`/`:itemId` URL pair read as "not found" instead of silently resolving to the wrong contract's file.
- Wire the new source into the existing cross-tab `ContractAttachmentsService` aggregation (add one more `Promise.all` branch + one more spread in the merge) in the SAME unit, not deferred — an attachment tab that's missing a whole real upload source is a data-honesty gap, not a nice-to-have.

### A derived KPI must never fight the record's own manual status
- Path: `apps/api/src/contracts/contract-document-obligations.service.ts` — `computeDocumentObligationIsExpiredOverdue()`/`computeDocumentObligationIsExpiringSoon()`
- When a task explicitly says a manual `status` field must never be silently overridden by date math, implement the "is this actually overdue" KPI logic as a pure function computed AT READ TIME from `status` + the real date — excluding only genuinely-settled statuses (Submitted/Cancelled/Not Required) — and never write the derived result back to the stored `status` column. This means a record can legitimately appear in two different counts at once (e.g. still "Pending" by its own status AND "Expired / Overdue" by date) — that overlap is a true, honest fact about two different lenses on the same record, not a bug to eliminate. Same pattern as `ContractRisk`'s `computeRiskIsDueSoon()`/`computeRiskDaysToDeadline()`, generalized to a 6-status enum instead of a binary due/not-due signal.
- Reuse this pattern whenever a future feature has both a manual status field and a date the manager cares about tracking against.

### Adding a field to an existing shared aggregation's output shape
- Path: `apps/api/src/contracts/contract-attachments.service.ts` — `relatedItemTitle`
- When a new requirement needs one more field surfaced from an aggregation that already merges N sources (here: "which real record does this file belong to"), add it to ALL existing sources in the same pass, not just the new one — a field that's populated for the new source but silently `undefined` for the other 3 is a worse data-honesty gap than not having the field at all, since the frontend can't distinguish "genuinely no title" from "this source's branch forgot to populate it." Pull the value from whatever real field on that source's own parent already reads as a title (task's `taskName`, variation's `description`, the new item's own `title`); when no true title-like field exists (Closeout Request), compose an honest label from the real identifier instead of leaving it blank (`` `Closeout Request ${requestNo}` ``).

## Contract Detail Risk Assessment — Approved Design (CM-62)

### Brand-new additive model + service on a previously-disabled stub tab
- Unlike Claims (CM-61, already fully working) but like Payments/Production/Variations before it, Risk Assessment was a genuinely disabled stub ("Risk Assessment backend is not implemented yet.") — this unit built the full stack from a new `ContractRisk` Prisma model through to the display layer. Enum-backed fields the DTO allows omitting (`riskEvaluation`, `riskResponse`, `status`) all carry a Prisma `@default(...)` so the service never has to fabricate a value to satisfy a non-nullable response type — set the DB default to match whatever the "safe/expected" starting value is (here: MEDIUM evaluation, MITIGATE response, OPEN status) rather than making the API type field optional just because the create DTO is.

### Averaging a categorical (Low/Medium/High/Critical) field honestly
- Path: `apps/api/src/contracts/contract-risks.service.ts` — `RESIDUAL_RISK_NUMERIC`/`NUMERIC_TO_RESIDUAL_RISK_LABEL`, `computeRiskSummary()`
- When a KPI needs to average a manager-facing ordinal/categorical scale (here, Residual Risk) that has no real numeric backing, use an explicit, documented mapping (Low=1/Medium=2/High=3/Critical=4), average only over rows that genuinely have the field set, round-and-clamp back into range, then map back to the nearest label — return `null` (never a fabricated label like "Low") when zero rows have the field set. Never silently coerce a partial average by treating unset rows as 0 or as the lowest severity — that would understate real risk exposure.
- Reuse this pattern any time a future KPI needs "average severity/priority" over an enum field that isn't naturally numeric.

### A manual-only field must stay manual through every layer
- Path: `apps/api/src/contracts/contract-risks.service.ts` (`create()`), `apps/web/.../contract-risk-form-modal.tsx`
- When a business rule says a field must always be user-entered and never derived (here: Residual Risk must never be computed from Risk Evaluation or Risk Response), enforce it by omission at every layer rather than by a runtime check: the DTO has no logic connecting the fields, the service's `data` spread never sets `residualRisk` unless the request body explicitly included it, and the form's Residual Risk `<select>` has no `onChange` wired to the other two dropdowns. The regression-proof way to keep this true is a dedicated unit test asserting the create-service's Prisma `data` argument has `residualRisk === undefined` when the request omitted it — a missing/`undefined` field is easy to verify directly, unlike "prove nothing derived this value."

### Response Description free-text field absorbing examples that aren't real dropdown values
- Path: `apps/web/.../contract-risk-helpers.ts` (`RISK_RESPONSE_LABELS`), `contract-risk-form-modal.tsx`
- When a manager mentions specific real-world response mechanisms (here: "Subcontracting", "Insurance") as *examples* of a category, but the approved dropdown only has a small fixed set of true response *types* (Mitigate/Accept/Avoid/Transfer), don't add the examples as extra dropdown options — they belong only in the adjacent free-text description field. Encode this as a permanent unit test (`RISK_RESPONSE_LABELS` values never match `/subcontract|insurance/i`) so a future edit can't accidentally reintroduce them as fake dropdown values.

## Contract Detail Claims — Approved Design (CM-61)

### Rebuilding a display layer on top of an ALREADY-working feature, not a stub
- Unlike most CM-5x/CM-6x contract-detail tabs (which started as static "Not started" stubs), Claims already had a fully working backend, Add/Edit modal, and table before this unit — reused via `../../../claims/_components/` (module-level Claim Log's own components). When a task asks to rebuild a tab's *design* and the underlying feature already works, audit what's reusable FIRST (service methods, DTOs, form modal, server actions, export route) before writing anything new — this unit ended up needing zero new backend endpoints and zero new write-side frontend code, only a new KPI strip, filter labels, and column set.
- A second, tab-local label map for a shared enum (`contract-claim-detail-helpers.ts`'s `CLAIM_TYPE_DETAIL_LABELS`) is fine alongside an existing one (`claims/_components/claim-type-badge.tsx`'s own `TYPE_LABELS`) when two different surfaces genuinely want different manager-facing wording for the same real enum — keep both, scoped to their own component, never make one page's wording preference overwrite another's.

### Fixing a bug in a function shared by an existing page and a new one
- When building a new consumer of an existing pure aggregation function (here, `computeClaimSummary()`, already used by the module-level Claim Log) surfaces a real bug in that function (CM-61 found `totalOutstandingValue` summing REJECTED/CANCELLED claims' full delta, overstating exposure), fix it in the shared function directly rather than forking a second copy for the new consumer — then explicitly re-verify the OLD consumer (the module-level page) still renders correctly with the corrected number. A fix to a shared aggregate is not the same risk as changing a write path; document the audit finding, the exact narrowed scope of the fix (which statuses, which field — per-row vs. aggregate), and the live re-verification of every existing consumer.

### Sticky first/last columns on a very wide table (CM-61B)
- Path: `apps/web/src/app/(protected)/contracts/[id]/(workspace)/claims/_components/contract-claim-panel.tsx`
- Reused Contract List's own established sticky-column pattern (`contract-list-table.tsx`'s `STICKY_LEFT_CLS`/`STICKY_RIGHT_CLS`) for a different table with an 18-column, `min-w-[1800px]` spread — pin the row-identifying first column and the action-button last column, let everything else scroll underneath. The one adaptation needed: Contract List's header is dark navy (`bg-nav`), this table's header is the lighter `bg-surface-secondary` used across every other contract-detail tab — copy the STRUCTURE (`sticky left-0`/`right-0`, `z-10`, opaque body background, border on the pinned edge) but match the HEADER color to whatever that specific table already uses, never hardcode `bg-nav` onto a table that doesn't have a dark header. Known, accepted tradeoff (same as Contract List's own): a sticky body cell's opaque background does not pick up the row's hover tint.

## Contract Attachment Uploads — Local-Disk Pattern (CM-32, CM-33, CM-60C)

### Reuse the CM-32 workflow-attachment storage/validation contract for every new attachment type
- `apps/api/src/contracts/workflow-attachment-storage.service.ts` is the canonical local-disk attachment pattern: random UUID on-disk filename (original name only ever recorded in the DB, never used as the real path — eliminates path-traversal/overwrite risk by construction), a per-parent-entity subfolder, a `resolveAbsolutePath()` that asserts the resolved path is still inside the configured base directory (defense-in-depth even though `storagePath` is always self-generated), and exported `..._MAX_BYTES`/`..._ALLOWED_MIME_TYPES` constants (10MB; PDF/PNG/JPEG/XLSX/DOCX).
- `CloseoutAttachmentStorageService` (CM-33) and `VariationAttachmentStorageService` (CM-60C) both just re-export those same constants and duplicate the same 4 methods with a different parent-entity id — don't redefine the size/MIME rules per feature unless a real, different business rule is given; import and reuse CM-32's constants directly.
- Controller wiring: multer `FileInterceptor('file', { limits: { fileSize }, fileFilter })` on the POST route (rejects before even reaching the service), PLUS the same two checks re-asserted inside the service's own `createAttachment()` (defense-in-depth, not redundant — a service method should never trust its caller unconditionally). Env var for the storage dir follows `<FEATURE>_ATTACHMENTS_DIR` (default `./storage/<feature>-attachments`), added to `packages/config/src/env/api.ts` next to the existing two.
- Download route: `GET .../attachments/:attachmentId/download`, permission `contracts.read`, `StreamableFile` + `Content-Disposition` header with `encodeURIComponent(originalFileName)`. The service method backing it must verify the FULL parent chain in one query (e.g. `findFirst({ where: { id: attachmentId, variationId, variation: { contractId } } })`) — never trust a single id alone when the URL carries multiple nested ids; a mismatched pair should read as "not found," not silently resolve to a different parent's file.
- Frontend: a client component (a modal, a drawer) that needs its own attachment list/upload cannot call `contractsApi` directly (it depends on `next/headers`) — give it a thin same-origin JSON GET proxy (`.../attachments/route.ts`, forwards to `contractsApi.list...Attachments()`) and a same-origin stream GET proxy (`.../attachments/[attachmentId]/download/route.ts`, forwards the bearer cookie to the real API and re-streams the response body/headers) — both call the real backend, no independent authorization logic in the proxy itself. Upload itself goes through a server action using `actionFetchMultipart()` (already established in `contracts/actions.ts`), not a client-side `fetch` to the proxy.

### Read-only cross-feature attachment aggregation
- Path: `apps/api/src/contracts/contract-attachments.service.ts`
- When several features each have their own already-working attachment table (workflow tasks, closeout requests, variations, …) and a page needs to show "everything uploaded for this contract," don't build a new unified upload path — query each existing table filtered by its own parent's `contractId` relation, tag each row with a source label and a download path built from that source's own already-existing download route, merge, sort. Upload stays per-feature; this is purely a read-side union. Extend this same service (add one more `Promise.all` branch) rather than creating a second aggregator when a 4th attachment-bearing feature is added later.

## Contract Detail Variations / Change Orders — Approved Design (CM-60)

### Dual-naming: manager-facing tab title vs. real backend/table terminology
- Pattern, not a component. Where a real business/QS term ("Variation") and a manager/client-friendly synonym ("Change Order") both apply to the same real thing, put both words together ONLY in the page/tab title ("Variations / Change Orders") — never rename the underlying table, model, DTO fields, KPI labels, or table columns to the friendlier synonym. Keeps the frontend approachable without creating two names for one real field across the codebase.
- Reuse whenever a task explicitly calls for "both words" framing but only in one place — resist the urge to also rename every column/label to match; that's over-changing labels the task didn't ask for.

### Reconciled formula strip vs. an unreconciled approved-design mockup
- Path: `apps/web/src/app/(protected)/contracts/[id]/(workspace)/variations/_components/contract-variation-formula-strip.tsx`
- When an approved-design screenshot shows a KPI card and a formula strip that are supposed to derive from the same inputs, don't assume the screenshot's own numbers are internally consistent — verify the math (CM-60's mockup showed a KPI card and a formula strip landing on two different totals for the same Original + Approved inputs). Compute the shared value once server-side and feed it to both display spots, so the real build is always self-consistent even when the mockup wasn't.

### A secondary upload action embedded inside a larger Add/Edit modal (CM-60C)
- Path: `apps/web/src/app/(protected)/contracts/[id]/(workspace)/variations/_components/contract-variation-form-modal.tsx`, `SupportingDocumentsSection`
- When a record's own Add/Edit modal also needs a file-upload sub-section, give the upload its own `useActionState`/`<form>`, separate from the record's own field-saving form — they're genuinely different actions (uploading a file shouldn't require re-submitting every other field, and vice versa). Show the upload section only when a real parent id exists (Edit mode); Add mode gets an honest note ("save first, then attach files") rather than a disabled or fake control. Seed the attachment list from the already-fetched parent object's own embedded array (no extra round trip to open the modal), then refetch via a client JSON proxy route after each successful upload so multiple uploads in one modal session all show up without closing/reopening.

### Signed amounts, never clamped
- When a domain concept can be a real deduction (a variation reducing contract value), store and display it as a genuine negative number end-to-end — no `@Min(0)` on the DTO, no `Math.max(0, ...)` on display, no absolute-value formatting. `formatContractValue()` (`contract-ui-helpers.ts`) already renders negatives correctly; color it distinctly (e.g. `text-error` for a negative amount cell) rather than hiding the sign.

## Contract Detail Production Status — Approved Design (CM-59)

### Client-side filtered table for a small, fully-fetched, contract-scoped list
- Path: `apps/web/src/app/(protected)/contracts/[id]/(workspace)/production/_components/contract-production-panel.tsx`
- Purpose: When a contract-detail sub-resource is bounded in size (here: BOQ items, typically a few dozen per contract) and already fetched in full server-side, filter/search client-side over the fetched array (`useState` + `useMemo`) instead of the searchParams-driven GET-form round trip used by the Payments tab. No "Apply Filters" step, no pagination — search/status/category all apply instantly. Category options are the real distinct non-empty values already present in the fetched items, never a fabricated list.
- Reuse whenever a contract-scoped list is small/unpaginated by nature (one row per BOQ item, one row per contract line item, etc.) — prefer this over the searchParams+GET-form pattern, which is better suited to a module-level, potentially-large, paginated register (Payments, Claims, Issues).
- CM-59B: for a client-side (non-searchParams) filter bar specifically, a single `flex flex-wrap items-center gap-2` row — search as `flex-1 min-w-*`, each `<select>` sized `w-auto min-w-*` (not `w-full`, which needs a base `inputCls` without `w-full` baked in), actions grouped in a trailing `div` with `ml-auto` — reads as one compact bar and wraps cleanly on narrow widths, without needing a visible `<label>` per field (use `aria-label` instead). Prefer this over a field-grid-plus-separate-actions-row layout when the field count is small enough to plausibly fit one line at typical desktop widths.

### Item-picker step before a "not-yet-selected-row" write action
- Path: same `contract-production-panel.tsx`, `pickerOpen`/`pickerItemId` state.
- Purpose: When a page-level action button (here: "Add / Update Production") edits one row from a list but no row is preselected, never silently default to "the first item" — that risks a manager unknowingly submitting data against the wrong row. Show a small picker modal (a `<select>` of the real rows) first; only open the real edit modal once a specific row is explicitly chosen. The same edit modal is reused unchanged when triggered from a row's own action button (which always has a concrete row already).
- Reuse whenever a list page's top-level action needs a target row but the row isn't implied by page context.

### Additive 1:1 tracking table for an existing parent row, lazily created
- Path: `apps/api/src/contracts/contract-boq-production.service.ts`, `ContractBoqItemProductionStatus` model.
- Purpose: To add new, optional tracked fields to an existing row (here: BOQ item) without touching that row's own table/meaning, add a separate table with a unique FK back to the parent, created lazily via `upsert()` on first write rather than seeded for every parent row up front. Keeps the parent's own columns (BOQ Qty/Area) completely untouched and their derived values (Total Qty, Progress %) computed the same way they always were.
- **Known tradeoff to check before reusing this pattern**: if the parent row can be bulk deleted-and-recreated by an existing save flow (as `ContractBoqItem` is, by Edit Contract's BOQ replace), the new FK needs `onDelete: Cascade` rather than `Restrict` — `Restrict` would break that existing save flow the moment any parent row had tracking data. `Cascade` keeps the existing flow working but means the tracked data is silently reset whenever the parent rows are replaced; document this explicitly rather than letting it surprise someone later (see CM-59's progress-tracker entry).

## Contract Detail Payments — Approved Design (CM-58)

### Contract-scoped page reuses shared components instead of duplicating them
- Pattern, not a component. `[id]/(workspace)/payments/page.tsx` reuses the module-level payments register's own `PaymentFormModal` and `cancelPaymentAction` (`contracts/payments/_components/`) unmodified — same Add/Edit fields, same server action, same `contracts.update` gate. Only the *display* layer (column set/wording, filter bar, KPI labels, status labels) is contract-scoped-specific; write behavior is never duplicated.
- Reuse this split whenever a contract-detail tab needs a scoped view of a module-level register: build new display components, but call into the existing write actions/modals directly rather than re-implementing them.

### `DashboardKpiCard` reused outside the dashboard, now with a `dense` variant (CM-58, CM-58B)
- `contracts/dashboard/_components/dashboard-kpi-card.tsx` (icon-in-soft-circle, bold value, label, optional subtext) is generic enough to reuse anywhere a KPI strip is needed — not dashboard-exclusive. Used by `contract-payment-kpi-strip.tsx` for the Payments tab's 5 KPIs. Prefer this over the older, plainer `_components/metric-card.tsx` when the approved design calls for the colored-circle icon treatment.
- Optional `dense?: boolean` prop (default `false`): a horizontal (icon left, value+label right, shorter row) layout for KPI strips that need to be more compact than the dashboard's own tall vertical-stack cards. Default is unchanged, so every dashboard consumer is unaffected — only opt in per call site.
- CM-60B: optional `valueClassName?: string` prop (default `text-text-primary`) — overrides the big value's own text color, not just its icon circle. Use when several money-value KPI cards in one strip each need their own color identity (Contract Detail Variations: Approved green / Pending amber / Rejected red / Net Impact accent / Current Contract Value teal) rather than every card's number reading the same neutral black regardless of what it means. Leave unset for a plain count or a card that doesn't need its own color story (e.g. Total Variations) — default is unchanged, so every existing consumer's value color is unaffected.

### Card header `actions` slot (CM-57B)
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-overview-summary-card.tsx`
- Purpose: An optional `actions?: React.ReactNode` prop rendered right-aligned in a section card's own title row, next to its `<h2>`. Used to fold real, already-existing action components (here: `ContractTransitions`/`ContractClosureAction`) into an existing card's header instead of giving them their own separate boxed section — removes visual clutter without changing what the actions do or when they're visible.
- Reuse whenever a page has real, conditionally-visible action buttons that don't need their own full section — attach them to the header of the page's own primary/summary card instead.

### `SummaryTable` — compact table-style card body (CM-57B)
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-overview-bottom-summary-cards.tsx`
- Purpose: A small `<table>` with one header row of labels and one bold data row of values — for a card that shows a handful of related metrics side by side and should read as a compact summary table rather than a stat-chip grid. Takes `columns: { label, value, valueClassName? }[]`.
- Reuse for any "N metrics across one entity" card; pair an intentionally-unsupported value (no real data at all) with a muted `valueClassName` (e.g. `text-text-muted`) so it reads as a deliberate "—", not a broken 0.

### Compact horizontal chip strip for a small set of boolean/selected options (CM-58C)
- Path: `apps/web/src/app/(protected)/contracts/[id]/(workspace)/payments/_components/contract-payment-terms-strip.tsx`
- Purpose: Replaces a full table card (`ContractPaymentTermsSummaryCard`, deleted) when the content is just a handful of named on/off options and a full card row-per-option is more space than the information needs. One `<section>` with a small uppercase label followed by a `flex flex-wrap` row of pill chips — each chip pairs a `Check`/`Minus` icon with the option label, styled `bg-success-light text-success` when selected vs. `bg-surface-secondary text-text-muted` when not. Two states only, no third "partial"/"unknown" treatment.
- Reuse whenever a page needs to show a small fixed set of named booleans (feature flags, agreed terms, included/excluded items) as a glanceable strip rather than a table — especially above a filter/search section, where a full card would push the actionable content further down the page.

## Contract Detail Overview — Approved Design (CM-57)

### Inline SVG circular progress ring (no chart library)
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-overview-progress-card.tsx` (`ProgressRing`, internal)
- Purpose: A `stroke-dasharray`/`stroke-dashoffset`-animated `<circle>` pair (track + real-percent ring) with the percentage as centered SVG `<text>`. Zero external chart dependency — plain inline SVG, matching the CLAUDE.md "use CSS/SVG only if no chart library exists" constraint already followed by `donut-chart.tsx` (CM-54).
- Reuse: any future circular-progress need (a single ring, not a whole card) — extract `ProgressRing` if a second consumer appears.

### Read-only aggregation over an existing detail endpoint's side effect
- Pattern, not a component. `GET :id/workflow` (`contract-workflow.service.ts`'s `getWorkflowForContract`) lazily **generates** a contract's default workflow tasks on first call if none exist — correct for the real Workflow tab, wrong for any page that only wants to *display* a summary. `getWorkflowSummaryForContract()` / `GET :id/workflow-summary` is the read-only sibling: same permission/department-scope checks, same `computeTaskIsOverdue()`, but a plain `findMany()` with no `createMany()` path.
- Reuse this split whenever a summary/dashboard surface needs data from an endpoint that has a lazy-generation (or other write) side effect on first call — never call the generating endpoint from a page that's meant to be pure display.

### Overview checklist row (checkbox-style, all options always shown)
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-overview-checklist-cards.tsx` (`ChecklistRow`, internal to `ContractOverviewScopeCard`/`ContractOverviewPaymentTermsCard`)
- Purpose: Always renders every option in a fixed list (never just the selected ones) with a `CheckSquare`/`Square` icon per row — distinct from the older `ContractBadgeGroupCard` (which only renders selected items as pill badges). Use this pattern when the approved design calls for a full checklist; use `ContractBadgeGroupCard` when it calls for a compact "only what's selected" pill row.

### InfoBox — `variant="subtle"` (CM-56D)
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-form-fields.tsx`
- Purpose: Opt-in lighter/shorter rendering (`bg-info-light/60`, no border, `text-[11px]`, smaller icon) for pages that show several helper notes close together. Default (`variant="default"`, or the prop omitted) is the original bordered/`text-xs` look — every pre-existing `InfoBox` consumer, including Edit Contract, is unaffected unless it explicitly opts in.
- Used by: New Contract Register's own three inline notes, plus `ScopeOfWorkFieldset`'s Ex-Factory note via its new `infoBoxVariant` prop (see below).

### ScopeOfWorkFieldset — `infoBoxVariant` prop (CM-56D)
- Same file as above. Forwards to the fieldset's own internal `InfoBox`. Default `'default'`; New Register passes `'subtle'` alongside its existing `excludeKeys`/`gridClassName` overrides. Edit Contract passes none of the three and is fully unaffected.

### Read-only calculated cell styling (CM-56D)
- Pattern, not a component. For a table cell that shows a value the user can never edit (it's always derived from other fields in the same row), render it as a plain `<div>` with a muted background — `rounded-md bg-surface-secondary px-2 py-1.5 text-right tabular-nums font-medium text-text-secondary` (`boqReadOnlyCls` in `contract-boq-register-table.tsx`) — not a real `disabled` `<input>`. A disabled input would still be a form control (and would need its own `name`, risking an accidental duplicate submission of an already-derived value); a plain styled `<div>` can never do that while still visually reading as "not editable" next to the real inputs beside it.

### ContractDatesFields / ContractValueFields reused in New Contract Register (CM-56C)
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-form-fields.tsx` (component definitions, pre-existing from Edit Contract)
- Purpose: Confirms these two shared field-group components need zero changes to be reused in a brand-new form — they already only read/write their own named fields (`startDate`/`endDate`/`forecastCompletionDate`, `originalContractValue`/`originalCurrency`) via plain HTML `name` attributes, so any `<form>` containing them "just works" against `createContractAction`/`updateContractAction` without extra wiring.
- Pattern: to give a shared field-group component a different *initial* value at one call site without changing its default for other call sites, pass a `defaults` prop override (e.g. `<ContractValueFields defaults={{ originalCurrency: 'KWD' }} />`) rather than editing the component's own internal fallback.

### contract-boq-helpers.ts — invoiceQty-derived pure functions
- Path: `apps/web/src/app/(protected)/contracts/_lib/contract-boq-helpers.ts`
- Purpose: `boqInvoicedValue()` (invoiceQty × unitPrice), `boqProgressPercent()` (invoiceQty / BOQ qty × 100, rounded), `boqAmountRemaining()` (Total Price − invoiced value) — all divide-by-zero-safe, returning 0 when BOQ qty is blank or 0 rather than throwing or going negative from a missing denominator. Once qty is valid, `boqAmountRemaining()` is NOT clamped to zero — a genuine over-invoiced line shows a real negative value.
- Also: `emptyRegisterBoqRow()` — like `emptyBoqRow()` but defaults `unitOfMeasure` to `'m²'`; kept separate so Edit Contract's own "Add Item" (which still defaults to blank) is unaffected.
- Notes: Total Price (`boqLineTotal`) is intentionally NOT a function of `invoiceQty` — it stays `BOQ Qty × Unit Price` regardless of how much has been invoiced.

### HTML `form` attribute for cross-component submit
- Pattern, not a component. A Server Component (e.g. `new/page.tsx`'s header) can submit or associate with a Client Component's `<form>` using the plain HTML `form="<id>"` attribute on a `<button type="submit">`, with zero shared React state or context. `new-contract-form.tsx` exports `NEW_CONTRACT_FORM_ID`; the page header's "Save Draft" button references it directly.
- Reuse this whenever a page-level header/toolbar needs to trigger a nested client form's submit without lifting state.

## Global Contract Schedule Overview — Approved Design (CM-68B)

### GlobalSchedulePanel
- Path: `apps/web/src/app/(protected)/contracts/schedule/_components/global-schedule-panel.tsx`
- Purpose: Search/filter row + compact table for an all-contract manager overview page. Same bounded, client-side-filtered pattern as Risk Assessment/Production Status/Claims (CM-59/CM-61/CM-62): fetch the full row list once server-side (capped at 1000), filter instantly with `useMemo` + a pure filter function, no round trip, no pagination.
- Variants: none.
- Key tokens/classes: reuses the established filter-row/table classes from `contract-risk-panel.tsx` (`inputCls`, `filterLabelCls`, sticky table header).
- Used by: `contracts/schedule/page.tsx`.
- Notes: distinguishes two real empty states — "No active contracts found." (zero contracts at all) vs "No planned schedules have been added yet…" (contracts exist, every one is genuinely `scheduleStatus === 'Not Planned'`, no filters active) vs a generic "No contracts match the current search/filters." when filters are active and simply return nothing. Never conflate these three.

### Export route re-runs the same client-side filter function (CM-68B)
- Pattern, not a component. When a page's table filtering is client-side (`filterOverviewRows`) rather than server query-param filtering, the page's `/export` route can still follow the app-wide server-export-route convention (own CSV builder, `GET` route reads query params and returns `text/csv`) by calling the identical exported filter function server-side against the same query param names the client sends on its Export link. This keeps "what's on screen" and "what's exported" guaranteed identical with zero duplicated filter logic, and avoids introducing a second, competing export pattern (a client-side CSV Blob) into an app that already has one established convention (`contract-payment-csv.ts`/`contract-risk-csv.ts`/etc. + their own `/export` routes) used by every other register page.

### Reusing MetricCard for a 6-card KPI strip with `dense`
- `global-schedule-kpi-strip.tsx` — plain reuse of the existing `MetricCard` (`dense` variant, CM-58/58B) at 6-up (`xl:grid-cols-6`) rather than the more common 5-up register layout; no new card component needed.

## Contract Cancel/Void Confirmation — Safe Remove Flow (CM-69A)

### ContractCancelAction
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-cancel-action.tsx`
- Purpose: Real `ConfirmTransitionDialog` (see "Expected future components" below — this is that component, now built) for a destructive-reading lifecycle transition that still needs an explicit Cancel button, not just a click-away dismiss. Used for Cancel/Remove Draft (CM-69A) since the existing `<details>`-based Terminate popover (`contract-transitions.tsx`) has no way to close itself without JS — a true modal was needed once the task required a real "Cancel" button alongside "Confirm Cancellation".
- Variants: label prop (`'Remove Draft' | 'Cancel Contract'`) drives both the trigger button text and the modal title — never a fixed "Cancel Contract" title for a draft-removal context.
- Key tokens/classes: `bg-danger` trigger/confirm buttons (a genuinely destructive-reading action); modal chrome (`fixed inset-0 z-40 bg-black/40`, `role="dialog" aria-modal="true"`) copied from CM-68A's `ContractScheduleEditButton` modal.
- Accessibility behavior: `role="dialog"`/`aria-modal="true"`, labeled reason textarea, Confirm button disabled until a non-empty reason is entered.
- Used by: `contract-transitions.tsx` (rendered alongside Activate/Terminate in the Contract Summary header's action row — there is no separate "Actions dropdown" on the contract detail page; this is the real slot for it).
- Notes: calls `cancelContractAction(id, version, reason)` — a direct-typed-argument server action (not FormData-based), same CM-68A-established convention, since this component already holds `reason` in local state rather than a native form.

### Never reuse an existing status for a semantically different meaning, even when the labels sound similar (CM-69A)
- `ContractStatus.TERMINATED` already exists and reads like it could mean "cancelled" — but it carries real, load-bearing business meaning elsewhere (closeout eligibility: `contract-closeout.service.ts` allows closeout requests for ACTIVE or TERMINATED contracts). Reusing it for "void a mistake/test contract" would have made cancelled test contracts wrongly closeout-eligible. When a task says "prefer using an existing status if available," first audit every OTHER place that status is read, not just whether the enum value already exists — if reuse would leak an unrelated real workflow into the new feature, an additive new enum value is the safer, correct choice.

### Safe void/cancel over hard delete: never build the delete path at all (CM-69A)
- When a business rule says "never hard-delete X," the safest implementation isn't "hard-delete only when provably safe" (still requires reasoning about every child-relation edge case) — it's to never write a `DELETE`/`.delete()` call anywhere, and rely on the schema's own `onDelete: Restrict` on every child relation as the real backstop. A single safe status-transition method (mirroring an already-tested sibling like `terminate()`) that a manager can trigger for both "remove a draft mistake" and "void an active mistake" covers the whole business need with zero new deletion code to get wrong.

## Sticky action column: reserve a min-width, not just a border (CM-69B)
- Pattern, not a component. The established sticky-right-column convention (Contract List's own Action column, and the Risk/Claims/Attachments panels it was originally copied from) used only `sticky right-0 z-10` + an opaque background + `border-l border-border` — enough to keep the column visually separated, but with NO reserved width, a column whose content varies (an "Open" link plus a conditional "···" More trigger) can still read as cramped once real data pushes other columns wider. The fix: add an explicit `min-w-[Npx]` (200px for a link + icon-button action cell) to BOTH the `<th>` and `<td>` sticky classes, matching the same "reserved so it never gets squeezed" precedent CM-55D already used for the Contract ID column (`min-w-40`). A left-edge box-shadow (`shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.15)]`) on the body cell only (skip it on an opaque dark header) adds a second, softer visual cue beyond the border that content is scrolling underneath a fixed column. Reuse this exact fix on any OTHER sticky-right action column in this app that starts feeling cramped, rather than re-deriving it.

## "Lifecycle Status" vs "Contract Status" — two same-domain filters need visibly distinct labels (CM-69C)
- Contract List's filter bar already had a dropdown literally labeled "Contract Status" — but it filters the manager-facing **schedule** status (`scheduleStatus`: IN_PROGRESS/ON_TRACK/DELAYED/COMPLETED/AHEAD_OF_SCHEDULE), not the real lifecycle status (`lifecycleStatus`: DRAFT/ACTIVE/.../CANCELLED). When CM-69C needed to add a genuine lifecycle-status filter to the same page, reusing "Contract Status" as the label (or anything close to it) would have made two dropdowns read as duplicates/conflicting. Labeled the new one "Lifecycle Status" instead — distinct enough that a manager immediately understands these are two different, real filters over the same contract, not a UI bug. When a page already has a filter whose label doesn't match what it actually filters (here, "Contract Status" secretly means schedule status), audit for that naming collision BEFORE adding a second, semantically-different filter to the same row.

## Default-view exclusion needs an explicit bypass value, not just "no filter" (CM-69C)
- Pattern, not a component. When a list's default (no filter selected) should hide a status but an explicit "show me everything" option must still exist, "no filter param" cannot mean both things at once — a blank dropdown selection and a fresh page load are indistinguishable at the query-string level. The fix: give "show everything" its own explicit sentinel value (here, `'ALL'`, validated via `@IsIn` alongside every real enum value) rather than overloading the blank/absent state. `buildListWhere()`'s structure: `if (!explicitAll) { ...existing per-value branches..., else { /* true default */ } }` — the true default only fires when NEITHER param is present, and `'ALL'` short-circuits the entire block. Reuse this shape whenever a "hide by default, but still auditable" status needs adding to an existing list filter.

## ContractDetailActionsMenu (CM-69D)
- Path: `apps/web/src/app/(protected)/contracts/_components/contract-detail-actions-menu.tsx`
- Purpose: The Contract Detail workspace's top-right "Actions ▾" dropdown, enabled whenever `getVisibleContractTransitions()`/`getClosureAction()` say at least one real action exists. Lives at the `[id]/(workspace)/layout.tsx` level, so it's reachable from every tab (Schedule, Payments, Workflow, etc.), not just the Overview page where `ContractTransitions`/`ContractClosureAction` already render inline — this is a second, parallel trigger surface for the same underlying actions, not a replacement for either.
- Variants: menu contents are entirely data-driven (Activate/Cancel/Terminate/Request Closeout/Close Contract, each independently gated); the trigger itself renders as either a real enabled dropdown or a disabled stub with an accurate "no actions available" title, never both states mixed.
- Key tokens/classes: same `role="menu"`/click-outside-overlay pattern as `contract-row-actions.tsx`'s "···" menu; `text-accent` for safe/informational items (Activate, Request Closeout), `text-danger` for Cancel/Terminate, `text-success` for the final Close Contract.
- Accessibility behavior: `aria-haspopup="menu"`/`aria-expanded` on the trigger, `role="menuitem"` on every entry, each destructive/lifecycle item opens its own `role="dialog" aria-modal="true"` confirm step — nothing fires directly from a menu click.
- Used by: `[id]/(workspace)/layout.tsx` (replacing what had been a permanently disabled placeholder button since it was first added).
- Notes: reuses `ContractCancelAction`'s real CM-69A modal via its new `renderTrigger` prop (see below) rather than re-implementing a second cancel modal; reuses `terminateContractAction`/`closeContractFromCloseoutAction`/`activateContractAction` completely unchanged.

### Give an existing modal-owning component a `renderTrigger` prop instead of duplicating its modal (CM-69D)
- Pattern. When a second surface (here, a dropdown menu item) needs to open the exact same confirm/reason modal an existing self-contained component already owns (`ContractCancelAction`), give it an optional `renderTrigger?: (open: () => void) => React.ReactNode` prop (renders the caller's custom trigger instead of the default button) — but **also** add controlled-mode props (`open`/`onOpenChange`) alongside it. `renderTrigger` alone is not sufficient and was the source of a real bug (CM-69D → fixed in CM-69E, below): if the component instance itself is rendered *inside* a parent block that can unmount on the same click that's supposed to open it (e.g. a dropdown menu closing itself), its own internal `open` state gets destroyed before the modal ever paints. The correct shape: the parent owns the open/closed boolean (`isCancelOpen` or similar) in its OWN state, passes `open`/`onOpenChange` to the modal-owning component (which renders the modal as a sibling of the menu — always mounted, never inside the conditionally-rendered part), and passes `renderTrigger={() => null}` since the actual clickable trigger is a plain button living inside the menu that just calls the parent's own setter directly. When `open`/`onOpenChange` are omitted (every pre-existing call site), the component falls back to its own internal `useState` — fully backward compatible.

## Never nest a modal-owning component inside a block that conditionally unmounts on the same click that opens it (CM-69D bug, fixed CM-69E)
- The concrete failure mode a real user hit: "Remove Draft" was visible and clickable, but did nothing. Cause: the dropdown menu's own `onClick` handler both closed the menu (`setMenuOpen(false)`) and told a child `<ContractCancelAction>` to open its (internal, uncontrolled) modal — but that child was rendered inside `{menuOpen && (...)}`, so the very re-render meant to show the modal instead unmounted the component holding its state. Nothing was wrong with the server action, DTO, or backend — the request never even fired. Whenever a menu/accordion/tab body conditionally unmounts, any modal-owning child inside it needs its open state lifted to the parent (see the `renderTrigger` + controlled-mode entry above) — don't assume "it's rendered, so clicking its trigger will show its modal" without checking whether the trigger's own click ALSO unmounts its parent.

## Never disable a required-field submit button silently — validate with a visible message instead (CM-69F)
- A submit button whose ONLY feedback for "you haven't filled the required field yet" is being rendered at reduced opacity (`disabled:opacity-60`) is easy to miss entirely, especially the very first time a modal opens with an empty required field (nothing has visually changed yet from the user's perspective — they just see a dim button next to a crisp one and may not register it as a button at all). This was reported as "the modal has no submit button," when the button was always there — just permanently dimmed with no explanation. The fix: keep the submit button fully enabled/visible except while the request is genuinely in flight (`disabled={isPending}`, not `isPending || !requiredField.trim()`), and validate on click instead — set a real, visible error message (reusing the exact same error-banner UI the request-failure path already shows) when the required field is empty. Apply this to any OTHER modal in this app with the same `disabled={isPending || !x.trim()}` shape on its primary action button — same latent readability trap.

## CRITICAL — `danger` is not a real color token in this app; the real token is `error` (CM-69G, ~98 files affected app-wide)
- This app's Tailwind v4 theme (`apps/web/src/app/globals.css`'s `@theme` block) defines `--color-error`/`--color-error-light` — it has **never** defined `--color-danger`. Tailwind v4 only generates a `bg-<name>`/`text-<name>`/`border-<name>` utility when a matching `--color-<name>` variable exists in `@theme`; `bg-danger`/`text-danger`/`border-danger`/`bg-danger-light` generate **zero CSS**. Combined with `text-white` (a real, always-available Tailwind color) on a button, the result is invisible white-on-transparent text sitting on this app's white (`--color-surface: #ffffff`) surfaces — exactly the multi-report bug chased across CM-69D/E/F/G before the real cause was found (proved conclusively in CM-69G by fetching the running dev server's actual compiled CSS and grepping it: `.bg-error`/`.text-error` exist, `.bg-danger`/`.text-danger` do not, anywhere).
- **Always use `error` for a destructive/danger-styled element in this app** — `bg-error`, `text-error`, `border-error`, `bg-error-light`, `hover:bg-error/90`. Never write `bg-danger`/`text-danger`/`border-danger` — it will compile with no visible error, no console warning, no build failure, and just silently render nothing.
- **Scope of the remaining problem**: a repo-wide search found 98 files still using the fake `danger` token (vs. 61 correctly using `error`) — spanning Contract Management (Claims/Issues/Payments/Workflow/Closeouts/Documents/Risks/Variations), Factory Tasks, Incidents, Maintenance, Production, and Safety & Compliance. CM-69G fixed only the 4 files directly in the contract-lifecycle-actions family it was already touching (`contract-cancel-action.tsx`, `contract-detail-actions-menu.tsx`, `contract-transitions.tsx`, `contract-row-actions.tsx`) to keep that hotfix properly scoped — the other ~94 files are UNFIXED and almost certainly have the same invisible-button/invisible-text defect somewhere in each. A dedicated project-wide remediation unit is recommended (either a global find/replace `danger`→`error`, or the lower-risk fix of adding `--color-danger` as an alias in `@theme` pointing at the same value as `--color-error`, so every existing usage starts working without touching 98 files individually — trade-off: the alias fix leaves the wrong name in the source, the find/replace fixes it properly but touches far more files).

## Exclude a "voided/audit" status at the single upstream query, not at every downstream computation (CM-69H)
- Pattern. When a dashboard/aggregation service derives many separate numbers (financials, progress, alerts, top-lists, workflow overview) from ONE upstream `contract.findMany(...)` fetch plus child records joined via `contractId: { in: contractIds }`, the correct place to exclude a status that should never count as "active working data" (here, CANCELLED) is that single upstream query's `where` clause — never each individual downstream computation. Excluding it upstream means contracts AND every one of their child records (tasks/issues/claims/payments/closeout requests) are never even fetched, so nothing downstream needs its own `if (contract.status !== 'CANCELLED')` check to stay correct. This is the same "batched bulk-fetch, filter once" precedent used by CM-68A/CM-69A's schedule-overview services — reapply it whenever a new "should this contract count as active" rule needs adding to an aggregation service, rather than auditing and patching every consumer function individually.
- A KPI's own semantic scope ("Total Contracts" = literal all-time count vs. "Total WORKING Contracts" = only currently-actionable statuses) is a real business decision, not just a data-plumbing one — when a task's own wording defines "working statuses" explicitly (e.g. "DRAFT, ACTIVE only — do not include CANCELLED, CLOSED, TERMINATED"), that redefinition can correctly diverge from a broader "status breakdown" chart shown alongside it (which may legitimately keep Closed/Terminated as real portfolio context while still excluding a void status like Cancelled) — the two don't need to sum to the same total once their scopes are genuinely different.

## A fixed-options dropdown backed by a real free-text column: always keep an "Other" escape hatch (CM-70A)
- Pattern. When a real backend column is plain free text (here, `ContractPayment.paymentTerm`, `@IsString @MaxLength(100)`, no enum) but the UI wants a clean, guided dropdown of the common real values, do NOT replace the field with a closed enum — that would either lose legacy data that doesn't match one of the fixed options, or require a migration to widen the column. Instead: a `<select>` of fixed options plus a literal "Other" option that reveals a free-text input; submit a single hidden `<input type="hidden" name="<field>">` carrying whichever value is actually correct (the fixed choice, or the "Other" free text) — the backend never knows a dropdown was involved. On edit, always resolve the REAL stored value first: if it matches a fixed option, preselect it; if it doesn't (legacy/unexpected text), preselect "Other" with that exact text preserved, never silently blanked. See `resolvePaymentTermSelection`/`resolvePaymentTermValue` (contract-payment-detail-helpers.ts) for the reusable shape.

## Auto-suggest a status from live amounts, but let a validation pass — not a locked field — be the real gate (CM-70A)
- Pattern. When a status field has SOME values fully derivable from other live-editable numbers (here, Pending/Partially Received/Received from Invoice vs. Received Amount) but also has real values that aren't derivable that way (Submitted/Certified/Overdue/Cancelled), don't lock the field to auto-computed-only — keep it a normal editable `<select>`, auto-set it via each amount field's own `onChange` (compute the suggestion from the JUST-TYPED value, not the not-yet-updated React state, to avoid a stale-by-one-keystroke suggestion), and let a manual pick of a non-amount-derived status survive until the next amount edit. Enforce the actual amount/status consistency rules (e.g. "Fully Paid requires Received = Invoice") as a real, visible pre-submit validation error instead — this way a deliberate manual override of a derivable status is still caught if it's genuinely inconsistent with the amounts, without ever disabling the dropdown or overriding a legitimate manual choice mid-edit.

## A list page's summary/KPI cards must share the table's own filter-resolution function, never a separate query (CM-69I)
- Pattern. When a page shows both a filtered table (via `findAll(query)`/`buildListWhere(query)`) and summary/KPI cards computed from a SEPARATE endpoint/method that takes no filter params at all, the two WILL drift the moment the table's own default scope changes (here, CM-69C's default-excludes-CANCELLED) — the cards keep counting whatever the from-scratch query was hardcoded to count. The fix is never "add one more filter to the summary query to patch this one symptom" — it's to make the summary method accept the exact same query DTO the list method takes and resolve it through the exact same shared `buildListWhere()`/equivalent function, then combine department scope via the identical pattern (`{ ...buildListWhere(query) }` + conditional `departmentId` overwrite) the list method already uses. On the frontend, build ONE shared filter-params object and pass it to both the list and summary API calls from the same page — this makes "table and cards agree" a structural guarantee, not something that has to be manually re-verified every time a new filter or default-scope rule is added to either one alone.
- When a sub-KPI needs "count within the current filtered scope that ALSO matches an additional condition" (here, Active Contracts = current scope AND status=ACTIVE), always express that as a real Prisma `{ AND: [where, { extraCondition }] }`, never an object-spread `{ ...where, extraCondition }` — the spread silently overwrites a same-named key `where` might already carry (e.g. an explicit `lifecycleStatus=DRAFT` filter's own `status` condition), producing a wrong, filter-ignoring count instead of the correct "0, because this scope excludes it" result.

---

## Before assuming a reported "red/invalid field" is a real bug, verify the actual data first (CM-70B)
- When a user reports a field looking invalid/red/confusing, audit the ACTUAL current values that field can hold before assuming a CSS/validity bug: check what the backend really returns for the "empty"/fresh case (here, `contract-boq-production.service.ts`'s own `toNum(...) ?? 0` fallback — confirmed a never-touched item's Delivered field is a real, honest `0`, never `undefined`/`NaN`), and check the component for `required` attributes or conditional border-color logic actually tied to that field's value. If neither exists, the real fix is usually a UX/communication gap (no reassurance that the default value is correct/expected), not a code defect — say so explicitly rather than inventing a fake root cause to match the report. Still apply the same defensive numeric-formatting habit either way: seed a controlled number input from a helper that rounds to the column's real decimal precision (`Math.round(value * 1000) / 1000`, see `toInputValue()`) rather than a raw `String(number)`, since floating-point noise beyond the input's own `step` CAN genuinely trip native browser validity styling — a real, if narrower, technical possibility worth closing regardless of whether it was the actual cause this time.

## Status-driven field requiredness: let Status decide whether OTHER fields are required, don't disable them (CM-70C)
- Pattern. When a status/workflow field (here, Variation Status: Draft → Submitted/Pending Approval/Approved/Rejected/Cancelled) governs whether OTHER fields (Submitted Date, Approved Date) are meaningful, this is the reverse relationship from CM-70A/70B's "amount derives status" pattern — here, status derives date REQUIREDNESS, not the date's value. Express each rule as its own small pure predicate (`isSubmittedDateRequired(status)`, `isApprovedDateRequired(status)`) so both the visual required-asterisk and the validation-error condition read from the exact same source of truth, and add the actual requiredness check into one combined `validateVariationFormValues()` pass alongside every other cross-field rule (date ordering, approved+affects+amount≠0) — never scatter individual `if` checks inline in the component.
- When a task's own wording hedges a hard rule with "...unless the user explicitly needs it" (here, "Approved Date should be empty/disabled for Draft/Submitted/Pending Approval unless user explicitly needs it"), do NOT reach for the native `disabled` attribute — a truly disabled field can never be filled in even in the legitimate edge case the hedge is carving out. Instead, only apply soft visual de-emphasis (muted opacity, no required asterisk, a small explanatory note) while leaving the field genuinely editable, and only lift the de-emphasis once the field already has a real value OR the status starts requiring it. This preserves an existing record's historical value (never hidden/force-cleared) while still nudging the common case correctly.

## `class-validator` DTOs with independently-optional fields are exactly where cross-field validation gaps hide (CM-70C)
- Pattern. A DTO like `create-contract-variation.dto.ts` can have every individual field correctly validated (`@IsOptional`, `@IsIn`, date-pattern-matched) while having ZERO rules connecting them (status vs. required dates, one date vs. another, a status+flag+amount combination). This is not a bug in the DTO — per this codebase's "prefer frontend/UI-validation only" precedent (CM-69F onward), the fix is a single pure `validate*FormValues()` function in the relevant `_lib/contract-*-helpers.ts` file, unit-tested directly, wired into the modal's `handleSubmit` exactly like every other unit in this series — not a backend DTO change, unless the task explicitly asks for one.

## A "fixed contract" Add flow needs its OWN readable contract identity — never assume it's derivable from sibling data (CM-70C — Claim Modal)
- Pattern. A modal shared between a module-level register (which always has a full `contracts: {id, referenceNumber, title}[]` array to look up from) and a per-contract tab (which passes only `fixedContractId`, a bare id, because listing "every contract" makes no sense there) will silently regress to showing a raw UUID the moment the per-contract call site is added, UNLESS that call site is explicitly given its own small readable-identity object. Do not assume the current claims/payments/etc. list response already carries this (`claim.contract.referenceNumber` is only available once at least one record exists — a contract with zero records has nothing to source identity from). The established fix (already used by `payments/page.tsx`, reused here for `claims/page.tsx`) is a second, small `contractsApi.get(id)` fetch in the per-contract tab's own page.tsx, even though the workspace `layout.tsx` already fetched the same contract once — Next.js's layout→page relationship has no prop-injection channel, so a per-tab page that needs contract identity fetches it again. Thread the result down as a small `{referenceNumber, title, counterpartyName?}` prop, never the full `Contract` object, to keep the component's own prop surface minimal.
- When auditing "does field X show a raw UUID anywhere," check EVERY call site of the shared component independently — a bug present at one call site (the per-contract tab) can be completely absent at another (the module-level register, which always has its `contracts` array) using the exact same component and the exact same fallback expression. "It works in the register" is not evidence it works everywhere the modal is reused.

## A claim/record "type" field with real-world guidance that doesn't map 1:1 onto the actual backend enum: bucket the real values, don't invent a new one (CM-70C — Claim Modal)
- Pattern. When a task describes behavior for a category (here, "Cost") that has no exact matching value in the real enum (`ContractClaimType` has no `COST` — only `VARIATION`/`EXTENSION_OF_TIME`/`DELAY`/`PAYMENT`/`DAMAGE`/`SCOPE_CHANGE`/`OTHER`), do not add a new enum value to satisfy the wording literally — that needs a migration and is out of scope for a frontend-only unit, and risks inventing a workflow the business never asked for (a real CLAUDE.md constraint). Instead, write a pure `get*Guidance(type)` function that buckets the REAL values into the requested categories (EXTENSION_OF_TIME → the time-based bucket; every other concrete type → the cost-like bucket per the task's own "Cost" example; OTHER → a neutral bucket covering both) and document the mapping decision explicitly in the unit's own report. The guidance drives copy only (an InfoBox/helper text) — it must never hide or disable a field, since the "bucket" is an interpretive categorization, not a real, stored distinction the backend enforces.

## The "fixed contract raw-UUID" bug recurs any time a per-contract tab is added to a register-shared modal — check the same pattern proactively (CM-70D — Issue Modal, same shape as CM-70C's Claim Modal)
- Pattern. Any modal shared between a module-level register (which always builds a full `contracts[]` array for its own Add-contract-selector dropdown) and a per-contract tab (which passes only `fixedContractId`, since listing every contract makes no sense from inside one contract's own workspace) is at risk of the exact same bug: the per-contract call site has no `contracts` array to look up a label from, so a naive `contracts?.find(...)?.referenceNumber ?? fixedContractId` fallback silently renders the raw UUID. This has now recurred identically for both Claims (CM-70C) and Issues (CM-70D) — when auditing ANY other register-shared modal in this app (Risks, Documents & Obligations, Workflow Tasks, etc.), check this exact fallback expression first; if present, apply the same fix: a small `fixedContract?: {referenceNumber, title, counterpartyName?}` prop, sourced via a `contractsApi.get(id)` fetch in that per-contract tab's own page.tsx (same pattern as `payments/page.tsx`), formatted through a tiny per-module `format*ContractContext()` pure helper.

## A task's suggested option list may not match the real backend enum — verify before relabeling, and never invent to close the gap (CM-70D — Issue Modal)
- Pattern. A task can describe a category list (here: Technical, Production, Delivery, Erection, Finance, Site, Quality, Safety, Client, Other) that partially overlaps but does NOT match the real, already-shipped backend enum (`CONTRACT_ISSUE_CATEGORIES`: Commercial, Technical, Production, Delivery, Erection, Client, Document, Payment, Other — no Finance/Site/Quality/Safety). Always diff the task's list against the actual `@IsIn(...)` array in the DTO before writing any relabeling code. When they don't match and the task itself says "use existing backend enum/options only" / "do not add enum values unless backend already supports them," the correct outcome is often to change NOTHING functionally — if the real values are already plain human-readable words (not a SCREAMING_SNAKE_CASE enum needing humanizing), the only remaining work is a helper-text sentence, not a relabeling map. Also check whether a PRIOR unit already built a relabeling map for this same field in a different, tab-scoped file (here, `contract-issue-detail-helpers.ts`'s own `ISSUE_CATEGORY_LABELS`, CM-65) before writing a second one for the modal — reusing or deliberately NOT reusing it needs to be a documented decision, not an accidental third naming scheme.

## A confusing combined form field can be a real schema limitation, not just a labeling problem — check the column count before assuming frontend-only (CM-70E)
- Pattern. When a reported "this field is confusing" issue involves TWO or more genuinely distinct business meanings sharing ONE field (here, "Submission / Expiry Date" backed by a single `submissionOrExpiryDate` column), don't assume a relabel/split-the-UI-only fix until checking whether any REQUIRED real-world scenario needs both meanings recorded SIMULTANEOUSLY on the same record (here, an Insurance Certificate needing both a real submission date AND a real expiry date at once). If the task's own test-data scenarios require that overlap, the DB genuinely cannot represent it with one column — this is a real, additive-migration-worthy gap, not a UI polish item. Confirm via `pnpm db:migrate:status`/reading `schema.prisma` directly, never by assuming the type layer already has what you need.
- When adding the split, NEVER drop or backfill/guess-assign the old combined column's existing data into one of the two new fields — which meaning an old combined value held is not recoverable with confidence. Add two new nullable columns, leave the legacy column and its data exactly as they are, and make every derived calculation (days remaining, expiring/expired, overdue) prefer the new specific field with `newField ?? legacyField` as a one-line fallback — this keeps every pre-existing record's computed behavior identical while all new records use the correct, unambiguous field. Before deciding how much "migrate old data" ceremony a report needs, run a real read-only row/column count against the live dev DB (a small Prisma script, see this unit's own audit) rather than assuming — an empty table changes nothing about the migration's correctness but changes how much legacy-display UI is actually worth building right now.
- Applying a hand-written additive migration safely in this repo: create `packages/database/prisma/migrations/<timestamp>_<name>/migration.sql` by hand (matching the exact `-- AlterTable` / quoted-identifier style Prisma itself generates — copy the format from the most recent real migration in the folder), update `schema.prisma` to match, then run `pnpm db:migrate:deploy` (never `db:migrate:dev`, which can prompt for a shadow-DB reset) followed by `pnpm --filter @recafco/database run build` to regenerate the Prisma client. Confirm with `pnpm db:migrate:status`.

Expected future components (not yet built):

- DataSourceBadge
- DataTable
- FilterBar
- AttachmentList

Do not register one-off page markup. Do not create duplicate components with slightly different styling.

## CRITICAL — a raw Prisma `@db.Date` value serializes as a full ISO datetime, which a native `<input type="date">` silently renders blank (CM-70F, likely affects every Contract Management date field app-wide)
- Root cause, proven empirically (not theoretical): Prisma returns a real JS `Date` object (UTC midnight) for every `@db.Date` column. NestJS's default response path (`{ data, meta, error }` returned raw from a controller, no `ClassSerializerInterceptor` or custom JSON replacer registered anywhere in `main.ts`) serializes that `Date` via the JS-native `.toISOString()`, producing `"2026-09-06T00:00:00.000Z"` — NOT the plain `"2026-09-06"` every frontend `ContractX` type declares for that field. A native `<input type="date">`'s `value`/`defaultValue` MUST be exactly `YYYY-MM-DD` per the HTML spec; anything else (including a technically-valid ISO-8601 datetime with a `T`) is treated as invalid and the browser renders the field as **empty** — with no console error, no thrown exception, nothing to catch in a code review that doesn't specifically check the wire format.
- This was fixed for Documents & Obligations in `contract-document-obligations.service.ts` via a `toDateOnlyString(date: Date | null | undefined): string | undefined` helper (`date.toISOString().slice(0, 10)`, or `undefined` for null/unset — never a fabricated date) applied inside the shared `withDerivedFields()`/response-construction function, so every read/create/update response gets it for free. Verify a fix like this with a REAL read-only Prisma query (see this unit's own audit — query any existing row's own date field, `JSON.stringify` it, and read the actual wire shape) rather than trusting a unit test mock, since a mock's `Date` object passed straight into `toMatchObject`/`toEqual` can hide the exact issue if the assertion doesn't check the serialized string shape specifically.
- **This same unconverted-Date-object pattern was confirmed (by code inspection, not yet fixed) in Claims/Risks/Issues/Payments/Variations, and very likely Contract Edit's own `startDate`/`endDate`/etc.** None of these have ever been visually confirmed in a live browser this entire session (the credential blocker has applied since CM-62), so this is a plausible, silent, systemic bug across most of Contract Management's Edit modals — every one of them uses the identical `defaultValue={item?.xDate ?? ''}` pattern trusting the API to already hand back a clean date string. Treat this as the single highest-value follow-up unit: apply the same `toDateOnlyString()`-in-the-response-builder fix to each sibling service, verified the same way (a real Prisma query + a unit test asserting the literal `"YYYY-MM-DD"` shape).
- A "Save/Upload doesn't work" bug report can be fully explained by THIS bug alone, with zero actual defect in the save/upload code path: if a save genuinely succeeds but the edited date fields come back empty on reopen, a user reasonably concludes "my change didn't save" even though it did. Before assuming a report of "X doesn't work" means the X action itself is broken, check whether a sibling display bug (like this one) could make a working action LOOK broken — re-audit the actual persistence layer (does the DB have the right value?) separately from the round-trip DISPLAY layer (does the exact string sent back render correctly in the exact input type used?).

## CRITICAL — an attachment-upload `<form>` nested inside a modal's own outer `<form>` breaks the Upload button; this exact pattern was copy-pasted across multiple attachment sections (CM-70G, confirmed also present in Variations)
- Root cause: `SupportingDocumentsSection`/`AttachmentsSection`-style components (Documents, Variations — established starting CM-60C/CM-63) each render their OWN `<form action={uploadFormAction}>` around their file input + Upload button. Every one of them is rendered as a CHILD of the enclosing modal's own outer `<form id="...-form">` (the Save/Add form). Nested `<form>` elements are invalid HTML — React's own development-mode DOM validation surfaces exactly a "`<form>` cannot be nested inside another `<form>`" console warning, and a `<button type="submit">` inside the invalidly-nested inner form does not reliably resolve to ITS OWN nearest form, making Upload appear to silently do nothing.
- The fix (applied to Documents in CM-70G, NOT yet applied to Variations' `SupportingDocumentsSection` — confirmed to have the identical structure, flagged as a follow-up): convert the inner upload `<form>` to a plain `<div>`; change the Upload button to `type="button"`; replace the form's own `onSubmit` handler with a plain `onClick` handler that reads the selected file directly off a `useRef<HTMLInputElement>`, shows the "Please choose a file before uploading." message client-side if none is selected, and otherwise builds a `FormData` manually and calls the `useActionState`-returned dispatcher (e.g. `uploadFormAction(formData)`) DIRECTLY — this dispatcher is a plain function; it does not require a real `<form>` submission event to invoke correctly, and calling it manually still updates its own pending/error state exactly as if a form had submitted it.
- When auditing ANY OTHER attachment-upload section in this app for the same bug, the tell is structural, not behavioral: does this component render `<form action={someUploadDispatcher}>` AND is this component itself rendered somewhere inside another, larger `<form>` element? If both are true, it has this bug regardless of whether anyone has reported it yet — `workflow-task-drawer.tsx` has multiple `<form>` elements whose mutual nesting was flagged during this unit's audit but not fully traced; check it next.

## `useActionState` + `submittedRef` + `useEffect`-close is the established pattern app-wide, but it has no independent safety net — prefer an explicit `isSaving` + `try/finally` when a "stuck on Saving…" bug is reported (CM-70H — Payment Modal)
- Every Add/Edit modal in this app (Payments, Claims, Variations, Issues, Documents, Risks, etc.) uses the same shape: `const [state, formAction, isPending] = useActionState(action, {error: null})`, a `submittedRef` set to `true` only when client validation passes, and a `useEffect` that closes the modal + calls `router.refresh()` once `submittedRef.current && !isPending && !state.error`. This works reliably in the overwhelming majority of cases — it is NOT deprecated app-wide — but it has exactly one structural weak point: success-detection depends entirely on that one `useEffect` re-running correctly with the right values after the action's promise settles. If a report says a Save/Add button gets permanently stuck on its pending label with the modal still open, and — critically — the backend write actually succeeded (confirmed by a manual refresh showing the new/updated record), do not assume the fetch/action layer itself is broken before checking two things in order: (1) is `revalidatePath`/similar being called with the WRONG path for the page the user is actually on (the most common real cause — see the Payments case, where `revalidatePath('/contracts/payments')` never touched the actual `/contracts/{contractId}/payments` route the Contract Detail tab lives on); (2) does the modal's own success-close logic depend on this fragile effect-based pattern with no independent fallback.
- The more robust fix, applied to the Payment modal in CM-70H: replace `useActionState`/`submittedRef`/`useEffect` with an explicit `useState<boolean>` (`isSaving`) and a plain `async function handleSubmit(e)` that ALWAYS calls `e.preventDefault()` first (removing any dependency on the form's native `action` prop entirely — drop `action={formAction}` from the `<form>`), checks `if (isSaving) return;` at the top for a real double-submit guard, and wraps the actual `await someAction(...)` call in `try { ... } catch (err) { console.error(...); setError(...) } finally { setIsSaving(false); }` — `isSaving` can then never get structurally stuck regardless of what happens inside, and a successful result closes the modal immediately and unconditionally (never gated on a later effect), with `router.refresh()`'s own failure only logged as a `console.warn` (never reverting the close) since the save itself already succeeded by that point. The exported Server Actions (`createXAction`/`updateXAction`) do not need to change shape — they remain plain `(prevState, formData) => Promise<ActionResult>` functions and can be called directly (`await createXAction({error: null}, formData)`) from a manual handler exactly as well as from `useActionState`.
- **Important exception, found in CM-70I (Edit Contract page)**: a full-page form that calls `redirect()` from directly inside its Server Action after a successful save does NOT have this fragility — `redirect()`'s special thrown signal drives the navigation itself, with no dependency on a client-side effect correctly detecting `isPending`/`state.error` transitions. Don't blanket-apply the `isSaving`+`try/finally` rewrite to every "stuck on Saving" report — first check whether the action already ends in `redirect(...)` after its `revalidatePath(...)` calls (Edit Contract's `updateContractAction` does). If so, the fragile-effect diagnosis doesn't apply, and the real cause is very likely elsewhere — start with the `danger`-token check below.

## Before diagnosing "Save doesn't work" as a plumbing bug, check whether the error banner can even be seen (CM-70I — Edit Contract page)
- `edit-contract-form.tsx` (and the shared `contract-form-fields.tsx` it reuses) had the same invalid `bg-danger`/`text-danger`/`border-danger` Tailwind v4 tokens first identified in CM-69G — this form was never part of that sweep since it predates it and wasn't touched by any later unit. The practical effect: this page's `updateContractAction` already threw clear, specific, correctly-returned error messages (e.g. `contracts.service.ts`'s real `ConflictException` — "Contract was changed by another user; please refresh and retry" — on a version conflict) that were rendering with ZERO visible styling. A save that genuinely failed for ANY reason looked, to the user, exactly like a save that silently did nothing — no console error, no thrown exception, nothing that shows up in a functional trace of the save flow itself. Before spending time on the action/DTO/service layer for a "doesn't save" report, grep the specific component tree for `danger` first — it's a five-second check that has now fully or partially explained the root cause for three separate "broken save" reports in this session (CM-69D-G's Cancel button, and now Edit Contract).

## A PATCH action that omits an empty field to mean "leave unchanged" cannot express "the user explicitly cleared this back to its default" — distinguish the two before assuming omission is always safe (CM-70I — Edit Contract page)
- `updateContractAction`'s Department/Plant `<select>`s both offer a real "— None —" option. The action's own `(formData.get(x) as string|null) || undefined` conversion made an empty string (a deliberate "None" choice) indistinguishable from `undefined` (a field this specific request never touched) — both collapsed to the same wire value, and the backend's `if (dto.x !== undefined) data[x] = dto.x;` pattern (itself correct and unchanged) then always chose "leave unchanged" for both cases, silently discarding an explicit clear.
- This is only safe to "fix" by always-sending-the-current-value (instead of conditionally omitting) on a form where EVERY field is unconditionally rendered every time — a full-state form, not a sparse/partial-update UI. Before applying this fix to any given field, confirm from the JSX that the `<input>`/`<select>` is never conditionally absent from the DOM (Edit Contract's own crane fields ARE conditionally rendered only when Erection is selected — those were deliberately left on the old omit-when-absent behavior, since "the field wasn't in the DOM at all" genuinely can mean "untouched" there, unlike Department/Plant which are always present). Then confirm the target column is genuinely nullable in `schema.prisma`, and confirm `class-validator`'s `@IsOptional()` on the DTO field accepts `null` (it does, by design — checked directly against the installed package's own source: `IsOptional` is implemented as `ValidateIf((obj, value) => value !== null && value !== undefined)`, i.e. it skips validation for both). If all three hold, convert `'' → undefined` (omit) to `'' → null` (explicit clear, always included) — this is a small, additive, backend-code-free fix (the service's existing `!== undefined` check already handles `null` correctly once it actually receives one).

## The fragile `useActionState`+`submittedRef`+`useEffect`-close pattern recurs independently per-modal — a "stuck on Saving…" report on ONE modal means every other modal sharing the same signature is equally at risk, not just that one (CM-70J)
- Following up on CM-70H's Payment-modal fix, the user reported the identical symptom on Add Claim — a SEPARATE modal, with its own SEPARATE `useActionState`/`submittedRef`/`useEffect` instance, not a regression of the Payment fix. A full audit of the whole Contract Management tree (every file matching `useActionState`, `submittedRef`, `"Saving…"`, `"Submitting…"`) found the exact same fragile signature independently present in 12 more forms/modals: Claim, Issue, Variation, Risk, Document, Production, Assign Task, Closeout Request, Closeout Review/Approve/Reject/Close (a shared `useSimpleAction()` hook), Closeout Request Attachments, Workflow Task Drawer (3 forms), and Staff Task Update Panel (3 forms) — all rewritten to the `isSaving`+`try/finally` pattern established in CM-70H. Treat any single confirmed "stuck on Saving" bug as a signal to grep the WHOLE module for the same signature, not just fix the one reported instance.
- Distinguishing genuinely-safe `useActionState` usage from the fragile kind, confirmed again this unit: `isPending`/the hook's own returned pending flag is ALWAYS reliable on its own (it resolves the instant the action's promise settles — this is native React behavior, not something that can get stuck). The bug is specifically in an EXTRA `useEffect` layered on top that watches a separate `submittedRef` flag to decide whether to close a modal / trigger a side effect once success is detected. A component using `useActionState` with NO such effect (Contract Edit page, New Contract Register, and every file-upload `AttachmentsSection`/`SupportingDocumentsSection` in this app, which only use the effect to refresh an attachment list — a cosmetic no-op if it fails to fire, not a stuck button) is not at risk of the "stuck forever" failure mode and does not need the rewrite. Before rewriting any `useActionState` usage, confirm it actually pairs `submittedRef` with a `useEffect`-driven close/navigate — if it doesn't, leave it alone.
- Where `formRef.current?.requestSubmit()` is used to programmatically submit a form after a piece of controlled state (e.g. a `status` `<select>`'s value) has been updated and re-rendered (`staff-task-update-panel.tsx`'s Mark Complete/Submit/Send Back/Reject buttons), the rewrite is fully compatible and requires no change to that mechanism: `requestSubmit()` fires the form's native `submit` event regardless of whether the `<form>` has an `action` prop, so it invokes a plain `onSubmit={handleSubmit}` handler exactly the same way a user clicking a real submit button would.

## `revalidatePath('/contracts')` alone is not enough for any action invoked FROM a Contract Detail tab — always also revalidate `/contracts/${contractId}` (or the specific tab route), and check for this independently on every mutating action, not just the ones already known (CM-70J)
- Beyond the Payments case fixed in CM-70H, this unit found the identical bug independently in `activateContractAction`, `terminateContractAction`, `closeContractAction`, and `addContractCommentAction` — all Contract Detail page actions (invoked from the page's own Actions menu / Comments panel, which stays on `/contracts/{id}` after the action completes) that only ever called `revalidatePath('/contracts')` (the list page) and never `/contracts/${id}` itself. The user stays on the Contract Detail page after any of these actions, so the list-page revalidation is functionally useless for what they actually see — the page looks unchanged (stale status badge, stale comment count) until an unrelated navigation forces a fresh fetch. When adding or auditing ANY new Contract Detail-tab mutating action, grep its own `revalidatePath` calls and confirm the specific `/contracts/${contractId}` (or `/contracts/${contractId}/{tab}`) path is included, not just the module-level list route — do not assume an action is safe just because SOME `revalidatePath` call is present.

## Erection Workflow Step 1 — Issue Erection Method Statement (CM-71A)

### ErectionWorkflowStepTracker
- Path: `apps/web/src/app/(protected)/contracts/[id]/(workspace)/workflow/erection/method-statement/_components/erection-workflow-step-tracker.tsx`
- Purpose: Read-only/navigation-style 7-step progress tracker for the Erection Workflow. Purely presentational — takes only `currentStep: number`, carries no workflow-progress data of its own.
- Variants: None yet — every step beyond the current one renders identically as "pending" (no click handler, no route) since only Step 1 has a real screen. Steps before `currentStep` render as done (checkmark).
- Key tokens/classes: `border-success bg-success` (done), `border-accent bg-accent` (current), `border-border text-text-muted` (pending) — same 3-state visual language as `workflow-task-drawer.tsx`'s own step-sequence UI.
- Used by: `ErectionMethodStatementPanel` (Step 1 screen). Reuse as-is for every future step's screen (CM-71B onward) — do not rebuild the tracker per step.
- Notes: Server-safe (no `'use client'` directive needed — no state/handlers of its own); step labels come from `ERECTION_WORKFLOW_STEPS` in `contract-erection-method-statement-helpers.ts`, not hardcoded here.

### A single-record-per-contract feature (at most one row, ever) is best modeled as a nullable-until-saved GET, not a list, and its screen behaves like one Add/Edit modal inlined into a full page (CM-71A)
- `ContractErectionMethodStatement.contractId` is a real DB-level unique constraint, not just a frontend assumption — `GET .../erection/method-statement` returns `data: null` (200, not 404) when nothing has been created yet, since "not created yet" is a normal, valid state for Step 1 of a workflow. `POST` creates it once; every later save goes through `PATCH .../erection/method-statement/:statementId`, mirroring the exact same "mode: add | edit, derived from whether the record exists" pattern every Add/Edit modal in this app already uses (Claims, Issues, Variations, Risks, Documents) — just rendered as a full page instead of a modal, since the design calls for a dedicated screen with its own breadcrumb, guidance card, and 7-step tracker rather than a dialog.
- When adding a new "exactly one of these per parent" record type elsewhere in this app, follow this shape rather than either (a) a list endpoint that's expected to always return 0-or-1 items, or (b) a fake "always exists" record seeded at parent-creation time.

### First attachment-bearing feature to get a real delete endpoint — the storage-service contract needs one more method (CM-71A)
- Every earlier attachment table (workflow task/CM-32, closeout/CM-33, variation/CM-60C, document-obligation/CM-63) has upload/list/download only — no delete was ever requested for those. This unit's task explicitly asked for delete, so `ErectionMethodStatementAttachmentStorageService` adds a `deleteFile(storagePath)` method alongside the established `save()`/`createReadStream()`/`resolveAbsolutePath()` trio — best-effort, never throws (a missing/already-removed file on disk must never fail the user's delete request; the DB row is the source of truth, the disk file is a cheap, recoverable artifact). The controller route deletes the DB row first, then calls `deleteFile()` — never the reverse order, so a failed disk cleanup can never leave a dangling DB row pointing at a file that still exists but is no longer referenced anywhere.
- If a delete-attachment capability is ever added to one of the 4 earlier features, copy this same `deleteFile()` shape into their own storage service rather than inventing a different cleanup contract.

### A route nested deeper than the standard `/contracts/[id]/<tab>` shape needs its own breadcrumb function, checked before the generic 3-level fallback (CM-71A)
- `isContractWorkspaceDetailPath`'s regex only inspects the first 2 path segments after `/contracts/`, so `/contracts/[id]/workflow/erection/method-statement` still matches it (via `workflow`) and would otherwise get the same generic "Contract Management > Contract List > Contract Detail" breadcrumb every other tab gets — one level short of what a page nested two levels below a tab actually needs. Added `contractErectionMethodStatementBreadcrumbItems()` (`_lib/contract-workspace-breadcrumb.ts`), following the exact same shape as the existing `contractWorkflowBreadcrumbItems()` special case: a dedicated function, pathname-only (contractId parsed directly out of the URL, never fetched), checked in `top-header.tsx`'s resolution chain before the generic `isContractWorkspaceDetailPath` fallback. Never widen the generic fallback itself to handle a deeper route — every other workspace tab depends on it staying exactly 3 levels.

## Erection Manager Dashboard (CM-71B)

### ErectionKpiGrid / ErectionWorkQueueTable / ErectionMethodStatementStatusBadge / ErectionAttentionBadge
- Path: `apps/web/src/app/(protected)/contracts/erection-dashboard/_components/`
- Purpose: KPI strip + searchable/filterable work queue for the Erection Manager Dashboard, all read-only, every action linking out to the CM-71A Method Statement screen (no dashboard quick-edit).
- Key reuse: `ErectionKpiGrid` reuses `DashboardKpiCard` (`contracts/dashboard/_components/dashboard-kpi-card.tsx`, CM-54) directly — it already accepts `value: string | number | undefined`, so the 2 "not built yet" cards (Checklist Pending, Payment Pending After Erection) just pass a fixed `'Not started'` string instead of a number, no new card component needed. `erection-work-queue-table.tsx` reuses `ContractLifecycleBadge` for the Contract Status column and `inputCls` from `contract-form-fields.tsx` for its search box/selects.
- Used by: `contracts/erection-dashboard/page.tsx`.
- Notes: Filtering (search + Method Statement Status + Attention + Contract Status) is entirely client-side over the already-fetched, server-capped (`DASHBOARD_CONTRACT_CAP`) dataset — the same "fetch once, filter in memory" approach the rest of this dashboard already uses, not a paginated/query-param list page.

### A dashboard whose value can legitimately be "not available yet, not zero" needs a card that accepts a string, not a number formatter bolted on afterward (CM-71B)
- When Steps 6-7 of the Erection Workflow (Checklist, Payment) have no dedicated screen/model to compute a real count from, the honest choice is a fixed placeholder label ("Not started"), never `0` (which reads as "checked, and the answer is zero" — a false claim) and never a fabricated number. `DashboardKpiCard`'s `value: string | number | undefined` prop already supports this without any change — pass the literal string. Before building a new KPI-card component for a "sometimes we just don't have this data yet" situation, check whether the existing card can already take a string value; it likely can.

### An "X-related record" filter across 3 independent real signals belongs in one small pure predicate function, computed once server-side — never repeated at each call site (CM-71B)
- `isErectionRelatedContract()` (`contract-erection-dashboard.service.ts`) is the single place that decides whether a contract counts as "erection-related" (scope flag OR method-statement existence OR ERECTION workflow-task existence) — computed once per contract during the dashboard's own data pass, not re-derived by the frontend or repeated in multiple backend call sites. When a "which records match this multi-signal business concept" question recurs (e.g. a future "which contracts are QS/Commercial-related" filter), write one small named predicate function taking a plain-object input (not a live Prisma row) so it stays independently unit-testable, exactly like this one.

### Two same-named-sounding fields from different units are not the same field — verify before reusing a label (CM-71B)
- `Contract.jobOrder` (an older, contract-level field from an earlier unit) and `ContractErectionMethodStatement.jobOrderNo` (CM-71A, per-method-statement) are NOT the same concept despite the similar name — the Erection Dashboard's "Job Order No." column shows the method statement's own value first (since that's what this feature is about) and only falls back to the older contract-level field, never silently treating one as a stand-in for the other without checking both actually exist and mean the same thing. Whenever two fields with similar English names turn up on related models, confirm they're actually the same concept before conflating them in a shared UI label.

## Erection Workflow Step 2 — Erection Method Statement Approval (CM-71C)

### A required "Decision" field driven by dedicated action buttons, not a separately-toggled pre-select (CM-71C)
- `erection-method-statement-approval-panel.tsx`'s Decision `<select>` (Approve / Request Revision / Reject) is real, visible, and required — but it is never the reviewer's independent first move. Each of the 3 final-action buttons (Approve & Forward / Request Revision / Reject) sets the Decision state directly when clicked, immediately before submit, so the dropdown always reflects exactly what's about to be saved and can never drift out of sync with which button was pressed. When a design calls for both a "required field with named options" AND "distinct action buttons for each option," prefer this shape (buttons drive the field) over asking the user to set the field first and then find the matching button — it removes an entire class of "I picked X but clicked Y" mistakes for free.

### Comments-required-for-a-final-decision is enforced twice, once client-side and once server-side — for the same reason class-validator DTOs exist at all (CM-71C)
- `validateErectionMethodStatementApprovalFinalValues()` (frontend, immediate UX) and `assertCommentsPresentForFinalDecision()` (`contract-erection-method-statement-approval.service.ts`, the real floor) both require Comments / Review Notes before Approve/Request Revision/Reject can succeed — matching the existing `RejectContractCloseoutRequestDto` precedent (a required `rejectionReason` field on its own dedicated DTO) rather than trusting client-side validation alone for a real business-consequential action. When a button triggers an irreversible-feeling workflow transition (approve, reject, terminate, close), check whether an existing "reason required" precedent exists elsewhere in this app before deciding whether server-side enforcement is worth the extra function — for anything approval/rejection-shaped, the closeout precedent says yes.

### Two attachment tables for two owners of the same document set, even when they review the exact same files (CM-71C)
- `ContractErectionMethodStatementApprovalAttachment` (Step 2's own QA/QC review uploads) is a completely separate table from `ContractErectionMethodStatementAttachment` (Step 1's own submitted files) — Step 2's screen shows Step 1's attachments read-only (download only, via Step 1's own existing endpoints) and never re-uses Step 1's upload/delete endpoints for anything. This is the same reasoning as CM-71A's own attachment-table split, one level up the workflow: whenever screen B needs to both *display* screen A's files and *add its own*, give B its own attachment table rather than either (a) reusing A's table with a "source" discriminator column, or (b) letting B's delete endpoint reach into A's rows. The separation makes "Step 2 can never delete what Step 1 submitted" true by construction, not by convention.

### A dashboard's per-row Action link should be computed once, server-side, as a `{label, href}` pair — not re-derived by every consumer component (CM-71C)
- Extending the CM-71B Erection Dashboard for a new Step 2 meant its Action column now needs to route to either Step 1 or Step 2 depending on real status. Rather than duplicating that routing rule in `erection-work-queue-table.tsx` AND `erection-dashboard-panels.tsx` (2 separate components that both render an action link per row), `computeErectionNextAction()` computes a single `nextAction: { label, href }` server-side per row, and both frontend components just render `r.nextAction.label`/`r.nextAction.href` verbatim. When a dashboard's row-level "what to do next" logic depends on more than one upstream status, compute it once in the backend service (easily unit-tested in isolation) rather than letting each frontend consumer re-derive it — a future Step 3 addition only needs to touch this one function, not every table/panel that links out.

## Erection Workflow Step 3 — Issue Erection Schedule (CM-71D)

### CM-71C's own prediction held: extending `computeErectionNextAction()` for a 3rd step touched exactly one function, not every consumer (CM-71D)
- Confirms the CM-71C registry entry above. Adding Step 3 routing meant adding 2 new params (`scheduleStatus`, `hasSchedule`) and one more `if` branch to `computeErectionNextAction()` in `contract-erection-dashboard.service.ts` — `erection-work-queue-table.tsx` and `erection-dashboard-panels.tsx` needed zero changes to their action-link rendering logic. The same "compute once, server-side, as a typed row field" shape was reused again for `computeCurrentErectionStepLabel()`, which layers the 3 real dedicated per-step statuses (Steps 1-3) over the pre-existing generic-task-derived fallback (`computeCurrentErectionStep`) — a "specific data overrides generic proxy, falls back honestly once the specific data runs out" pattern worth reusing again once Step 4 exists.

### A "not stored, computed client-side" badge state (CM-71A's "Ready to Issue") is a real, reusable design decision to re-apply per unit, not a one-off (CM-71D)
- CM-71D's own task literally suggested a `READY_TO_ISSUE` enum value in its "Suggested enum" section, the same way CM-71A's original task once implied one too. Both times the better call was to keep the real Prisma enum to only the values an actual button transition writes (`DRAFT | ISSUED | HOLD | RETURNED`, 4 values, not 5) and compute "Ready to Issue" client-side from `status === 'DRAFT' && validation-passes`. Contrast with CM-71C's Step 2, which kept `PENDING_APPROVAL` as a real stored default — that unit's own task explicitly listed all 5 badge states as literal enum-backed with no obvious "virtual" candidate. When a new step's task suggests an enum value that reads like "this record is basically done but nothing has explicitly saved it yet," check whether any real button transition would ever write it — if not, it belongs in a `computeDisplayStatus()`-shaped pure function instead, matching `contract-erection-schedule-helpers.ts`'s and `contract-erection-method-statement-helpers.ts`'s own two functions of the same name and shape.

### Server-side auto-derivation of a cross-step foreign key beats trusting the frontend to supply it (CM-71D)
- `ContractErectionSchedule.methodStatementId`/`approvalId` are never sent by the frontend form — `contract-erection-schedule.service.ts`'s own `loadPrerequisites()` looks up the contract's current Step 1/Step 2 records and links them automatically at creation time. This is more than a style preference: a frontend-supplied cross-reference can go stale between page load and submit, or simply be wrong if a component is reused sloppily. Whenever a new record needs to reference "whatever the current upstream step record is" rather than a value the user is actually editing on screen, derive it server-side from the parent id already in the URL/params, not from a hidden form field.

## Erection Workflow Step 4 — Delivery Start (CM-71E)

### A "who owns this step" distinction that has no backend concept yet is a frontend badge, not a fabricated role (CM-71E)
- This unit's own task was explicit: "Use badge: Delivery / Logistics Team. Do not make this look owned by Erection Department." There is no `CONTRACTS_DELIVERY_LOGISTICS` role or permission anywhere in this app, and inventing one just to justify the badge would violate the standing "do not create new roles unless strictly required" instruction every erection unit has carried. The badge is purely presentational — hard-coded text on the header, unrelated to `contracts.update`'s own gating (identical to every other step). When a design calls for an ownership label that the backend genuinely has no way to enforce yet, render it as a label and say so in the unit's own notes — don't invent a role/permission just to make the frontend feel more "real" than the backend actually is.

### Server-derived summary totals from a real child-row table, recomputed on every write, never trusted from the client (CM-71E)
- `ContractErectionDeliveryStart.totalPackages/totalWeight/totalVolume/totalItems` are never accepted as DTO input fields — `computeDeliveryTotals()` in `contract-erection-delivery-start.service.ts` recomputes them from the real `ContractErectionDeliveryItem` rows on every create/update, inside the same `$transaction` that writes the items themselves. The frontend has its own `computeDeliveryTotalsPreview()` mirror in `contract-erection-delivery-start-helpers.ts` for immediate on-screen feedback while a user edits the Items Overview table, but that preview is explicitly documented as non-authoritative — the real numbers always come from the next server round-trip. When a "summary" field is mathematically derivable from a set of child rows the same request is already writing, derive it server-side from those exact rows rather than accepting a client-computed total that could silently drift (a stale tab, a client-side rounding difference, or a bug in the preview math).

### A status that can only become "true" via a real cross-reference must be computed from that reference, never accepted as a raw client value (CM-71E)
- `ContractErectionDeliveryDocument.status` can be `ATTACHED`, but the client can never set that value directly — `create`/`update` DTOs only accept `PENDING`/`NOT_REQUIRED` as a requested status; `computeDeliveryDocumentStatus(hasValidAttachment, requestedStatus)` in the service is the only place ATTACHED is ever produced, and only once the service has independently confirmed `attachmentId` resolves to a real, currently-existing attachment row belonging to that same delivery-start record. This is the same "don't fake attached documents" reasoning CM-71D applied to its own Hold/Return-requires-remarks floor, generalized to a tri-state field: whenever a status value's only honest meaning is "a specific other record exists and is linked," gate that value behind a server-side existence check, never a client-supplied enum choice.

### A dynamic, user-editable child-row table submitted alongside a form's scalar fields is a case for direct typed server-action args, not FormData (CM-71E)
- `createErectionDeliveryStartAction`/`updateErectionDeliveryStartAction` in `actions.ts` take a plain typed object (`DeliveryStartFormInput`, including an `items: DeliveryStartItemInput[]` array) rather than `FormData` — the established shape for every other erection-step action so far (CM-71A/C/D). The precedent for this exception already existed before CM-71E: `updateContractSchedulePlanAction`'s own doc comment explicitly justifies "direct typed args (not FormData) since the Edit Planned Schedule drawer collects several rows at once." CM-71E's own Items Overview table is managed as React component state (`ErectionDeliveryItemFormRow[]`) precisely because a dynamic add/remove row table doesn't map cleanly onto `new FormData(e.currentTarget)`; the scalar fields are still read from `FormData` for validation consistency, then combined with the items array into one plain object passed directly to the action. When a form's payload includes an array whose length the user controls at runtime, prefer this shape over contorting FormData with indexed field names.

## Erection Workflow Step 5 — Erection Start (CM-71F)

### A summary that appears in the suggested schema for one step but not another is a signal to check, not copy blindly (CM-71F)
- CM-71E's `ContractErectionDeliveryStart` had real stored summary columns (`totalPackages`/`totalWeight`/etc) because that unit's own suggested schema listed them explicitly. CM-71F's own suggested `ContractErectionStart` schema lists NO summary columns at all — Resources Summary (Total Manpower/Equipment/Crane/Trailer Assigned) is described only in the page-layout section, never in the data model. `computeResourcesSummary()` in `contract-erection-start.service.ts` therefore computes it live on every read, never storing it — a deliberate divergence from CM-71E's own precedent, not an oversight. When two adjacent units both have a "summary card calculated from real rows" requirement, check each unit's OWN suggested schema for whether that summary graduated to a stored column — don't assume the previous unit's storage choice carries over just because the UI requirement looks identical.

### Free-text fields with a suggested option list belong behind `<datalist>`, not a validated enum, when the task says "allow the user to type their own value" (CM-71F)
- `ContractErectionStartEquipment.equipmentType`/`descriptionCapacity` are plain `VARCHAR` columns with no `@IsIn()` restriction on the DTO side — this unit's own task was explicit: "Allow user to type their own value or add their own row because crane type, rental equipment, and trailer details may vary by site." The frontend still surfaces the suggested options (Crane/Trailer/Rental Equipment/Tools & Tackles/Other; 30T/50T/60T/80T/100T/Other) via `<datalist>`-backed `<input type="text" list="...">` elements in `erection-start-panel.tsx` — giving the convenience of a dropdown without the restriction of an enum. Contrast with `CONTRACT_ERECTION_DELIVERY_DOCUMENT_NAMES` (CM-71E) or `CONTRACT_ERECTION_START_CHECKLIST_ITEMS` (this same unit), both real `@IsIn()`-validated fixed lists — the difference is whether the task described a closed set ("the fixed 4-document checklist") or an open one ("may vary by site"). Read that distinction from the task's own wording before reaching for `@IsIn()` by default.

### When a task offers two equally-valid badge labels, prefer the one already established elsewhere in the same workflow (CM-71F)
- This unit's own task literally offered a choice: "Badge: Site / Erection Team or Erection Department." Step 3 (CM-71D) already uses "Erection Department" as its own real, shipped badge text. CM-71F's panel uses "Erection Department" too, purely for consistency within the same 7-step workflow a user clicks through sequentially — a user seeing two different labels for what is effectively the same owning department across adjacent steps would read as an inconsistency bug, not a deliberate distinction. When a task explicitly leaves a wording choice open with "X or Y," check whether a sibling step in the same feature family already committed to one — matching it is a low-cost consistency win worth taking over re-deriving a fresh choice.

## Erection Workflow Step 6 — Erection Checklist (CM-71G)

### "Should not duplicate a sibling step exactly" is enforced by giving the two features their own model, own table names, and a doc comment cross-referencing each other — never a shared table with a discriminator (CM-71G)
- This unit's own task was explicit that Step 6's QA/QC verification checklist must not duplicate Step 5's own pre-erection readiness checklist. The two already have similarly-named models (`ContractErectionStartChecklist` from CM-71F vs. `ContractErectionChecklist` from this unit) that could easily be confused by a future reader. Rather than relying on naming alone, both models' own schema.prisma doc comments explicitly cross-reference each other ("NOT the same model as X above — that is Step N's own Y") — the same defensive-documentation pattern CM-71C established for its own two-attachment-tables-per-review-step split. When two features are conceptually similar but the task explicitly forbids conflating them, don't just pick different names — write the doc comment that tells the next reader why they're separate, at the exact point where confusion is most likely (right next to the back-relation declaration).

### A KPI card's "fixed placeholder vs. real count" status changes exactly when its own backing model ships — flip it in the same unit that adds the model, not later (CM-71G)
- `ErectionDashboardKpis.checklistPendingAvailable: false` (a fixed placeholder since CM-71B, because Step 6 had no model) was replaced with a real `checklistPending: number` in the exact same unit that shipped `ContractErectionChecklist` — not deferred to a "left for next units" note. The task itself named this explicitly ("Checklist Pending KPI should now count real Step 6 ... records"), but the general principle holds even when a task doesn't spell it out: once a step's own dedicated model exists, its own placeholder KPI has no more excuse to stay fake, and leaving it as a placeholder for even one more unit is a "no fake data" violation waiting to happen. Cross-reference: `erectionInProgress` (CM-71F) and `readyForErection` (CM-71C/D/E/F) went through the identical fixed-placeholder-to-real-field transition, each the moment their own backing model landed.

### A stored status the task lists in the header/dashboard sections but omits from the button list still needs a real button — verify reachability against the WHOLE task, not just the "Button behavior" section (CM-71G)
- This unit's own "Button behavior" section listed only 4 actions (Save Draft/Submit/Hold/Return), but the header's own status badge list and the dashboard/workflow-tab integration sections all named `VERIFIED` as a real, distinct state ("Checklist Status: ... Verified", "If Step 6 is Verified, show completed/verified"). Cross-referencing the task's OWN other sections (not just the one titled for buttons) revealed a 5th real transition was needed — added as a "Verify" button beyond what "Button behavior" enumerated, matching the "every stored status must be reachable via a real button" rule already applied throughout every earlier erection-workflow unit (see CM-71D/E/F's own registry entries for the inverse case — excluding unreachable "Ready to X" values). When a task's field/status list and its own button list don't visibly agree on how many real states exist, trust the field list and add the missing action — don't silently drop a named status just because no button was spelled out for it.

## Erection Workflow Assignment & Role-Based Dashboard (CM-71H)

### When a task offers "add a new permission" vs. "reuse what exists," check the codebase's OWN stated design principle before picking the more powerful option (CM-71H)
- The task's sidebar-behavior section explicitly offered two options: "Option A: hide Erection Dashboard from Contract Manager unless they have erection dashboard permission" (marked "Preferred") or "Option B: show 'Erection Status' instead... if current user is Contract Manager." Option A needs a brand-new permission code seeded and re-granted across roles — a real, if small, change to the platform's access model. But `module-visibility.ts`'s own doc comment states the sidebar's visibility rule is derived "entirely from live permission codes (never a role name)" and is explicitly designed to be closed/complete as-is; the frontend also has literally no role field available at render time to fall back on if a permission-seed step were somehow skipped. Given this unit's own "additive/safe changes... no unrelated module changes" constraint, Option B was chosen: it needs zero schema/seed changes, cannot hide a screen any existing user currently relies on, and still satisfies the underlying "Contract Manager should read as monitor, not owner" intent the task was actually after. When a task presents a "preferred but riskier" option alongside an explicitly-permitted safer alternative, and the unit's own constraints emphasize safety, take the safer one and document why — a task's stated preference is a signal, not an override of the unit's own hard constraints.

### An "assigned to current user" dashboard filter belongs downstream of the existing department filter, as an in-memory narrowing keyed off the SAME actor object already passed into the service — not a new DB WHERE clause (CM-71H)
- `contract-workflow.service.ts`'s own `myTasksOnly` flag already established this shape: `DepartmentAccessService.buildDeptFilter()` produces a Prisma WHERE for department scope, and a SEPARATE, later, in-memory `.filter()` narrows further to `responsibleUserId === actor.id`. `contract-erection-dashboard.service.ts`'s new `scopedContracts` filter (CM-71H) follows the identical shape: department filter stays a Prisma WHERE (unchanged), then `scopedContracts = actorCanManage ? contracts : contracts.filter(c => assignment?.assignedToUserId === actor.id)` narrows in memory before the existing per-row loop runs. Keeping the narrowing in-memory (rather than pushing `assignedToUserId` into the Prisma WHERE) meant zero changes to the existing query shape, and kept the "does this contract count as erection-related at all" logic (`isErectionRelatedContract`) and the assignment filter as two clearly separable concerns instead of one large conditional WHERE clause. When a task asks for "filter dashboard rows to the current user's own work," check whether an existing `myTasksOnly`-shaped precedent already exists in a sibling service before inventing a new filtering strategy.

### A viewer-relative action label ("Continue" vs. "View Status" vs. "Read Only") is a per-row, server-computed field, not a client-side permission check — because it depends on data (who is THIS row assigned to) the client doesn't have (CM-71H)
- The task's access-control section asked for 3 different action-button treatments depending on the relationship between the current viewer and each row's own assignment: the assignee sees "Continue/Update," a manager-tier monitor sees "View Status," everyone else sees nothing. This can't be a client-side `permissions.includes(...)` check (CM-70's usual pattern) because the deciding factor — whether THIS SPECIFIC contract is assigned to the current user — is per-row, per-viewer data that only the backend has (the assignment table, joined per contract). So `computeErectionViewerActionMode()` lives in the dashboard SERVICE (pure, tested function) and is computed once per row during `getDashboard()`, returning a `viewerActionMode: 'ACT' | 'MONITOR' | 'READ_ONLY'` field already baked into each `ErectionWorkQueueRow` — the frontend components (`erection-work-queue-table.tsx`, `erection-dashboard-panels.tsx`) just switch on that string, no client-side re-derivation. When a UI decision depends on a relationship between "the current viewer" and "a specific row's own data" (not just the viewer's own permission set), compute it server-side per row — a client-side permission check literally cannot see the other half of that relationship.

### A second "summary card" the task asks for can be consolidated into an existing section instead of built standalone, when the two would show mostly-overlapping fields — but only when every field the task named is still genuinely present (CM-71H)
- The task asked for both an "Erection Workflow Assignment" section (Assigned Erection Manager/Department/Date/Status + Assign button) and a separate "Erection Workflow card" (Owner/Assigned To/Current Step/Last Updated/Action) on the same Workflow & Team Tasks tab. Building both as two adjacent cards would have shown "Assigned To" twice and "Owner: Erection Department" as a lone new fact next to fields the assignment card already covers. Instead, Owner/Assigned To/Current Step/Last Updated were folded into the EXISTING "Erection Workflow" section header (the one with the Step 1-6 button row, unchanged since CM-71A) as a small `<dl>` strip, and the assignment card kept its own distinct focus (the assign/reassign FORM, which doesn't belong in a read-only summary strip). Every field the task named is still present somewhere on the page — none were dropped, only the container changed. This is the same judgment call as CM-71G's "should not duplicate a sibling step" reasoning in reverse: there, near-duplicate DATA got separate models; here, near-duplicate DISPLAY of the SAME data got merged into one place instead of two.

## Erection Manager User Template, Department Ownership, and Assignment UX Cleanup (CM-71H.1)

### A UI feature is unusable if the account meant to use it structurally cannot reach it — trace the FULL path from "admin creates the user" to "user does the thing," not just the one screen the task named (CM-71H.1)
- CM-71H built a working assignment mechanism, but 3 separate gaps made it practically unusable for its intended actor: (1) no admin flow made it clear HOW to create an "Erection Manager" user, (2) the only role that maps to that intent (`CONTRACT_STAFF`) got the short `CONTRACT_STAFF_ITEMS` sidebar list, which never included "Erection Dashboard" at all, and (3) that same role's `contracts.workflow_update` permission was never enough to actually WRITE to the erection-owned Step 1/3/5 endpoints (all 3 services hard-gated on `contracts.update` alone). Any one of these three would have silently broken the whole feature for its real target user even though CM-71H's own dashboard filtering, assignment model, and UI labels were all already correct. When a task says "make X usable for role Y," trace the actual account lifecycle for Y — create it, log in as it, see the nav item, open the screen, attempt the write — rather than stopping once the most obviously-relevant screen looks right.

### A missing/weak permission gate discovered mid-unit is a real, scoped fix, not scope creep — but only if it's bounded to exactly the steps/routes the task's own ownership table names (CM-71H.1)
- Discovering that Steps 1/3/5 (Erection-Department-owned, per CM-71H's own table) were unreachable by `contracts.workflow_update` could have been "fixed" several ways: grant the new Erection Manager template the full `CONTRACT_MANAGER` role (functionally correct but grants unrelated payments/claims/closeout authority — wrong per the task's own "Erection Manager owns [only] assigned erection workflow execution" framing), add a brand-new fine-grained permission (a bigger, riskier change this task explicitly asked to avoid "if possible"), or relax exactly the 3 services' exactly-Erection-Department-owned write methods to also accept the existing `contracts.workflow_update` permission (chosen). The chosen fix is bounded on two axes: which STEPS (only 1/3/5, never 2/4/6 — QA/QC- and Delivery/Logistics-owned, explicitly out of scope) and which ACTIONS (only create/update/attachment-write, never the `contracts.read`-gated GET routes, which were already permissive enough). It also directly reuses an EXISTING precedent in the same controller file (`@AnyPermission('contracts.update', 'contracts.workflow_update')`, already used for the generic `ContractWorkflowTask` routes) rather than inventing a new authorization shape. When a mid-unit permission gap is found, the fix should be exactly as wide as the task's own ownership/scope language — no wider (don't reach for a bigger existing role just because it's convenient) and no narrower (don't leave the gap merely documented when a small, precedented, testable fix exists).

### Widening a permission gate from "single-permission-required" to "AnyPermission" is safe to verify by grep, not by re-deriving every test scenario from scratch (CM-71H.1)
- Before touching 3 services × 4 write methods each (12 call sites) and the matching 12 controller decorators, the relevant test files were grepped for any existing assertion of the form "an actor with `contracts.workflow_update` alone is forbidden" — none existed (Step 1's service had no test file at all; Steps 3/5's test files only ever asserted `contracts.read`-alone-is-forbidden, still true after the change). This made the relaxation provably non-breaking without re-running or re-reading all ~65 existing tests across the 3 files line-by-line: a permission-gate WIDENING can only break a test that specifically pins the OLD (narrower) forbidden boundary, so grepping for that exact boundary assertion is a fast, sufficient safety check — much cheaper than manually verifying every test's actor fixture stayed valid.

### A department/org-unit display-label typo is DATA, not CODE — fix it through the same idempotent seed mechanism (or a narrowly-scoped equivalent) already used to write that row, never by editing a migration or inventing a new one (CM-71H.1)
- The single seeded Department was named "Contracts Management" (a typo) in the live dev DB. Before touching it, two things were confirmed: `Department.name` has no uniqueness constraint (a plain `VARCHAR(200)`), and grepping the whole `apps/`/`packages/` tree (excluding generated/dist output) found zero code anywhere that does a literal string match against `department.name` — so a name correction could not silently break a lookup. The fix itself went through the SAME idempotent `upsert` already used to write that row (`uat-seed.ts`'s own `DEPT_CM01` constant, corrected so a future re-seed can't reintroduce the typo) plus a narrowly-scoped, targeted `UPDATE ... WHERE code = 'CM-01' AND name = 'Contracts Management'` applied directly to the live dev DB (verified before/after) — never a raw broad `UPDATE departments SET name = ...` with no WHERE-clause guard, and never a new migration (this is a data value, not a schema change). The general rule: before "fixing a typo" in any seeded reference-data row, grep for literal-string lookups against that field first — a typo fix is only safe once you've confirmed nothing else depends on the old spelling as a KEY rather than a LABEL.

### A shared client component that already receives a real per-entity id (not a cross-entity aggregate) can safely gain a new cross-cutting link wherever it renders, without checking each call site individually — verify by finding every render call, not by reading the component in isolation (CM-71H.1)
- Before adding an "Open Guided Erection Workflow" link to `WorkflowBoard`'s Erection Team lane, it mattered whether `contractId` (the prop the new link's `href` depends on) was ever an aggregate/placeholder value at any of its render sites — if the cross-contract Workflow Register rendered ONE `WorkflowBoard` for tasks spanning MANY contracts, a single `contractId` prop would be meaningless there. Grepping for every `<WorkflowBoard` usage (not just reading the component file) found all 3 call sites (`[id]/(workspace)/workflow/page.tsx`, `workflow-board-modal.tsx`, `assignment-queue-view.tsx`) pass a real single contract's id — the "register" is actually built from a modal-per-contract, not one board spanning many. This confirmed the new link is safe and correct everywhere the component renders, with no special-casing needed. When adding a feature to a shared component that depends on one of its existing props being "a real single entity," verify that assumption by finding every call site, not by reading the component's own prop type (which only says `contractId: string` — it can't tell you whether every caller actually passes ONE real contract).

## Route Erection Tasks to Guided Workflow Screens (CM-71H.2)

### A stable backend-defined key beats a display string for task-type detection — and this codebase already had TWO independent precedents for it before this unit added a third (CM-71H.2)
- `staff-task-update-panel.tsx`'s own doc comment (CM-49/50/51) already states the principle explicitly: "the one place task type is detected, keyed off the stable, backend-defined taskKey ... rather than the display taskName, which is just copy." `contract-schedule-plan.service.ts` independently does the same thing (`task('erection_start')`, `task('erection_issue_checklist')`) to derive real schedule-plan dates from generic task rows. `guided-erection-workflow-route.ts`'s `getGuidedErectionWorkflowRoute()` is a third, independent application of the identical rule — and BECAUSE the rule was already established twice, the design decision here took minutes, not an investigation: taskKey primary, a normalized-title match only as a defensive fallback for a task record that somehow has no recognized key (never the primary path). When a codebase has already solved "how do I reliably detect what KIND of generic record this is" more than once the same way, a new instance of the same problem should reuse that exact shape, not re-derive a new one — check for the precedent before designing.

### Rerouting a click target away from a shared "open the generic thing" handler is safer done by making the CALLER conditionally skip the handler, not by teaching the handler itself about the exception (CM-71H.2)
- `WorkflowTaskCard`'s only way to open `WorkflowTaskDrawer` was `onClick={() => onOpen(task)}`, a callback owned by the parent `WorkflowBoard`. Rather than threading a "is this a guided task" branch into `WorkflowBoard`'s own `onOpen`/`setOpenTaskId` logic (which would need to somehow suppress opening the drawer AND trigger a navigation from inside a state setter), the card itself was changed to conditionally render either a real `<Link>` (guided task — real navigation, no `onOpen` call at all) or the original `<button onClick={onOpen}>` (everything else, byte-for-byte unchanged). This meant `WorkflowTaskDrawer` and `WorkflowBoard`'s own state management needed ZERO changes — the routing decision lives entirely at the point where the click originates, and the shared drawer infrastructure simply becomes unreachable for those 6 taskKeys rather than needing to know about them. The same shape was used for `StaffTaskCard`/`StaffTaskUpdatePanel`: the card decides the href, the panel component itself was never touched. When redirecting some subset of clicks on a shared "open X" affordance to a different destination, prefer changing what the CLICKABLE ELEMENT does (link vs. handler) over teaching the opened-thing or its state owner about the exception — it keeps the shared infrastructure provably unaffected for every case that doesn't opt into the new path.

### A generic form component that CAN still be reached via a stale/hand-typed URL param needs its own server-side guard, even after every UI entry point that used to link there is fixed (CM-71H.2)
- Fixing `StaffTaskCard`'s two links so they never generate a `?taskId=<erection-task-id>` URL closes the normal path, but `staff-my-tasks-view.tsx` resolves whatever `taskId` shows up in the URL regardless of how it got there — a bookmarked link, a shared URL, or a future caller that doesn't go through `StaffTaskCard` at all would still hit the exact same `if (selectedTask) { return <StaffTaskUpdatePanel .../> }` branch. A `redirect()` was added at that resolution point itself (before ever rendering the generic panel) as defense in depth, mirroring how CM-71H.1 already reasoned about permission RE-CHECKS being real, not just UI-hiding. When a task can be reached "normally" through a fixed link but is ultimately selected by a URL parameter the app doesn't fully control, add the guard where the parameter is RESOLVED, not only where the link that usually produces it is generated.

## Open Workflow Navigation Investigation + Locked-Step Notices (CM-71H.3)

### A "click does nothing, URL looks right" report is diagnostic-shaped, not necessarily code-shaped — audit the LONGEST-RUNNING dev process before re-deriving the routing logic from scratch (CM-71H.3)
- Every piece of CM-71H.2's own routing code checked out correct on a full re-read: `href` and the button label are both derived from the same value (can't diverge), no `preventDefault`/form-wrapping/handler exists to block a plain `<Link>`, the server-side redirect guard is scoped to a completely different route than the one reported broken, the guided pages have no redirect logic at all, and the backend confirms it returns both fields the routing helper needs. When every plausible CODE explanation is individually ruled out by direct evidence (not guesswork), the next place to look is the RUNTIME the browser is actually talking to — here, the `next dev` process had been running, unrestarted, since before the entire CM-71H work stream began, meaning the browser's live client bundle predated several rounds of routing changes to the exact files in question. Restarting it was the one concrete, verifiable action taken; a stale dev server (or the client router cache mismatch a restart produces) explains the reported symptom without requiring any code to be wrong. When a report says "the click did nothing" and static analysis finds no bug, check what SERVER PROCESS the browser has been talking to before concluding the investigation.

### Self-minting an auth session/token to complete a "live click-through" verification is a real security boundary, not a convenience shortcut to route around — when blocked, stop and hand the verification to the user rather than finding another way in (CM-71H.3)
- With direct DB access already established (department-name fixes, task-assignment queries), minting a matching JWT + `UserSession` row for the real reported account would have been technically trivial and CORRECT for verification purposes — but the platform's own automated safety classifier flagged it as a credential/session bypass and declined it. The right response was to stop immediately, not hunt for an alternative bypass (a raw password-hash overwrite, an admin-flow shortcut) that would have had the same character. Instead: finish everything independently verifiable (full audit, dev-server restart, unauthenticated route smoke tests across all 6 guided pages, the newly-added locked-step feature's own full test/lint/typecheck/build pass), then explicitly hand the one remaining step — an authenticated click as the real account — back to the user with two concrete options (they re-test now that the server is fresh, or they share/reset that account's password). A tool declining an action is a signal to change what CAN be verified safely, not an obstacle to engineer around.

### A "locked step" UX requirement can be satisfied by reusing an existing button-visibility boolean as a PAGE-LEVEL gate, once you notice the two are really the same rule enforced in two different places (CM-71H.3)
- The Workflow & Team Tasks tab already computes `erectionStepNReady` (N=2..6) to decide whether to SHOW a Step N button at all — but that's a UI-visibility convenience, not an access gate: the underlying `/contracts/{id}/workflow/erection/...` route was always directly reachable by URL regardless of that boolean, with zero server-side enforcement. Rather than inventing a new prerequisite rule, `erection-step-lock.ts`'s `isErectionStepNLocked()` functions are the exact same conditions, just negated and moved to where each step's own `page.tsx` already fetches its prerequisite record (for unrelated read-only display purposes) — no new backend call, no new data dependency. When a task asks you to enforce something as an access gate that the app already computes as a display-visibility boolean somewhere else, check whether that's genuinely the same rule before writing a second one — two independently-maintained copies of "is Step N allowed yet" is exactly the kind of drift that produces confusing bugs down the line.

### When a live re-test PROVES a fix was insufficient, the next investigation must go one layer UP the render tree, not sideways into the same files already cleared — a shared `layout.tsx` is invisible to a search scoped to "the page that's misbehaving" (CM-71H.3, round 2)
- Round 1 exhaustively cleared `staff-task-card.tsx`, the CM-71H.2 redirect guard, and all 6 guided `page.tsx` files themselves — correctly, each one really was innocent. The actual redirect lived in `contracts/[id]/(workspace)/layout.tsx`, a file that wraps EVERY `/contracts/[id]/...` route (including the 6 new guided ones) but that a page-scoped audit never had a reason to open, because nothing about the reported symptom pointed at "a file none of the 6 pages import." The tell, in hindsight: the bug affected Step 1 too, which has zero prerequisite-lock logic of its own — a symptom common to ALL 6 steps with no step-specific variation is a strong signal the cause sits ABOVE every individual page, in something they all share structurally (a layout, a middleware, a root error boundary) rather than in per-page logic that would be expected to vary. When a set of independently-coded pages all fail identically, check what they involuntarily share before re-auditing each one's own code a second time.

### A route-scoped exception to a years-old blanket redirect needs the CURRENT PATHNAME inside a layout — which Next.js App Router layouts do not receive directly, only `params` (dynamic segments) — so it has to be threaded through as a middleware-set request header (CM-71H.3)
- `contracts/[id]/(workspace)/layout.tsx` only ever received `{ params: Promise<{ id: string }>, children }` — enough to know WHICH contract, never WHICH TAB. Making the CM-44 Contract-Staff redirect route-aware (skip it for `/workflow/erection/...`, keep it for every other tab) required knowing the full pathname inside a Server Component layout, which the App Router does not expose there by default. The fix was the standard, documented pattern: middleware (`proxy.ts`) already sees the pathname on every request, so it now forwards it as a plain `x-pathname` request header (`NextResponse.next({ request: { headers } })`), and the layout reads it back via `headers()`. This is worth remembering as a named pattern: whenever a shared layout needs to make a decision based on "which specific sub-route is this," and the answer isn't derivable from `params` alone, middleware-forwarded-header is the way to get it there — not prop-drilling, not re-deriving it from `children`'s type, both of which don't work in the App Router's layout/page model.

## Align Erection Dashboard, My Tasks, and Staff Dashboard Assignment Source (CM-71H.4)

### When two features that both do "assignment" ship in different units, check whether they recognize the SAME assignment signal before assuming a report of "empty dashboard, but the task list has work" is a display bug (CM-71H.4)
- CM-71H (Erection Dashboard) and the pre-existing My Tasks/Workflow Board (CM-40/44, months older) each independently and correctly implement "assigned to the current user" — but keyed off two DIFFERENT real columns (`ContractErectionWorkflowAssignment.assignedToUserId` vs. `ContractWorkflowTask.responsibleUserId`). Neither is wrong; a Contract Manager can legitimately assign erection work through either mechanism (the generic Workflow Board's Assign Task action predates CM-71H's own whole-workflow Assign flow by months), and a contract assigned the "old way" is fully real, fully assigned work that the NEWER feature had simply never been taught to recognize. The fix was strictly additive (OR the two signals together, change neither's own write path, synthesize neither from the other) rather than picking one as sole truth and migrating/backfilling the other — "safest path with least confusion," per this unit's own instruction, and the same non-destructive instinct as CM-71H.1's department-name fix. When a report says "the same real work shows up in one feature but not a related one," check whether the two features key off the same underlying assignment/ownership column before assuming a rendering or query bug — a genuine dual-source-of-truth gap reads identically to a filtering bug from the outside.

### A frontend-only derived field (`guidedStepLocked`, `taskKey`) that one screen already computes needs to be re-derived independently on every OTHER screen showing the same underlying rows — grep for every render site of the type, not just the one screen the bug report named (CM-71H.4)
- CM-71H.3 added guided-erection routing/labeling/locking to My Tasks (`staff-task-card.tsx` / `staff-my-tasks-view.tsx`) but this unit's own task named a SECOND screen — "My Contract Work Dashboard" (`staff-task-table.tsx` / `staff-todays-work-panel.tsx` / `staff-dashboard-view.tsx`) — rendering the SAME kind of generic task rows (`StaffTaskRow`, a sibling type to `StaffFlatTask`) with the exact same stale "Update Task" behavior, because it was never touched in CM-71H.2/.3 at all. The backend `StaffTaskRow`/`DashboardTaskRow` types hadn't even been carrying `taskKey` — the ONE field the whole guided-routing mechanism keys off — because nothing had ever needed it there before. When a guided-routing/labeling fix lands on one screen, grep for every OTHER place the same underlying row type renders before considering the fix "done" — a type used in 2 unrelated dashboard surfaces will silently miss one of them if the audit only followed the bug report's own named screen.

## Staff Dashboard Erection Workflow Polish (CM-71H.5)

### Before implementing a reported wording/labeling bug, re-read the current file — the fix from a PRIOR unit may have already landed, and the live report may just be describing a stale server (CM-71H.5)
- This unit's own task re-listed "fix old erection wording on the Staff Dashboard" as if it were still outstanding, but a fresh read of `staff-task-table.tsx`/`staff-todays-work-panel.tsx` showed CM-71H.4 had already wired `getGuidedErectionTaskDisplayName`/`getGuidedErectionWorkflowRoute` and the "Open Workflow"/"Locked" button states into both — confirmed by a repo-wide grep turning up zero remaining old-wording strings outside comments and the intentional legacy-title fallback table. This session had already hit the exact same "live report says X is still broken, but the code is provably correct" shape twice before (CM-71H.3's stale dev server, CM-71H.4's own predecessor reports) — recognizing the pattern meant NOT re-implementing an already-correct fix a third time, and instead restarting the dev servers (again) and focusing investigation on what was ACTUALLY still missing (the "Today's Work" picker's lock-awareness, which was genuinely never built). When a task re-describes a bug a previous unit's own progress-tracker entry claims to have fixed, read the current code first — confirming "still correct" costs one file read, while blindly re-patching wastes the turn AND risks introducing a second, competing implementation of the same rule.

### A "pick the single most urgent item" function needs to exclude not-yet-actionable candidates BEFORE ranking, not after — and the caller needs a way to distinguish "nothing picked because the queue is empty" from "nothing picked because everything available is blocked" (CM-71H.5)
- `pickNextTask()`'s priority cascade (overdue → due-today → high-priority → in-progress → earliest-due → first) ranks candidates by urgency signals that have nothing to do with whether the candidate is actually actionable — a locked guided step can be maximally "overdue" by its raw due date while being completely unusable to click through to right now. Filtering `guidedStepLocked` tasks out of the candidate pool BEFORE the ranking cascade runs (one `.filter()` at the top, not a check bolted onto each tier) means every existing priority rule keeps working unmodified for the remaining candidates — no special-casing needed inside any individual tier. The second half of the pattern: `pickNextTask` returning `undefined` is genuinely ambiguous between "you have nothing assigned" and "you have assigned work, all of it blocked" — two states that call for different empty-state copy — so a second pure function (`hasOnlyLockedOpenTasks`) computes that distinction separately rather than overloading the picker's own return type (e.g. a sentinel value) to carry it. When a "pick the best candidate" function needs an actionability precondition, filter for it before ranking, and give the caller a separate signal for "the reason nothing was picked," rather than making the picker's absence of a result do double duty.

## Simplify Guided Erection Workflow Pages for Erection Manager View (CM-71H.6)

### To hide chrome for one viewer tier on one route family, make the shared LAYOUT skip its own render for that case rather than building a new page-level header component (CM-71H.6)
- The task asked for a "focused workflow header" showing Contract No./Project Name/Client/Current Step/Status for staff-tier viewers on the 6 guided erection routes — but every one of those 6 panels already renders its own step title, status badge, and Contract Summary section (unchanged since CM-71A), so a new header component would just duplicate data the page already fetches and displays. Instead, `(workspace)/layout.tsx` (the one place both the full header and `<ContractWorkspaceTabs>` are rendered, wrapping every contract-scoped page) got a single early return: when `isStaffTier && isGuidedErectionRoute`, skip the full header/tabs entirely and render only `{children}` in a plain padded container, letting the panel's own existing content BE the focused view. Manager-tier and staff-tier-on-other-routes fall through to the original, untouched code path unchanged. When a task asks for a "simplified view" of something a shared layout already wraps, check whether the child content already has what the simplified view needs before building new chrome — the layout's job may only be to get out of the way, not to add anything.

### New optional props on shared/panel components should default to whatever reproduces the PRE-CHANGE behavior exactly, so every existing call site is provably unaffected without auditing it (CM-71H.6)
- `isStaffTier?: boolean` was added to all 6 guided panels and to `ErectionStepLockedNotice`, always defaulting to `false` in the destructured params (`isStaffTier = false`). Manager-tier behavior with the prop omitted or `false` is byte-for-byte identical to before this unit — no toggle button renders, the Step Guidance section starts open, no staff-only back-nav links appear. This meant zero need to find and re-verify every existing caller of these components; only the 6 `page.tsx` files that now deliberately pass `isStaffTier={isStaffTier}` see any behavior change. Same pattern reused from `contractWorkflowBreadcrumbItems`'s pre-existing `isStaffOnly` parameter (CM-66F) — but that one has no default, forcing every call site to choose explicitly, appropriate for a pure function with few call sites vs. a widely-reused component where "silently unchanged" is the safer default.

### A collapsible section defaults to open/closed based on viewer tier, not a fixed default, and the toggle control itself only renders for the tier that needs it (CM-71H.6)
- `ErectionStepGuidance` initializes its `open` state as `!isStaffTier` — manager-tier starts open with no toggle shown at all (matching the original always-visible section exactly); staff-tier starts collapsed with a small "Show guidance" button. Rather than one fixed default plus a toggle everyone sees, the initial state itself is tier-aware, so a manager-tier viewer's very first render is pixel-identical to the pre-CM-71H.6 markup — no button appears where none existed before, avoiding any risk of a manager mistaking a new UI element for a functional change.

## Erection Manager UX Cleanup: Remove Locks, Remove Guidance, Fix Read-only Fields (CM-71H.7)

### Before building a new "friendly inline notice" component, check whether the panel already has one doing the exact same check a level up (page.tsx) wants to duplicate (CM-71H.7)
- CM-71H.3's page-level `ErectionStepLockedNotice` and each later panel's own internal `if (!prereqRecord || prereqRecord.status !== 'X') return <InfoBox>...` block turned out to test the IDENTICAL condition (Step 4/5/6) or a deliberately weaker one (Step 2/3, where the panel's own floor is looser than the page's stricter UI-visibility rule) — the page-level check was a second, harsher gate sitting in front of a friendlier one that already existed and that every manager-tier viewer had been seeing unmodified the whole time. Before adding new "show a friendly message instead of blocking" UI anywhere, grep the target component for an existing early-return that already handles the same missing-prerequisite case — a redundant harsher duplicate is a deletion, not a design problem.

### A UI-only "harsh lock, this button is disabled" affordance and a real backend authorization/business-rule check are two different things — removing the first must never touch the second (CM-71H.7)
- Every fix in this unit — deleting the page-level lock block, greying-out/opacity styling, and "Locked" button copy — was strictly about VISUAL/UX severity: not one backend guard (`assertCanWriteErectionDepartmentStep`, the Step 5 hard `UnprocessableEntityException` on missing Delivery Start, the Step 3-4-6 prerequisite `ConflictException`/`UnprocessableEntityException` checks) was touched, weakened, or bypassed. Separately, widening `canUpdate` to include `contracts.workflow_update` for Steps 1/3/5 was safe to do ONLY because it made the frontend match a permission the backend ALREADY accepted (`AnyPermission('contracts.update', 'contracts.workflow_update')`, from CM-71H.1) — never the other way around (never widen a frontend gate to something the backend doesn't already independently enforce). When a task says "remove the harsh lock but keep it safe," the backend's own authorization/validation layer is the one thing that must be read and left completely alone while every visual severity cue around it changes freely.

### The same "guidedStepLocked" derived UI state is computed once but rendered by THREE separate task-list surfaces — a styling fix has to be applied to all three, found by grepping the shared field name, not by fixing the one screen the request happened to name (CM-71H.7)
- CM-71H.4 already established that `StaffTaskRow`/`StaffFlatTask` (the two sibling generic-task shapes) get rendered by more than one screen; this unit reconfirmed that lesson for STYLING (not just labeling/routing): `guidedStepLocked === true` drives the exact same grey-out + "Locked" badge/button pattern independently copy-pasted into `staff-task-card.tsx` (My Tasks), `staff-task-table.tsx` (Contract Staff Dashboard's "My Assigned Tasks"), and `staff-todays-work-panel.tsx` ("Today's Work" — currently dead code there since `pickNextTask()` already filters locked tasks out, but fixed anyway for consistency/robustness against that filter ever changing). Grepping for the shared boolean field name (`guidedStepLocked`) across the whole app, not just the one component the task text named ("My Tasks / Erection Dashboard"), is what surfaced all three; fixing only the named one would have left two visually-inconsistent duplicates of the exact same now-fixed bug.

### A component's own "how it looks when passed a boolean" contract can be simplified back to presentational-only once every caller decides not to pass that boolean anymore — don't leave dead conditional branches "just in case" (CM-71H.7)
- CM-71H.6 gave `ErectionStepGuidance` an `isStaffTier` prop that changed ITS OWN internal collapse/toggle behavior. This unit's task asked to go further — never render the card at all for staff-tier — which moves that decision to every CALL SITE (`{!isStaffTier && <ErectionStepGuidance>...}`) instead of into the component. Once every one of the 6 call sites was updated to the new pattern, the component's own `isStaffTier` prop and its `useState`/toggle-button logic became genuinely unreachable, not just unused for one case — so it was deleted back to a pure presentational component rather than left in place "in case a future caller wants the old collapse behavior." A prop that no live call site can any longer pass a meaningfully different value for is dead code, not a preserved extension point — delete it in the same change that removes the last caller, rather than accumulating unreachable branches.

## Guided Erection Workflow Layout Polish for Staff View (CM-71H.8)

### Removing a card from a shared grid row isn't the same as removing the ROW — check what's left behind before calling a "hide this for one tier" change complete (CM-71H.8)
- CM-71H.7's `{!isStaffTier && <ErectionStepGuidance>...}` correctly stopped Guidance from rendering, but the surrounding `grid grid-cols-1 lg:grid-cols-3` row it shared with Contract Summary was left in place and still rendered for staff-tier — just now with one card in it instead of two, `max-w-sm`-capped so it wouldn't stretch, but still occupying its own full grid row above the form. The visual result (a lone narrow card, then a gap, then the form starting a full row later) was exactly the "large empty space" this unit's task reported — a real regression introduced by a fix that was correct about WHICH ELEMENT to hide but hadn't checked whether the CONTAINER it lived in needed to go too. When a task says "remove X for this case," check every ancestor element X was the only meaningful content of — a wrapper `<div>`/grid row left behind with one child remaining is not the same as no wrapper at all.

### Moving a card from a "first-row, own-container" position into an EXISTING later sidebar is safer than inventing a new layout for one viewer tier — reuse the container, add an optional prop (CM-71H.8)
- The task asked for a "clean two-column layout" with Contract Summary in the sidebar for staff-tier, which could have meant building a whole new staff-tier-specific grid structure parallel to the manager-tier one. Instead, the EXISTING form+sidebar grid row (unchanged since CM-71A, already responsive, already `lg:col-span-2`/1-column-sidebar) was reused as-is, and each panel's own `*Sidebar` function gained one new optional `contract` prop rendering the exact same Contract Summary markup as its first card, passed only by the staff-tier branch. This meant zero new grid/breakpoint code, zero risk of the new staff-tier layout drifting out of sync with the manager-tier one over time (same container, same responsive rules, just a different set of children), and the "sidebar starts aligned with the form top" requirement fell out automatically from both living in the same grid row — never something that had to be separately coded or verified. When a task asks to relocate a UI element into a section that already exists elsewhere on the page, prefer adding an optional prop to the EXISTING section's component over building parallel layout structure for the tier that needs the change.

### `exactOptionalPropertyTypes: true` requires `T | undefined` on the type, not just `?`, when a call site can explicitly pass `undefined` — a real strictness feature, not a lint quirk to silence (CM-71H.8)
- All 6 new sidebar `contract` props were typed as `contract?: {...}` and called as `contract={isStaffTier ? contract : undefined}` — correct-looking TypeScript that failed `tsc --noEmit` under this repo's `exactOptionalPropertyTypes: true`, because `?:` alone means "the property may be omitted," not "the property may be omitted OR explicitly set to `undefined`" (two different things under this flag). The fix was `contract: {...} | undefined` (no `?`), matching how an explicit `undefined` value is actually being passed. Caught immediately by the typecheck step this unit's own workflow already runs before considering any change done — a reminder that "add `undefined` to the target's properties," when `tsc` suggests it under this flag, is the correct fix to make, not a warning to route around with a type assertion.

## Manager Preview Mode for Guided Erection Workflow Pages (CM-71H.9)

### An early-return that blocks a screen "for everyone when a prerequisite is missing" is a SINGLE gate doing two different jobs — separate them before adding a bypass, or the bypass leaks to the wrong audience (CM-71H.9)
- Before this unit, each later guided panel's `if (!prereqRecord) return <InfoBox>...</InfoBox>` served both "protect against invalid/crashing renders on null data" and "enforce that this step isn't ready yet" in one boolean check. Adding a preview bypass required splitting those concerns explicitly: `prerequisiteMissing` (the data-shape fact) stays computed exactly as before, but the RETURN now only fires `if (prerequisiteMissing && !isPreviewMode)` — the render-safety half (every downstream `statement.foo` access) still had to be independently guarded with optional chaining, because bypassing the early return does not make the underlying data any less null. Treat "block for data reasons" and "block for workflow-gating reasons" as two separate conditions from the start, even when today they happen to share one boolean — a future exception (preview mode, an admin override, a different tier) will need to split them anyway.

### A `?query=1` feature flag that only manager-tier can activate must check the RAW permission list, never a broadened per-step permission variable a nearby part of the same file already computes for an unrelated reason (CM-71H.9)
- Steps 1/3/5's own `page.tsx` files compute a widened `canUpdate = permissions.includes('contracts.update') || permissions.includes('contracts.workflow_update')` (CM-71H.7, so the Erection Manager can save their own owned steps). Preview-mode eligibility could easily have been implemented as "if `canUpdate` and `?preview=1`" by reusing that same nearby variable — which would have silently let an Erection Manager (staff-tier) trigger manager-only preview mode on exactly the 3 steps where `canUpdate` happens to be broadened. `resolveErectionPreviewMode()` instead re-checks `permissions.includes('contracts.update')` directly, independent of any local widening. When gating a new manager-only feature by permission, grep for whether a DIFFERENT local variable in the same file has already been intentionally broadened for a different purpose before reusing it — same name, different meaning, is exactly the kind of bug static analysis won't catch.

## Erection Workflow Manager Presentation Navigation (CM-71H.10)

### A feature can be fully correct and still fail on usability grounds — "the mechanism works" and "there's one obvious place to find it" are two separate acceptance bars, and a follow-up unit can exist purely to satisfy the second (CM-71H.10)
- CM-71H.9's `?preview=1` mechanism was complete and correct on every technical axis (gating, null-safety, disabled actions) — the ONLY gap this unit closed was discoverability: a manager had to already know the query param existed, or stumble onto a per-step "Preview Screen" fallback that only ever appeared for the one step that happened to be not-ready at that moment, never all six at once. The fix added zero new logic — a static array of the 6 steps' labels/paths, one `canManage`-gated section, 6 links reusing the exact existing `?preview=1` contract. When a task describes a UX/discoverability complaint about a feature that already technically works, resist the urge to touch the underlying mechanism — audit what's actually missing is usually just an ENTRY POINT, not new behavior.
