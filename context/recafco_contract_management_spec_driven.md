# RECAFCO FMP — Contract Management Updated Spec-Driven + Loop Engineering File

**Product:** RECAFCO FMP — Factory Management Platform  
**Module Name:** Contract Management  
**Document Type:** Updated agentic coding specification  
**Purpose:** Production-ready UI/UX and phased implementation guide for Contract Management based on the latest approved screen designs.  
**Status:** Ready to use as the main context/spec file before coding  
**Updated:** 2026-08-15

---

## 0. Important Correction From Previous Spec

The older plan showed **New Contract Register** as a separate main screen/module item. This must be corrected.

**Correct rule:**

```text
New Contract Register is inside Contract List.
It is opened from Contract List using a primary button:
+ New Contract / + Register Contract
```

The main Contract Management structure is now:

```text
Contract Management
├── Dashboard
├── Contract List
│   ├── View / search / filter all contracts
│   ├── Open Contract Detail Workspace
│   └── New Contract Register
│       ├── Basic Contract Details
│       ├── Scope of Work
│       ├── Payment Terms
│       └── Optional BOQ / Contract Items
│
└── Contract Detail Workspace
    ├── Overview
    ├── Payments
    ├── Production Status
    ├── Variations
    ├── Claims / Change Orders
    ├── Risk Register
    ├── Documents & Obligations
    ├── Workflow & Team Tasks
    ├── Issue Log
    ├── Attachments
    ├── Closeout
    └── Activity / Audit History
```

Do **not** show New Contract Register as a separate main sidebar item once this redesign is implemented.

---

## 1. Non-Negotiable Safety Rules

The coding agent must follow these rules for every unit:

- Do not break existing RECAFCO FMP modules.
- Do not refactor unrelated files.
- Do not rename the module. The module name remains **Contract Management**.
- Do not deploy automatically.
- Do not modify production data automatically.
- Do not use destructive Prisma migrations.
- Do not use `db push`, `migrate reset`, `DROP`, `TRUNCATE`, or any data-destructive command.
- Do not invent SAP integration behavior.
- Do not bypass existing RBAC, PermissionGuard, DepartmentAccessService, audit logging, or lifecycle rules.
- Do not use role names for runtime authorization. Use permission codes only.
- All backend reads must respect department scope.
- All state-changing actions must create activity/audit logs where applicable.
- Implement one small unit at a time.
- Stop after each unit report and wait for approval.

---

## 2. Existing Platform Foundation To Reuse

Reuse the existing platform architecture and patterns:

- Existing pnpm monorepo / Turborepo structure.
- Existing Next.js web app.
- Existing NestJS API.
- Existing Prisma/PostgreSQL database package.
- Existing RBAC / PermissionGuard.
- Existing DepartmentAccessService.
- Existing security audit event pattern.
- Existing ContractActivity timeline pattern.
- Existing lifecycle management safety rules.
- Existing API response/error envelope pattern.
- Existing RECAFCO FMP visual language:
  - dark navy sidebar
  - white content area
  - rounded cards
  - blue primary actions
  - KPI cards
  - status badges
  - filter bars
  - clean enterprise tables
  - simple layout for non-technical users

---

## 3. Business Goal

The current contract process is managed in Excel. The system must convert that workbook into one connected, production-ready Contract Management module.

The final module should allow management and teams to answer:

- How many contracts are active?
- What is the total and current contract value?
- What is the physical progress?
- What is submitted, certified, paid, and outstanding?
- Which contracts are delayed or at risk?
- Which payments are overdue?
- Which claims are open?
- Which obligations/documents are expiring?
- Which team has pending tasks?
- Which issues require management attention?
- Which contracts are ready for closeout?
- Who changed what and when?

---

## 4. Source Excel Mapping To Latest System Screens

| Excel Sheet | Latest System Area | Notes |
|---|---|---|
| Contract Master | Contract Management navigation | Used as module menu concept only |
| Dashboard | Contract Management Dashboard | Management KPIs and alerts |
| Contract List | Contract List | Master list of all contracts |
| Contract Register | New Contract Register inside Contract List | Create contract from Contract List button |
| Contract Status Report | Contract Detail Workspace / Overview | One-contract command center |
| Contract Workflow | Workflow & Team Tasks | Team lanes and step tracking |
| Team Task | Workflow-generated team tasks | Generated from workflow steps where approved |
| Payments | Payments tab | Payment tracker and account statement |
| Claim Register | Claims / Change Orders tab | Claims, EOT, action due dates |
| Risk Register | Risk Register tab | Risk assessment and mitigation |
| Issue Log | Issue Log tab | Issue tracking, due dates, resolution |
| Document & Obligation Register | Documents & Obligations tab | Obligations, expiry, required documents |
| Contract Closeout | Closeout tab | Final closeout checklist and blockers |
| Attachments need | Attachments tab | Central document library for all contract files |
| Audit need | Activity / Audit History tab | User-facing activity and audit timeline |

