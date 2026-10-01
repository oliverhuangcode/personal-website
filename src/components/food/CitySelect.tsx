"use client";

import { useState } from "react";

import { MediaFrame } from "@/components/ui/MediaFrame";
import { NavLink } from "@/components/ui/NavLink";
import { formatCoords, type CitySummary } from "@/lib/food";
import { pad3 } from "@/lib/nav";

/**
 * Map-select style city banners. The pick follows the pointer and keyboard focus; ← / → belong
 * to the food tabs. The picked card comes alive: it grows a touch, an accent glow rises from
 * its bottom corner, its photo (or the stripes standing in for one) drifts, the number lights
 * up, and its bar wipes in as the last pick's wipes out.
 */
export function CitySelect({ cities }: { cities: CitySummary[] }) {
  const [selected, setSelected] = useState(0);

  return (
    <ul aria-label="Cities" className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {cities.map((city, i) => {
        const active = i === selected;
        return (
          // An odd last card spans the row rather than leaving a hole beside it.
          <li key={city.slug} className="md:[&:last-child:nth-child(odd)]:col-span-2">
            <NavLink
              href={`/food/${city.slug}`}
              onFocus={() => setSelected(i)}
              onMouseEnter={() => setSelected(i)}
              className={`group chamfer-tr relative flex h-full min-h-[clamp(150px,15vw,184px)] outline-none transition-[scale] duration-300 ease-snap active:scale-[0.99] ${
                active ? "z-10 scale-[1.015]" : ""
              } flex-col justify-between gap-5 overflow-hidden bg-panel px-5 pt-3.5 pb-5 text-ink hover:text-ink`}
            >
              {/* The photo layer sits behind the text; its own wrapper keeps MediaFrame's `relative` from taking part in the layout. */}
              <div aria-hidden className="absolute inset-0">
                <MediaFrame
                  photo={city.cover}
                  thumb
                  sizes="(min-width: 768px) 620px, 100vw"
                  className={`h-full bg-[repeating-linear-gradient(135deg,var(--color-panel)_0_10px,var(--color-panel-raised)_10px_11px)] ${
                    active ? "animate-drift" : ""
                  }`}
                  imageClassName={`brightness-[0.55] saturate-[0.85] ${active ? "scale-[1.05]" : ""}`}
                />
                <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--color-bg)_0%,transparent_75%)]" />
                {/* A low accent glow rises from the bar while the card is picked. */}
                <div
                  className={`absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_100%,color-mix(in_oklab,var(--color-accent)_22%,transparent),transparent_70%)] transition-opacity duration-500 ease-snap ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
              </div>
              <div className="relative flex flex-wrap justify-between gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.16em] text-ink-muted">
                <span className={`transition-colors duration-300 ${active ? "text-accent" : ""}`}>{pad3(i + 1)}</span>
                {city.coords && <span>{formatCoords(city.coords)}</span>}
              </div>
              <div className="relative flex flex-col gap-2">
                <span className="font-display text-[clamp(40px,5vw,60px)] leading-[0.85] tracking-[0.03em] break-words text-title">
                  {city.name}
                </span>
                <span className="font-mono text-[11px] tracking-[0.14em] text-ink-dim">
                  {city.count} {city.count === 1 ? "SPOT" : "SPOTS"} · AVG{" "}
                  <span className="text-accent">{city.average.toFixed(1)}</span>
                </span>
              </div>
              {/* The chamfer clips outlines, so keyboard focus draws its frame inside the card. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 hidden border-2 border-accent group-focus-visible:block"
              />
              {/* Wipes in from the left on the pick, and out to the right as the pick moves on. */}
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-border-strong/60">
                <span
                  className={`absolute inset-0 bg-accent transition-transform duration-300 ease-snap ${
                    active ? "origin-left scale-x-100" : "origin-right scale-x-0"
                  }`}
                />
              </span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
