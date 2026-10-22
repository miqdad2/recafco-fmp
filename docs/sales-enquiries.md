# Sales & Enquiries (FMP-SALES-01)

Lets a senior manager record who visited or contacted RECAFCO, what they need, the rough project value in KWD, the status of the enquiry, and when to follow up. It uses the normal FMP login. It does not read or write Contract Management.

## Data model (additive migration `20261022000000_add_sales_enquiries_foundation`)

| Table | Purpose |
|---|---|
| `sales_enquiries` | One row per enquiry. `enquiry_number` is `ENQ-YYYY-NNNN`. `estimated_value` and `awarded_value` are `DECIMAL(15,3)` (KWD fils); **NULL means not known** and is never treated as 0. `currency` is `KWD`. Dates are calendar `DATE`s in Kuwait time. |
| `sales_activities` | History: office meeting, phone call, email, client visit, follow-up, quotation update, status change, note, and `ENQUIRY_UPDATED` (stores the old and new value of every edited field in `metadata`). Never deleted. |
| `sales_follow_ups` | Follow-ups with status `PENDING / COMPLETED / CANCELLED`. Completing keeps the row; rescheduling cancels the old row and creates a new one linked by `rescheduled_from_id`. |
| `sales_sequences` | Yearly counter for enquiry numbers. |

`sales_enquiries.next_follow_up_date` is always the earliest pending follow-up (kept in step by the service).

## Permissions and roles

| Code | Meaning |
|---|---|
| `sales.read` | View enquiries, follow-ups, dashboard |
| `sales.create` | Register new enquiries |
| `sales.update` | Edit, record meetings, manage follow-ups, change status |
| `sales.manage` | Reassign an enquiry to another user (API only) |
| `sales.reports.read` | Monthly conversion/value reporting |

Roles seeded by the migration: **SALES_MANAGER** (all five) and **SALES_VIEWER** (`sales.read`, `sales.reports.read`). `SUPER_ADMIN` receives the five codes like for every other module. No other role gets any. Operational permissions never open Sales, and there is no export route. Assign a role in Administration → Users.

## Routes (web)

`/sales` dashboard · `/sales/enquiries` register · `/sales/enquiries/new` · `/sales/enquiries/[id]` · `/sales/enquiries/[id]/edit` · `/sales/follow-ups`.
Every page needs `sales.read` (otherwise 404). The Control Center shows the Sales & Enquiries card only to users with `sales.read`. Sales is **not** in the sidebar; it has its own small navigation bar.

## API (`/sales`)

`GET dashboard` · `GET reports/monthly?month=YYYY-MM` · `GET|POST enquiries` · `GET|PATCH enquiries/:id` · `POST enquiries/:id/status` · `POST enquiries/:id/activities` · `POST enquiries/:id/follow-ups` · `GET follow-ups?bucket=` · `POST follow-ups/:id/complete` · `POST follow-ups/:id/reschedule`.
Every change writes a history row and a `securityAuditEvent` (`SALES_ENQUIRY_CREATED`, `_UPDATED`, `_STATUS_CHANGED`, `SALES_ACTIVITY_RECORDED`, `SALES_FOLLOW_UP_SCHEDULED/COMPLETED/RESCHEDULED`).

## User workflow

1. **+ New Client Enquiry**: company and scope are the only required fields. The date (today in Kuwait), status (New Enquiry) and "registered by" are set by the server. A next follow-up date creates a real follow-up.
2. On the enquiry: **Add Follow-up**, **Record Meeting / Note**, **Update Status**, **Edit Enquiry**.
3. **Follow-ups** page: Overdue / Due Today / Upcoming / Completed, with Mark Completed and Reschedule.

## Status meanings

New Enquiry (just registered) · Contacted · Meeting Done · Quotation Sent · Follow-up (waiting on the client) · **Won** · **Lost**. Any status can be set directly. Lost needs a short reason. Won can record the awarded value and award date; the estimate is never overwritten. Moving a Won/Lost enquiry back to an open status clears the outcome fields, and the old values stay in the status-history entry.

## Follow-up calculation

Compared with **today in Kuwait (UTC+3, no daylight saving)**: date before today = **Overdue**; equal = **Due Today**; after = **Upcoming**. Completed and cancelled (replaced) follow-ups are never due. Colours are red / amber / blue / green, always with a text label.

## Conversion rate (one definition)

