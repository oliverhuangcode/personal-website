import type { CSSProperties } from "react";

/**
 * Delays an entry animation by `s` seconds, for staggering siblings. On a first
 * visit it also waits out the boot screen (`--boot-delay`, see globals.css).
 */
export const stagger = (s: number): CSSProperties => ({ animationDelay: `calc(var(--boot-delay, 0s) + ${s}s)` });
