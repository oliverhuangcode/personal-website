import { NavLink } from "@/components/ui/NavLink";

export default function NotFound() {
  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-gutter py-section text-center">
      <p className="font-mono text-[12px] tracking-[0.3em] text-ink-muted">404 · NO SIGNAL</p>
      <h1 className="font-display text-page-title font-normal text-title">OFF THE MAP</h1>
      <NavLink
        href="/"
        className="border border-border-strong px-3.5 py-2 font-mono text-[11px] font-medium tracking-[0.14em] text-ink transition-colors duration-150 hover:bg-ink hover:text-bg"
      >
        ◂ HOME
      </NavLink>
    </main>
  );
}
