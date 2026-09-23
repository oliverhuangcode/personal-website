"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { PAGES, stepPage } from "@/lib/nav";
import { blip, toggleSound } from "@/lib/sound/sound";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * 1–5 jump to a page, ↑ and ↓ cycle through them, S toggles sound.
 *
 * ← and → are deliberately left alone: they belong to whatever control has
 * focus, such as moving along a row of tabs or thumbnails.
 */
export function KeyboardNav() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const go = (href: string) => {
      blip("nav");
      router.push(href);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target)) return;

      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= PAGES.length) {
        go(PAGES[n - 1].href);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        go(stepPage(pathname, 1).href);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        go(stepPage(pathname, -1).href);
      } else if (e.key.toLowerCase() === "s" && !e.shiftKey) {
        toggleSound();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);

  return null;
}