---

## 5. Final Screen Structure

### 5.1 Dashboard

**Purpose:** Management overview of all contracts.

**Main sections:**

- Top KPI cards:
  - Total Contracts
  - Active Contracts
  - Total Contract Value
  - Overall Physical Progress
  - Open Claims
  - Total Submitted
  - Total Paid
  - Outstanding Amount
  - High / Critical Risks
  - Overdue Workflow Tasks
  - Expiring Documents
  - Contracts Closing Soon
- Physical Progress by Discipline:
  - Technical Progress
  - Production Progress
  - Erection Progress
  - Overall Physical Progress
- Financial Performance:
  - Current Contract Value
  - Submitted
  - Certified
  - Paid
  - Outstanding
- Contracts by Status:
  - Not Started
  - In Progress
  - At Risk
  - Delayed
  - On Hold
  - Completed
  - Closed
- Claims Status Overview:
  - Draft
  - Under Review
  - Submitted
  - Under Negotiation
  - Approved
  - Partially Approved
  - Rejected
  - Settled
  - Closed
- Management Attention Required:
  - Overdue workflow tasks
  - Overdue payments
  - High / critical risks
  - Open high-priority issues
  - Expiring documents
  - Claims with action due
- Top 5 Delayed Contracts
- Top 5 Contracts by Value

**Filters:**

- As of date
- Department/scope
- Status
- Risk
- Claim status
- Payment status

**Acceptance criteria:**

- Dashboard respects department scope.
- Dashboard never leaks unauthorized contracts.
- If data fails to load, do not show misleading zeros.
- Dashboard has clear loading, empty, error, and unauthorized states.
- Management Attention pulls from workflow, payments, risks, issues, obligations, and claims.

---

### 5.2 Contract List

**Purpose:** Central list of all contracts and the entry point for creating new contracts.

**Important UI rule:**

```text
+ New Contract / + Register Contract button belongs here.
New Contract Register is not a separate main sidebar item.
```

**Main actions:**

- Search contracts
- Filter contracts
- Open Contract Detail Workspace
- Start New Contract Register form
- Export list, future phase

**Recommended columns:**

- Contract ID
- Contract No.
- Job Order
- Contract Name
- Client / Employer
- Main Contractor
- Contract Type
- Project / Package
- Contract Manager
- Start Date
- Original Completion
- Forecast Completion
- Actual Completion
- Original Value
- Approved Variations
- Current Value
- Currency
- Status
- Physical Progress %
- Payment Progress %
- Open Claims
- Risk Rating
- Days Remaining
- Action

**Acceptance criteria:**

- List respects department scope.
- Out-of-scope contracts are hidden.
- Direct URL access to hidden contract detail is blocked.
- User can quickly open the contract workspace.
- New Contract Register opens from this page only.

---

### 5.3 New Contract Register

**Purpose:** Create/register a new contract.

**Location:** Inside Contract List, opened by `+ New Contract` or `+ Register Contract`.

**Sections:**

#### Basic Contract Details

- Job Order
- Date
- Quotation #
- Company Name
- Project Name
- Project Number
- Contract No.
- Client / Employer
- Main Contractor
- Contract Type
- Project / Package
- Contract Manager
- Department
- Currency
- Original Contract Value
- Start Date
- Original Completion Date

#### Scope of Work

- Shop Drawing
- Design Production
- Production
- Delivery
- Erection
- Ex-Factory

#### Payment Terms

- Advance
- Retention
- Performance Bond
- Insurance
- Interim Payment
- Tax Clearance

#### Optional BOQ / Contract Items

BOQ is optional/future-friendly because the user currently does not have complete BOQ data.

Columns if used:

- S/N
- Item Description
- Unit
- Qty
- Unit Price
- Total Price
- Invoice Qty
- Produced / P/R
- Amount Remaining
- Remarks

**Business rules:**

- Job Order can be manually entered.
- Auto-generation can be future phase if approved.
- Multiple scope options can be selected.
- Multiple payment terms can be selected.
- If Ex-Factory is selected, Delivery and Erection should become Not Required or disabled unless override is approved.
- Contract creation creates the initial contract workspace.
- Contract creation writes activity/audit log.

**Acceptance criteria:**

- Required fields are validated.
- Department assignment is validated.
- New contract appears in Contract List.
- New contract affects Dashboard KPIs.
- New contract opens in Contract Detail Workspace.

---

### 5.4 Contract Detail Workspace

**Purpose:** One-contract command center.

**Header summary:**

- Contract ID
- Contract No.
- Job Order
- Contract Name
- Client / Employer
- Main Contractor
- Contract Manager
- Contract Status
- Start Date
- Original Completion
- Forecast Completion
- Actual Completion
- Current Contract Value
- Currency
- Overall Progress
- Department badge
- Viewer scope badge

**Tabs:**

