import { describe, it, expect } from 'vitest';
import {
  isErectionStep2Locked,
  isErectionStep3Locked,
  isErectionStep4Locked,
  isErectionStep5Locked,
  isErectionStep6Locked,
} from './erection-step-lock';

describe('isErectionStep2Locked', () => {
  it('is locked when Step 1 does not exist yet', () => {
    expect(isErectionStep2Locked(null)).toBe(true);
  });

  it('is locked when Step 1 is still Draft', () => {
    expect(isErectionStep2Locked({ status: 'DRAFT' })).toBe(true);
  });

  it('is unlocked once Step 1 is Submitted for Approval', () => {
    expect(isErectionStep2Locked({ status: 'SUBMITTED_FOR_APPROVAL' })).toBe(false);
  });

  it('is unlocked once Step 1 is Issued', () => {
    expect(isErectionStep2Locked({ status: 'ISSUED' })).toBe(false);
  });
});

describe('isErectionStep3Locked', () => {
  it('is locked when Step 2 does not exist yet', () => {
    expect(isErectionStep3Locked(null)).toBe(true);
  });

  it('is locked when Step 2 review is not Approved', () => {
    expect(isErectionStep3Locked({ reviewStatus: 'DRAFT_REVIEW' })).toBe(true);
  });

  it('is unlocked once Step 2 is Approved', () => {
    expect(isErectionStep3Locked({ reviewStatus: 'APPROVED' })).toBe(false);
  });
});

describe('isErectionStep4Locked', () => {
  it('is locked when Step 3 does not exist yet', () => {
    expect(isErectionStep4Locked(null)).toBe(true);
  });

  it('is locked when Step 3 is still Draft', () => {
    expect(isErectionStep4Locked({ status: 'DRAFT' })).toBe(true);
  });

  it('is unlocked once Step 3 is Issued', () => {
    expect(isErectionStep4Locked({ status: 'ISSUED' })).toBe(false);
  });
});

describe('isErectionStep5Locked', () => {
  it('is locked when Step 4 does not exist yet', () => {
    expect(isErectionStep5Locked(null)).toBe(true);
  });

  it('is locked when Step 4 is still Draft', () => {
    expect(isErectionStep5Locked({ status: 'DRAFT' })).toBe(true);
  });

  it('is unlocked once Step 4 is Started', () => {
    expect(isErectionStep5Locked({ status: 'STARTED' })).toBe(false);
  });
});

describe('isErectionStep6Locked', () => {
  it('is locked when Step 5 does not exist yet', () => {
    expect(isErectionStep6Locked(null)).toBe(true);
  });

  it('is locked when Step 5 is still Draft', () => {
    expect(isErectionStep6Locked({ status: 'DRAFT' })).toBe(true);
  });

  it('is unlocked once Step 5 is Started', () => {
    expect(isErectionStep6Locked({ status: 'STARTED' })).toBe(false);
  });
});
