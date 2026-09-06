import { describe, it, expect } from 'vitest';
import {
  activityActionLabel,
  activityType,
  activitySource,
  ACTIVITY_SOURCE_OPTIONS,
  isReviewApprovalEvent,
  activityDetails,
  activityOldValue,
  activityNewValue,
  computeActivitySummary,
} from './contract-activity-helpers';
import type { ContractActivity } from '@/lib/contracts-api';

function makeActivity(overrides: Partial<ContractActivity> = {}): ContractActivity {
  return {
    id: 'a1',
    contractId: 'contract-1',
    actorUserId: 'user-1',
    actorName: 'Manager',
    event: 'created',
    createdAt: '2026-01-05T00:00:00Z',
    ...overrides,
  };
}

describe('activityActionLabel', () => {
  it('maps known real events to their manager-facing label', () => {
    expect(activityActionLabel('created')).toBe('Contract Created');
    expect(activityActionLabel('payment_created')).toBe('Payment Added');
    expect(activityActionLabel('closeout_approved')).toBe('Closeout Approved');
  });

  it('falls back to a readable title-cased version for an unrecognized event (never blank)', () => {
    expect(activityActionLabel('some_future_event')).toBe('Some Future Event');
  });
});

describe('activityType', () => {
  it('maps contract-level events correctly', () => {
    expect(activityType('created')).toBe('CONTRACT_CREATED');
    expect(activityType('updated')).toBe('CONTRACT_UPDATED');
    expect(activityType('activated')).toBe('STATUS_CHANGED');
  });

  it('maps every real *_attachment_uploaded event to DOCUMENT_UPLOADED, never a record-creation event', () => {
    expect(activityType('document_obligation_attachment_uploaded')).toBe('DOCUMENT_UPLOADED');
    expect(activityType('variation_attachment_uploaded')).toBe('DOCUMENT_UPLOADED');
    expect(activityType('closeout_attachment_uploaded')).toBe('DOCUMENT_UPLOADED');
    expect(activityType('document_obligation_created')).not.toBe('DOCUMENT_UPLOADED');
  });

  it('maps each domain create/update pair to its own type', () => {
    expect(activityType('payment_created')).toBe('PAYMENT_UPDATED');
    expect(activityType('variation_updated')).toBe('VARIATION_UPDATED');
    expect(activityType('claim_created')).toBe('CLAIM_UPDATED');
    expect(activityType('risk_updated')).toBe('RISK_UPDATED');
    expect(activityType('issue_created')).toBe('ISSUE_UPDATED');
  });

  it('falls back to OTHER for an unrecognized event (never invents a type)', () => {
    expect(activityType('mystery_event')).toBe('OTHER');
  });
});

describe('activitySource', () => {
  it('maps each domain event to its real workspace tab', () => {
    expect(activitySource('created')).toBe('Overview');
    expect(activitySource('payment_created')).toBe('Payments');
    expect(activitySource('variation_updated')).toBe('Variations / Change Orders');
    expect(activitySource('claim_created')).toBe('Claims');
    expect(activitySource('risk_updated')).toBe('Risk Assessment');
    expect(activitySource('document_obligation_created')).toBe('Documents & Obligations');
    expect(activitySource('issue_updated')).toBe('Issue Log');
    expect(activitySource('closeout_approved')).toBe('Closeout');
  });
});

describe('ACTIVITY_SOURCE_OPTIONS', () => {
  it('has exactly the 10 real workspace-tab source labels', () => {
    expect(ACTIVITY_SOURCE_OPTIONS).toHaveLength(10);
    expect(ACTIVITY_SOURCE_OPTIONS).toContain('Workflow & Team Tasks');
    expect(ACTIVITY_SOURCE_OPTIONS).toContain('Attachments');
  });
});

describe('isReviewApprovalEvent', () => {
  it('is true only for real closeout review/approval/rejection events', () => {
    expect(isReviewApprovalEvent('closeout_review_started')).toBe(true);
    expect(isReviewApprovalEvent('closeout_approved')).toBe(true);
    expect(isReviewApprovalEvent('closeout_rejected')).toBe(true);
  });

  it('is false for a mere request or an unrelated event', () => {
    expect(isReviewApprovalEvent('closeout_requested')).toBe(false);
    expect(isReviewApprovalEvent('payment_created')).toBe(false);
  });
});

