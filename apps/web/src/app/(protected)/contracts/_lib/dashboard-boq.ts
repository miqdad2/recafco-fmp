import { fetchBoqConfirmations, fetchDrawingGroups } from '@/lib/technical-api';
import { withTechnicalRelease } from './boq-progress-helpers';
import type { ProgressSource } from '../executive/_lib/project-overview-helpers';

/**
 * FMP-UI-48 — one contract's BOQ progress for the Contract Management dashboard: the same two read-only
 * calls the contract's own BOQ Progress page makes (BOQ confirmations + Technical drawing groups, merged with
 * `withTechnicalRelease`), so "Released to Production" and every other figure here match that page.
 * null = the BOQ could not be loaded, so nothing is claimed. If only the drawing groups fail, the rest still
 * shows and Released to Production is reported as not available.
 */
export async function fetchProjectBoq(contractId: string): Promise<ProgressSource[] | null> {
  const [items, groups] = await Promise.all([fetchBoqConfirmations(contractId), fetchDrawingGroups(contractId)]);
  if (items === null) return null;
  return groups === null ? items : withTechnicalRelease(items, groups);
}
