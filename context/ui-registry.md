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

---

Expected future components (not yet built):

- DataSourceBadge
- DataTable
- FilterBar
- AttachmentList
- ConfirmTransitionDialog

Do not register one-off page markup. Do not create duplicate components with slightly different styling.
