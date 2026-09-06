import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';

// ---------------------------------------------------------------------------
// CM-66 — shared helper for writing into the existing ContractActivity table
// (contracts.service.ts / contract-closeout.service.ts already write to it
// directly for contract-level/closeout events; this function reuses the
// exact same shape for the additional sources this unit adds: Payments,
// Documents & Obligations, Variations, Claims, Risks, Issues). No new
// table, no schema change.
// ---------------------------------------------------------------------------

/**
 * Best-effort audit-trail write — deliberately never throws. Activity
 * logging is a supplementary record of what happened, not the operation
 * itself; a rare failure writing this row must never turn an otherwise-
 * successful create/update into a failed request.
 */
export async function logContractActivity(
  db: DatabaseService,
  contractId: string,
  actor: AuthUser,
  event: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.getClient().contractActivity.create({
      data: {
        contractId,
        actorUserId: actor.id,
        actorName: actor.displayName,
        event,
        ...(metadata !== undefined ? { metadata: metadata as never } : {}),
      },
    });
  } catch {
    // Deliberately swallowed — see doc comment above.
  }
}
