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

const trim = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

/** The header page a path belongs to; sub-pages like /food/melbourne count as their section. */
export function pageIndex(pathname: string): number {
  const path = trim(pathname);
  return PAGES.findIndex((p) => p.href === path || (p.href !== "/" && path.startsWith(`${p.href}/`)));
}

/** The page `step` places away from `pathname`, wrapping. Unknown paths step from HOME. */
export function stepPage(pathname: string, step: number): NavPage {
  const i = pageIndex(pathname);
  const from = i === -1 ? PAGES.findIndex((p) => p.href === "/") : i;
  const n = PAGES.length;
  return PAGES[(((from + step) % n) + n) % n];
}

export type NavDirection = "nav-forward" | "nav-back";

/**
 * Which way a jump from `fromPath` to `toHref` travels along the header: rightward is forward.
 * Within one section, going deeper (hub -> city) is forward and coming back out is back.
 */
export function navDirection(fromPath: string, toHref: string): NavDirection {
  const home = PAGES.findIndex((p) => p.href === "/");
  const at = (path: string) => (pageIndex(path) === -1 ? home : pageIndex(path));
  if (pageIndex(toHref) !== -1 && pageIndex(toHref) === pageIndex(fromPath)) {
    const depth = (path: string) => trim(path).split("/").filter(Boolean).length;
    return depth(toHref) < depth(fromPath) ? "nav-back" : "nav-forward";
  }
  return at(toHref) < at(fromPath) ? "nav-back" : "nav-forward";
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const pad3 = (n: number) => String(n).padStart(3, "0");
