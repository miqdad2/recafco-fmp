import { describe, it, expect } from 'vitest';
import type { Contract } from '../../../../lib/contracts-api';
import { SCHEDULE_STATUS_OPTIONS, scheduleStatusLabel } from './contract-ui-helpers';
import {
  canEditBasicDetails,
  basicDetailsFromContract,
  validateBasicDetails,
  toBasicDetailsPayload,
} from './contract-basic-details-helpers';

const contract = {
  jobOrder: 'JO-1', quotationNumber: 'Q-1', title: 'Tower A', projectNumber: null, counterpartyName: 'Client Co',
  contractDate: '2026-09-01T00:00:00.000Z', startDate: undefined, endDate: '2026-12-31T00:00:00.000Z',
  scopeDescription: 'Precast', scheduleStatus: 'DELAYED', notes: undefined, paymentTerms: { advance: true },
} as unknown as Contract;

describe('contract basic details helpers (FMP-CONTRACT-03)', () => {
  it('shows the Edit button only to contracts.update on editable statuses', () => {
    expect(canEditBasicDetails('ACTIVE', ['contracts.read', 'contracts.update'])).toBe(true);
    expect(canEditBasicDetails('DRAFT', ['contracts.update'])).toBe(true);
    expect(canEditBasicDetails('ACTIVE', ['contracts.read'])).toBe(false);
    expect(canEditBasicDetails('CLOSED', ['contracts.update'])).toBe(false);
    expect(canEditBasicDetails('CANCELLED', ['contracts.update'])).toBe(false);
  });

  it('prefills from the existing contract values', () => {
    const f = basicDetailsFromContract(contract);
    expect(f).toMatchObject({ jobOrder: 'JO-1', title: 'Tower A', counterpartyName: 'Client Co', projectNumber: '', contractDate: '2026-09-01', endDate: '2026-12-31', startDate: '', scheduleStatus: 'DELAYED' });
    expect(f.paymentTerms).toEqual({ advance: true });
  });

  it('validates with friendly labels, not field names', () => {
    const f = { ...basicDetailsFromContract(contract), jobOrder: ' ', title: '', counterpartyName: '' };
    expect(validateBasicDetails(f)).toEqual([
      'Job Order No is required.',
      'Project / Contract Name is required.',
      'Client / Employer is required.',
    ]);
    expect(validateBasicDetails(basicDetailsFromContract(contract))).toEqual([]);
  });

  it('payload contains only safe fields (no BOQ/workflow/payment/status/value)', () => {
    const payload = toBasicDetailsPayload(basicDetailsFromContract(contract), 4);
    expect(Object.keys(payload).sort()).toEqual([
      'contractDate', 'counterpartyName', 'endDate', 'jobOrder', 'notes', 'paymentTerms', 'projectNumber',
      'quotationNumber', 'scheduleStatus', 'scopeDescription', 'startDate', 'title', 'version',
    ]);
    expect(payload['projectNumber']).toBeNull();
    expect(payload['version']).toBe(4);
  });

  it('schedule status is optional, empty prefill is blank (placeholder) and clears to null', () => {
    const empty = basicDetailsFromContract({ ...contract, scheduleStatus: undefined } as unknown as Contract);
    expect(empty.scheduleStatus).toBe('');
    expect(validateBasicDetails(empty)).toEqual([]);
    expect(toBasicDetailsPayload(empty, 1)['scheduleStatus']).toBeNull();
  });

  it('schedule status is sent as-is and never carries the contract lifecycle status', () => {
    const payload = toBasicDetailsPayload(basicDetailsFromContract(contract), 2);
    expect(payload['scheduleStatus']).toBe('DELAYED');
    expect(payload).not.toHaveProperty('status');
  });

  it('uses the friendly Schedule Status labels', () => {
    expect(SCHEDULE_STATUS_OPTIONS.map((o) => o.label)).toEqual(['In Progress', 'On Track', 'Delayed', 'Completed', 'Ahead of Schedule']);
    expect(scheduleStatusLabel('AHEAD_OF_SCHEDULE')).toBe('Ahead of Schedule');
  });
});
