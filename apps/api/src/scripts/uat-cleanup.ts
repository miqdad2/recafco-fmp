/**
 * uat-cleanup.ts
 *
 * Idempotent cleanup of UAT data created by uat-seed.ts.
 *
 * SAFETY GUARDS:
 *   1. Aborts immediately if NODE_ENV === 'production'.
 *   2. The --force-production flag exists only to document that it is NOT supported;
 *      passing it exits with an error and a clear message.
 *
 * What is removed:
 *   - All records whose referenceNumber starts with 'UAT-' (across all 6 modules)
 *   - All safety findings that belong to UAT safety inspections
 *   - TEST-LOC-01 location
 *   - UAT-LINE-01 production line
 *   - TEST-PLANT-01 plant (only if no non-UAT records reference it)
 *   - ENG-01 department (only if created by the UAT seed and has zero non-UAT records)
 *   - test.operator, test.selected, test.manager, test.nodept users
 *     (their UserModuleAccess and grants cascade-delete automatically)
 *
 * What is NEVER removed:
 *   - CM-01 department (business data; must exist before and after UAT)
 *   - Any record whose title/referenceNumber does NOT start with 'UAT-' or '[UAT]'
 *   - Any non-test user
 *
 * Run with:
 *   pnpm --filter @recafco/api uat:cleanup
 */

import 'reflect-metadata';
import { createPrismaClient } from '@recafco/database';

// ---------------------------------------------------------------------------
// Production guard
// ---------------------------------------------------------------------------

