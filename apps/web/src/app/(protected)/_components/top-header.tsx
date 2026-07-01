import { Menu } from 'lucide-react';
import { logoutAction } from '../actions';
import type { ShellUser } from './app-shell';

interface TopHeaderProps {
  user: ShellUser;
  onMenuOpen: (trigger: HTMLElement) => void;
}

export function TopHeader({ user, onMenuOpen }: TopHeaderProps): React.JSX.Element {
  return (
    <header className="flex items-center justify-between h-14 px-4 bg-surface border-b border-border shrink-0">
      {/* Mobile hamburger */}
      <MobileMenuButton onMenuOpen={onMenuOpen} />

      {/* Desktop: empty left (sidebar provides branding) */}
      <div className="hidden md:block" />

      {/* Right: user info + logout */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-text-primary leading-tight">{user.displayName}</p>
          <p className="text-xs text-text-muted leading-tight">{user.roleName}</p>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="h-9 px-3 rounded-md border border-border bg-surface text-text-secondary text-sm hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

// Separate client component just for the mobile button (receives callback from AppShell)
function MobileMenuButton({
  onMenuOpen,
}: {
  onMenuOpen: (trigger: HTMLElement) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="md:hidden p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
      aria-label="Open navigation menu"
      aria-controls="mobile-nav"
      onClick={(e) => onMenuOpen(e.currentTarget)}
    >
      <Menu className="size-5" aria-hidden="true" />
    </button>
  );
}
