"use client";

import { startTransition, useRef, useState, ViewTransition } from "react";

import { MediaFrame } from "@/components/ui/MediaFrame";
import { NavLink } from "@/components/ui/NavLink";
import { useArrowCycle } from "@/lib/keys";
import { formatCoords, type CitySummary } from "@/lib/food";
import { stagger } from "@/lib/motion";
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
    <ul aria-label="Cities" className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {cities.map((city, i) => {
        const active = i === selected;
        return (
          // An odd last card spans the row rather than leaving a hole beside it.
          <li
            key={city.slug}
            style={stagger(i * 0.05)}
            className="animate-enter md:[&:last-child:nth-child(odd)]:col-span-2"
          >
            <NavLink
              href={`/food/${city.slug}`}
              ref={(el) => {
                links.current[i] = el;
              }}
              onFocus={() => setSelected(i)}
              onMouseEnter={() => setSelected(i)}
              className="group chamfer-tr relative flex h-full outline-none min-h-[clamp(150px,15vw,184px)] flex-col justify-between gap-5 overflow-hidden bg-panel px-5 pt-3.5 pb-5 text-ink hover:text-ink"
            >
              {/* The photo layer sits behind the text; its own wrapper keeps MediaFrame's `relative` from taking part in the layout. */}
              <div aria-hidden className="absolute inset-0">
                <MediaFrame
                  photo={city.cover}
                  thumb
                  zoom
                  sizes="(min-width: 768px) 620px, 100vw"
                  className="h-full bg-[repeating-linear-gradient(135deg,var(--color-panel)_0_10px,var(--color-panel-raised)_10px_11px)]"
                  imageClassName="brightness-[0.55] saturate-[0.85]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--color-bg)_0%,transparent_75%)]" />
              </div>
              <span className="relative self-end font-mono text-[11px] tracking-[0.16em] text-ink-muted">
                {city.coords && formatCoords(city.coords)}
              </span>
              <div className="relative flex flex-col gap-2">
                <span className="font-display text-[clamp(40px,5vw,60px)] leading-[0.85] tracking-[0.03em] break-words text-title">
                  {city.name}
                </span>
                <span className="font-mono text-[11px] tracking-[0.14em] text-ink-dim">
                  {city.count} {city.count === 1 ? "SPOT" : "SPOTS"} · AVG{" "}
                  <span className="text-score">{city.average.toFixed(1)}</span>
                </span>
              </div>
              {/* The chamfer clips outlines, so keyboard focus draws its frame inside the card. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 hidden border-2 border-accent group-focus-visible:block"
              />
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