- Overview
- Payments
- Production Status
- Variations
- Claims / Change Orders
- Risk Register
- Documents & Obligations
- Workflow & Team Tasks
- Issue Log
- Attachments
- Closeout
- Activity / Audit History

**Acceptance criteria:**

- Tabs are permission-aware.
- Sub-tabs do not leak unauthorized data.
- Each tab has loading, empty, error, and unauthorized states.
- Updates in tabs update overview and dashboard where applicable.

---

### 5.5 Overview Tab

**Purpose:** Quick status report for one contract.

**Shows:**

- Basic contract information
- Scope of work selected
- Payment terms selected
- Progress summary
- Financial summary
- Open claims
- Open risks
- Open issues
- Expiring documents/obligations
- Latest workflow status
- Management alerts
- Closeout readiness summary

**Acceptance criteria:**

- Manager can understand the contract status in less than one minute.
- Values match detailed tabs.
- Critical alerts are visible without opening every tab.

---

### 5.6 Payments Tab

**Purpose:** Track invoices, submitted/certified/paid amounts, overdue and outstanding values.

**Summary cards:**

- Total Submitted
- Total Certified
- Total Paid
- Outstanding
- Overdue Payments
- Payment Progress %

**Table columns:**

- Payment No.
- Invoice #
- Invoice Date
- Amount
- % of Contract Cost
- Payment Term
- Submitted Date
- Received Date
- Duration
- Paid On
- Paid Amount
- Remaining
- Overdue Date
- Status
- Action

**Statuses:**

- Pending
- Submitted
- Certified
- Paid
- Partially Paid
- Overdue
- Cancelled

**Calculations:**

- Remaining = Amount - Paid Amount
- Outstanding = Current Contract Value - Total Paid
- Payment Progress = Total Paid / Current Contract Value
- Overdue = current date > overdue date and status is not Paid

**Acceptance criteria:**

- Payments are linked to contract.
- Overdue payments show in Dashboard attention.
- Payment updates are audit logged.
- SAP/accounting integration remains future phase.

---

### 5.7 Production Status Tab

**Purpose:** Track production progress for contract items.

**Summary cards:**

- Total Qty
- Casted
- Delivered
- Stock
- Remaining to Cast
- Production Progress %

**Table columns:**

- S/N
- Item Description
- Unit
- Total Qty
- Casted
- Delivered
- Stock
- Remaining to Cast
- Production Status
- Last Update
- Remarks
- Action

**Calculations:**

- Remaining to Cast = Total Qty - Casted
- Stock = Casted - Delivered
- Production Progress = Casted / Total Qty
- Delivery Progress = Delivered / Total Qty

**Acceptance criteria:**

- Phase 1 can be manual.
- Future phase can link to Production module.
- Production progress can feed physical progress only after business confirmation.

---

### 5.8 Variations Tab

**Purpose:** Track variation orders and value impact.

**Summary cards:**

- Total Variations
- Approved Variation Value
- Pending Variation Value
- Rejected / Cancelled
- Current Contract Value Impact

**Table columns:**

- Variation No.
- Description
- Amount
- Affects Contract Value
- Status
- Supporting Document
- Submitted Date
- Approved Date
- Remarks
- Action

**Statuses:**

- Draft
- Submitted
- Under Review
- Approved
- Rejected
- Closed

**Business rule:**

```text
Current Contract Value = Original Contract Value + Approved Variations
```

Only apply automatically if business confirms.

**Acceptance criteria:**

- Variations are linked to contract.
- Approved variations update current value only when approved by business rule.
- Variation changes are audit logged.

---

### 5.9 Claims / Change Orders Tab

**Purpose:** Track claims, change orders, EOT and commercial actions.

**Summary cards:**

- Open Claims
- Submitted Value
- Approved Value
- Outstanding Value
- EOT Claimed Days
- EOT Approved Days
- Actions Due

**Table columns:**

- Claim ID
- Intake ID
- Contract ID
- Claim Title
- Claim Type
- Date of Event
- Claim Date
- Claim Status
- Submitted Value
- Approved Value
- Outstanding Value
- EOT Claimed Days
- EOT Approved Days
- Responsible Person
- Next Action
- Action Due Date
- Days to Deadline
- Last Update
- Remarks
- Action

**Statuses:**

- Draft
- Under Review
- Submitted
- Under Negotiation
- Approved
- Partially Approved
- Rejected
- Settled
- Closed

**Acceptance criteria:**

- Claims are linked to contract.
- Open claims update Contract List and Dashboard.
- Action due dates feed Management Attention.
- Claim value affects contract value only after business confirmation.

---

### 5.10 Risk Register Tab

**Purpose:** Track contract risks and mitigation.

**Summary cards:**

- Total Risks
- High / Critical Risks
- Open Risks
- Mitigated Risks
- Residual Risk

**Table columns:**