describe('activityDetails', () => {
  it('is concise and human-readable, never raw JSON', () => {
    const details = activityDetails(makeActivity({ event: 'payment_created', metadata: { paymentId: 'p1', paymentNo: 'PAY-001' } }));
    expect(details).toBe('Payment PAY-001 added');
    expect(details).not.toContain('{');
  });

  it('omits the missing piece gracefully rather than fabricating one', () => {
    expect(activityDetails(makeActivity({ event: 'payment_created', metadata: undefined }))).toBe('Payment added');
  });

  it('summarizes a schedule status change using the real captured before/after values', () => {
    const details = activityDetails(
      makeActivity({ event: 'schedule_status_updated', metadata: { previousScheduleStatus: 'ON_TRACK', newScheduleStatus: 'DELAYED' } }),
    );
    expect(details).toBe('Schedule status changed from ON_TRACK to DELAYED');
  });

  it('falls back to the action label for an unrecognized event', () => {
    expect(activityDetails(makeActivity({ event: 'mystery_event' }))).toBe('Mystery Event');
  });
});

describe('activityOldValue / activityNewValue', () => {
  it('uses the real previousStatus/newStatus columns for a lifecycle change', () => {
    const a = makeActivity({ event: 'activated', previousStatus: 'DRAFT', newStatus: 'ACTIVE' });
    expect(activityOldValue(a)).toBe('DRAFT');
    expect(activityNewValue(a)).toBe('ACTIVE');
  });

  it('falls back to the real schedule-status metadata pair when no lifecycle status columns are set', () => {
    const a = makeActivity({ event: 'schedule_status_updated', metadata: { previousScheduleStatus: 'ON_TRACK', newScheduleStatus: 'DELAYED' } });
    expect(activityOldValue(a)).toBe('ON_TRACK');
    expect(activityNewValue(a)).toBe('DELAYED');
  });

  it('shows "—" when neither is captured (never fabricated)', () => {
    const a = makeActivity({ event: 'payment_created' });
    expect(activityOldValue(a)).toBe('—');
    expect(activityNewValue(a)).toBe('—');
  });
});

describe('computeActivitySummary', () => {
  it('counts totalActivities as every real activity', () => {
    const summary = computeActivitySummary([makeActivity(), makeActivity({ id: 'a2' })]);
    expect(summary.totalActivities).toBe(2);
  });

  it('counts updatesThisMonth using the real createdAt against the given "now"', () => {
    const now = new Date(Date.UTC(2026, 5, 15));
    const summary = computeActivitySummary(
      [
        makeActivity({ createdAt: '2026-06-01T00:00:00Z' }),
        makeActivity({ id: 'a2', createdAt: '2026-05-01T00:00:00Z' }),
      ],
      now,
    );
    expect(summary.updatesThisMonth).toBe(1);
  });

  it('counts documentsUploaded/statusChanges/reviewApprovalActions from the real event types', () => {
    const summary = computeActivitySummary([
      makeActivity({ event: 'document_obligation_attachment_uploaded' }),
      makeActivity({ id: 'a2', event: 'variation_attachment_uploaded' }),
      makeActivity({ id: 'a3', event: 'activated' }),
      makeActivity({ id: 'a4', event: 'closeout_approved' }),
      makeActivity({ id: 'a5', event: 'payment_created' }),
    ]);
    expect(summary.documentsUploaded).toBe(2);
    expect(summary.statusChanges).toBe(1);
    expect(summary.reviewApprovalActions).toBe(1);
  });

  it('returns all zeros for an empty activity list (no logs — never fake rows)', () => {
    expect(computeActivitySummary([])).toEqual({
      totalActivities: 0,
      updatesThisMonth: 0,
      documentsUploaded: 0,
      statusChanges: 0,
      reviewApprovalActions: 0,
    });
  });
});
