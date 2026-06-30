# Build Plan

## Core Principle

Build visible, verifiable production slices. This is not a visual-only mock application. Never present fake operational or SAP data as real.

## Phase 0 — Discovery

- [x] Platform name and main modules
- [x] Open-source/self-hosted direction
- [x] SAP product/version/database
- [x] Governing context
- [ ] Departments, plants, locations, roles
- [ ] Detailed workflows
- [ ] SAP Service Layer/test-company discovery
- [ ] Existing maintenance-system assessment
- [ ] Server assessment

## Phase 1 — Repository and Runtime

1. Monorepo foundation
2. Environment, logging, request IDs, health
3. PostgreSQL and Prisma
4. MinIO foundation
5. Redis and worker foundation

## Phase 2 — Identity and Shell

6. Organization reference data
7. Users and authentication
8. Roles and permissions
9. Application shell and navigation
10. Audit foundation

## Phase 3 — Shared Services

11. Activity and comments
12. Attachments
13. Notifications
14. Approval engine foundation
15. Reporting/export foundation

## Phase 4 — Factory Tasks

16. Data model and API
17. UI
18. Workflow, recurrence, reminders, escalation

## Phase 5 — Incidents

19. Data model and API
20. UI and workflow
21. Dashboard and reports

## Phase 6 — Maintenance

22. Existing system assessment
23. Equipment cards
24. Maintenance requests and repair orders
25. Preventive maintenance
26. Spare parts and service contracts

## Phase 7 — Safety & Compliance

27. Checklist templates
28. Shop-floor inspections
29. Environmental monitoring
30. Compliance calendar after confirmation

## Phase 8 — Contracts

31. Contract register
32. Contract workflow after confirmation

## Phase 9 — Production and SAP Read Integration

33. SAP connection health
34. SAP session/read client
35. Master-data synchronization
36. Production-order synchronization
37. Production transactions/report sources
38. Production dashboard
39. SAP sync administration/reconciliation

No SAP write operations are included in this plan.

## Phase 10 — Operations

40. Monitoring
41. Backup and restore
42. Company-server deployment
43. Security and production readiness

## Sequencing Rules

- No business modules before authentication, permissions, audit, and shared foundations.
- No maintenance rebuild before assessing the existing maintenance system.
- No SAP business data before read-only connection safeguards.
- No unconfirmed contract or compliance workflows.
- Split any unit that cannot be reviewed and verified quickly.
