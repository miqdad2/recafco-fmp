import { describe, it, expect } from 'vitest';
import {
  computeInspectionNextStep,
  computeInspectionNextStepLabel,
  formatActivityEventLabel,
  toTitleCase,
} from './safety-detail-helpers';

describe('computeInspectionNextStepLabel', () => {
  it('returns a short, real action label for every status', () => {
    expect(computeInspectionNextStepLabel('DRAFT')).toBe('Schedule Inspection');
    expect(computeInspectionNextStepLabel('SCHEDULED')).toBe('Complete Inspection');
    expect(computeInspectionNextStepLabel('IN_PROGRESS')).toBe('Complete Inspection');
    expect(computeInspectionNextStepLabel('COMPLETED')).toBe('Review Findings');
    expect(computeInspectionNextStepLabel('CLOSED')).toBe('Reopen if Needed');
    expect(computeInspectionNextStepLabel('CANCELLED')).toBe('No Action Needed');
  });
});

describe('computeInspectionNextStep', () => {
  it('matches the brief\'s exact wording for DRAFT, SCHEDULED, and COMPLETED', () => {
    expect(computeInspectionNextStep('DRAFT')).toBe(
      'This inspection is still in draft. Schedule it once inspector and date are confirmed.',
    );
    expect(computeInspectionNextStep('SCHEDULED')).toBe(
      'This inspection is scheduled. Complete it after inspection is performed.',
    );
    expect(computeInspectionNextStep('COMPLETED')).toBe(
      'Inspection completed. Review findings and corrective actions.',
    );
  });

  it('returns a real, non-empty sentence for every other status', () => {
    for (const status of ['IN_PROGRESS', 'CLOSED', 'CANCELLED'] as const) {
      expect(computeInspectionNextStep(status).length).toBeGreaterThan(0);
    }
  });
});

describe('formatActivityEventLabel', () => {
  it('maps every real activity event key to a human-readable label', () => {
    expect(formatActivityEventLabel('INSPECTION_CREATED')).toBe('Inspection created');
    expect(formatActivityEventLabel('INSPECTION_SCHEDULED')).toBe('Inspection scheduled');
    expect(formatActivityEventLabel('INSPECTION_STARTED')).toBe('Inspection started');
    expect(formatActivityEventLabel('INSPECTION_COMPLETED')).toBe('Inspection completed');
    expect(formatActivityEventLabel('INSPECTION_CLOSED')).toBe('Inspection closed');
    expect(formatActivityEventLabel('INSPECTION_CANCELLED')).toBe('Inspection cancelled');
    expect(formatActivityEventLabel('INSPECTION_REOPENED')).toBe('Inspection reopened');
    expect(formatActivityEventLabel('FINDING_CREATED')).toBe('Finding recorded');
    expect(formatActivityEventLabel('FINDING_ASSIGNED')).toBe('Finding assigned');
    expect(formatActivityEventLabel('FINDING_ACTION_REQUIRED')).toBe('Action required on finding');
    expect(formatActivityEventLabel('FINDING_RESOLVED')).toBe('Finding resolved');
    expect(formatActivityEventLabel('FINDING_VERIFIED')).toBe('Finding verified');
    expect(formatActivityEventLabel('FINDING_CLOSED')).toBe('Finding closed');
    expect(formatActivityEventLabel('FINDING_REOPENED')).toBe('Finding reopened');
    expect(formatActivityEventLabel('COMMENT_ADDED')).toBe('Comment added');
  });

  it('falls back to a Title Case version of an unknown event key, never a raw UPPER_SNAKE string', () => {
    expect(formatActivityEventLabel('SOME_NEW_EVENT')).toBe('Some New Event');
  });
});

describe('toTitleCase', () => {
  it('converts UPPER_SNAKE status values to Title Case', () => {
    expect(toTitleCase('DRAFT')).toBe('Draft');
    expect(toTitleCase('IN_PROGRESS')).toBe('In Progress');
    expect(toTitleCase('ACTION_REQUIRED')).toBe('Action Required');
  });
});
