"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PAGES } from "@/lib/nav";
import { blip, toggleSound } from "@/lib/sound/sound";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * 1–5 jump to a page, S toggles sound.
 *
 * The arrow keys are deliberately left alone: they belong to the page, for
 * scrolling and for moving within a control.
 */
export function KeyboardNav() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target)) return;

      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= PAGES.length) {
        blip("nav");
        router.push(PAGES[n - 1].href);
      } else if (e.key.toLowerCase() === "s" && !e.shiftKey) {
        toggleSound();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
