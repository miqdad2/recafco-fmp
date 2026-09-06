// ---------------------------------------------------------------------------
// CM-66 — Pure, presentation-agnostic helpers for the Contract Detail
// Activity / Audit History tab. Reuses the existing ContractActivity table
// (contracts.service.ts / contract-closeout.service.ts already write real
// events into it; CM-66 additively logs Payments/Documents & Obligations/
// Variations/Claims/Risks/Issues create+update too — see
// contract-activity-log.ts on the backend). Every label/derivation here is
// keyed off the real `event` string already stored — never a fabricated
// category, user, date, or value. Dependency-free so it can be unit tested
// directly, matching contract-risk-helpers.ts / contract-issue-detail-helpers.ts.
// ---------------------------------------------------------------------------

import type { ContractActivity } from '@/lib/contracts-api';

export type ActivityType =
  | 'CONTRACT_CREATED'
  | 'CONTRACT_UPDATED'
  | 'STATUS_CHANGED'
  | 'DOCUMENT_UPLOADED'
  | 'PAYMENT_UPDATED'
  | 'WORKFLOW_UPDATED'
  | 'VARIATION_UPDATED'
  | 'CLAIM_UPDATED'
  | 'RISK_UPDATED'
  | 'ISSUE_UPDATED'
  | 'CLOSEOUT_ACTION'
  | 'OTHER';

/**
 * Real `event` string (as written by contracts.service.ts /
 * contract-closeout.service.ts / contract-activity-log.ts) -> manager-
 * facing action label. Every event this app can actually log is listed
 * here explicitly — an unrecognized event falls back to a readable
 * title-cased version of the raw string, never a blank label.
 */
const ACTION_LABELS: Record<string, string> = {
  created: 'Contract Created',
  updated: 'Contract Updated',
  schedule_status_updated: 'Schedule Status Updated',
  activated: 'Contract Activated',
  terminated: 'Contract Terminated',
  closed: 'Contract Closed',
  comment_added: 'Comment Added',
  closeout_requested: 'Closeout Requested',
  closeout_review_started: 'Closeout Review Started',
  closeout_approved: 'Closeout Approved',
  closeout_rejected: 'Closeout Rejected',
  closeout_attachment_uploaded: 'Closeout Attachment Uploaded',
  payment_created: 'Payment Added',
  payment_updated: 'Payment Updated',
  document_obligation_created: 'Document Added',
  document_obligation_updated: 'Document Updated',
  document_obligation_attachment_uploaded: 'Document Attachment Uploaded',
  variation_created: 'Variation Added',
  variation_updated: 'Variation Updated',
  variation_attachment_uploaded: 'Variation Attachment Uploaded',
  claim_created: 'Claim Added',
  claim_updated: 'Claim Updated',
  risk_created: 'Risk Added',
  risk_updated: 'Risk Updated',
  issue_created: 'Issue Added',
  issue_updated: 'Issue Updated',
};

