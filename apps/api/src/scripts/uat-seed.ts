/**
 * uat-seed.ts
 *
 * Idempotent User Acceptance Test seed for development/staging databases.
 * Creates UAT departments, plant, location, test users, module access profiles,
 * and one clearly-labelled test record per module per department.
 *
 * SAFETY GUARD: aborts immediately if NODE_ENV === 'production'.
 * Forcing production execution is intentionally not supported.
 *
 * Run with:
 *   pnpm --filter @recafco/api uat:seed
 *
 * Default test-user password: UATpass2026!
 * (Change immediately if promoting to a shared staging environment.)
 *
 * This script is idempotent: running it multiple times produces the same state.
 * All entities are created via upsert; existing records are left unchanged.
 */

import 'reflect-metadata';
import { hash, Algorithm } from '@node-rs/argon2';
import { createPrismaClient } from '@recafco/database';
import { DepartmentAccessScope, ModuleIdentifier } from '@recafco/database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UAT_PASSWORD = 'UATpass2026!';

const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

const DEPT_CM01 = { code: 'CM-01', name: 'Contracts Management' };
const DEPT_ENG01 = { code: 'ENG-01', name: 'Engineering' };

const PLANT_TEST = {
  code: 'TEST-PLANT-01',
  name: 'Acceptance Test Plant',
  description: '[UAT] Do not use for real operations',
};

const LOC_TEST = {
  code: 'TEST-LOC-01',
  name: 'Acceptance Test Location',
  description: '[UAT] Do not use for real operations',
};

const PROD_LINE_TEST = {
  code: 'UAT-LINE-01',
  name: '[UAT] Acceptance Test Line',
  description: '[UAT] Do not use for real operations',
};

// ---------------------------------------------------------------------------
// Production guard
// ---------------------------------------------------------------------------