- Risk ID
- Risk Clause / Description
- Risk Evaluation
- Risk Response
- Risk Response Description
- Residual Risk
- Risk Owner
- Priority / Severity
- Status
- Due Date
- Last Reviewed Date
- Remarks
- Action

**Statuses:**

- Open
- In Progress
- Mitigated
- Accepted
- Closed

**Acceptance criteria:**

- Risks are linked to contract.
- High/critical risks appear on Dashboard.
- Risk updates are audit logged.
- Critical open risks may block closeout if business confirms.

---

### 5.11 Documents & Obligations Tab

**Purpose:** Track required documents, obligations, responsibility, submission dates, expiry dates and days remaining.

This is different from Attachments. It is a deadline/control register, not only a file library.

**Summary cards:**

- Total Obligations
- Submitted
- Pending
- Expiring Soon
- Expired / Overdue

**Table columns:**

- Item ID
- Contract ID
- Document / Obligation
- Category
- Responsible Party
- Required Date
- Submission / Expiry Date
- Days Remaining
- Status
- Remarks
- Attachment
- Action

**Categories:**

- Contract Document
- Approval Document
- Performance Bond
- Insurance
- Tax Clearance
- Method Statement
- Drawing / Technical Submission
- Checklist
- Handover
- Other

**Statuses:**

- Required
- Submitted
- Approved
- Active
- Expiring Soon
- Expired
- Overdue
- Not Required
- Closed

**Acceptance criteria:**

- Expiring/expired obligations appear on Dashboard.
- Mandatory missing documents appear in Closeout blockers.
- Attachments can be linked, but document upload should use shared attachment design.

---

### 5.12 Workflow & Team Tasks Tab

**Purpose:** Track contract execution steps by team and generate team tasks.

**Team lanes and steps:**

#### Technical Team

- Drawing Received
- SD & Calculation Submission
- Getting Approval
- FD Issuance

#### Production Team

- Submission of Mix Design
- Mix Design Approval
- Mould Preparation
- Issue Production Schedule
- Production Start

#### Erection / Site / Logistics Team

- Issued of Erection Method Statement
- Erection Statement Approval
- Issued Erection Schedule
- Delivery Start
- Erection Start
- Issue Checklist

#### QS / Commercial / Finance

- Payment Issued

**Step fields:**

- Step name
- Team owner
- Status
- Planned date
- Actual date
- Responsible user
- Remarks
- Blocked reason
- Updated by
- Updated at
- Attachments

**Statuses:**

- Not Required
- Pending
- In Progress
- Submitted
- Approved
- Rejected
- Completed
- On Hold
- Blocked

**Scope rules:**

- Scope controls which steps are required.
- Ex-Factory makes Delivery and Erection steps Not Required unless override is approved.
- Completed workflow steps can generate or close team tasks.
- Delayed workflow steps appear in Management Attention.

**Acceptance criteria:**

- Workflow board shows all team lanes.
- Tasks are linked to workflow steps.
- Users can update only permitted workflow steps.
- Workflow updates create activity/audit logs.

---

### 5.13 Issue Log Tab

**Purpose:** Track contract issues, responsibility, due dates, and resolution.

**Summary cards:**

- Total Issues
- Open
- In Progress
- Waiting
- Resolved
- Closed
- Open Overdue
- High Priority

**Table columns:**

- Issue ID
- Issue Title
- Category
- Priority
- Raised By
- Raised Date
- Responsible Person
- Due Date
- Status
- Linked Area
- Remarks
- Action

**Categories:**

- Technical
- Production
- Delivery
- Erection
- Payment
- Document
- Client Approval
- Variation
- Claim
- Risk
- Other

**Statuses:**

- Open
- In Progress
- Waiting for Response
- Resolved
- Closed
- Cancelled

**Acceptance criteria:**

- Issues are linked to contract.
- High-priority or overdue issues appear on Dashboard.
- Critical unresolved issues may block Closeout if business confirms.
- Issue updates are audit logged.

---

### 5.14 Attachments / Document Library Tab

**Purpose:** Central repository for all files uploaded against one contract from all tabs.

**Important distinction:**

```text
Documents & Obligations = deadline/control register.
Attachments = actual uploaded files and file history.
```

**Summary cards:**

- Total Files
- Pending Review
- Approved Documents
- Expiring Documents
- Missing Required Documents
- Storage Used

**Table columns:**

- File Name
- Category
- Source Tab
- Related Item
- Uploaded By
- Uploaded Date
- Status
- File Type
- Size
- Action

**Categories:**

- Contract Document
- Drawing
- Calculation
- Method Statement
- Schedule
- Payment Document
- Claim Document
- Risk Document
- Checklist
- Certificate
- Photo
- Report
- Other

**Actions:**

- Upload File
- Preview
- Download
- Replace Version
- View History
- Archive/Delete only with permission

**Acceptance criteria:**

