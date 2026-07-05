interface StatusBadgeProps {
  isActive: boolean;
  isArchived?: boolean;
}

export function StatusBadge({ isActive, isArchived }: StatusBadgeProps): React.JSX.Element {
  let label: string;
  let classes: string;

  if (isArchived) {
    label = 'Archived';
    classes = 'bg-surface-tertiary text-text-muted';
  } else if (isActive) {
    label = 'Active';
    classes = 'bg-success-light text-success';
  } else {
    label = 'Inactive';
    classes = 'bg-surface-secondary text-text-muted';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full ${classes}`}
      aria-label={label}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
