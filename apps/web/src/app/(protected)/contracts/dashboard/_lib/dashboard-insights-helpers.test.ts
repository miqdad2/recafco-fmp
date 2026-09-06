import { describe, it, expect } from 'vitest';
import {
  formatKwdCompact,
  computeOverallProgressPercent,
  computeDisciplineProgress,
  totalContractsFromMetrics,
  buildContractsByStatusSegments,
  buildClaimsStatusSegments,
} from './dashboard-insights-helpers';
import type { TeamWorkflowOverview, ContractDashboardData } from '@/lib/contracts-api';

describe('formatKwdCompact', () => {
  it('returns em-dash for undefined/NaN', () => {
    expect(formatKwdCompact(undefined)).toBe('—');
    expect(formatKwdCompact(Number.NaN)).toBe('—');
  });

  it('formats millions with 2 decimals and KWD prefix', () => {
    expect(formatKwdCompact(125_000_000)).toBe('KWD 125.00M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatKwdCompact(8_650)).toBe('KWD 8.65K');
  });

  it('formats sub-thousand values plainly', () => {
    expect(formatKwdCompact(42.5)).toBe('KWD 42.50');
  });

  it('omits the prefix when withPrefix is false', () => {
    expect(formatKwdCompact(25_600_000, false)).toBe('25.60M');
  });

  it('handles zero without a false "—"', () => {
    expect(formatKwdCompact(0)).toBe('KWD 0.00');
  });
});

function makeOverview(overrides: Partial<Record<TeamWorkflowOverview['team'], Partial<TeamWorkflowOverview>>> = {}): TeamWorkflowOverview[] {
  const teams: TeamWorkflowOverview['team'][] = ['TECHNICAL', 'PRODUCTION', 'ERECTION', 'QS_COMMERCIAL'];
  return teams.map((team) => ({
    team, openTasks: 0, unassignedTasks: 0, overdueTasks: 0, completedTasks: 0,
    ...(overrides[team] ?? {}),
  }));
}

describe('computeDisciplineProgress', () => {
  it('computes percent per named discipline from completed/(completed+open)', () => {
    const overview = makeOverview({
      TECHNICAL: { completedTasks: 3, openTasks: 1 },
      PRODUCTION: { completedTasks: 2, openTasks: 2 },
      ERECTION: { completedTasks: 0, openTasks: 4 },
    });
    const rows = computeDisciplineProgress(overview);
    expect(rows.find((r) => r.key === 'TECHNICAL')!.percent).toBe(75);
    expect(rows.find((r) => r.key === 'PRODUCTION')!.percent).toBe(50);
    expect(rows.find((r) => r.key === 'ERECTION')!.percent).toBe(0);
  });

  it('shows 0% (not NaN) for a team with zero tasks', () => {
    const rows = computeDisciplineProgress(makeOverview());
    expect(rows.every((r) => r.percent === 0)).toBe(true);
  });

  it('Overall Progress aggregates all 4 teams, including QS_COMMERCIAL', () => {
    const overview = makeOverview({
      TECHNICAL: { completedTasks: 1, openTasks: 1 },
      QS_COMMERCIAL: { completedTasks: 1, openTasks: 1 },
    });
    const overall = computeDisciplineProgress(overview).find((r) => r.key === 'OVERALL')!;
    expect(overall.completedTasks).toBe(2);
    expect(overall.totalTasks).toBe(4);
    expect(overall.percent).toBe(50);
  });
});

describe('computeOverallProgressPercent', () => {
  it('matches the OVERALL row from computeDisciplineProgress', () => {
    const overview = makeOverview({ TECHNICAL: { completedTasks: 2, openTasks: 2 } });
    expect(computeOverallProgressPercent(overview)).toBe(50);
  });
});

const BASE_METRICS: ContractDashboardData['metrics'] = {
  totalDraft: 10, totalActive: 50, totalExpiring: 5, totalExpired: 3, totalTerminated: 2, totalClosed: 8, totalCancelled: 4,
};

describe('totalContractsFromMetrics', () => {
  it('CM-69H — "Total Working Contracts": counts only Draft + Active, never Terminated/Closed/Cancelled', () => {
    expect(totalContractsFromMetrics(BASE_METRICS)).toBe(10 + 50);
  });

  it('CM-69H — is unaffected by however many contracts are cancelled', () => {
    expect(totalContractsFromMetrics({ ...BASE_METRICS, totalCancelled: 999 })).toBe(10 + 50);
  });
});

describe('buildContractsByStatusSegments', () => {
  it('produces mutually-exclusive Draft/Active/Expiring/Expired/Terminated/Closed segments, never Cancelled', () => {
    const segments = buildContractsByStatusSegments(BASE_METRICS);
    expect(segments.map((s) => s.key)).toEqual(['DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED', 'CLOSED']);
    expect(segments.find((s) => s.key === 'ACTIVE')!.count).toBe(50 - 5 - 3);
  });

  it('CM-69H — never includes a Cancelled segment, however many contracts are cancelled', () => {
    const segments = buildContractsByStatusSegments({ ...BASE_METRICS, totalCancelled: 999 });
    expect(segments.some((s) => s.key === 'CANCELLED')).toBe(false);
  });

  it("CM-69H — sums to zero (triggering the donut's own empty state) when only cancelled contracts remain", () => {
    const allCancelled: ContractDashboardData['metrics'] = {
      totalDraft: 0, totalActive: 0, totalExpiring: 0, totalExpired: 0, totalTerminated: 0, totalClosed: 0, totalCancelled: 2,
    };
    const segments = buildContractsByStatusSegments(allCancelled);
    const sum = segments.reduce((acc, s) => acc + s.count, 0);
    expect(sum).toBe(0);
  });

  it('never produces a negative active-only count', () => {
    const segments = buildContractsByStatusSegments({ ...BASE_METRICS, totalActive: 2, totalExpiring: 5, totalExpired: 0 });
    expect(segments.find((s) => s.key === 'ACTIVE')!.count).toBe(0);
  });
});

describe('buildClaimsStatusSegments', () => {
  it('maps status codes to display labels and drops zero-count rows', () => {
    const segments = buildClaimsStatusSegments([
      { status: 'DRAFT', count: 4 },
      { status: 'SETTLED', count: 0 },
      { status: 'UNDER_NEGOTIATION', count: 2 },
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({ key: 'DRAFT', label: 'Draft', count: 4 });
    expect(segments.find((s) => s.key === 'UNDER_NEGOTIATION')!.label).toBe('Under Negotiation');
  });

  it('sorts by count descending', () => {
    const segments = buildClaimsStatusSegments([
      { status: 'DRAFT', count: 1 },
      { status: 'APPROVED', count: 9 },
    ]);
    expect(segments.map((s) => s.key)).toEqual(['APPROVED', 'DRAFT']);
  });
});