- Attachments are linked to contract and optionally to source tab/item.
- Missing mandatory documents can show in Closeout.
- Deletion/archive must be permission-controlled and audit logged.
- File upload implementation should align with shared platform attachment architecture.

---

### 5.15 Closeout Tab

**Purpose:** Final contract closure control.

**Important rule:**

If blocking items exist, the page should show:

```text
Not Ready for Closeout
```

or

```text
Ready for Review with Pending Items
```

Do not show “Ready for Closeout” while blockers still exist unless business approves an override state.

**Readiness cards:**

- Overall Completion
- Payment Completion
- Open Claims
- Open Risks
- Pending Documents
- Pending Issues

**Final checklist:**

- All workflow steps completed
- Technical workflow completed
- Production workflow completed
- Delivery completed, if applicable
- Erection completed, if applicable
- Issue checklist completed
- Final inspection completed
- All required documents submitted
- All obligations cleared
- All claims reviewed/closed
- All risks mitigated/accepted
- All issues closed
- Final payment submitted
- Final payment received/confirmed
- Retention status updated
- Client acceptance received
- Closeout attachments uploaded
- Final remarks entered

**Blocking item sources:**

- Open claims
- Open high/critical risks
- Open high-priority issues
- Pending documents/obligations
- Expired obligations
- Overdue payments
- Incomplete workflow tasks
- Missing final approval

**Final documents:**

- Completion Certificate
- Client Acceptance / Handover
- Final Invoice
- Final Payment Certificate
- Retention Release
- As-Built Drawings
- O&M Manual
- Warranty Documents
- Testing / Inspection Reports
- Final Checklist
- Project Photos
- Other

**Actions:**

- Save Draft
- Request Missing Items
- Submit Closeout Review
- Return for Correction
- Close Contract
- Archive Contract
- Back to Contract

**Acceptance criteria:**

- Closeout readiness is clearly visible.
- Blocking items prevent final close unless override is approved.
- Close action is permission-controlled.
- Closeout changes are audit logged.
- Closed contract should become read-only except allowed comments/attachments or permitted admin correction.

---

### 5.16 Activity / Audit History Tab

**Purpose:** Show all actions and changes for one contract.

**Summary cards:**

- Total Activities
- Updates This Month
- Documents Uploaded
- Status Changes
- Approval / Review Actions

**Timeline/table columns:**

- Date & Time
- User
- Activity / Action
- Source Tab
- Details
- Old Value
- New Value
- IP Address
- View Details

**Activity types:**

- Contract Created
- Contract Updated
- Workflow Status Changed
- Payment Updated
- Claim Added / Updated
- Risk Added / Updated
- Document Uploaded
- Variation Added / Approved
- Issue Raised / Resolved
- Closeout Submitted
- Contract Closed
- Contract Archived

**Security rule:**

Do not log passwords, tokens, secrets, raw stack traces, or unnecessary sensitive free text.

**Acceptance criteria:**

- User-facing timeline shows meaningful business actions.
- Security audit log stores safe metadata.
- Activity respects department scope.
- Changes from all tabs are traceable.

---

## 6. Workflow Task Detail Screens

Each workflow step should open a simple task detail screen using the same layout:

- Contract summary header
- Workflow step title
- Step status
- Responsible person/team
- Planned date
- Actual date
- Required form fields for that step
- Attachments
- Remarks
- Activity panel
- Actions:
  - Save Draft
  - Submit / Mark Complete
  - Move Next
  - Return / Request Correction
  - Hold
  - Back to Workflow

### Technical Team Step Screens

#### Drawing Received

Fields:

- Received Date
- Received From
- Sender Name
- Drawing Type
- Drawing Reference No.
- Revision No.
- Number of Sheets
- Priority
- Status
- Drawing Description
- Related Area / Package
- Internal Reference / Intake No.
- Assigned To
- Planned Review Start
- Attachments
- Remarks

#### SD & Calculation Submission

Fields:

- Submission Date
- Submission Type
- Submitted To
- Drawing Reference No.
- Revision No.
- Related Drawing Received
- Calculation Type
- Number of Sheets / Files
- Target Approval Date
- Submission Method
- Reference / Submission No.
- Contact / Email
- Attachments
- Remarks

#### Getting Approval

Fields:

- Submitted On
- Submitted By
- Submitted To
- Approval Status
- Expected Approval Date
- Reviewed On
- Reviewed By
- Revision
- Client / Reviewer Comments
- Resubmission Required
- Resubmission Date
- Resubmission Reason
- Approval Attachments
- Remarks

#### FD Issuance

Fields:

- FD Issue Date
- Issued To
- Purpose / For
- Issue Type
- Drawing Reference
- Revision
- Approved Reference
- Approved Date
- Number of Sheets
- Scale
- Distribution
- Issue Method
- Issued By
- Designation
- Contact / Email
- Attachments
- Remarks

### Production Team Step Screens

#### Submission of Mix Design

Fields:

