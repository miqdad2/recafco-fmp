interface StatusBadgeProps {
  isActive: boolean;
}

export function StatusBadge({ isActive }: StatusBadgeProps): React.JSX.Element {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full',
        isActive
          ? 'bg-success-light text-success'
          : 'bg-surface-secondary text-text-muted',
      ].join(' ')}
      aria-label={isActive ? 'Active' : 'Inactive'}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}
