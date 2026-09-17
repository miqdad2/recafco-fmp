import { Eye } from 'lucide-react';

/**
 * CM-71H.9 — shown at the top of a guided erection screen whenever
 * `isPreviewMode` is true (see erection-preview.ts). Purely informational —
 * never disables anything itself; each panel separately disables its own
 * save/submit/issue/approve/confirm actions when preview mode is the only
 * reason the prerequisite-gated form is rendering.
 */
export function ErectionPreviewBanner(): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 rounded-md border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
      <Eye className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
      <p>
        <span className="font-semibold">Preview Mode</span> — this screen is shown for layout review. Workflow actions remain disabled until previous steps are completed.
      </p>
    </div>
  );
}
