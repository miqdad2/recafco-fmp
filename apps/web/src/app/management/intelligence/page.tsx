import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ConnectionPending } from './_components/report-foundation';
import { CONNECTION_STATUS_TEXT, CONNECTION_STATUS_TITLE, MANAGEMENT_MODULES, moduleHref } from './_lib/management-modules';

export default function ManagementHomePage(): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary lg:text-4xl">
          RECAFCO Management Intelligence Center
        </h1>
        <p className="mt-2 text-base text-text-secondary lg:text-lg">Factory operations, projects and performance in one place.</p>
      </header>

      <div className="mt-6">
        <ConnectionPending title={CONNECTION_STATUS_TITLE} text={CONNECTION_STATUS_TEXT} />
      </div>

      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {MANAGEMENT_MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <li key={m.slug} className="flex">
              <article className="group flex w-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition duration-150 focus-within:border-accent hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <span className="flex size-12 items-center justify-center rounded-xl bg-accent-light text-accent">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-text-primary">{m.title}</h2>
                <p className="mt-1 flex-1 text-[15px] leading-relaxed text-text-secondary">{m.description}</p>
                <Link
                  href={moduleHref(m)}
                  aria-label={`View ${m.title} dashboard`}
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold text-text-primary transition-colors hover:border-accent hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                >
                  View Dashboard
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