- Mix Design Reference
- Submitted To
- Target Approval Date
- Mix Type
- Concrete Grade
- Cement Type
- Admixture / Additives
- Water Cement Ratio
- Slump
- Max Aggregate Size
- Workability
- Designed By
- Attachments
- Remarks

#### Mix Design Approval

Fields:

- Received On
- Reviewed By
- Approval Status
- Expected Approval Date
- Mix Design Reference
- Revision
- Compliance
- Resubmission Required
- Comments
- Attachments

#### Mould Preparation

Fields:

- Planned Start
- Planned Completion
- Actual Start
- Actual Completion
- Mould Type / Element
- Mould ID / Reference
- Quantity
- Location / Casting Yard
- Material
- Condition / Status
- Cleaning Completed
- Surface Treatment Done
- Inspection By
- Inspection Date
- Next Inspection Due
- Responsibility
- Attachments
- Remarks

#### Issue Production Schedule

Fields:

- Schedule Issue Date
- Valid From
- Valid To
- Schedule Reference No.
- Production Type
- Work Location / Yard
- Department / Area
- Prepared By
- Total Items / Components
- Total Quantity
- Resource Plan
- Shifts Per Day
- Schedule Attachment
- Remarks

#### Production Start

Fields:

- Actual Start Date
- Start Time
- Production Type
- Work Location / Yard
- Department / Area
- Shift
- Team In Charge
- Supervisor On Site
- Equipment Ready
- Materials Ready
- Workforce Available
- Safety Briefing Completed
- Attachments
- Remarks

### Erection / Site / Logistics Step Screens

#### Issued of Erection Method Statement

Fields:

- Method Statement Reference
- Issue Date
- Issued To
- Site / Package
- Revision
- Prepared By
- Reviewed By
- Method Statement Attachment
- Remarks
- Next Approval Required

#### Erection Statement Approval

Fields:

- EMS Reference No.
- EMS Issued Date
- Submitted By
- Submitted On
- Review Required By
- Reviewing Engineer
- Review Type
- Priority
- Review Status
- Decision
- Requires Client Approval
- Comments
- Attachments

#### Issued Erection Schedule

Fields:

- Schedule Reference
- Schedule Date
- Planned Start
- Planned End
- Work Package / Area
- Erection Crew / Team
- Manpower Planned
- Equipment Planned
- Prepared By
- Reviewed By
- Document Revision
- Attachments
- Remarks

#### Delivery Start

Fields:

- Delivery Reference
- Delivery Date
- Planned Delivery Window
- Transport Mode
- Supplier / Fabricator
- Dispatch From
- Delivery To / Site
- Gate Entry Contact
- LR / Tracking No.
- Vehicle No.
- Driver Name
- Driver Contact
- Delivery Items
- Delivery Documents
- Comments

#### Erection Start

Fields:

- Erection Start Reference
- Planned Start
- Actual Start
- Work Package / Area
- Crew / Team
- Team Leader
- Supervisor
- Safety Officer
- Manpower
- Equipment
- Weather Condition
- Permit Reference
- Lifting Plan Reference
- Method Statement Reference
- Risk Assessment Reference
- Scope Today
- Attachments
- Checklist
- Remarks

#### Issue Checklist

Fields:

- Checklist Reference
- Date
- Work Package / Area
- Checklist Type
- Prepared By
- Reviewed By
- Verified By
- Status
- Checklist Items
- Attachments
- Remarks

### QS / Commercial / Finance Step Screen

#### Payment Issued

Fields:

- Payment Reference
- Payment Date
- Payment Type
- Payment For
- Amount
- Currency
- Payment Method
- Transaction Reference
- Bank
- Account
- Beneficiary
- Status
- Authorized By
- Approved By
- Payment Attachments
- Remarks

---

## 7. Important Management Questions Before Full Backend

Ask only these limited important questions:

1. What is the minimum required information to register a new contract?
2. Which fields come from SAP and which fields are manually entered?
3. Should Contract ID / Job Order / Contract No. be manual, auto-generated, or both?
4. Are workflow steps fixed for every contract or controlled by scope/type?
5. Who updates each workflow stage?
6. When Ex-Factory is selected, should Delivery and Erection be disabled/not required?
7. Should team tasks be automatically created from workflow?
8. What are the real contract statuses?
9. How should overall physical progress be calculated?
10. Which items should appear in Management Attention Required?
11. Who updates payment data: contract team, finance, or SAP?
12. Can a contract be closed if final payment or retention is pending?
13. Are Claims, Change Orders, and Variations separate or connected?
14. Should approved variations automatically update Current Contract Value?
15. Can open claims/high risks/issues block closeout, or can management override?
16. Which documents are mandatory before closing a contract?
17. Who has final authority to close/archive a contract?
18. After closeout, should editing be blocked?

---

## 8. Phased Coding Units

### UNIT CM-01 — Shell, Routing, Navigation Cleanup

