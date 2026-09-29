import { describe, it, expect } from 'vitest';
import { computeIncidentNextStepLabel, computeIncidentNextStep } from './incident-detail-helpers';
import type { IncidentStatus } from '../../../../lib/incidents-api';

const ALL_STATUSES: IncidentStatus[] = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INVESTIGATION', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED', 'CANCELLED',
];

describe('computeIncidentNextStepLabel', () => {
  it('returns a short, real action label for every status', () => {
    for (const status of ALL_STATUSES) {
      const label = computeIncidentNextStepLabel(status);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('matches the exact expected label per status', () => {
    expect(computeIncidentNextStepLabel('DRAFT')).toBe('Submit Incident');
    expect(computeIncidentNextStepLabel('SUBMITTED')).toBe('Start Review');
    expect(computeIncidentNextStepLabel('UNDER_REVIEW')).toBe('Begin Investigation');
    expect(computeIncidentNextStepLabel('INVESTIGATION')).toBe('Request Corrective Actions');
    expect(computeIncidentNextStepLabel('ACTION_REQUIRED')).toBe('Resolve Incident');
    expect(computeIncidentNextStepLabel('RESOLVED')).toBe('Close Incident');
    expect(computeIncidentNextStepLabel('CLOSED')).toBe('No Action Needed');
    expect(computeIncidentNextStepLabel('CANCELLED')).toBe('No Action Needed');
  });
});

describe('computeIncidentNextStep', () => {
  it('matches the brief\'s exact wording for DRAFT, SUBMITTED, and CLOSED', () => {
    expect(computeIncidentNextStep('DRAFT')).toBe(
      'Review the incident details and attach evidence if available. Submit when ready for review.',
    );
    expect(computeIncidentNextStep('SUBMITTED')).toBe(
      'Incident is submitted. Investigation or corrective action can begin once review starts.',
    );
    expect(computeIncidentNextStep('CLOSED')).toBe(
      'Incident is closed. No further action is required.',
    );
  });

  it('returns a real, non-empty sentence for every other status', () => {
    for (const status of ['UNDER_REVIEW', 'INVESTIGATION', 'ACTION_REQUIRED', 'RESOLVED', 'CANCELLED'] as const) {
      expect(computeIncidentNextStep(status).length).toBeGreaterThan(0);
    }
  });

  it('never returns the same generic text for every status (each is status-specific)', () => {
    const texts = ALL_STATUSES.map((s) => computeIncidentNextStep(s));
    expect(new Set(texts).size).toBe(ALL_STATUSES.length);
  });
});
