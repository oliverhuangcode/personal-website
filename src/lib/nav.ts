export interface NavPage {
  href: string;
  label: string;
}

/** Visual nav order. Keys 1–5 and arrow cycling follow this, not DOM order. */
export const PAGES: NavPage[] = [
  { href: "/about", label: "ABOUT" },
  { href: "/projects", label: "PROJECTS" },
  { href: "/", label: "HOME" },
  { href: "/travel", label: "TRAVEL" },
  { href: "/food", label: "FOOD" },
];

export function pageIndex(pathname: string): number {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PAGES.findIndex((p) => p.href === path);
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const pad3 = (n: number) => String(n).padStart(3, "0");
