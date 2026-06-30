# RECAFCO Factory Management Platform — Application Context

Read these files in order before implementing:

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/ui-tokens.md`
4. `context/ui-rules.md`
5. `context/ui-registry.md`
6. `context/code-standards.md`
7. `context/library-docs.md`
8. `context/build-plan.md`
9. `context/progress-tracker.md`

## Approved Naming

- Official name: `RECAFCO Factory Management Platform`
- Short name: `RECAFCO FMP`
- Recommended internal hostname: `fmp.recafco.local`

## Permanent Constraints

- This is permanent production software, not a disposable prototype.
- Use open-source and self-hosted components wherever technically possible.
- Deploy on the RECAFCO company server.
- Keep the system usable on the internal network without mandatory internet access.
- SAP Business One 9.3 for SAP HANA remains authoritative for SAP-owned production, inventory, purchasing, project, and financial records.
- Begin SAP integration read-only.
- Never write directly to SAP HANA tables.
- Never invent missing business workflows.
- Never stop all Node.js processes globally.
- Never reset, reseed, truncate, drop, or recreate a production database.
- Do not affect AuditFlow IMS or other existing systems.
- Update `progress-tracker.md` after each meaningful change.
- Update `ui-registry.md` after each reusable UI component or established pattern.
- Work on one numbered implementation unit at a time.
- Stop after the unit report; do not continue automatically.
