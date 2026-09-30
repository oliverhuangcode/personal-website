"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { isTypingTarget, releaseFocus } from "@/lib/keys";
import { PAGES, navDirection, stepPage, type NavDirection } from "@/lib/nav";
import { blip, toggleSound } from "@/lib/sound/sound";

/**
 * 1–5 jump to a page, ↑ and ↓ cycle through them, S toggles sound.
 *
 * ← and → are left to each page: they step through its picks where it has them
 * (see `useArrowCycle`).
 */
export function KeyboardNav() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const go = (href: string, direction: NavDirection) => {
      releaseFocus();
      blip("nav");
      router.push(href, { transitionTypes: [direction] });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      // Holding a key doesn't race through pages, and a held ↑/↓ mustn't fall
      // through to the browser and scroll the page it just landed on.
      if (e.repeat) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") e.preventDefault();
        return;
      }

      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= PAGES.length) {
        go(PAGES[n - 1].href, navDirection(pathname, PAGES[n - 1].href));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        // The key sets the direction, so wrapping from FOOD to ABOUT still slides onward.
        go(stepPage(pathname, 1).href, "nav-forward");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        go(stepPage(pathname, -1).href, "nav-back");
      } else if (e.key.toLowerCase() === "s" && !e.shiftKey) {
        releaseFocus();
        toggleSound();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);

  return null;
}
