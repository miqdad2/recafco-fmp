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

---

## Production Management Components (Unit 13)

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
