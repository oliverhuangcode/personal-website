"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { blip } from "@/lib/sound/sound";

/**
 * next/link that plays the navigation click.
 *
 * A mouse click drops focus afterwards. The header survives navigation, so the
 * link would otherwise stay focused, and the next ↑/↓ press would make the
 * browser draw a focus ring on a page you've already left. Keyboard activation
 * (`detail` 0) keeps focus so Tab users don't lose their place.
 */
export function NavLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        blip("nav");
        onClick?.(e);
        if (e.detail > 0) e.currentTarget.blur();
      }}
    />
  );
}