**Goal:** Align Contract Management navigation and page shells with latest structure.

**Scope:**

- Dashboard route shell
- Contract List route shell
- New Contract Register inside Contract List only
- Contract Detail Workspace shell with latest tabs
- Remove/hide separate New Contract Register main navigation item if it exists
- Placeholder pages only where needed
- No schema/migration
- No backend feature implementation

**Acceptance:**

- Navigation matches latest structure.
- App still builds.
- Existing modules unaffected.

---

### UNIT CM-02 — Dashboard UI

**Goal:** Build the final Contract Management Dashboard UI using existing/mock data first.

**Scope:**

- KPI cards
- Physical progress section
- Financial performance section
- Contract status chart/list
- Claims status overview
- Management Attention Required
- Top delayed contracts
- Top contracts by value
- Filters and export button UI

**No backend aggregation yet unless existing data supports it safely.**

---

### UNIT CM-03 — Contract List + New Contract Register UI

**Goal:** Redesign Contract List and add New Contract Register form inside it.

**Scope:**

- Contract List table
- Filters
- `+ New Contract` button
- New Contract Register drawer/modal/page section
- Basic details form
- Scope checkboxes
- Payment terms checkboxes
- Optional BOQ draft UI only

---

### UNIT CM-04 — Contract Detail Workspace + Overview

**Goal:** Build single-contract workspace and Overview tab.

**Scope:**

- Header summary
- Latest tab structure
- Overview cards
- Alerts
- Scope/payment summary
- Progress and financial summary

---

### UNIT CM-05 — Payments UI

**Goal:** Build Payments tab UI.

**Scope:**

- Summary cards
- Payment tracker table
- Account statement table fields
- Status badges
- Overdue visual logic using mock or existing data

---

### UNIT CM-06 — Production Status + Variations UI

**Goal:** Build Production Status and Variations tabs.

**Scope:**

- Production summary and table
- Variation summary and table
- Current value impact display

---

### UNIT CM-07 — Claims + Risk Register UI

**Goal:** Build Claims / Change Orders and Risk Register tabs.

**Scope:**

- Claim summary and table
- Risk summary and table
- Dashboard attention compatibility

---

### UNIT CM-08 — Documents & Obligations + Attachments UI

**Goal:** Build obligation tracker and central attachment library.

**Scope:**

- Obligation deadline tracker
- Expiry status
- Attachment library table
- Missing/expiring document UI
- No custom upload backend unless shared architecture exists

---

### UNIT CM-09 — Workflow & Team Tasks UI

**Goal:** Build workflow board and step-detail pattern.

**Scope:**

- Technical lane
- Production lane
- Erection/Site/Logistics lane
- QS/Commercial/Finance lane
- Team task cards
- Step detail template
- Scope-based required/not-required UI

---

### UNIT CM-10 — Issue Log UI

**Goal:** Build Issue Log tab.

**Scope:**

- Issue summary cards
- Filters
- Issue table
- Raise issue action UI
- Status/priority badges

---

### UNIT CM-11 — Closeout UI

**Goal:** Build Closeout tab.

**Scope:**

- Readiness cards
- Final checklist
- Blocking items
- Final documents
- Financial closeout
- Final approval section
- Activity side panel

---

### UNIT CM-12 — Activity / Audit History UI

**Goal:** Build Activity / Audit History tab.

**Scope:**

- KPI cards
- Filters
- Timeline/table
- Activity by type
- Top users
- Export activity log UI

---

### UNIT CM-13 — Backend Data Models / API Planning Gate

**Goal:** After UI approval, plan backend schema and API in controlled units.

**Do not start until manager/user approves the UI direction.**

Potential backend sub-units:

- Contract register fields extension
- Contract payment model/API
- Contract claim model/API
- Contract risk model/API
- Contract issue model/API
- Contract obligation model/API
- Contract variation model/API
- Contract workflow step/team task model/API
- Contract closeout model/API
- Shared attachment architecture
- Dashboard aggregation endpoints

---

## 9. Loop Engineering Process For Every Unit

Every coding unit must follow this loop.

### LOOP 1 — Audit

- Inspect current routes.
- Inspect current Contract Management files.
- Inspect navigation/sidebar.
- Inspect Prisma schema only if backend changes are needed.
- Inspect existing permission and department scope patterns.
- Inspect existing UI components and dashboard/table patterns.
- Do not edit files during audit.
- Report what exists and what needs to change.

### LOOP 2 — Plan

- State the unit goal.
- List exact files expected to edit.
- Confirm what will not be touched.
- Confirm no destructive migration.
- Confirm no unrelated refactor.

### LOOP 3 — Implement

- Implement only the approved unit.
- Prefer small reusable components.
- Reuse existing RECAFCO FMP visual patterns.
- Keep UI simple for non-technical users.
- Keep route structure stable.
- Use mock/static data only when backend is not ready.
- Do not invent final backend behavior from mock data.

