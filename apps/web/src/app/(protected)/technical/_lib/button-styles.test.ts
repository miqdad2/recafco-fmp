import { describe, it, expect } from 'vitest';
import { BADGE, BTN_DANGER, BTN_NAV, BTN_NAV_PRIMARY, BTN_PRIMARY, BTN_PRIMARY_SM, BTN_QUIET, BTN_SECONDARY } from './button-styles';

describe('technical button styles (FMP-TECH-32)', () => {
  const buttons = { BTN_PRIMARY, BTN_PRIMARY_SM, BTN_SECONDARY, BTN_QUIET, BTN_DANGER, BTN_NAV, BTN_NAV_PRIMARY };

  it('every button has a hover change, a focus ring, a pointer cursor, a border and a disabled look', () => {
    for (const [name, cls] of Object.entries(buttons)) {
      expect(cls, name).toMatch(/hover:/);
      expect(cls, name).toMatch(/focus:ring-2/);
      expect(cls, name).toMatch(/cursor-pointer/);
      expect(cls, name).toMatch(/\bborder\b/);
      expect(cls, name).toMatch(/disabled:opacity-50/);
    }
  });

  it('the main action is solid red, view/edit buttons are bordered white, danger is a red outline', () => {
    expect(BTN_PRIMARY).toMatch(/bg-accent /);
    expect(BTN_SECONDARY).toMatch(/bg-surface /);
    expect(BTN_SECONDARY).toMatch(/border-text-muted/);
    expect(BTN_DANGER).toMatch(/border-error/);
    expect(BTN_DANGER).toMatch(/text-error/);
  });

  it('navigation buttons are larger than action buttons', () => {
    expect(BTN_NAV).toMatch(/h-10/);
    expect(BTN_NAV_PRIMARY).toMatch(/h-10/);
    expect(BTN_SECONDARY).toMatch(/h-8/);
  });

  it('status badges look nothing like a button: no border, default cursor, no hover', () => {
    expect(BADGE).toMatch(/cursor-default/);
    expect(BADGE).not.toMatch(/\bborder\b|hover:|cursor-pointer|shadow/);
  });
});
