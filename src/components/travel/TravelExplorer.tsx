"use client";

import { useMemo, useState } from "react";

import { MAX_TRIP_PHOTOS } from "@/content/trips";
import type { Trip } from "@/content/types";
import { pad2, pad3 } from "@/lib/nav";
import { blip } from "@/lib/sound/sound";

import { Globe } from "./Globe";
import { PhotoCarousel } from "./PhotoCarousel";

const pagerButton = "px-2.5 py-1 hover:text-ink";
const stagger = (s: number) => ({ animationDelay: `${s}s` });

export function TravelExplorer({ trips }: { trips: Trip[] }) {
  // `seq` re-triggers the globe flight even when re-selecting the current trip after a drag.
  const [selection, setSelection] = useState({ index: 0, seq: 0 });
  const [photoIndex, setPhotoIndex] = useState<number[]>(() => trips.map(() => 0));

  const destinations = useMemo(
    () => trips.map((t) => ({ lon: t.lon, lat: t.lat, label: t.name, visited: t.status === "VISITED" })),
    [trips],
  );

  const index = selection.index;
  const trip = trips[index];
  const photos = trip.photos.slice(0, MAX_TRIP_PHOTOS);

  const select = (i: number) => {
    blip("destination");
    setSelection((s) => ({ index: i, seq: s.seq + 1 }));
  };
  const cycle = (step: number) => select((index + step + trips.length) % trips.length);
  const showPhoto = (i: number) => {
    blip("photo");
    setPhotoIndex((prev) => prev.map((v, t) => (t === index ? i : v)));
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-grid">
      <ul aria-label="Destinations" className="hairline-group min-w-0 flex-[1_1_240px]">
        {trips.map((t, i) => {
          const active = i === index;
          return (
            <li key={t.name}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => select(i)}
                className={`flex w-full items-center gap-3 px-[15px] py-[13px] text-left transition-colors duration-150 ${
                  active ? "bg-accent text-bg" : "bg-panel-glass text-ink"
                }`}
              >
                <span className="font-mono text-[11px] opacity-70">{pad3(i + 1)}</span>
                <span className="font-display text-[24px] leading-none tracking-[0.05em]">{t.name}</span>
                <span className="ml-auto font-mono text-[10px] tracking-[0.12em] opacity-70">{t.status}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex min-w-0 flex-[0_1_300px] flex-col items-center gap-3.5">
        <Globe
          target={trip}
          flyKey={selection.seq}
          label={trip.name}
          index={index}
          onMarkerClick={() => select(index)}
          destinations={destinations}
          onSelect={select}
        />
        <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.14em] text-ink-muted">
          <button type="button" aria-label="Previous destination" onClick={() => cycle(-1)} className={pagerButton}>
            ◂
          </button>
          <span className="text-ink">
            {pad2(index + 1)} / {pad2(trips.length)} · {trip.name}
          </span>
          <button type="button" aria-label="Next destination" onClick={() => cycle(1)} className={pagerButton}>
            ▸
          </button>
        </div>
      </div>

      <section aria-live="polite" aria-label={trip.name} className="flex min-w-0 flex-[1_1_260px] flex-col gap-3.5">
        <PhotoCarousel
          photos={photos}
          index={photoIndex[index]}
          onChange={showPhoto}
          label={trip.name}
          revealKey={index}
        />
        {/* Keyed on the trip, not the section: the live region must persist to announce. */}
        <div
          key={`title-${index}`}
          className="flex animate-enter items-baseline justify-between gap-3"
          style={stagger(0.04)}
        >
          <h2 className="font-display text-trip-name font-normal text-title">{trip.name}</h2>
          <span className="font-mono text-[11px] tracking-[0.14em] text-ink-muted">
            {pad3(index + 1)} · {trip.status}
          </span>
        </div>
        <ul
          key={`cities-${index}`}
          className="flex animate-enter flex-wrap gap-1.5 font-mono text-[10px] font-medium tracking-[0.1em]"
          style={stagger(0.08)}
        >
          {trip.cities.map((city) => (
            <li
              key={city}
              className={`px-[11px] py-[5px] ${trip.status === "VISITED" ? "bg-accent text-bg" : "bg-chip text-ink"}`}
            >
              {city}
            </li>
          ))}
        </ul>
        <p
          key={`note-${index}`}
          className="animate-enter text-[16px] leading-[1.55] text-pretty text-ink-dim"
          style={stagger(0.12)}
        >
          {trip.note}
        </p>
      </section>
    </div>
  );
}
