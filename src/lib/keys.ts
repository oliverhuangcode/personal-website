"use client";

import { useEffect, useRef } from "react";

/** Keys typed into a field belong to the field, not to page shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
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
      if (!e.repeat) stepRef.current(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
