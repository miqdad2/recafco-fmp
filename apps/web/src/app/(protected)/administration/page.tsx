import Link from 'next/link';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../_components/breadcrumbs';

export const metadata: Metadata = { title: 'Administration — RECAFCO FMP' };

const sections = [
  {
    title: 'Users',
    description: 'Manage platform accounts and access roles.',
    href: '/administration/users',
  },
  {
    title: 'Roles',
    description: 'View system and custom roles with their permission sets.',
    href: '/administration/roles',
  },
  {
    title: 'Departments',
    description: 'Manage company-wide departments.',
    href: '/administration/departments',
  },
  {
    title: 'Plants',
    description: 'Manage production plants and facilities.',
    href: '/administration/plants',
  },
  {
    title: 'Locations',
    description: 'Manage physical locations within plants or independent areas.',
    href: '/administration/locations',
  },
];

export default function AdministrationPage(): React.JSX.Element {
  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs items={[{ label: 'Administration' }]} />

        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-text-primary">Administration</h1>
          <p className="mt-2 text-text-secondary">
            Configure organization reference data used across the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="block p-6 bg-surface rounded-lg border border-border hover:border-border-strong hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <h2 className="text-base font-semibold text-text-primary">{section.title}</h2>
              <p className="mt-1 text-sm text-text-secondary">{section.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent">
                Manage
                <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
