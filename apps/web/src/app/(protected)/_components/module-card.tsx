import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ModuleCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  iconColor?: string;
  status: 'available' | 'planned';
  phase: string;
}

export function ModuleCard({
  title,
  description,
  href,
  icon: Icon,
  iconColor = 'text-accent',
  status,
  phase,
}: ModuleCardProps): React.JSX.Element {
  return (
    <Link
      href={href}
      className="group block p-5 bg-surface rounded-lg border border-border hover:border-border-strong hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-focus"
    >
      <div className="flex items-start gap-3">
        <span className={`${iconColor} shrink-0 mt-0.5`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
            {status === 'planned' && (
              <span className="text-[10px] font-medium bg-secondary-accent-light text-secondary-accent px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                {phase}
              </span>
            )}
            {status === 'available' && (
              <span className="text-[10px] font-medium bg-success-light text-success px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary mt-1 line-clamp-2">{description}</p>
        </div>
        <ArrowRight
          className="size-4 text-text-muted shrink-0 mt-0.5 group-hover:text-accent transition-colors"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
