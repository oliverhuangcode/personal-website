import type { CSSProperties } from "react";

import { site } from "@/content/site";

/**
 * Map-load style intro. Pure CSS: it fades itself out at 2.5s and is hidden
 * before first paint on repeat visits or under reduced motion (see layout.tsx).
 *
 * It never takes pointer events: it is decorative, and blocking clicks would
 * make the whole page dead for the first three seconds of a session.
 */
export function BootScreen() {
  const [first, last] = site.name.toUpperCase().split(" ");
  const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

  return (
    <div
      aria-hidden
      className="boot-screen pointer-events-none fixed inset-0 z-90 bg-[radial-gradient(120%_90%_at_62%_40%,#141120_0%,#0a0c0d_55%,#08070c_100%)]"
    >
      <div className="absolute inset-0 bg-[linear-gradient(100deg,#08070cf7_0%,#08070cd9_34%,#08070c4d_62%,#08070c99_100%)]" />

      <div className="boot-line absolute left-[30px] top-[22px] flex items-center gap-[9px] font-mono text-[12px] tracking-[0.14em] text-ink [animation-duration:0.3s]">
        <span className="size-2 rotate-45 bg-accent" />
        <span>0 / 5</span>
      </div>

      <div className="absolute left-[30px] top-[clamp(70px,13vh,130px)] flex max-w-[min(92%,760px)] flex-col gap-5">
        <div className="boot-line font-display text-boot text-ink" style={delay(0.1)}>
          {first}
          <br />
          {last}
        </div>
        <div className="boot-line flex flex-col gap-2.5" style={delay(0.4)}>
          <div className="font-mono text-[clamp(11px,1.4vw,15px)] tracking-[0.28em] text-ink">
            {site.coordinates}
          </div>
          <div className="h-0.5 w-24 bg-rule" />
        </div>
        <div className="boot-line flex flex-col gap-3" style={delay(0.6)}>
          <div className="font-mono text-[12px] tracking-[0.24em] text-ink-muted">{site.title}</div>
          <div className="flex gap-1.5">
            <span className="size-[9px] bg-accent" />
            <span className="size-[9px] bg-border" />
            <span className="size-[9px] bg-border" />
          </div>
        </div>
      </div>

      <div
        className="boot-line absolute bottom-[clamp(36px,7vh,72px)] left-[30px] inline-flex flex-col items-stretch gap-2.5"
        style={delay(0.9)}
      >
        <div className="animate-pulse indent-[0.24em] text-center font-display text-[clamp(28px,4vw,44px)] leading-none tracking-[0.24em] text-ink">
          LOADING
        </div>
        <div className="flex items-center justify-center gap-[9px]">
          {[0, 0.2, 0.4].map((d) => (
            <span key={d} className="size-2 rotate-45 animate-pulse bg-accent" style={delay(d)} />
          ))}
        </div>
      </div>
    </div>
  );
}
