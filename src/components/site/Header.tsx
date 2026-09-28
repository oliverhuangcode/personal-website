"use client";

import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

import { NavLink } from "@/components/ui/NavLink";
import { PAGES, pageIndex, type NavPage } from "@/lib/nav";

import { SoundToggle } from "./SoundToggle";

const [about, projects, home, travel, food] = PAGES;

/**
 * Underline with an arrow resting on it and a crossed stem hanging below — marks the current page.
 * One name across all items, so on navigation it glides to the new page instead of jumping.
 */
function SelectedMarker() {
  return (
    <ViewTransition name="nav-marker" share="marker" default="none">
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute inset-x-0 -bottom-px h-[2px] bg-accent" />
        <svg
          viewBox="0 0 12 20"
          className="absolute left-1/2 top-full h-5 w-3 -translate-x-1/2 -translate-y-[7px] fill-accent"
        >
          <path d="M6 1 10 6H2Z" />
          <rect x="5.5" y="6" width="1" height="12" />
          <rect x="2" y="11" width="8" height="1" />
          <rect x="3.5" y="14" width="5" height="1" />
        </svg>
      </span>
    </ViewTransition>
  );
}

function NavItem({ page, active }: { page: NavPage; active: boolean }) {
  return (
    <NavLink
      href={page.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center px-1.5 py-[18px] transition-colors duration-150 hover:text-ink sm:px-[clamp(10px,1.6vw,18px)] ${
        active ? "bg-accent/15 text-ink" : "text-ink-muted"
      }`}
    >
      <span>{page.label}</span>
      {active && <SelectedMarker />}
    </NavLink>
  );
}

/**
 * Thin line running parallel to one slanted side of the HOME trapezoid, just outside it.
 * It overshoots the header and is clipped top and bottom so its ends sit flat on the edges.
 */
function HomeEdge({ side, active }: { side: "left" | "right"; active: boolean }) {
  return (
    <svg
      aria-hidden
      className={`pointer-events-none absolute top-0 h-full w-(--home-slant) overflow-visible stroke-ink [clip-path:inset(0_-4px)] ${
        side === "left" ? "-left-[9px]" : "-right-[9px] -scale-x-100"
      }`}
    >
      <line x1="-10%" y1="-10%" x2="110%" y2="110%" strokeWidth={active ? 2 : 1} />
    </svg>
  );
}

function HomeLink({ page, active }: { page: NavPage; active: boolean }) {
  return (
    <NavLink
      href={page.href}
      aria-current={active ? "page" : undefined}
      className="group relative flex items-center justify-center self-stretch px-[52px] [--home-slant:28px] sm:[--home-slant:44px] font-display text-[22px] leading-none tracking-[0.16em] sm:px-[clamp(88px,9vw,136px)] sm:text-[26px]"
    >
      <span
        aria-hidden
        className="chamfer-home absolute inset-0 bg-ink transition-colors duration-150 group-hover:bg-[color-mix(in_oklab,var(--color-ink)_80%,var(--color-accent))]"
      />
      <HomeEdge side="left" active={active} />
      <HomeEdge side="right" active={active} />
      <span className="relative text-bg">{page.label}</span>
    </NavLink>
  );
}

const navGroup =
  "flex flex-1 items-stretch self-stretch font-mono text-[10px] font-medium tracking-[0.1em] sm:text-[12px] sm:tracking-[0.14em]";

export function Header() {
  const current = PAGES[pageIndex(usePathname())];

  return (
    // Named so it holds still above the page while pages slide (see globals.css).
    <header
      style={{ viewTransitionName: "site-header" }}
      className="sticky top-0 z-20 flex items-center justify-center gap-[clamp(4px,1.5vw,20px)] border-b border-hairline bg-panel-glass px-2 sm:px-[clamp(56px,7vw,110px)]"
    >
      <nav aria-label="Primary" className="contents">
        <div className={`${navGroup} justify-end`}>
          <NavItem page={about} active={current === about} />
          <NavItem page={projects} active={current === projects} />
        </div>
        <HomeLink page={home} active={current === home} />
        <div className={`${navGroup} justify-start`}>
          <NavItem page={travel} active={current === travel} />
          <NavItem page={food} active={current === food} />
        </div>
      </nav>
      <SoundToggle className="absolute right-[clamp(12px,2vw,24px)] top-1/2 hidden -translate-y-1/2 sm:flex" />
    </header>
  );
}
