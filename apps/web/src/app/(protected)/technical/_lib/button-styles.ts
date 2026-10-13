// ---------------------------------------------------------------------------
// FMP-TECH-32 — one button look for the whole Technical workflow, so a user can
// tell at a glance what is clickable and how important it is:
//
//   primary    solid red       the one main work action (Confirm Elements, Add Drawing, Release…)
//   secondary  bordered white  looking / editing (View Elements, View Drawing Files, Add More Files…)
//   quiet      light border    lower-priority changes (Replace Drawing, Cancel)
//   danger     red outline     destructive (Cancel Confirmation, Remove)
//   nav        large outline   moving between steps (Previous / Next / Back)
//   navPrimary large, accent   Next when the step is ready
//
// Every button has a hover change, a visible focus ring, a pointer cursor and a
// clear disabled look. Status badges deliberately share none of this: they are
// borderless, small, default-cursor pills (see BADGE).
// ---------------------------------------------------------------------------

const BASE =
  'inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

export const BTN_PRIMARY = `${BASE} h-9 border-accent bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-sm hover:bg-accent-hover`;
export const BTN_PRIMARY_SM = `${BASE} h-8 border-accent bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-sm hover:bg-accent-hover`;
export const BTN_SECONDARY = `${BASE} h-8 border-text-muted/60 bg-surface px-3 text-xs text-text-primary shadow-sm hover:border-text-secondary hover:bg-surface-secondary`;
export const BTN_QUIET = `${BASE} h-8 border-border bg-surface px-3 text-xs text-text-secondary hover:border-text-muted hover:bg-surface-secondary hover:text-text-primary`;
export const BTN_DANGER = `${BASE} h-8 border-error/60 bg-surface px-3 text-xs text-error hover:bg-error-light`;
export const BTN_NAV = `${BASE} h-10 border-text-muted/60 bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm hover:border-text-secondary hover:bg-surface-secondary`;
export const BTN_NAV_PRIMARY = `${BASE} h-10 border-accent bg-accent-light px-4 text-sm font-semibold text-accent shadow-sm hover:bg-accent hover:text-accent-foreground`;

/** Status pills: no border, default cursor, no hover — they must never look pressable. */
export const BADGE = 'inline-flex cursor-default select-none items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold';
