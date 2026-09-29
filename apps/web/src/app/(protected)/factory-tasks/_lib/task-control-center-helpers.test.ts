import { describe, it, expect } from 'vitest';
import {
  isTaskRowOverdue,
  TASK_CONTROL_CENTER_TABS,
  getVisibleTaskControlCenterTabs,
  isValidTaskControlCenterTab,
  computeTaskNextActionText,
  computeTaskNextStepGuidance,
  computeTaskQuickAction,
} from './task-control-center-helpers';

describe('isTaskRowOverdue', () => {
  it('is false when there is no due date', () => {
    expect(isTaskRowOverdue(null, 'OPEN')).toBe(false);
  });

  it('is false for a terminal or draft status even when due date has passed', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isTaskRowOverdue(past, 'DRAFT')).toBe(false);
    expect(isTaskRowOverdue(past, 'COMPLETED')).toBe(false);
    expect(isTaskRowOverdue(past, 'CLOSED')).toBe(false);
    expect(isTaskRowOverdue(past, 'CANCELLED')).toBe(false);
  });

  it('is true for an active status with a past due date', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isTaskRowOverdue(past, 'OPEN')).toBe(true);
    expect(isTaskRowOverdue(past, 'ASSIGNED')).toBe(true);
    expect(isTaskRowOverdue(past, 'IN_PROGRESS')).toBe(true);
    expect(isTaskRowOverdue(past, 'BLOCKED')).toBe(true);
  });

  it('is false for an active status with a future due date', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isTaskRowOverdue(future, 'OPEN')).toBe(false);
  });
});

describe('TASK_CONTROL_CENTER_TABS', () => {
  it('has exactly the 5 required tabs, in the required order', () => {
    expect(TASK_CONTROL_CENTER_TABS.map((t) => t.key)).toEqual(['my', 'assigned-by-me', 'all', 'overdue', 'completed']);
  });

  it('every tab has a real viewAllHref and a non-empty empty-state message', () => {
    for (const tab of TASK_CONTROL_CENTER_TABS) {
      expect(tab.viewAllHref.startsWith('/factory-tasks')).toBe(true);
      expect(tab.emptyMessage.length).toBeGreaterThan(0);
    }
  });
});

describe('getVisibleTaskControlCenterTabs', () => {
  it('hides "All Tasks" from a viewer without tasks.manage', () => {
    const visible = getVisibleTaskControlCenterTabs(['tasks.read']);
    expect(visible.map((t) => t.key)).toEqual(['my', 'assigned-by-me', 'overdue', 'completed']);
  });

  it('shows all 5 tabs to a viewer with tasks.manage', () => {
    const visible = getVisibleTaskControlCenterTabs(['tasks.read', 'tasks.manage']);
    expect(visible.map((t) => t.key)).toEqual(['my', 'assigned-by-me', 'all', 'overdue', 'completed']);
  });
});

describe('isValidTaskControlCenterTab', () => {
  it('accepts every tab key the viewer can actually see', () => {
    expect(isValidTaskControlCenterTab('my', [])).toBe(true);
    expect(isValidTaskControlCenterTab('all', ['tasks.manage'])).toBe(true);
  });

  it('rejects a tab the viewer cannot access, even if the key is real', () => {
    expect(isValidTaskControlCenterTab('all', [])).toBe(false);
  });

  it('rejects an unknown or missing value', () => {
    expect(isValidTaskControlCenterTab('bogus', ['tasks.manage'])).toBe(false);
    expect(isValidTaskControlCenterTab(undefined, ['tasks.manage'])).toBe(false);
  });
});

