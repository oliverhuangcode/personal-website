import { HoloCore } from "@/components/home/HoloCore";
import { NavLink } from "@/components/ui/NavLink";
import { site } from "@/content/site";
import { stagger } from "@/lib/motion";

export default function HomePage() {
  const [first, last] = site.name.toUpperCase().split(" ");

  return (
    // Not selectable: scrolling and swiping here spin the spike, and a stray drag shouldn't
    // paint a selection over the name.
    <main className="relative isolate flex flex-1 flex-col items-center justify-center overflow-hidden px-[clamp(16px,3vw,40px)] py-[clamp(40px,8dvh,90px)] text-center select-none">
      <HoloCore />
      <div className="relative z-10 flex w-full flex-col items-center gap-[26px]">
        {/* Assembles top to bottom, after the boot screen on a first visit. */}
        <p
          className="animate-enter font-mono text-[clamp(11px,1.3vw,13px)] tracking-[0.34em] text-ink"
          style={stagger(0)}
        >
          {site.title}
        </p>
        <h1
          style={stagger(0.06)}
          className="animate-enter font-display text-hero font-normal text-title [text-shadow:0_4px_30px_#08070c,0_0_60px_#08070caa]">
          {first}
          <br />
          {last}
        </h1>
        <div aria-hidden className="flex w-full max-w-[520px] items-center gap-3.5">
          {/* The rules draw outward from the diamond. */}
          <div
            className="h-px flex-1 origin-right animate-fill bg-linear-to-r from-transparent to-border-strong"
            style={stagger(0.16)}
          />
          <div className="size-[9px] animate-enter rotate-45 bg-accent" style={stagger(0.12)} />
          <div
            className="h-px flex-1 origin-left animate-fill bg-linear-to-r from-border-strong to-transparent"
            style={stagger(0.16)}
          />
        </div>
        {/* The chamfer clips borders and outlines, so the 1px frame is the wrapper showing
            through, and it lights up to mark keyboard focus. */}
        <div
          className="chamfer-br animate-enter bg-border-strong p-px transition-colors duration-150 has-focus-visible:bg-accent"
          style={stagger(0.2)}
        >
          <NavLink
            href="/projects"
            className="group chamfer-br sweep block bg-bg px-[26px] py-[13px] font-mono text-xs font-medium tracking-[0.16em] text-ink outline-none"
          >
            VIEW PROJECTS <span className="inline-block transition-transform duration-200 ease-snap group-hover:translate-x-0.5">▸</span>
          </NavLink>
        </div>
      </div>
    </main>
  );
}
