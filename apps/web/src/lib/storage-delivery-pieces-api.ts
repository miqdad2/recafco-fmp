import { cookies } from 'next/headers';
import type { BoqPieceStatus, BoqPieceUpdateStatus } from './technical-api';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// FMP-BOQ-08 — typed client for the Storage Yard & Delivery piece screen.
// Server-side only (cookie auth), same pattern as the other module clients.

export interface StoragePiece {
  id: string;
  pieceCode: string;
  drawingNo: string;
  sizeOrSpecification: string | null;
  currentStatus: BoqPieceStatus;
  currentLocation: string | null;
  updatedAt: string;
  contract: { id: string; referenceNumber: string; jobOrder: string | null; title: string };
  boqItem: { description: string };
}

export interface StoragePieceList {
  items: StoragePiece[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StoragePieceSummary {
  readyForStore: number;
  inStore: number;
  delivered: number;
  onHoldOrRejected: number;
}

export interface StorageContractOption {
  id: string;
  referenceNumber: string;
  jobOrder: string | null;
  title: string;
}

// FMP-UI-33 — mirrors StorageContractProgress in
// apps/api/src/storage-delivery/storage-delivery-pieces.service.ts exactly.
export interface StorageContractProgress {
  contractId: string;
  referenceNumber: string;
  jobOrder: string | null;
  projectName: string;
  readyForStore: number;
  inStore: number;
  delivered: number;
  onHold: number;
  rejected: number;
  lastUpdatedAt: string;
}

// FMP-UI-33 — mirrors RecentStoragePieceUpdate in
// apps/api/src/storage-delivery/storage-delivery-pieces.service.ts exactly.
export interface RecentStoragePieceUpdate {
  id: string;
  pieceCode: string;
  newStatus: BoqPieceStatus;
  contractId: string;
  referenceNumber: string;
  jobOrder: string | null;
  projectName: string;
  currentLocation: string | null;
  createdAt: string;
  updatedByName: string | null;
}

export interface StoragePieceQuery {
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

export const storageDeliveryPiecesApi = {
  list: (query: StoragePieceQuery) => {
    const qs = new URLSearchParams();
    if (query.statuses) qs.set('statuses', query.statuses);
    if (query.search) qs.set('search', query.search);
    if (query.contractId) qs.set('contractId', query.contractId);
    if (query.drawingNo) qs.set('drawingNo', query.drawingNo);
    if (query.boqItem) qs.set('boqItem', query.boqItem);
    if (query.page && query.page > 1) qs.set('page', String(query.page));
    const suffix = qs.toString();
    return get<StoragePieceList>(`/storage-delivery/pieces${suffix ? `?${suffix}` : ''}`);
  },
  summary: () => get<StoragePieceSummary>('/storage-delivery/pieces/summary'),
  contracts: () => get<StorageContractOption[]>('/storage-delivery/pieces/contracts'),
  /** FMP-UI-33 — per-contract piece-status breakdown for the Storage Yard & Delivery dashboard. */
  contractProgress: () => get<StorageContractProgress[]>('/storage-delivery/pieces/contract-progress'),
  /** FMP-UI-33 — latest piece status updates across every contract. */
  recentUpdates: () => get<RecentStoragePieceUpdate[]>('/storage-delivery/pieces/recent-updates'),
  /** The statuses this user may set here; null = could not be resolved (page stays read-only). */
  allowedStatuses: async (): Promise<BoqPieceUpdateStatus[] | null> => {
    const data = await get<{ statuses: BoqPieceUpdateStatus[] }>('/storage-delivery/pieces/allowed-statuses');
    return data ? data.statuses : null;
  },
};
