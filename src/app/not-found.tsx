import { NavLink } from "@/components/ui/NavLink";
import { stagger } from "@/lib/motion";

export default function NotFound() {
  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-gutter py-section text-center">
      <p className="animate-enter font-mono text-[12px] tracking-[0.3em] text-ink-muted" style={stagger(0)}>
        404 · NO SIGNAL
      </p>
      <h1 className="animate-enter font-display text-page-title font-normal text-title" style={stagger(0.06)}>
        OFF THE MAP
      </h1>
      <NavLink
        href="/"
        style={stagger(0.12)}
        className="group sweep animate-enter border border-border-strong px-3.5 py-2 font-mono text-[11px] font-medium tracking-[0.14em] text-ink [--sweep-color:var(--color-ink)]"
      >
        <span className="inline-block transition-transform duration-200 ease-snap group-hover:-translate-x-0.5">◂</span> HOME
      </NavLink>
    </main>
  );
}
