# RECAFCO Factory Management Platform

## Overview

RECAFCO FMP is a permanent, modular, self-hosted platform for factory operations. It provides operational workflows, dashboards, notifications, files, approvals, and auditability around existing company processes while integrating safely with SAP Business One 9.3 for SAP HANA.

The platform does not replace SAP. SAP remains authoritative for official production, inventory, purchasing, project, and financial records.

## Permanent Main Modules

1. Production Dashboard
2. Factory Tasks Management
3. Incident Reporting
4. Maintenance Requests
5. Safety & Compliance
6. Contracts Management

Detailed submodules will be added as management confirms requirements.

## Primary Navigation

- Dashboard
- Production
- Factory Tasks
- Incidents
- Maintenance
- Safety & Compliance
- Contracts
- Documents
- Notifications
- Reports
- Administration
- Settings

## Core User Flow

1. User signs in.
2. The system checks account status, forced reset, permissions, department, and plant/location scope.
3. The user sees a role-aware dashboard.
4. The user enters an authorized module.
5. The user creates, reviews, assigns, approves, updates, verifies, or closes a record.
6. The system records files, comments, activity, notifications, approvals, and audit history.
7. Management views workload, risks, overdue work, and trends.
8. SAP-linked data shows source, reference, sync state, and freshness.

## Shared Capabilities

- Authentication
- User, role, permission, department, plant, and location management
- Shared comments and activity
- Shared attachments
- Shared notifications
- Shared approvals
- Audit logs
- Search, filters, pagination, and exports
- Monitoring, backup, and restore
- Internal LAN deployment

## Data Ownership

### RECAFCO FMP Owns

- factory tasks
- incidents
- maintenance workflows
- safety inspections and environmental records
- contract operational records
- comments, files, approvals, notifications, and audits
- SAP mappings and synchronization metadata

### SAP Business One Owns

- production orders
- BOM and production components
- issue for production
- receipt from production
- item master
- official warehouse stock
- purchasing documents
- projects and distribution references
- SAP-owned costs and financial postings

## In Scope

- Next.js frontend
- NestJS backend
- PostgreSQL
- Prisma
- Redis-compatible queue/cache
- MinIO
- Background worker
- Granular RBAC
- Audit trail
- Six permanent module shells
- Confirmed module workflows
- Read-only SAP integration foundation
- Responsive desktop, tablet, and mobile/PWA UI
- Company-server deployment

## Out of Scope Until Approved

- Replacing SAP
- Direct SAP database writes
- Automatic SAP financial or inventory posting
- Mandatory paid SaaS
- Public internet access
- AI making final approval, safety, financial, or maintenance decisions
- Unconfirmed business workflows
- Native mobile apps

## Success Criteria

- Authorized users see only permitted modules and records.
- Confirmed workflows work end to end and are auditable.
- Shared services work consistently across modules.
- Dashboards show real or clearly labelled manual/imported/SAP-synchronized data.
- SAP integration is read-only initially, observable, retryable, and reconcilable.
- Deployment does not affect existing RECAFCO systems.
- Backup and restore are documented and tested.
