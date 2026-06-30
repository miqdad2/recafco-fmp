# UI Rules

## Direction

The interface must feel professional, trustworthy, clear, and purpose-built for factory operations.

Avoid excessive gradients, glassmorphism, glow effects, playful illustrations, oversized marketing text, and decorative animation.

## Layout

### Desktop
- Left sidebar
- Compact top header
- Main content padding: 24–32px
- Section gap: 24px
- Structured detail pages
- Sticky table headers where useful

### Tablet
- Collapsible sidebar
- Two-column dashboards where space permits

### Mobile/PWA
- Drawer navigation
- One-column forms/cards
- Large touch targets
- Easy photo/evidence upload
- No hover-only actions

## Cards and KPIs

- White surfaces, subtle borders, minimal shadows
- Color only in icons, badges, charts, and statuses
- KPIs show value, unit, source, freshness, and drill-down where useful
- Never show fake metrics as real

## Forms

- Visible labels
- Explicit required fields
- Meaningful sections
- Units for measurements
- Inline validation
- Reason required for high-impact transitions
- Avoid long forms in small modals

## Tables

- Keep identifier, status, responsible party, and due date visible
- Right-align numeric values
- Consistent row action menu
- Loading, empty, error, forbidden, and partial-data states
- Sensitive export actions require permission and audit

## Standard Status Meaning

- Draft: neutral
- Submitted/Pending: info
- In Progress: info
- Waiting/Blocked: warning
- Completed/Verified/Active: success
- Rejected/Failed/Critical: error
- Cancelled/Archived: muted

## Standard Pages

### Module Dashboard
Title, description, source/time context, KPIs, exceptions, trends, workload, recent activity, quick links.

### List Page
Title, primary action, search, filters, status counts, table, pagination, export, empty state.

### Detail Page
Identifier, title, status, responsible party, controlled actions, Overview, Activity, Comments, Files, Related Records, Audit/History.

### Create/Edit Page
Sectioned form, draft only where supported, validation, permission-aware fields, clear save/cancel, reason for high-risk transitions.

## Accessibility

Target WCAG 2.1 AA with keyboard navigation, visible focus, connected errors, accessible dialogs, chart summaries, and 44px touch targets.

## Workflow

Before reusable UI work:

1. Read `ui-tokens.md`.
2. Read `ui-registry.md`.
3. Reuse an existing pattern.
4. Build and verify responsive/accessibility states.
5. Register the component.