**Monthly Enquiry Cohort Conversion Rate** = enquiries *created* in the month that are *now Won* ÷ enquiries *created* in the month × 100, one decimal. Shown as **N/A** when no enquiry was created that month.
Different figures, never mixed: *Enquiries This Month* counts creation dates; *Projects Won* counts enquiries whose **award date** is in the month (their awarded value is summed separately). *Potential Project Value* sums the estimates of open enquiries only; enquiries without an estimate are counted and flagged, not counted as 0.

## Not included yet

Attachments, Excel/CSV export, assigning to another person from the screen, email reminders, linking a Won enquiry to a Contract (deliberately not done automatically), per-user record scoping.

## Control Center card and who can see Sales (FMP-SALES-01A)

The Sales & Enquiries card is **always the seventh card** on the Control Center. With `sales.read` it shows four live figures and an active **Open Sales & Enquiries** button. Without it, it shows **Access Restricted**: nothing is fetched from the Sales API, no figure is shown and there is no link.

Why it was missing before: the card was only rendered for users holding `sales.read`, and the `EXECUTIVE_MANAGER` role holds none of the five Sales codes (nor does `ADMIN`). That is deliberate: no role is granted Sales automatically.

**Giving a management user Sales access.** A user has exactly **one role**, so assigning `SALES_VIEWER` (`sales.read` + `sales.reports.read` only, no create/update/manage) *replaces* their current role. For a manager who must keep the Control Center and the operational read screens, assign `SALES_VIEWER` **and** tick **Full Platform Access** on the user: that flag adds the operational *read* permissions (never write/manage/administration) on top of the role. They then see all seven cards, with Sales read-only. A manager who also needs the write permissions of the Executive Manager role would need a combined role, which does not exist yet.

## Access model since FMP-SALES-01B (migration `20261023000000_grant_sales_visibility_to_operational_roles`)

Management decision: operational users may **view** Sales; only management may **change** it. Role-permission grants (additive; users keep their role):

| Role | read | reports.read | create | update | manage |
|---|---|---|---|---|---|
| SUPER_ADMIN | yes | yes | yes | yes | yes |
| EXECUTIVE_MANAGER | yes | yes | yes | yes | yes |
| SALES_MANAGER | yes | yes | yes | yes | yes |
| ADMIN | yes | yes | – | – | – |
| VIEWER | yes | yes | – | – | – |
| CONTRACT_MANAGER, CONTRACT_MANAGEMENT_USER | yes | yes | – | – | – |
| SALES_VIEWER | yes | yes | – | – | – |
| CONTRACT_STAFF, TECHNICAL_MANAGER, TECHNICAL_STAFF | – | – | – | – | – |
| MANAGEMENT_INTELLIGENCE_VIEWER | – | – | – | – | – |

Task-only (Contract Staff), single-module (Technical) and Management Intelligence roles are deliberately excluded. Every write route needs `sales.create` / `sales.update` (the API returns 403 otherwise); there is no delete route. Read-only users see one friendly note and no write controls anywhere (they are not rendered, not disabled). Users whose `/dashboard` redirects to a single module (for example Contract Manager) do not see the Control Center card and reach Sales by its address.

## Plain-language wording and quick entry (FMP-SALES-01C)

Screens use business words, not CRM terms. The stored status values did not change (no migration), only the words shown:

| Shown | Stored as |
|---|---|
| New | `NEW_ENQUIRY` |
| Follow-up Needed | `FOLLOW_UP` |
| Quotation Sent | `QUOTATION_SENT` |
| Under Discussion | `MEETING_DONE` (older `CONTACTED` rows also read and filter as Under Discussion; it is no longer offered) |
| Confirmed | `WON` (confirmed value / confirmation date = awarded value / won date) |
| Not Proceeding | `LOST` (a short reason is still required) |

Dashboard figures: Enquiries This Month, Follow-ups Due, Active Enquiries, Estimated Project Value, Confirmed Projects, Conversion This Month (same cohort definition as before).

**+ New Client Enquiry** opens a centered popup (native dialog: Esc, Cancel, X or a click outside closes it; focus is kept inside) from the dashboard and the All Enquiries page. It asks only: Company / Client Name*, Contact Person, Contact Number, Scope of Work*, Estimated Project Value (KWD), Next Follow-up Date, Meeting Notes / Remarks (saved as the enquiry remarks). After a save the popup closes, the page refreshes by itself and "Enquiry saved successfully." appears with a link to the new enquiry. Everything else (source, expected dates, additional notes, email, project name/location, type of work) is added later with **Edit Enquiry**. The older full-page form at `/sales/enquiries/new` still exists for direct links but nothing links to it.

API: the enquiry list `status` filter now also accepts a comma list (for example `MEETING_DONE,CONTACTED`); everything else is unchanged.
