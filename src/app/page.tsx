import { NavLink } from "@/components/ui/NavLink";
import { site } from "@/content/site";

export default function HomePage() {
  const [first, last] = site.name.toUpperCase().split(" ");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-[26px] px-[clamp(16px,3vw,40px)] py-[clamp(40px,8vw,110px)] text-center">
      <p className="font-mono text-[clamp(11px,1.3vw,13px)] tracking-[0.34em] text-ink">{site.title}</p>
      <h1 className="font-display text-hero font-normal text-title">
        {first}
        <br />
        {last}
      </h1>
      <div aria-hidden className="flex w-full max-w-[520px] items-center gap-3.5">
        <div className="h-px flex-1 bg-linear-to-r from-transparent to-border-strong" />
        <div className="size-[9px] rotate-45 bg-accent" />
        <div className="h-px flex-1 bg-linear-to-r from-border-strong to-transparent" />
      </div>
      <div className="flex flex-wrap justify-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em]">
        <NavLink
          href="/projects"
          className="border border-border-strong px-3.5 py-2 text-ink transition-colors duration-150 hover:bg-ink hover:text-bg"
        >
          VIEW PROJECTS ▸
        </NavLink>
      </div>
    </main>
  );
}