function abortIfProduction(): void {
  if (process.env['NODE_ENV'] === 'production') {
    console.error('[uat-seed] ABORT: NODE_ENV=production. This script must not run in production.');
    console.error('[uat-seed] If you need test data in production, create it through the application UI.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  abortIfProduction();

  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    console.error('[uat-seed] ERROR: DATABASE_URL is not set.');
    process.exitCode = 1;
    return;
  }

  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  console.log(`[uat-seed] Environment: ${nodeEnv}`);
  console.log('[uat-seed] Starting UAT seed (idempotent)…');

  const db = createPrismaClient({
    databaseUrl: dbUrl,
    poolMax: 1,
    connectionTimeoutMs: 10_000,
    statementTimeoutMs: 60_000,
  });

  try {
    await db.$connect();

    // -----------------------------------------------------------------------
    // Step 1: Departments
    // -----------------------------------------------------------------------

    console.log('[uat-seed] Step 1: Departments…');

    const deptCm01 = await db.department.upsert({
      where: { code: DEPT_CM01.code },
      create: { code: DEPT_CM01.code, name: DEPT_CM01.name, isActive: true },
      update: { name: DEPT_CM01.name, isActive: true },
      select: { id: true, code: true },
    });
    console.log(`[uat-seed]   ${deptCm01.code} → ${deptCm01.id} (reused or created)`);

    const deptEng01 = await db.department.upsert({
      where: { code: DEPT_ENG01.code },
      create: { code: DEPT_ENG01.code, name: DEPT_ENG01.name, isActive: true },
      update: { name: DEPT_ENG01.name, isActive: true },
      select: { id: true, code: true },
    });
    console.log(`[uat-seed]   ${deptEng01.code} → ${deptEng01.id} (reused or created)`);

    // -----------------------------------------------------------------------
    // Step 2: Plant
    // -----------------------------------------------------------------------

    console.log('[uat-seed] Step 2: Plant…');

    const plant = await db.plant.upsert({
      where: { code: PLANT_TEST.code },
      create: { code: PLANT_TEST.code, name: PLANT_TEST.name, description: PLANT_TEST.description, isActive: true },
      update: { name: PLANT_TEST.name, isActive: true },
      select: { id: true, code: true },
    });
    console.log(`[uat-seed]   ${plant.code} → ${plant.id}`);

    // -----------------------------------------------------------------------
    // Step 3: Location (linked to TEST-PLANT-01)
    // -----------------------------------------------------------------------

    console.log('[uat-seed] Step 3: Location…');

    const location = await db.location.upsert({
      where: { code: LOC_TEST.code },
      create: {
        code: LOC_TEST.code,
        name: LOC_TEST.name,
        description: LOC_TEST.description,
        plantId: plant.id,
        isActive: true,
      },
      update: { name: LOC_TEST.name, plantId: plant.id, isActive: true },
      select: { id: true, code: true },
    });
    console.log(`[uat-seed]   ${location.code} → ${location.id} (plant: ${plant.id})`);

    // -----------------------------------------------------------------------
    // Step 4: Production line (linked to TEST-PLANT-01)
    // -----------------------------------------------------------------------

    console.log('[uat-seed] Step 4: Production line…');

    const prodLine = await db.productionLine.upsert({
      where: { code: PROD_LINE_TEST.code },
      create: {
        code: PROD_LINE_TEST.code,
        name: PROD_LINE_TEST.name,
        description: PROD_LINE_TEST.description,
        plantId: plant.id,
        isActive: true,
      },
      update: { name: PROD_LINE_TEST.name, isActive: true },
      select: { id: true, code: true },
    });
    console.log(`[uat-seed]   ${prodLine.code} → ${prodLine.id}`);

    // -----------------------------------------------------------------------
    // Step 5: Roles (look up existing — never create roles in seed)
    // -----------------------------------------------------------------------

    console.log('[uat-seed] Step 5: Roles…');

    const viewerRole = await db.role.findUnique({ where: { code: 'VIEWER' }, select: { id: true, code: true } });
    if (!viewerRole) {
      console.error('[uat-seed] ERROR: VIEWER role not found. Apply all migrations before running this script.');
      process.exitCode = 1;
      return;
    }
    console.log(`[uat-seed]   VIEWER → ${viewerRole.id}`);

    const adminRole = await db.role.findUnique({ where: { code: 'ADMIN' }, select: { id: true, code: true } });
    if (!adminRole) {
      console.error('[uat-seed] ERROR: ADMIN role not found. Apply all migrations before running this script.');
      process.exitCode = 1;
      return;
    }
    console.log(`[uat-seed]   ADMIN  → ${adminRole.id}`);

    // -----------------------------------------------------------------------
    // Step 6: Test users
    // -----------------------------------------------------------------------

    console.log('[uat-seed] Step 6: Test users…');
    console.log('[uat-seed]   Hashing passwords (this may take a moment)…');

    const passwordHash = await hash(UAT_PASSWORD, ARGON2_OPTIONS);

    const userOperator = await db.user.upsert({
      where: { username: 'test.operator' },
      create: {
        username: 'test.operator',
        displayName: '[UAT] Operator (CM-01 / OWN_DEPARTMENT)',
        passwordHash,
        roleId: viewerRole.id,
        departmentId: deptCm01.id,
        isActive: true,
        mustChangePassword: false,
      },
      update: {
        displayName: '[UAT] Operator (CM-01 / OWN_DEPARTMENT)',
        roleId: viewerRole.id,
        departmentId: deptCm01.id,
        isActive: true,
      },
      select: { id: true, username: true },
    });
    console.log(`[uat-seed]   test.operator  → ${userOperator.id}`);

    const userSelected = await db.user.upsert({
      where: { username: 'test.selected' },
      create: {
        username: 'test.selected',
        displayName: '[UAT] Selected-Depts User (CM-01 primary / SELECTED for Tasks+Incidents)',
        passwordHash,
        roleId: viewerRole.id,
        departmentId: deptCm01.id,
        isActive: true,
        mustChangePassword: false,
      },
      update: {
        displayName: '[UAT] Selected-Depts User (CM-01 primary / SELECTED for Tasks+Incidents)',
        roleId: viewerRole.id,
        departmentId: deptCm01.id,
        isActive: true,
      },
      select: { id: true, username: true },
    });
    console.log(`[uat-seed]   test.selected  → ${userSelected.id}`);

    const userManager = await db.user.upsert({
      where: { username: 'test.manager' },
      create: {
        username: 'test.manager',
        displayName: '[UAT] Manager (CM-01 / ALL_DEPARTMENTS for Incidents+Contracts)',
        passwordHash,
        roleId: adminRole.id,
        departmentId: deptCm01.id,
        isActive: true,
        mustChangePassword: false,
      },
      update: {
        displayName: '[UAT] Manager (CM-01 / ALL_DEPARTMENTS for Incidents+Contracts)',
        roleId: adminRole.id,
        departmentId: deptCm01.id,
        isActive: true,
      },
      select: { id: true, username: true },
    });
    console.log(`[uat-seed]   test.manager   → ${userManager.id}`);

    const userNodept = await db.user.upsert({
      where: { username: 'test.nodept' },
      create: {
        username: 'test.nodept',
        displayName: '[UAT] No-Department User (fail-closed)',
        passwordHash,
        roleId: viewerRole.id,
        departmentId: null,
        isActive: true,
        mustChangePassword: false,
      },
      update: {
        displayName: '[UAT] No-Department User (fail-closed)',
        roleId: viewerRole.id,
        departmentId: null,
        isActive: true,
      },
      select: { id: true, username: true },
    });
    console.log(`[uat-seed]   test.nodept    → ${userNodept.id}`);

    // -----------------------------------------------------------------------
    // Step 7: Module access — test.selected
    //   FACTORY_TASKS:     SELECTED_DEPARTMENTS → [CM-01, ENG-01]
    //   INCIDENT_REPORT:   SELECTED_DEPARTMENTS → [CM-01, ENG-01]
    //   All others:        OWN_DEPARTMENT (no explicit row = default)
    // -----------------------------------------------------------------------

    console.log('[uat-seed] Step 7: Module access for test.selected…');

    for (const mod of [ModuleIdentifier.FACTORY_TASKS, ModuleIdentifier.INCIDENT_REPORT]) {
      const access = await db.userModuleAccess.upsert({
        where: { userId_module: { userId: userSelected.id, module: mod } },
        create: { userId: userSelected.id, module: mod, scope: DepartmentAccessScope.SELECTED_DEPARTMENTS },
        update: { scope: DepartmentAccessScope.SELECTED_DEPARTMENTS },
        select: { id: true },
      });
      // Replace grant rows atomically
      await db.userModuleDepartmentGrant.deleteMany({ where: { userModuleAccessId: access.id } });
      await db.userModuleDepartmentGrant.createMany({
        data: [
          { userModuleAccessId: access.id, departmentId: deptCm01.id },
          { userModuleAccessId: access.id, departmentId: deptEng01.id },
        ],
        skipDuplicates: true,
      });
      console.log(`[uat-seed]   SELECTED_DEPARTMENTS[CM-01,ENG-01] → ${mod}`);
    }

    // -----------------------------------------------------------------------
    // Step 8: Module access — test.manager
    //   INCIDENT_REPORT:       ALL_DEPARTMENTS
    //   CONTRACTS_MANAGEMENT:  ALL_DEPARTMENTS
    //   All others:            OWN_DEPARTMENT (no explicit row = default)
    // -----------------------------------------------------------------------

    console.log('[uat-seed] Step 8: Module access for test.manager…');

    for (const mod of [ModuleIdentifier.INCIDENT_REPORT, ModuleIdentifier.CONTRACTS_MANAGEMENT]) {
      await db.userModuleAccess.upsert({
        where: { userId_module: { userId: userManager.id, module: mod } },
        create: { userId: userManager.id, module: mod, scope: DepartmentAccessScope.ALL_DEPARTMENTS },
        update: { scope: DepartmentAccessScope.ALL_DEPARTMENTS },
        select: { id: true },
      });
      console.log(`[uat-seed]   ALL_DEPARTMENTS → ${mod}`);
    }

    // -----------------------------------------------------------------------
    // Step 9: UAT test records — one per module per department
    // Creator for all records: test.operator (already exists)
    //
    // Reference numbers use the module's enforced format (MODULE-YYYY-NNNNNN).
    // UAT records use the 999xxx range to avoid colliding with real sequences.
    // These numbers are NOT inserted into the sequence tables; real records
    // continue from wherever the sequence left off. Gaps are acceptable.
    // -----------------------------------------------------------------------

    console.log('[uat-seed] Step 9: UAT test records…');

    const now = new Date();
    const creator = userOperator.id;
    const YEAR = now.getUTCFullYear();

    // [referenceNumber, label, departmentId]
    type RecordSpec = [string, string, string];

    // — Factory Tasks —
    const taskSpecs: RecordSpec[] = [
      [`TASK-${YEAR}-999001`, 'CM-01', deptCm01.id],
      [`TASK-${YEAR}-999002`, 'ENG-01', deptEng01.id],
    ];
    for (const [ref, label, deptId] of taskSpecs) {
      const existing = await db.factoryTask.findUnique({ where: { referenceNumber: ref }, select: { id: true } });
      if (!existing) {
        await db.factoryTask.create({
          data: {
            referenceNumber: ref,
            title: `[UAT] Acceptance Test Task — ${label}`,
            description: '[UAT] Created by uat-seed.ts. Safe to delete via uat-cleanup.ts.',
            priority: 'MEDIUM',
            status: 'OPEN',
            createdByUserId: creator,
            responsibleDepartmentId: deptId,
          },
        });
        console.log(`[uat-seed]   FactoryTask ${ref} (${label}) created`);
      } else {
        console.log(`[uat-seed]   FactoryTask ${ref} already exists — skipped`);
      }
    }

    // — Incidents —
    const incidentSpecs: RecordSpec[] = [
      [`INC-${YEAR}-999001`, 'CM-01', deptCm01.id],
      [`INC-${YEAR}-999002`, 'ENG-01', deptEng01.id],
    ];
    for (const [ref, label, deptId] of incidentSpecs) {
      const existing = await db.incident.findUnique({ where: { referenceNumber: ref }, select: { id: true } });
      if (!existing) {
        await db.incident.create({
          data: {
            referenceNumber: ref,
            title: `[UAT] Acceptance Test Incident — ${label}`,
            description: '[UAT] Created by uat-seed.ts. Safe to delete via uat-cleanup.ts.',
            severity: 'LOW',
            status: 'DRAFT',
            occurredAt: now,
            reportedByUserId: creator,
            affectedDepartmentId: deptId,
          },
        });
        console.log(`[uat-seed]   Incident ${ref} (${label}) created`);
      } else {
        console.log(`[uat-seed]   Incident ${ref} already exists — skipped`);
      }
    }

    // — Maintenance Requests —
    const mrSpecs: RecordSpec[] = [
      [`MR-${YEAR}-999001`, 'CM-01', deptCm01.id],
      [`MR-${YEAR}-999002`, 'ENG-01', deptEng01.id],
    ];
    for (const [ref, label, deptId] of mrSpecs) {
      const existing = await db.maintenanceRequest.findUnique({ where: { referenceNumber: ref }, select: { id: true } });
      if (!existing) {
        await db.maintenanceRequest.create({
          data: {
            referenceNumber: ref,
            title: `[UAT] Acceptance Test Maintenance Request — ${label}`,
            problemDescription: '[UAT] Created by uat-seed.ts. Safe to delete via uat-cleanup.ts.',
            priority: 'LOW',
            status: 'DRAFT',
            createdByUserId: creator,
            affectedDepartmentId: deptId,
          },
        });
        console.log(`[uat-seed]   MaintenanceRequest ${ref} (${label}) created`);
      } else {
        console.log(`[uat-seed]   MaintenanceRequest ${ref} already exists — skipped`);
      }
    }

    // — Safety Inspections + one Finding each —
    const safetySpecs: RecordSpec[] = [
      [`SAFE-${YEAR}-999001`, 'CM-01', deptCm01.id],
      [`SAFE-${YEAR}-999002`, 'ENG-01', deptEng01.id],
    ];
    for (const [ref, label, deptId] of safetySpecs) {
      const existing = await db.safetyInspection.findUnique({ where: { referenceNumber: ref }, select: { id: true } });
      if (!existing) {
        const inspection = await db.safetyInspection.create({
          data: {
            referenceNumber: ref,
            title: `[UAT] Acceptance Test Inspection — ${label}`,
            status: 'DRAFT',
            createdByUserId: creator,
            departmentId: deptId,
          },
          select: { id: true },
        });
        await db.safetyFinding.create({
          data: {
            inspectionId: inspection.id,
            title: `[UAT] Acceptance Test Finding — ${label}`,
            description: '[UAT] Created by uat-seed.ts.',
            severity: 'LOW',
            status: 'OPEN',
            createdByUserId: creator,
          },
        });
        console.log(`[uat-seed]   SafetyInspection ${ref} (${label}) + finding created`);
      } else {
        console.log(`[uat-seed]   SafetyInspection ${ref} already exists — skipped`);
      }
    }

    // — Contracts —
    const contractSpecs: RecordSpec[] = [
      [`CONTRACT-${YEAR}-999001`, 'CM-01', deptCm01.id],
      [`CONTRACT-${YEAR}-999002`, 'ENG-01', deptEng01.id],
    ];
    for (const [ref, label, deptId] of contractSpecs) {
      const existing = await db.contract.findUnique({ where: { referenceNumber: ref }, select: { id: true } });
      if (!existing) {
        await db.contract.create({
          data: {
            referenceNumber: ref,
            title: `[UAT] Acceptance Test Contract — ${label}`,
            counterpartyName: '[UAT] Test Vendor',
            status: 'DRAFT',
            createdByUserId: creator,
            ownerUserId: creator,
            departmentId: deptId,
          },
        });
        console.log(`[uat-seed]   Contract ${ref} (${label}) created`);
      } else {
        console.log(`[uat-seed]   Contract ${ref} already exists — skipped`);
      }
    }

    // — Production Orders —
    const prodSpecs: RecordSpec[] = [
      [`PROD-${YEAR}-999001`, 'CM-01', deptCm01.id],
      [`PROD-${YEAR}-999002`, 'ENG-01', deptEng01.id],
    ];
    for (const [ref, label, deptId] of prodSpecs) {
      const existing = await db.productionOrder.findUnique({ where: { referenceNumber: ref }, select: { id: true } });
      if (!existing) {
        await db.productionOrder.create({
          data: {
            referenceNumber: ref,
            title: `[UAT] Acceptance Test Production Order — ${label}`,
            status: 'DRAFT',
            targetQuantity: 1,
            unit: 'pcs',
            createdByUserId: creator,
            departmentId: deptId,
            productionLineId: prodLine.id,
          },
        });
        console.log(`[uat-seed]   ProductionOrder ${ref} (${label}) created`);
      } else {
        console.log(`[uat-seed]   ProductionOrder ${ref} already exists — skipped`);
      }
    }

    // -----------------------------------------------------------------------
    // Step 10: Audit event
    // -----------------------------------------------------------------------

    await db.securityAuditEvent.create({
      data: {
        event: 'uat_seed_executed',
        metadata: {
          nodeEnv,
          deptCm01Id: deptCm01.id,
          deptEng01Id: deptEng01.id,
          plantId: plant.id,
          locationId: location.id,
          testUserIds: [userOperator.id, userSelected.id, userManager.id, userNodept.id],
          executedAt: now.toISOString(),
        },
      },
    });

    console.log('');
    console.log('[uat-seed] ✓ Seed complete.');
    console.log('');
    console.log('[uat-seed] Test user credentials (change if promoting to shared staging):');
    console.log('  Username          Password');
    console.log('  ──────────────────────────────────────');
    console.log(`  test.operator     ${UAT_PASSWORD}`);
    console.log(`  test.selected     ${UAT_PASSWORD}`);
    console.log(`  test.manager      ${UAT_PASSWORD}`);
    console.log(`  test.nodept       ${UAT_PASSWORD}`);
    console.log('');
    console.log('[uat-seed] UAT records created (titles prefixed with [UAT], refs in 999xxx range):');
    console.log(`  Module               CM-01                        ENG-01`);
    console.log('  ──────────────────────────────────────────────────────────────────────────');
    console.log(`  Factory Tasks        TASK-${YEAR}-999001          TASK-${YEAR}-999002`);
    console.log(`  Incidents            INC-${YEAR}-999001           INC-${YEAR}-999002`);
    console.log(`  Maintenance          MR-${YEAR}-999001            MR-${YEAR}-999002`);
    console.log(`  Safety               SAFE-${YEAR}-999001          SAFE-${YEAR}-999002`);
    console.log(`  Contracts            CONTRACT-${YEAR}-999001      CONTRACT-${YEAR}-999002`);
    console.log(`  Production           PROD-${YEAR}-999001          PROD-${YEAR}-999002`);
    console.log('');
    console.log('[uat-seed] Run uat:cleanup to remove all UAT data when testing is complete.');
  } finally {
    await db.$disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error('[uat-seed] Fatal error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
