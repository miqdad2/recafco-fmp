import type { LucideIcon } from 'lucide-react';
import { ACCENT_PALETTE } from '../_lib/module-accent';
import type { ModuleAccent } from '../_lib/module-accent';

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: ModuleAccent;
  /**
   * FMP-UI-16 — optional right-side primary actions (buttons/links), shown
   * inline with the title on larger screens so a manager sees "what can I
   * do here" immediately, without scrolling down to a separate Actions
   * section. Optional and purely additive: every page that doesn't pass it
   * (every Executive Module Landing Page except Contract Management, as of
   * this unit) renders exactly as before — see this unit's own
   * progress-tracker entry for which pages could adopt this next.
   */
  actions?: React.ReactNode;
}

/**
 * FMP-UI-07 — the Executive Module Landing Page header: module icon/title/
 * one-line explanation.
 *
 * FMP-UI-07D — dropped the right-side displayName/roleName block. It
 * duplicated the exact same text TopHeader already shows, always visible,
 * top-right, on every protected page — repeating it here read as "duplicate
 * user text" rather than useful context. Removed from this shared
 * component (not just Contract Management's page) since the duplication
 * was identical on all 8 Executive Module Landing Pages, not specific to
 * one module.
 *
 * FMP-UI-16 — added the optional `actions` slot described above. Uses
 * `flex-col` (stacked) below `lg` and `flex-row justify-between` at `lg`
 * and up, so the actions never crowd the title/description on a narrower
 * screen — they just drop below it, same as the rest of this page's
 * content already does at that width.
 */
export function ExecutiveModuleTitle({ title, description, icon: Icon, accent, actions }: Props): React.JSX.Element {
  const palette = ACCENT_PALETTE[accent];

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-4">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: palette.light, color: palette.base }}
        >
          <Icon className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">{title}</h1>
          <p className="mt-1 text-base text-text-secondary max-w-2xl">{description}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">{actions}</div>}
    </div>
  );
}
