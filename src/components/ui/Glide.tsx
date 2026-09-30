"use client";

import { useLayoutEffect, useRef } from "react";

/** Where each highlight was when it last left, relative to its `data-glide-root`. */
const left = new Map<string, { x: number; y: number; w: number; h: number; at: number }>();

function measure(el: HTMLElement) {
  const root = el.parentElement?.closest<HTMLElement>("[data-glide-root]");
  const r = el.getBoundingClientRect();
  const o = root?.getBoundingClientRect() ?? { left: -window.scrollX, top: -window.scrollY };
  return {
    x: r.left - o.left + (root?.scrollLeft ?? 0),
    y: r.top - o.top + (root?.scrollTop ?? 0),
    w: r.width,
    h: r.height,
  };
}

/**
 * A selection fill that slides from the last pick to this one. Render it inside the active
 * item only. It's an ordinary element, so it can pass under the labels (a view-transition
 * layer would paint over them): give the `data-glide-root` container `isolate`, this a
 * z-index, and every item's text a higher one. Positions are measured against that root,
 * which keeps the slide right when it scrolls.
 */
export function Glide({ id, className }: { id: string; className: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = left.get(id);
    // Only a pick that just happened slides; arriving on a page later starts in place.
    if (from && performance.now() - from.at < 1000 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const to = measure(el);
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || from.w !== to.w || from.h !== to.h) {
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(${from.w / to.w}, ${from.h / to.h})` },
            { transform: "none" },
          ],
          { duration: 280, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        );
      }
    }
    return () => {
      left.set(id, { ...measure(el), at: performance.now() });
    };
  }, [id]);

  return <span ref={ref} aria-hidden className={`pointer-events-none absolute origin-top-left ${className}`} />;
}
