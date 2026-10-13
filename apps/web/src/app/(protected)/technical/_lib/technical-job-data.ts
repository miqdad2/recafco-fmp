import { cookies } from 'next/headers';
import { authApi } from '@/lib/auth-api';
import {
  technicalApiFetchResult,
  fetchBoqConfirmations,
  fetchBoqAttachments,
  fetchAllowedPieceStatuses,
  fetchDrawingGroups,
  fetchElementCoverage,
} from '@/lib/technical-api';
import type { TechnicalWorkflowOverview } from '@/lib/technical-api';
import { canReadTechnical, canWriteTechnical } from './technical-permissions';
import { guidedWorkflow } from './technical-guided-workflow';

/** Why a job's Technical pages could not be shown. Only a job that really does not exist becomes a 404. */
export interface TechnicalJobUnavailable {
  kind: 'session' | 'forbidden' | 'access' | 'missing' | 'failed';
  title: string;
  message: string;
  /** Short code/status for support, never raw stack text. */
  detail: string;
}

export function describeUnavailable(kind: TechnicalJobUnavailable['kind'], detail: string): TechnicalJobUnavailable {
  switch (kind) {
    case 'session':
      return { kind, title: 'Please sign in again', message: 'Your session could not be verified, so Technical details cannot be shown.', detail };
    case 'forbidden':
      return { kind, title: 'No permission', message: 'You do not have permission to view Technical.', detail };
    case 'access':
      return { kind, title: 'No access to this job', message: 'You do not have access to the department that owns this job.', detail };
    case 'missing':
      return { kind, title: 'Job not found', message: 'The server could not find this job order. It may have been removed, or the link is wrong.', detail };
    default:
      return { kind, title: 'Technical details could not be loaded', message: 'Something went wrong while loading this job. Please refresh the page or try again in a moment.', detail };
  }
}

/**
 * FMP-TECH-23 — everything the Technical overview and the focused step pages
 * need for one job: same read check, same API calls and same write permission
 * the single Technical Details page used. A step page that does not need the
 * element-status list skips that one call.
 *
 * It used to turn every failure into a bare 404, which made a lost session or a
 * missing department access look like a missing page. Now only a job that does
 * not exist now also shows a visible "Job not found" page with the API code; every other failure comes back as `{ ok: false }` with a
 * plain reason (and is logged on the server with its code).
 */
export async function loadTechnicalJob(contractId: string, options: { withPieceStatuses?: boolean } = {}) {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const meResult = await authApi.me(accessToken);
  if (!meResult.ok) {
    const detail = `${meResult.code}: ${meResult.message}`;
    console.error(`[technical] job ${contractId}: could not verify the session (${detail})`);
    return { ok: false as const, unavailable: describeUnavailable('session', detail) };
  }
  const permissions = meResult.data.permissions;
  if (!canReadTechnical(permissions)) {
    console.error(`[technical] job ${contractId}: user ${meResult.data.id} has no technical.read / contracts.read`);
    return { ok: false as const, unavailable: describeUnavailable('forbidden', 'technical.read or contracts.read is missing') };
  }

  const overviewResult = await technicalApiFetchResult<TechnicalWorkflowOverview>(`/technical/jobs/${contractId}`);
  if (overviewResult.error) {
    const { status, code, message } = overviewResult.error;
    console.error(`[technical] job ${contractId}: overview failed (${status} ${code}: ${message})`);
    return { ok: false as const, unavailable: describeUnavailable(status === 403 ? 'access' : status === 404 ? 'missing' : 'failed', `${status} ${code}: ${message}`) };
  }
  const overview = overviewResult.data;

  // null when it could not be loaded; each section then shows a plain notice.
  const [boqConfirmations, allowedPieceStatuses, drawingGroups, boqAttachments, coverage] = await Promise.all([
    fetchBoqConfirmations(contractId),
    options.withPieceStatuses ? fetchAllowedPieceStatuses(contractId) : Promise.resolve(null),
    fetchDrawingGroups(contractId),
    fetchBoqAttachments(contractId),
    fetchElementCoverage(contractId),
  ]);

  return {
    ok: true as const,
    contract: overview.contract,
    workflow: overview.workflow,
    currentUserId: meResult.data.id,
    canWrite: canWriteTechnical(permissions),
    canManageFiles: permissions.includes('contracts.manage') || permissions.includes('technical.manage'),
    boqConfirmations,
    allowedPieceStatuses,
    drawingGroups,
    boqAttachments,
    coverage,
    guided: guidedWorkflow({ confirmations: boqConfirmations, attachments: boqAttachments, groupItems: drawingGroups, coverage: coverage?.summary ?? null }),
  };
}

export type TechnicalJobLoad = Awaited<ReturnType<typeof loadTechnicalJob>>;
