import { Eye, Plus, RefreshCw, Upload } from 'lucide-react';
import type { DrawingFileAction } from '../_lib/drawing-file-ui';
import { BTN_PRIMARY_SM, BTN_QUIET, BTN_SECONDARY } from '../_lib/button-styles';

const ICONS = {
  add: Plus,
  view: Eye,
  more: Upload,
  replace: RefreshCw,
} as const;

// Add Drawing is the main action when nothing is uploaded; viewing and adding more are secondary;
// replacing is the quietest because it is the least common.
const STYLE: Record<DrawingFileAction, string> = {
  add: BTN_PRIMARY_SM,
  view: BTN_SECONDARY,
  more: BTN_SECONDARY,
  replace: BTN_QUIET,
};

/** One drawing-file button (Add Drawing / View Drawing Files / Add More Files / Replace Drawing) with its icon. */
export function DrawingFileActionButton({ action, label, onClick }: { action: DrawingFileAction; label: string; onClick: () => void }): React.JSX.Element {
  const Icon = ICONS[action];
  return (
    <button type="button" onClick={onClick} className={STYLE[action]}>
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