describe('computeTaskNextActionText', () => {
  const CURRENT_USER = 'user-1';

  it('DRAFT: creator sees "Open for Work", a non-creator without tasks.manage sees "No action needed"', () => {
    const task = { status: 'DRAFT' as const, createdByUserId: CURRENT_USER, assignedToUserId: null };
    expect(computeTaskNextActionText(task, CURRENT_USER, [])).toBe('Open for Work');
    expect(computeTaskNextActionText(task, 'someone-else', [])).toBe('No action needed');
    expect(computeTaskNextActionText(task, 'someone-else', ['tasks.manage'])).toBe('Open for Work');
  });

  it('OPEN: a viewer with tasks.assign sees "Assign Task"', () => {
    const task = { status: 'OPEN' as const, createdByUserId: 'other', assignedToUserId: null };
    expect(computeTaskNextActionText(task, CURRENT_USER, ['tasks.assign'])).toBe('Assign Task');
    expect(computeTaskNextActionText(task, CURRENT_USER, [])).toBe('No action needed');
  });

  it('ASSIGNED: the assignee sees "Start Task", a manager with tasks.assign (not the assignee) sees "Reassign Task"', () => {
    const task = { status: 'ASSIGNED' as const, createdByUserId: 'other', assignedToUserId: CURRENT_USER };
    expect(computeTaskNextActionText(task, CURRENT_USER, [])).toBe('Start Task');
    expect(computeTaskNextActionText({ ...task, assignedToUserId: 'someone-else' }, CURRENT_USER, ['tasks.assign'])).toBe('Reassign Task');
  });

  it('IN_PROGRESS: the assignee sees "Complete Task" (priority over "Mark Blocked")', () => {
    const task = { status: 'IN_PROGRESS' as const, createdByUserId: 'other', assignedToUserId: CURRENT_USER };
    expect(computeTaskNextActionText(task, CURRENT_USER, [])).toBe('Complete Task');
  });

  it('BLOCKED: the assignee sees "Unblock Task"', () => {
    const task = { status: 'BLOCKED' as const, createdByUserId: 'other', assignedToUserId: CURRENT_USER };
    expect(computeTaskNextActionText(task, CURRENT_USER, [])).toBe('Unblock Task');
  });

  it('COMPLETED: tasks.close sees "Close Task", tasks.manage (without close) sees "Reopen Task"', () => {
    const task = { status: 'COMPLETED' as const, createdByUserId: 'other', assignedToUserId: 'other' };
    expect(computeTaskNextActionText(task, CURRENT_USER, ['tasks.close'])).toBe('Close Task');
    expect(computeTaskNextActionText(task, CURRENT_USER, ['tasks.manage'])).toBe('Reopen Task');
    expect(computeTaskNextActionText(task, CURRENT_USER, [])).toBe('No action needed');
  });

  it('CLOSED/CANCELLED: only tasks.manage can reopen, everyone else needs no action', () => {
    const closed = { status: 'CLOSED' as const, createdByUserId: 'other', assignedToUserId: 'other' };
    const cancelled = { status: 'CANCELLED' as const, createdByUserId: 'other', assignedToUserId: 'other' };
    expect(computeTaskNextActionText(closed, CURRENT_USER, ['tasks.manage'])).toBe('Reopen Task');
    expect(computeTaskNextActionText(closed, CURRENT_USER, [])).toBe('No action needed');
    expect(computeTaskNextActionText(cancelled, CURRENT_USER, ['tasks.manage'])).toBe('Reopen Task');
  });
});

describe('computeTaskQuickAction', () => {
  const CURRENT_USER = 'user-1';

  it('OPEN: a viewer with tasks.assign gets the "assign" quick action, otherwise none', () => {
    const task = { status: 'OPEN' as const, createdByUserId: 'other', assignedToUserId: null };
    expect(computeTaskQuickAction(task, CURRENT_USER, ['tasks.assign'])).toEqual({ type: 'assign', label: 'Assign' });
    expect(computeTaskQuickAction(task, CURRENT_USER, [])).toBeNull();
  });

  it('IN_PROGRESS: the assignee (or tasks.complete) gets the "complete" quick action', () => {
    const task = { status: 'IN_PROGRESS' as const, createdByUserId: 'other', assignedToUserId: CURRENT_USER };
    expect(computeTaskQuickAction(task, CURRENT_USER, [])).toEqual({ type: 'complete', label: 'Complete' });
    expect(computeTaskQuickAction({ ...task, assignedToUserId: 'someone-else' }, CURRENT_USER, [])).toBeNull();
    expect(computeTaskQuickAction({ ...task, assignedToUserId: 'someone-else' }, CURRENT_USER, ['tasks.complete'])).toEqual({ type: 'complete', label: 'Complete' });
  });

  it('COMPLETED: tasks.close gets the "close" quick action', () => {
    const task = { status: 'COMPLETED' as const, createdByUserId: 'other', assignedToUserId: 'other' };
    expect(computeTaskQuickAction(task, CURRENT_USER, ['tasks.close'])).toEqual({ type: 'close', label: 'Close' });
    expect(computeTaskQuickAction(task, CURRENT_USER, [])).toBeNull();
  });

  it('never returns a quick action for DRAFT/ASSIGNED/BLOCKED/CLOSED/CANCELLED', () => {
    for (const status of ['DRAFT', 'ASSIGNED', 'BLOCKED', 'CLOSED', 'CANCELLED'] as const) {
      const task = { status, createdByUserId: 'other', assignedToUserId: CURRENT_USER };
      expect(computeTaskQuickAction(task, CURRENT_USER, ['tasks.manage', 'tasks.assign', 'tasks.start', 'tasks.block'])).toBeNull();
    }
  });
});

describe('computeTaskNextStepGuidance', () => {
  it('uses the brief\'s exact 3 required sentences for DRAFT, OPEN-unassigned, and the terminal statuses', () => {
    expect(computeTaskNextStepGuidance('DRAFT', false)).toBe(
      'This task is still in draft. Open it for work when it is ready to be tracked and assigned.',
    );
    expect(computeTaskNextStepGuidance('OPEN', false)).toBe(
      'This task is open but not assigned yet. Assign it to the responsible person when assignment is available.',
    );
    for (const status of ['COMPLETED', 'CLOSED', 'CANCELLED'] as const) {
      expect(computeTaskNextStepGuidance(status, true)).toBe('This task is closed. No further action is required.');
    }
  });

  it('gives an honest, non-empty message for every other real status', () => {
    expect(computeTaskNextStepGuidance('OPEN', true)).toMatch(/open/i);
    expect(computeTaskNextStepGuidance('ASSIGNED', true)).toMatch(/assigned/i);
    expect(computeTaskNextStepGuidance('IN_PROGRESS', true)).toMatch(/progress/i);
    expect(computeTaskNextStepGuidance('BLOCKED', true)).toMatch(/blocked/i);
  });
});
