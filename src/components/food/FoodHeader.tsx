import { ViewTransition } from "react";

import { NavLink } from "@/components/ui/NavLink";

import { FoodTabKeys } from "./FoodTabKeys";

const TABS = [
  { href: "/food", label: "CITIES" },
  { href: "/food/rankings", label: "RANKINGS" },
] as const;

export type FoodTab = (typeof TABS)[number]["label"];

/** Parallelogram plate: both ends cut on the same slant, so the pair reads as one angled bar. */
const plate = "[clip-path:polygon(16px_0,100%_0,calc(100%-16px)_100%,0_100%)]";

/**
 * Title and the CITIES / RANKINGS switch shared by both food views. Deliberately unlike the
 * header nav: slanted plates in the display face, the current one lit white like the
 * leaderboard's title plate.
 *
 * Switching tabs is a page change, but the bar holds still (`food-hold`) and the lit plate
 * glides across to the new tab (`marker`) while the content beneath crossfades; the shared
 * pair takes over from the page slide, which still runs when arriving from another section.
 * Each label has its own name so it paints above the travelling plate instead of under it.
 * ← / → switch tabs.
 */
export function FoodHeader({ tab }: { tab: FoodTab }) {
  return (
    <header className="flex flex-col items-center gap-4 text-center">
      <h1 className="font-display text-page-title font-normal text-title">FOOD</h1>
      <ViewTransition name="food-tabs" share="food-hold" default="none">
        <nav aria-label="Food views" className="flex w-full max-w-[460px] gap-1">
          {TABS.map((t) => {
            const active = t.label === tab;
            return (
              <NavLink
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`${plate} relative flex flex-1 justify-center bg-panel-raised px-6 py-2.5 transition-[color,background-color,scale] duration-150 ease-snap active:scale-[0.97] ${
                  active ? "text-bg" : "text-ink-muted hover:bg-border hover:text-ink"
                }`}
              >
                {active && (
                  <ViewTransition name="food-tab-plate" share="marker" default="none">
                    <span aria-hidden className={`${plate} absolute inset-0 bg-title`} />
                  </ViewTransition>
                )}
                <ViewTransition name={`food-tab-${t.label.toLowerCase()}`} share="food-hold" default="none">
                  <span className="relative font-display text-[22px] leading-none tracking-[0.08em] sm:text-[26px]">
                    {t.label}
                  </span>
                </ViewTransition>
              </NavLink>
            );
          })}
        </nav>
      </ViewTransition>
      <FoodTabKeys hrefs={TABS.map((t) => t.href)} current={TABS.findIndex((t) => t.label === tab)} />
    </header>
  );
}