### LOOP 4 — Verify

Run available checks:

```powershell
pnpm lint
pnpm typecheck
pnpm --filter @recafco/api test --run
pnpm --filter @recafco/web test --run
pnpm build
```

If a command fails:

- Report exact error.
- Fix only related issues.
- Do not refactor unrelated code.

### LOOP 5 — Report

Return:

- Exact files changed
- What was added
- What was not changed
- Schema/migration changes, if any
- Backend behavior
- Frontend behavior
- Permissions impact
- Department scope impact
- Audit logging impact
- Tests/checks run
- Results
- Remaining deviations
- Next recommended unit
- Confirmation no production data changed

### LOOP 6 — Approval Gate

Stop and wait for approval before next unit.

---

## 10. Standard Prompt Template For Coding Agent

```text
Continue RECAFCO FMP Contract Management only.

Do not deploy.
Do not modify production data.
Do not refactor unrelated modules.
Do not start extra features outside this unit.
Do not use destructive migrations.
Do not use db push or migrate reset.
Do not bypass PermissionGuard, DepartmentAccessService, audit logging, or lifecycle rules.
Do not use role names for runtime authorization.

Current module name must remain: Contract Management.

Goal:
[INSERT UNIT GOAL]

Latest structure:
Contract Management
├── Dashboard
├── Contract List
│   └── New Contract Register inside Contract List
└── Contract Detail Workspace
    ├── Overview
    ├── Payments
    ├── Production Status
    ├── Variations
    ├── Claims / Change Orders
    ├── Risk Register
    ├── Documents & Obligations
    ├── Workflow & Team Tasks
    ├── Issue Log
    ├── Attachments
    ├── Closeout
    └── Activity / Audit History

Requirements:
[INSERT EXACT REQUIREMENTS]

Use existing:
- PermissionGuard
- DepartmentAccessService
- ContractActivity where user-facing timeline is needed
- security audit event pattern for compliance/action logging
- existing API envelope/error pattern
- existing UI card/table/filter/status-badge patterns

Loop process:
1. Audit first. Do not edit during audit.
2. Plan exact files to change.
3. Implement only this unit.
4. Verify using available checks.
5. Report exact files changed and results.
6. Stop after report.

Run if available:
pnpm lint
pnpm typecheck
pnpm --filter @recafco/api test --run
pnpm --filter @recafco/web test --run
pnpm build

Return:
1. Files changed
2. Schema/migration changes
3. Backend behavior
4. Frontend behavior
5. Permissions impact
6. Department scope impact
7. Audit logging impact
8. Tests/checks run
9. Verification results
10. Remaining deviations
11. Confirmation no production data was modified
12. Next recommended unit
```

---

## 11. First Unit Prompt — Use This Now

```text
Continue RECAFCO FMP Contract Management only.

Task: UNIT CM-01 — Shell, Routing, and Navigation Cleanup.

Before editing, audit the current Contract Management implementation.

Safety rules:
- Do not deploy.
- Do not modify production data.
- Do not touch Prisma schema or migrations in this unit.
- Do not refactor unrelated modules.
- Do not remove existing backend permissions.
- Do not rename the module.
- Module name remains Contract Management.
- Do not build all detailed pages yet.

Required outcome:
1. Contract Management navigation and routes should match this structure:
   - Dashboard
   - Contract List
     - New Contract Register is inside Contract List as a button/form/action.
   - Contract Detail Workspace
     - Overview
     - Payments
     - Production Status
     - Variations
     - Claims / Change Orders
     - Risk Register
     - Documents & Obligations
     - Workflow & Team Tasks
     - Issue Log
     - Attachments
     - Closeout
     - Activity / Audit History

2. If New Contract Register currently appears as a separate main sidebar item, remove/hide it from the main Contract Management navigation and make it accessible from Contract List.

3. Create placeholder shells for missing tabs/pages only if needed.

4. Keep the existing RECAFCO FMP visual style:
   - dark navy sidebar
   - white content background
   - rounded cards
   - blue primary actions
   - clean enterprise layout
   - simple for non-technical users

5. Do not implement backend CRUD or schema changes in this unit.

Loop process:
- First audit and report existing files/routes/navigation.
- Then implement minimal safe changes.
- Run lint/typecheck/build if available.
- Report exact files changed, checks result, and next recommended unit.

Stop after the report.
```

---

## 12. Definition Of Done For Updated Spec

This specification is ready for coding when the team agrees:

- New Contract Register belongs inside Contract List.
- Dashboard is the manager’s main overview screen.
- Contract Detail Workspace is the main operational screen for one contract.
- BOQ remains optional/future-friendly, not forced as a main tab in the latest UI.
- Workflow and team tasks follow selected scope.
- Payments, claims, risks, obligations, issues, attachments, closeout, and audit history are phased safely.
- SAP integration is future phase only.
- Backend schema/API work starts only after UI structure is approved.

