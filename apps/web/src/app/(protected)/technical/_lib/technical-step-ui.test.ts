import { describe, it, expect } from 'vitest';
import { isWorkflowStepKey, technicalStepHref, stepBadge, neighbours, VIEW_ONLY_MESSAGE } from './technical-step-ui';

describe('technical step pages (FMP-TECH-23)', () => {
  it('knows the five step keys and nothing else, so unknown URLs 404', () => {
    for (const k of ['boq-drawings', 'confirm-elements', 'drawing-groups', 'final-drawing-files', 'release-to-production']) {
      expect(isWorkflowStepKey(k)).toBe(true);
    }
    for (const k of ['drawing-received', 'sd-calculation-submission', 'getting-approval', 'fd-issuance', '', 'workflow']) {
      expect(isWorkflowStepKey(k)).toBe(false);
    }
  });

  it('builds the focused page address', () => {
    expect(technicalStepHref('c1', 'confirm-elements')).toBe('/technical/jobs/c1/step/confirm-elements');
  });

  it('labels status in plain words', () => {
    expect(stepBadge({ state: 'done', attention: false }).label).toBe('Done');
    expect(stepBadge({ state: 'current', attention: false }).label).toBe('Current');
    expect(stepBadge({ state: 'pending', attention: false }).label).toBe('Pending');
    expect(stepBadge({ state: 'locked', attention: false }).label).toBe('Not ready');
    expect(stepBadge({ state: 'current', attention: true }).label).toBe('Needs Attention');
    expect(stepBadge({ state: 'done', attention: true }).label).toBe('Done');
  });

  it('finds the previous and next step, none at the ends', () => {
    expect(neighbours('boq-drawings')).toEqual({ previous: null, next: 'confirm-elements' });
    expect(neighbours('drawing-groups')).toEqual({ previous: 'confirm-elements', next: 'final-drawing-files' });
    expect(neighbours('release-to-production')).toEqual({ previous: 'final-drawing-files', next: null });
  });

  it('has the view-only message', () => {
    expect(VIEW_ONLY_MESSAGE).toBe('You can view this technical status. Updates are available only to authorized users.');
  });
});
