'use server';

import { cookies } from 'next/headers';
import type { BoqPieceHistoryEntry, BoqPieceUpdateStatus, DrawingGroupFileCategory } from '@/lib/technical-api';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// FMP-BOQ-07 — Production piece actions. They call the Production endpoints,
// which run the shared piece engine with Production's own statuses.

interface ApiBody<T> {
  data: T | null;
  error: { message?: string } | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<{ data: T | null; error: string | null }> {
  let token: string | undefined;
  try {
    token = (await cookies()).get('recafco_access')?.value;
  } catch {
    token = undefined;
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: 'no-store',
    });
    const body = (await res.json()) as ApiBody<T>;
    if (!res.ok || body.error) return { data: null, error: body.error?.message ?? 'Something went wrong. Please try again.' };
    return { data: body.data, error: null };
  } catch {
    return { data: null, error: 'Something went wrong. Please try again.' };
  }
}

export interface ProductionPieceUpdateResult {
  error: string | null;
  /** "Pieces updated." / "8 pieces updated. 2 pieces skipped." / "You cannot update pieces to this status." */
  message?: string;
  updatedCount: number;
  skippedCount: number;
}

export async function updateProductionPieceStatusAction(
  pieceIds: string[],
  status: BoqPieceUpdateStatus,
  note: string,
): Promise<ProductionPieceUpdateResult> {
  const result = await call<{ updatedCount: number; skippedCount: number; message: string }>('/production/pieces/bulk-status', {
    method: 'POST',
    body: JSON.stringify({ pieceIds, status, ...(note.trim() ? { note: note.trim() } : {}) }),
  });
  if (result.error || !result.data) return { error: result.error ?? 'Something went wrong. Please try again.', updatedCount: 0, skippedCount: 0 };
  // No revalidatePath: the board refreshes itself (router.refresh) — revalidating here raced with that refresh.
  return { error: null, message: result.data.message, updatedCount: result.data.updatedCount, skippedCount: result.data.skippedCount };
}

export async function getProductionPieceHistoryAction(pieceId: string): Promise<{ error: string | null; entries: BoqPieceHistoryEntry[] }> {
  const result = await call<{ pieceCode: string; history: BoqPieceHistoryEntry[] }>(`/production/pieces/${pieceId}/history`);
  if (result.error || !result.data) return { error: 'History could not be loaded. Please try again.', entries: [] };
  return { error: null, entries: result.data.history };
}

// ---------------------------------------------------------------------------
// FMP-BOQ-13 — released drawing / calculation files (read-only)
// ---------------------------------------------------------------------------

export interface ProductionDrawingFiles {
  pieceCode: string;
  contract: { referenceNumber: string; jobOrder: string | null; title: string };
  group: { drawingNo: string; calculationRef: string | null; groupTitle: string | null };
  files: { id: string; originalName: string; mimeType: string; fileSize: number; category: DrawingGroupFileCategory; createdAt: string }[];
}

/** Files exist here only for a piece whose group is Released to Production; otherwise the API says so in plain words. */
export async function getProductionDrawingFilesAction(pieceId: string): Promise<{ error: string | null; data: ProductionDrawingFiles | null }> {
  const result = await call<ProductionDrawingFiles>(`/production/pieces/${pieceId}/drawing-files`);
  if (result.error || !result.data) return { error: result.error ?? 'You cannot view this file.', data: null };
  return { error: null, data: result.data };
}
