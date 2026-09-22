"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { blip } from "@/lib/sound/sound";

/** next/link that plays the navigation click. */
export function NavLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        blip("nav");
        onClick?.(e);
      }}
    />
  );
}