function abortIfProduction(): void {
  const args = process.argv.slice(2);
  if (args.includes('--force-production')) {
    console.error('[uat-cleanup] ABORT: --force-production is not supported. Production cleanup must be done manually.');
    process.exit(1);
  }
  if (process.env['NODE_ENV'] === 'production') {
    console.error('[uat-cleanup] ABORT: NODE_ENV=production. This script must not run in production.');
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
    console.error('[uat-cleanup] ERROR: DATABASE_URL is not set.');
    process.exitCode = 1;
    return;
  }

  console.log(`[uat-cleanup] Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
  console.log('[uat-cleanup] Starting UAT cleanup (idempotent)…');

  const db = createPrismaClient({
    databaseUrl: dbUrl,
    poolMax: 1,
    connectionTimeoutMs: 10_000,
    statementTimeoutMs: 60_000,
  });

  try {
    await db.$connect();

    // -----------------------------------------------------------------------
    // Step 1: UAT module records (titles start with '[UAT]')
    // Delete child rows first where cascade is not defined.
    // -----------------------------------------------------------------------

    console.log('[uat-cleanup] Step 1: Removing UAT module records…');

    // Factory task child rows (comments, activities, progress) cascade from task delete
    // via onDelete: Restrict on factoryTask — need to delete children manually first
    const uatTasks = await db.factoryTask.findMany({
      where: { title: { startsWith: '[UAT]' } },
      select: { id: true, referenceNumber: true },
    });
    for (const task of uatTasks) {
      await db.factoryTaskProgress.deleteMany({ where: { taskId: task.id } });
      await db.factoryTaskComment.deleteMany({ where: { taskId: task.id } });
      await db.factoryTaskActivity.deleteMany({ where: { taskId: task.id } });
      await db.factoryTask.delete({ where: { id: task.id } });
      console.log(`[uat-cleanup]   Deleted FactoryTask ${task.referenceNumber}`);
    }

    // Incidents: delete child rows first
    const uatIncidents = await db.incident.findMany({
      where: { title: { startsWith: '[UAT]' } },
      select: { id: true, referenceNumber: true },
    });
    for (const inc of uatIncidents) {
      await db.incidentAction.deleteMany({ where: { incidentId: inc.id } });
      await db.incidentComment.deleteMany({ where: { incidentId: inc.id } });
      await db.incidentActivity.deleteMany({ where: { incidentId: inc.id } });
      await db.incident.delete({ where: { id: inc.id } });
      console.log(`[uat-cleanup]   Deleted Incident ${inc.referenceNumber}`);
    }

    // Maintenance requests: delete child rows first
    const uatMRs = await db.maintenanceRequest.findMany({
      where: { title: { startsWith: '[UAT]' } },
      select: { id: true, referenceNumber: true },
    });
    for (const mr of uatMRs) {
      await db.maintenanceRequestComment.deleteMany({ where: { requestId: mr.id } });
      await db.maintenanceRequestActivity.deleteMany({ where: { requestId: mr.id } });
      await db.maintenanceRequest.delete({ where: { id: mr.id } });
      console.log(`[uat-cleanup]   Deleted MaintenanceRequest ${mr.referenceNumber}`);
    }

    // Safety: delete findings → comments/activities → inspection
    const uatInspections = await db.safetyInspection.findMany({
      where: { title: { startsWith: '[UAT]' } },
      select: { id: true, referenceNumber: true },
    });
    for (const insp of uatInspections) {
      await db.safetyFinding.deleteMany({ where: { inspectionId: insp.id } });
      await db.safetyInspectionComment.deleteMany({ where: { inspectionId: insp.id } });
      await db.safetyInspectionActivity.deleteMany({ where: { inspectionId: insp.id } });
      await db.safetyInspection.delete({ where: { id: insp.id } });
      console.log(`[uat-cleanup]   Deleted SafetyInspection ${insp.referenceNumber}`);
    }

    // Contracts: delete child rows first
    const uatContracts = await db.contract.findMany({
      where: { title: { startsWith: '[UAT]' } },
      select: { id: true, referenceNumber: true },
    });
    for (const c of uatContracts) {
      await db.contractComment.deleteMany({ where: { contractId: c.id } });
      await db.contractActivity.deleteMany({ where: { contractId: c.id } });
      await db.contract.delete({ where: { id: c.id } });
      console.log(`[uat-cleanup]   Deleted Contract ${c.referenceNumber}`);
    }

    // Production orders: delete child rows first
    const uatOrders = await db.productionOrder.findMany({
      where: { title: { startsWith: '[UAT]' } },
      select: { id: true, referenceNumber: true },
    });
    for (const ord of uatOrders) {
      await db.productionEntry.deleteMany({ where: { orderId: ord.id } });
      await db.productionComment.deleteMany({ where: { orderId: ord.id } });
      await db.productionActivity.deleteMany({ where: { orderId: ord.id } });
      await db.productionOrder.delete({ where: { id: ord.id } });
      console.log(`[uat-cleanup]   Deleted ProductionOrder ${ord.referenceNumber}`);
    }

    // -----------------------------------------------------------------------
    // Step 2: Test users (UserModuleAccess + grants cascade automatically)
    // -----------------------------------------------------------------------

    console.log('[uat-cleanup] Step 2: Removing test users…');

    const testUsernames = ['test.operator', 'test.selected', 'test.manager', 'test.nodept'];
    for (const username of testUsernames) {
      const user = await db.user.findUnique({ where: { username }, select: { id: true } });
      if (user) {
        await db.userSession.deleteMany({ where: { userId: user.id } });
        await db.user.delete({ where: { id: user.id } });
        console.log(`[uat-cleanup]   Deleted user: ${username}`);
      } else {
        console.log(`[uat-cleanup]   User ${username} not found — skipped`);
      }
    }

    // -----------------------------------------------------------------------
    // Step 3: Production line
    // -----------------------------------------------------------------------

    console.log('[uat-cleanup] Step 3: Production line…');

    const uatLine = await db.productionLine.findUnique({ where: { code: 'UAT-LINE-01' }, select: { id: true } });
    if (uatLine) {
      await db.productionLine.delete({ where: { id: uatLine.id } });
      console.log('[uat-cleanup]   Deleted production line UAT-LINE-01');
    } else {
      console.log('[uat-cleanup]   UAT-LINE-01 not found — skipped');
    }

    // -----------------------------------------------------------------------
    // Step 4: Location (TEST-LOC-01)
    // -----------------------------------------------------------------------

    console.log('[uat-cleanup] Step 4: Location…');

    const uatLoc = await db.location.findUnique({ where: { code: 'TEST-LOC-01' }, select: { id: true } });
    if (uatLoc) {
      await db.location.delete({ where: { id: uatLoc.id } });
      console.log('[uat-cleanup]   Deleted location TEST-LOC-01');
    } else {
      console.log('[uat-cleanup]   TEST-LOC-01 not found — skipped');
    }

    // -----------------------------------------------------------------------
    // Step 5: Plant (TEST-PLANT-01) — only if no remaining dependent records
    // -----------------------------------------------------------------------

    console.log('[uat-cleanup] Step 5: Plant…');

    const uatPlant = await db.plant.findUnique({ where: { code: 'TEST-PLANT-01' }, select: { id: true } });
    if (uatPlant) {
      const depsCount =
        (await db.location.count({ where: { plantId: uatPlant.id } })) +
        (await db.incident.count({ where: { affectedPlantId: uatPlant.id } })) +
        (await db.factoryTask.count({ where: { plantId: uatPlant.id } })) +
        (await db.maintenanceRequest.count({ where: { plantId: uatPlant.id } })) +
        (await db.safetyInspection.count({ where: { plantId: uatPlant.id } })) +
        (await db.contract.count({ where: { plantId: uatPlant.id } })) +
        (await db.productionLine.count({ where: { plantId: uatPlant.id } })) +
        (await db.productionOrder.count({ where: { plantId: uatPlant.id } })) +
        (await db.user.count({ where: { plantId: uatPlant.id } }));

      if (depsCount > 0) {
        console.log(`[uat-cleanup]   TEST-PLANT-01 has ${depsCount} remaining dependent record(s) — skipped.`);
        console.log('[uat-cleanup]   Remove those records first, then re-run uat:cleanup.');
      } else {
        await db.plant.delete({ where: { id: uatPlant.id } });
        console.log('[uat-cleanup]   Deleted plant TEST-PLANT-01');
      }
    } else {
      console.log('[uat-cleanup]   TEST-PLANT-01 not found — skipped');
    }

    // -----------------------------------------------------------------------
    // Step 6: ENG-01 department — only if no non-UAT dependencies remain
    // -----------------------------------------------------------------------

    console.log('[uat-cleanup] Step 6: ENG-01 department…');

    const eng01 = await db.department.findUnique({ where: { code: 'ENG-01' }, select: { id: true } });
    if (!eng01) {
      console.log('[uat-cleanup]   ENG-01 not found — skipped');
    } else {
      // Count any records NOT starting with the UAT prefix
      const nonUatTaskCount = await db.factoryTask.count({
        where: {
          responsibleDepartmentId: eng01.id,
          NOT: { title: { startsWith: '[UAT]' } },
        },
      });
      const nonUatIncCount = await db.incident.count({
        where: { affectedDepartmentId: eng01.id, NOT: { title: { startsWith: '[UAT]' } } },
      });
      const nonUatMRCount = await db.maintenanceRequest.count({
        where: { affectedDepartmentId: eng01.id, NOT: { title: { startsWith: '[UAT]' } } },
      });
      const nonUatSafeCount = await db.safetyInspection.count({
        where: { departmentId: eng01.id, NOT: { title: { startsWith: '[UAT]' } } },
      });
      const nonUatContCount = await db.contract.count({
        where: { departmentId: eng01.id, NOT: { title: { startsWith: '[UAT]' } } },
      });
      const nonUatProdCount = await db.productionOrder.count({
        where: { departmentId: eng01.id, NOT: { title: { startsWith: '[UAT]' } } },
      });
      const userCount = await db.user.count({
        where: { departmentId: eng01.id, NOT: { username: { startsWith: 'test.' } } },
      });
      const grantCount = await db.userModuleDepartmentGrant.count({ where: { departmentId: eng01.id } });

      const nonUatTotal = nonUatTaskCount + nonUatIncCount + nonUatMRCount + nonUatSafeCount + nonUatContCount + nonUatProdCount + userCount + grantCount;

      if (nonUatTotal > 0) {
        console.log(`[uat-cleanup]   ENG-01 has ${nonUatTotal} non-UAT dependent record(s) — skipped.`);
        console.log('[uat-cleanup]   ENG-01 was not removed. Remove non-UAT dependencies before re-running.');
      } else {
        await db.department.delete({ where: { id: eng01.id } });
        console.log('[uat-cleanup]   Deleted department ENG-01');
      }
    }

    // -----------------------------------------------------------------------
    // Step 7: Audit event
    // -----------------------------------------------------------------------

    await db.securityAuditEvent.create({
      data: {
        event: 'uat_cleanup_executed',
        metadata: {
          nodeEnv: process.env['NODE_ENV'] ?? 'development',
          executedAt: new Date().toISOString(),
        },
      },
    });

    console.log('');
    console.log('[uat-cleanup] ✓ Cleanup complete.');
    console.log('[uat-cleanup]   CM-01 and production users were not affected.');
  } finally {
    await db.$disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error('[uat-cleanup] Fatal error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
