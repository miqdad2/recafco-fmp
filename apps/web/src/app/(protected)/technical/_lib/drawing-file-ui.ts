import type { ElementCoverageSummary } from '@/lib/technical-api';

// ---------------------------------------------------------------------------
// FMP-TECH-30 — one set of status words and buttons for drawing files, used by
// the Drawing Groups page and the Final Drawing Files page for both groups and
// individual elements, so the two pages never disagree.
// ---------------------------------------------------------------------------

export type DrawingFileAction = 'add' | 'view' | 'more' | 'replace';

export interface DrawingFileButton {
  action: DrawingFileAction;
  label: string;
}

/**
 * Buttons for a drawing's files. No files: just "Add Drawing". With files: "View Drawing Files" for everyone,
 * plus "Add More Files" and "Replace Drawing" when the user may change them and the group/element is not
 * released. A reader with nothing uploaded gets no button.
 */
export function drawingFileButtons(fileCount: number, canWrite: boolean, canChange: boolean): DrawingFileButton[] {
  const editable = canWrite && canChange;
  if (fileCount === 0) return editable ? [{ action: 'add', label: 'Add Drawing' }] : [];
  return [
    { action: 'view', label: 'View Drawing Files' },
    ...(editable
      ? ([
          { action: 'more', label: 'Add More Files' },
          { action: 'replace', label: 'Replace Drawing' },
        ] as DrawingFileButton[])
      : []),
  ];
}

export interface DrawingRowStatus {
  label: 'Waiting Final Drawing' | 'Drawing Uploaded' | 'Released to Production';
  classes: string;
}

/** The status badge of a group or an individual element, from its drawing files and release. */
export function drawingRowStatus(fileCount: number, released: boolean): DrawingRowStatus {
  if (released) return { label: 'Released to Production', classes: 'bg-success-light text-success' };
  if (fileCount > 0) return { label: 'Drawing Uploaded', classes: 'bg-info-light text-info' };
  return { label: 'Waiting Final Drawing', classes: 'bg-warning-light text-warning' };
}

/** Shown inside the files dialog when the user chose Replace Drawing — nothing is deleted unless they remove it. */
export const REPLACE_DRAWING_HINT =
  'To replace a drawing, add the new file, then remove the old one. Nothing is deleted until you remove it yourself.';

export const NO_DRAWING_YET_TEXT = 'No drawing uploaded yet.';

export interface DrawingReadiness {
  ready: boolean;
  message: string;
}

/** The release readiness message for the Drawing Groups and Final Drawing Files pages (null when there are no elements). */
export function drawingReadiness(summary: Pick<ElementCoverageSummary, 'totalElements' | 'notCovered'>): DrawingReadiness | null {
  if (summary.totalElements === 0) return null;
  return summary.notCovered === 0
    ? { ready: true, message: 'All elements have final drawings. You can continue to Release to Production.' }
    : { ready: false, message: 'Some elements are still waiting for final drawings. Upload drawings before release to Production.' };
}

/** Text next to "Next: Release to Production" on the Final Drawing Files page. */
export function nextReleaseNote(summary: Pick<ElementCoverageSummary, 'totalElements' | 'notCovered'> | null, releaseReady: boolean): string {
  if (!releaseReady) return 'Final drawings are required before release to Production.';
  if (summary && summary.totalElements > 0 && summary.notCovered === 0) return 'All required final drawings are uploaded.';
  return 'Some elements are still waiting for final drawings.';
}
