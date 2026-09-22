"use client";

import { usePathname } from "next/navigation";

import { NavLink } from "@/components/ui/NavLink";
import { PAGES, pageIndex, type NavPage } from "@/lib/nav";

import { SoundToggle } from "./SoundToggle";

const [about, projects, home, travel, food] = PAGES;

function NavItem({ page, active }: { page: NavPage; active: boolean }) {
  return (
    <NavLink
      href={page.href}
      aria-current={active ? "page" : undefined}
      className="flex items-center gap-1.5 px-1.5 py-[18px] text-ink-muted transition-colors duration-150 hover:text-ink sm:gap-2 sm:px-[clamp(10px,1.6vw,18px)]"
    >
      {active && <span aria-hidden className="size-[7px] shrink-0 bg-accent" />}
      <span>{page.label}</span>
    </NavLink>
  );
}

const navGroup =
  "flex flex-1 items-stretch font-mono text-[10px] font-medium tracking-[0.1em] sm:text-[12px] sm:tracking-[0.14em]";

export function Header() {
  const current = PAGES[pageIndex(usePathname())];

  return (
    <header className="sticky top-0 z-20 flex items-center justify-center gap-[clamp(4px,1.5vw,20px)] border-b border-hairline bg-panel-glass px-2 sm:px-[clamp(56px,7vw,110px)]">
      <nav aria-label="Primary" className="contents">
        <div className={`${navGroup} justify-end`}>
          <NavItem page={about} active={current === about} />
          <NavItem page={projects} active={current === projects} />
        </div>
        <NavLink
          href={home.href}
          aria-current={current === home ? "page" : undefined}
          className="chamfer-pill flex items-center justify-center bg-ink px-4 py-[18px] font-display text-[22px] leading-none tracking-[0.16em] text-bg transition-colors duration-150 hover:bg-accent hover:text-bg sm:px-[clamp(24px,4vw,56px)] sm:text-[26px]"
        >
          {home.label}
        </NavLink>
        <div className={`${navGroup} justify-start`}>
          <NavItem page={travel} active={current === travel} />
          <NavItem page={food} active={current === food} />
        </div>
      </nav>
      <SoundToggle className="absolute right-[clamp(12px,2vw,24px)] top-1/2 hidden -translate-y-1/2 sm:flex" />
    </header>
  );
}
