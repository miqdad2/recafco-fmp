interface Props {
  isActive: boolean;
  isLocked: boolean;
  mustChangePassword: boolean;
}

export function UserSecurityStatus({ isActive, isLocked, mustChangePassword }: Props): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span
        className={[
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          isActive ? 'bg-success-light text-success' : 'bg-surface-secondary text-text-muted',
        ].join(' ')}
        aria-label={isActive ? 'Active' : 'Inactive'}
      >
        <span className="mr-1 size-1.5 rounded-full bg-current" aria-hidden="true" />
        {isActive ? 'Active' : 'Inactive'}
      </span>
      {isLocked && (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-warning-light text-warning">
          Locked
        </span>
      )}
      {mustChangePassword && (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-warning-light text-warning">
          Must Change Password
        </span>
      )}
    </div>
  );
}
