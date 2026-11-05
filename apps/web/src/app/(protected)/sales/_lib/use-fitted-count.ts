'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** FMP-SALES-14 — below this many complete cards, the short card form is tried so that more records are shown. */
const PREFERRED_RECORDS = 3;

/**
 * FMP-SALES-07 — on wide desktop windows a dashboard list shows only as many COMPLETE cards as fit between the list's top
 * and the bottom of the application's scroll area (header and sidebar are already outside it), so the page itself does
 * not need to scroll. The rest are hidden (display:none, not clipped) and reached with the "View …" links. Below the
 * desktop breakpoint every card is shown and the page scrolls naturally. At least one card is always shown.
 *
 * Nothing here is tied to a particular screen size: it measures the real cards and the real space, again whenever the
 * window or the scroll area is resized, the data changes, or fonts finish loading.
 */
export function useFittedCount(listRef: React.RefObject<HTMLElement | null>, dependency: unknown): number {
  const [shown, setShown] = useState<number>(Number.MAX_SAFE_INTEGER);
  const last = useRef(-1);

  const measure = useCallback((): void => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.children) as HTMLElement[];
    const apply = (n: number): void => {
      items.forEach((el, i) => {
        el.style.display = i < n ? '' : 'none';
      });
      if (last.current !== n) {
        last.current = n;
        setShown(n);
      }
    };
    if (items.length === 0) return apply(0);
    items.forEach((el) => {
      el.style.display = '';
    });
    list.dataset.dense = 'false';
    if (!window.matchMedia('(min-width: 1280px)').matches) return apply(items.length);

    const main = list.closest('main');
    const panel = list.closest('section');
    if (!main || !panel) return apply(items.length);
    const listTop = list.getBoundingClientRect().top;
    // Everything below the cards inside the panel (padding, notes) plus the page's own bottom padding.
    const tail = panel.getBoundingClientRect().bottom - list.getBoundingClientRect().bottom;
    const wrapper = panel.closest('[data-sales-shell]');
    const bottomPad = wrapper ? parseFloat(getComputedStyle(wrapper).paddingBottom) || 0 : 12;
    const available = main.getBoundingClientRect().bottom - listTop - tail - bottomPad - 6; // small safety margin so sub-pixel rounding never causes a scrollbar
    const fitting = (): number => {
      let n = 0;
      for (const el of items) {
        if (el.getBoundingClientRect().bottom - listTop <= available + 0.5) n += 1;
        else break;
      }
      return n;
    };
    let n = fitting();
    if (n < Math.min(PREFERRED_RECORDS, items.length)) {
      // Fewer than a useful number of complete cards fit: try the short card form (the low-value lines are left out, see
      // globals.css) and keep it only when it really shows more records - or when not even one full card fits.
      list.dataset.dense = 'true';
      const denseCount = fitting();
      if (denseCount > n || n < 1) n = denseCount;
      else list.dataset.dense = 'false';
    }
    apply(Math.max(1, n));
  }, [listRef]);

  useIsoLayoutEffect(() => {
    measure();
  }, [measure, dependency]);

  useEffect(() => {
    const main = listRef.current?.closest('main');
    const ro = new ResizeObserver(() => measure());
    if (main) ro.observe(main);
    if (listRef.current) ro.observe(listRef.current);
    const onResize = (): void => measure();
    window.addEventListener('resize', onResize);
    void document.fonts?.ready.then(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [listRef, measure]);

  return shown;
}
