"use client";

import { startTransition, useRef, useState, ViewTransition } from "react";

import { MediaFrame } from "@/components/ui/MediaFrame";
import { NavLink } from "@/components/ui/NavLink";
import { useArrowCycle } from "@/lib/keys";
import { formatCoords, type CitySummary } from "@/lib/food";
import { stagger } from "@/lib/motion";
import { pad2 } from "@/lib/nav";
import { blip } from "@/lib/sound/sound";

/** Map-select style city banners. ← / → move the pick and focus it, so Enter opens it. */
export function CitySelect({ cities }: { cities: CitySummary[] }) {
  const [selected, setSelected] = useState(0);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);

  useArrowCycle((step) => {
    const next = (selected + step + cities.length) % cities.length;
    blip("destination");
    startTransition(() => setSelected(next));
    links.current[next]?.focus();
  });

  return (
    <ul aria-label="Cities" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-3">
      {cities.map((city, i) => {
        const active = i === selected;
        const top = city.restaurants[0];
        return (
          <li key={city.slug} style={stagger(i * 0.05)} className="animate-enter">
            <NavLink
              href={`/food/${city.slug}`}
              ref={(el) => {
                links.current[i] = el;
              }}
              onFocus={() => setSelected(i)}
              onMouseEnter={() => setSelected(i)}
              className="group chamfer-tr relative block aspect-[16/8] overflow-hidden bg-panel text-ink hover:text-ink"
            >
              <MediaFrame
                photo={city.cover}
                thumb
                zoom
                sizes="(min-width: 1100px) 420px, 100vw"
                className="absolute inset-0 bg-[repeating-linear-gradient(135deg,var(--color-panel)_0_10px,var(--color-panel-raised)_10px_11px)]"
                imageClassName="brightness-[0.55] saturate-[0.85]"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(0deg,var(--color-bg)_0%,transparent_65%)]"
              />
              <div className="absolute inset-x-4 top-3 flex justify-between gap-3 font-mono text-[10px] tracking-[0.16em] text-ink-muted">
                <span>
                  {pad2(i + 1)} · {city.country}
                </span>
                {city.coords && <span>{formatCoords(city.coords)}</span>}
              </div>
              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="truncate font-display text-[clamp(40px,5vw,60px)] leading-[0.85] tracking-[0.03em] text-title">
                    {city.name}
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.14em] text-ink-dim">
                    {city.count} {city.count === 1 ? "SPOT" : "SPOTS"} · AVG{" "}
                    <span className="text-score">{city.average.toFixed(1)}</span>
                  </span>
                </div>
                {top && (
                  <span className="hidden shrink-0 flex-col items-end gap-0.5 font-mono text-[10px] tracking-[0.12em] text-ink-muted min-[420px]:flex">
                    <span>#01</span>
                    <span className="max-w-[140px] truncate text-ink">{top.name}</span>
                    <span className="text-score">{top.score.toFixed(1)}</span>
                  </span>
                )}
              </div>
              {/* The pick's bar glides between cards (see `.marker` in globals.css). */}
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-border-strong/60">
                {active && (
                  <ViewTransition name="city-bar" share="marker" default="none">
                    <span className="absolute inset-0 bg-accent" />
                  </ViewTransition>
                )}
              </span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