export function activityActionLabel(event: string): string {
  return ACTION_LABELS[event] ?? event.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const ACTIVITY_TYPE_BY_EVENT: Record<string, ActivityType> = {
  created: 'CONTRACT_CREATED',
  updated: 'CONTRACT_UPDATED',
  schedule_status_updated: 'STATUS_CHANGED',
  activated: 'STATUS_CHANGED',
  terminated: 'STATUS_CHANGED',
  closed: 'STATUS_CHANGED',
  comment_added: 'OTHER',
  closeout_requested: 'CLOSEOUT_ACTION',
  closeout_review_started: 'CLOSEOUT_ACTION',
  closeout_approved: 'CLOSEOUT_ACTION',
  closeout_rejected: 'CLOSEOUT_ACTION',
  closeout_attachment_uploaded: 'DOCUMENT_UPLOADED',
  payment_created: 'PAYMENT_UPDATED',
  payment_updated: 'PAYMENT_UPDATED',
  document_obligation_created: 'OTHER',
  document_obligation_updated: 'OTHER',
  document_obligation_attachment_uploaded: 'DOCUMENT_UPLOADED',
  variation_created: 'VARIATION_UPDATED',
  variation_updated: 'VARIATION_UPDATED',
  variation_attachment_uploaded: 'DOCUMENT_UPLOADED',
  claim_created: 'CLAIM_UPDATED',
  claim_updated: 'CLAIM_UPDATED',
  risk_created: 'RISK_UPDATED',
  risk_updated: 'RISK_UPDATED',
  issue_created: 'ISSUE_UPDATED',
  issue_updated: 'ISSUE_UPDATED',
};

export function activityType(event: string): ActivityType {
  return ACTIVITY_TYPE_BY_EVENT[event] ?? 'OTHER';
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CONTRACT_CREATED: 'Contract Created',
  CONTRACT_UPDATED: 'Contract Updated',
  STATUS_CHANGED: 'Status Changed',
  DOCUMENT_UPLOADED: 'Document Uploaded',
  PAYMENT_UPDATED: 'Payment',
  WORKFLOW_UPDATED: 'Workflow',
  VARIATION_UPDATED: 'Variation',
  CLAIM_UPDATED: 'Claim',
  RISK_UPDATED: 'Risk',
  ISSUE_UPDATED: 'Issue',
  CLOSEOUT_ACTION: 'Closeout',
  OTHER: 'Other',
};

export type ActivitySource =
  | 'Overview'
  | 'Payments'
  | 'Workflow & Team Tasks'
  | 'Variations / Change Orders'
  | 'Claims'
  | 'Risk Assessment'
  | 'Documents & Obligations'
  | 'Issue Log'
  | 'Attachments'
  | 'Closeout';

const SOURCE_BY_EVENT: Record<string, ActivitySource> = {
  created: 'Overview',
  updated: 'Overview',
  schedule_status_updated: 'Overview',
  activated: 'Overview',
  terminated: 'Overview',
  closed: 'Overview',
  comment_added: 'Overview',
  closeout_requested: 'Closeout',
  closeout_review_started: 'Closeout',
  closeout_approved: 'Closeout',
  closeout_rejected: 'Closeout',
  closeout_attachment_uploaded: 'Closeout',
  payment_created: 'Payments',
  payment_updated: 'Payments',
  document_obligation_created: 'Documents & Obligations',
  document_obligation_updated: 'Documents & Obligations',
  document_obligation_attachment_uploaded: 'Documents & Obligations',
  variation_created: 'Variations / Change Orders',
  variation_updated: 'Variations / Change Orders',
  variation_attachment_uploaded: 'Variations / Change Orders',
  claim_created: 'Claims',
  claim_updated: 'Claims',
  risk_created: 'Risk Assessment',
  risk_updated: 'Risk Assessment',
  issue_created: 'Issue Log',
  issue_updated: 'Issue Log',
};

export function activitySource(event: string): ActivitySource {
  return SOURCE_BY_EVENT[event] ?? 'Overview';
}

export const ACTIVITY_SOURCE_OPTIONS: ActivitySource[] = [
  'Overview', 'Payments', 'Workflow & Team Tasks', 'Variations / Change Orders', 'Claims',
  'Risk Assessment', 'Documents & Obligations', 'Issue Log', 'Attachments', 'Closeout',
];

/** Genuinely identifiable review/approval actions — real closeout events, never guessed. */
const REVIEW_APPROVAL_EVENTS = ['closeout_review_started', 'closeout_approved', 'closeout_rejected'];

export function isReviewApprovalEvent(event: string): boolean {
  return REVIEW_APPROVAL_EVENTS.includes(event);
}

/** Safe string read from an activity's real `metadata` JSON — never throws, never invents a value for a missing/wrong-shaped key. */
function metaStr(metadata: unknown, key: string): string | undefined {
  if (typeof metadata !== 'object' || metadata === null) return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined;
}

/**
 * Concise, human-readable summary of what happened — never raw JSON. Pulls
 * only the specific, already-known-safe fields each event's metadata
 * actually carries (see the CM-66 logging call sites); anything absent is
 * just omitted from the sentence, never replaced with a fabricated value.
 */
export function activityDetails(activity: ContractActivity): string {
  const m = activity.metadata;
  switch (activity.event) {
    case 'created':
      return 'Contract created';
    case 'updated':
      return 'Contract details updated';
    case 'schedule_status_updated': {
      const prev = metaStr(m, 'previousScheduleStatus');
      const next = metaStr(m, 'newScheduleStatus');
      return prev && next ? `Schedule status changed from ${prev} to ${next}` : 'Schedule status updated';
    }
    case 'activated':
      return 'Contract activated';
    case 'terminated': {
      const reason = metaStr(m, 'reason');
      return reason ? `Contract terminated: ${reason}` : 'Contract terminated';
    }
    case 'closed':
      return 'Contract closed';
    case 'comment_added':
      return 'Comment added';
    case 'closeout_requested': {
      const no = metaStr(m, 'requestNo');
      return no ? `Closeout requested (${no})` : 'Closeout requested';
    }
    case 'closeout_review_started':
      return 'Closeout review started';
    case 'closeout_approved': {
      const no = metaStr(m, 'requestNo');
      return no ? `Closeout approved (${no})` : 'Closeout approved';
    }
    case 'closeout_rejected': {
      const no = metaStr(m, 'requestNo');
      return no ? `Closeout rejected (${no})` : 'Closeout rejected';
    }
    case 'closeout_attachment_uploaded': {
      const file = metaStr(m, 'fileName');
      return file ? `File uploaded: ${file}` : 'Closeout attachment uploaded';
    }
    case 'payment_created': {
      const no = metaStr(m, 'paymentNo');
      return no ? `Payment ${no} added` : 'Payment added';
    }
    case 'payment_updated': {
      const no = metaStr(m, 'paymentNo');
      return no ? `Payment ${no} updated` : 'Payment updated';
    }
    case 'document_obligation_created': {
      const title = metaStr(m, 'title');
      return title ? `Document "${title}" added` : 'Document added';
    }
    case 'document_obligation_updated': {
      const title = metaStr(m, 'title');
      return title ? `Document "${title}" updated` : 'Document updated';
    }
    case 'document_obligation_attachment_uploaded':
    case 'variation_attachment_uploaded': {
      const file = metaStr(m, 'fileName');
      return file ? `File uploaded: ${file}` : 'File uploaded';
    }
    case 'variation_created': {
      const no = metaStr(m, 'variationNo');
      return no ? `Variation ${no} added` : 'Variation added';
    }
    case 'variation_updated': {
      const no = metaStr(m, 'variationNo');
      return no ? `Variation ${no} updated` : 'Variation updated';
    }
    case 'claim_created': {
      const no = metaStr(m, 'claimNo');
      return no ? `Claim ${no} added` : 'Claim added';
    }
    case 'claim_updated': {
      const no = metaStr(m, 'claimNo');
      return no ? `Claim ${no} updated` : 'Claim updated';
    }
    case 'risk_created': {
      const no = metaStr(m, 'riskNo');
      return no ? `Risk ${no} added` : 'Risk added';
    }
    case 'risk_updated': {
      const no = metaStr(m, 'riskNo');
      return no ? `Risk ${no} updated` : 'Risk updated';
    }
    case 'issue_created': {
      const no = metaStr(m, 'issueNo');
      return no ? `Issue ${no} added` : 'Issue added';
    }
    case 'issue_updated': {
      const no = metaStr(m, 'issueNo');
      return no ? `Issue ${no} updated` : 'Issue updated';
    }
    default:
      return activityActionLabel(activity.event);
  }
}

/** Real previousStatus/newStatus DB columns first (contract lifecycle changes); falls back to the real schedule-status metadata pair when that's what was actually captured. "—" only when genuinely nothing was recorded. */
export function activityOldValue(activity: ContractActivity): string {
  if (activity.previousStatus) return activity.previousStatus;
  const prevSchedule = metaStr(activity.metadata, 'previousScheduleStatus');
  return prevSchedule ?? '—';
}

export function activityNewValue(activity: ContractActivity): string {
  if (activity.newStatus) return activity.newStatus;
  const newSchedule = metaStr(activity.metadata, 'newScheduleStatus');
  return newSchedule ?? '—';
}

export interface ActivitySummary {
  totalActivities: number;
  updatesThisMonth: number;
  documentsUploaded: number;
  statusChanges: number;
  reviewApprovalActions: number;
}

/** Real counts only — every number here is derived directly from the real activity list already fetched, never a fabricated total. */
export function computeActivitySummary(activities: ContractActivity[], now: Date = new Date()): ActivitySummary {
  let updatesThisMonth = 0;
  let documentsUploaded = 0;
  let statusChanges = 0;
  let reviewApprovalActions = 0;

  for (const a of activities) {
    const created = new Date(a.createdAt);
    if (created.getUTCFullYear() === now.getUTCFullYear() && created.getUTCMonth() === now.getUTCMonth()) {
      updatesThisMonth += 1;
    }
    if (activityType(a.event) === 'DOCUMENT_UPLOADED') documentsUploaded += 1;
    if (activityType(a.event) === 'STATUS_CHANGED') statusChanges += 1;
    if (isReviewApprovalEvent(a.event)) reviewApprovalActions += 1;
  }

  return {
    totalActivities: activities.length,
    updatesThisMonth,
    documentsUploaded,
    statusChanges,
    reviewApprovalActions,
  };
}
