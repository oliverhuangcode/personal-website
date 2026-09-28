"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { navDirection } from "@/lib/nav";
import { blip } from "@/lib/sound/sound";

/**
 * next/link that plays the navigation click.
 *
 * A mouse click drops focus afterwards. The header survives navigation, so the
 * link would otherwise stay focused, and the next ↑/↓ press would make the
 * browser draw a focus ring on a page you've already left. Keyboard activation
 * (`detail` 0) keeps focus so Tab users don't lose their place.
 *
 * It also tags the navigation with the way it travels along the header, so the
 * page slides in from that side (see template.tsx).
 */
export function NavLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const direction = typeof props.href === "string" ? navDirection(pathname, props.href) : undefined;

  return (
    <Link
      transitionTypes={direction && [direction]}
      {...props}
      onClick={(e) => {
        blip("nav");
        onClick?.(e);
        if (e.detail > 0) e.currentTarget.blur();
      }}
    />
  );
}
