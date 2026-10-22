import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { ConnectionPending } from '../_components/report-foundation';
import {
  CONNECTION_STATUS_TEXT,
  CONNECTION_STATUS_TITLE,
  MANAGEMENT_BASE_PATH,
  MANAGEMENT_MODULES,
  findModule,
} from '../_lib/management-modules';

interface PageProps {
  params: Promise<{ module: string }>;
}

export function generateStaticParams(): { module: string }[] {
  return MANAGEMENT_MODULES.map((m) => ({ module: m.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { module: slug } = await params;
  const found = findModule(slug);
  return { title: found ? `${found.title} — Management Intelligence` : 'Management Intelligence' };
}

/**
 * One connection-pending page per module. Real KPI cards, charts and filters are added here once
 * the Factory Management integration supplies data (FMP-MIC-02+); nothing on this page is sample data.
 */
export default async function ManagementModulePage({ params }: PageProps): Promise<React.JSX.Element> {
  const { module: slug } = await params;
  const found = findModule(slug);
  if (!found) notFound();
  const Icon = found.icon;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Link
        href={MANAGEMENT_BASE_PATH}
        className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to Executive Overview
      </Link>

      <header className="mt-4 flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent">
          <Icon className="size-7" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">{found.title}</h1>
          <p className="mt-1 text-base text-text-secondary">{found.description}</p>
        </div>
      </header>

      <div className="mt-8">
        <ConnectionPending title={CONNECTION_STATUS_TITLE} text={CONNECTION_STATUS_TEXT} />
      </div>
    </div>
  );
}
