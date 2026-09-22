import type { Metadata } from "next";

import { links, readout, site, timeline } from "@/content/site";

export const metadata: Metadata = { title: "About" };

const sectionLabel = "font-mono text-[11px] tracking-[0.22em] text-ink-muted";

export default function AboutPage() {
  return (
    <main className="mx-auto grid w-full max-w-[1040px] flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] content-center items-start gap-[clamp(22px,3.5vw,48px)] px-gutter py-[clamp(24px,4vw,56px)]">
      <div className="flex min-w-0 flex-col gap-[18px]">
        <p className="font-mono text-[12px] tracking-[0.3em] text-ink">ABOUT</p>
        <h1 className="font-display text-about-title font-normal text-title">ME</h1>
        <p className="text-[18px] leading-[1.6] text-pretty text-ink-dim">{site.bio}</p>
        <dl className="hairline-group font-mono text-[12px]">
          {readout.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 bg-panel-glass px-4 py-[13px]">
              <dt className="text-ink-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex min-w-0 flex-col gap-[22px]">
        <section aria-labelledby="timeline" className="flex flex-col gap-2.5">
          <h2 id="timeline" className={sectionLabel}>
            TIMELINE
          </h2>
          <ol className="hairline-group">
            {timeline.map((entry) => (
              <li key={`${entry.year}-${entry.org}`} className="flex gap-4 bg-panel-glass px-4 py-3.5">
                <span className="flex-[0_0_62px] font-mono text-[12px] text-accent">{entry.year}</span>
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="font-mono text-[12px] tracking-[0.1em]">{entry.org}</span>
                  <span className="text-[15px] text-ink-muted">{entry.role}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="elsewhere" className="flex flex-col gap-2.5">
          <h2 id="elsewhere" className={sectionLabel}>
            ELSEWHERE
          </h2>
          <ul className="flex flex-col gap-2 font-mono text-[13px] font-medium">
            {links.map((link) => {
              const external = link.href.startsWith("http");
              return (
                <li key={link.label}>
                  <a
                    href={link.href}
                    {...(external && { target: "_blank", rel: "noopener noreferrer" })}
                    className="chamfer-br flex justify-between gap-3 bg-panel-raised px-4 py-3.5 text-ink transition-colors duration-150 hover:bg-accent hover:text-bg"
                  >
                    <span>{link.label}</span>
                    <span aria-hidden>↗</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
