import { cookies } from 'next/headers';
import type { BoqPieceStatus, BoqPieceUpdateStatus } from './technical-api';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// FMP-BOQ-07 — typed client for the Production piece screen. Server-side only
// (cookie auth), same pattern as the other module clients.

export interface ProductionPiece {
  id: string;
  pieceCode: string;
  drawingNo: string;
  sizeOrSpecification: string | null;
  currentStatus: BoqPieceStatus;
  updatedAt: string;
  contract: { id: string; referenceNumber: string; jobOrder: string | null; title: string };
  boqItem: { description: string };
  /**
   * FMP-BOQ-13 — Technical's drawing / calculation group for the piece. null = no group;
   * `{ released: false }` = not released to Production (nothing else is shown);
   * released groups carry drawing no, calculation ref, title and file count.
   */
  drawingGroup:
    | null
    | { released: false }
    | { released: true; drawingNo: string; calculationRef: string | null; groupTitle: string | null; fileCount: number };
}

export interface ProductionPieceList {
  items: ProductionPiece[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductionPieceSummary {
  readyForProduction: number;
  inProduction: number;
  produced: number;
  onHoldOrRejected: number;
}

export interface ProductionContractOption {
  id: string;
  referenceNumber: string;
  jobOrder: string | null;
  title: string;
}

// FMP-UI-32 — mirrors ProductionContractProgress in
// apps/api/src/production/production-pieces.service.ts exactly.
export interface ProductionContractProgress {
  contractId: string;
  referenceNumber: string;
  jobOrder: string | null;
  projectName: string;
  readyForProduction: number;
  inProduction: number;
  produced: number;
  onHold: number;
  rejected: number;
  lastUpdatedAt: string;
}

// FMP-UI-32 — mirrors RecentPieceUpdate in
// apps/api/src/production/production-pieces.service.ts exactly.
export interface RecentPieceUpdate {
  id: string;
  pieceCode: string;
  newStatus: BoqPieceStatus;
  contractId: string;
  referenceNumber: string;
  jobOrder: string | null;
  projectName: string;
  createdAt: string;
  updatedByName: string | null;
}

export interface ProductionPieceQuery {
  statuses?: string;
  search?: string;
  contractId?: string;
  drawingNo?: string;
  boqItem?: string;
  page?: number;
}

async function authHeader(): Promise<Record<string, string>> {
  try {
    const token = (await cookies()).get('recafco_access')?.value;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** null when the call failed, so each page section can degrade on its own. */
async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, cache: 'no-store' });
    const body = (await res.json()) as { data: T | null; error: unknown };
    return res.ok && body.error === null ? body.data : null;
  } catch {
    return null;
  }
}

export const productionPiecesApi = {
  list: (query: ProductionPieceQuery) => {
    const qs = new URLSearchParams();
    if (query.statuses) qs.set('statuses', query.statuses);
    if (query.search) qs.set('search', query.search);
    if (query.contractId) qs.set('contractId', query.contractId);
    if (query.drawingNo) qs.set('drawingNo', query.drawingNo);
    if (query.boqItem) qs.set('boqItem', query.boqItem);
    if (query.page && query.page > 1) qs.set('page', String(query.page));
    const suffix = qs.toString();
    return get<ProductionPieceList>(`/production/pieces${suffix ? `?${suffix}` : ''}`);
  },
  summary: () => get<ProductionPieceSummary>('/production/pieces/summary'),
  contracts: () => get<ProductionContractOption[]>('/production/pieces/contracts'),
  /** FMP-UI-32 — per-contract piece-status breakdown for the Production & Planning dashboard. */
  contractProgress: () => get<ProductionContractProgress[]>('/production/pieces/contract-progress'),
  /** FMP-UI-32 — latest piece status updates across every contract. */
  recentUpdates: () => get<RecentPieceUpdate[]>('/production/pieces/recent-updates'),
  /** The statuses this user may set here; null = could not be resolved (page stays read-only). */
  allowedStatuses: async (): Promise<BoqPieceUpdateStatus[] | null> => {
    const data = await get<{ statuses: BoqPieceUpdateStatus[] }>('/production/pieces/allowed-statuses');
    return data ? data.statuses : null;
  },
};
