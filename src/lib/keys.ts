"use client";

import { useEffect, useRef } from "react";

/** Keys typed into a field belong to the field, not to page shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * Drops focus left on whatever was last clicked. A key press switches the browser to
 * keyboard mode, which would light that element's focus ring long after the click;
 * a page shortcut isn't about that element, so it shouldn't stay lit.
 */
export function releaseFocus() {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body && !isTypingTarget(el)) el.blur();
}

/**
 * ← and → step through a page's picks (projects, destinations): `step` gets -1 or 1.
 * A held key doesn't race through them, and modified keys are left to the browser.
 */
export function useArrowCycle(step: (dir: -1 | 1) => void) {
  // Latest callback without re-binding the listener on every render.
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      releaseFocus();
      if (!e.repeat) stepRef.current(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
