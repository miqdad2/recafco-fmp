import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/types/auth-user';

/**
 * CM-71H.1 — Steps 1/3/5 (Issue Erection Method Statement, Issue Erection
 * Schedule, Erection Start) are Erection-Department-owned, per CM-71H's own
 * ownership table. An assigned Erection Manager's role today is typically
 * Contract Staff (contracts.workflow_update, no contracts.update) — without
 * this relaxation an assigned Erection Manager could see their assignment
 * and the Erection Dashboard, but could never actually save these 3 steps,
 * defeating the point of being assigned ("update erection-owned steps if
 * permissions allow"). Mirrors the EXISTING AnyPermission('contracts.update',
 * 'contracts.workflow_update') precedent already used for the generic
 * ContractWorkflowTask routes in contracts.controller.ts — deliberately NOT
 * extended to Steps 2/4/6 (QA/QC- and Delivery/Logistics-owned, out of this
 * unit's scope) or any other contracts.update-gated endpoint in this app.
 * Department-scope access (DepartmentAccessService) is unaffected — this
 * only widens WHO may attempt the write, not which contracts they can reach.
 */
export function assertCanWriteErectionDepartmentStep(actor: AuthUser): void {
  if (!actor.permissions.includes('contracts.update') && !actor.permissions.includes('contracts.workflow_update')) {
    throw new ForbiddenException({
      code: 'CONTRACTS_PERMISSION_DENIED',
      message: 'Missing contracts.update or contracts.workflow_update',
    });
  }
}
