'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * FMP-SALES-14 — a dashboard figure written in words ("12.5 million") that reveals the exact KWD amount on click, tap,
 * Enter or Space, not only on hover. Escape, a second press or a click elsewhere closes it. The exact amount appears in a
 * small bubble under the figure, so the card layout does not move. Detail pages and lists always show exact amounts.
 */
interface Props {
  number: string;
  unit: string;
  exact: string;
}

export function ExactAmount({ number, unit, exact }: Props): React.JSX.Element {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent): void => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
    };
  }, [open]);

  return (
    <span ref={wrap} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-expanded={open}
        aria-controls={id}
        title={`Exactly KWD ${exact}`}
        className="rounded-md text-left underline decoration-dotted decoration-2 underline-offset-4 hover:decoration-solid focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        data-exact-amount={exact}
      >
        {number}
        {unit && <span className="ml-1.5 text-xl font-bold 2xl:text-2xl">{unit}</span>}
        <span className="sr-only">. Show the exact amount</span>
      </button>
      <span
        id={id}
        role="status"
        className={open ? 'absolute left-0 top-full z-30 mt-1 whitespace-nowrap rounded-lg border-2 border-slate-500 bg-white px-3 py-1.5 text-lg font-semibold text-slate-900 shadow-lg' : 'sr-only'}
      >
        {open ? `Exactly KWD ${exact}` : ''}
      </span>
    </span>
  );
}
