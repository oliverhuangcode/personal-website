import { HoloCore } from "@/components/home/HoloCore";
import { NavLink } from "@/components/ui/NavLink";
import { site } from "@/content/site";

export default function HomePage() {
  const [first, last] = site.name.toUpperCase().split(" ");

  return (
    <main className="relative isolate flex flex-1 flex-col items-center justify-center overflow-hidden px-[clamp(16px,3vw,40px)] py-[clamp(40px,8dvh,90px)] text-center">
      <HoloCore />
      <div className="relative z-10 flex w-full flex-col items-center gap-[26px]">
        <p className="font-mono text-[clamp(11px,1.3vw,13px)] tracking-[0.34em] text-ink">{site.title}</p>
        <h1 className="font-display text-hero font-normal text-title [text-shadow:0_4px_30px_#08070c,0_0_60px_#08070caa]">
          {first}
          <br />
          {last}
        </h1>
        <div aria-hidden className="flex w-full max-w-[520px] items-center gap-3.5">
          <div className="h-px flex-1 bg-linear-to-r from-transparent to-border-strong" />
          <div className="size-[9px] rotate-45 bg-accent" />
          <div className="h-px flex-1 bg-linear-to-r from-border-strong to-transparent" />
        </div>
        {/* The chamfer clips borders and outlines, so the 1px frame is the wrapper showing
            through, and it lights up to mark keyboard focus. */}
        <div className="chamfer-br bg-border-strong p-px transition-colors duration-150 has-focus-visible:bg-accent">
          <NavLink
            href="/projects"
            className="chamfer-br block bg-bg px-[26px] py-[13px] font-mono text-xs font-medium tracking-[0.16em] text-ink transition-colors duration-150 outline-none hover:bg-accent hover:text-bg"
          >
            VIEW PROJECTS ▸
          </NavLink>
        </div>
      </div>
    </main>
  );
}
