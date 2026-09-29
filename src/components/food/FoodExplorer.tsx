"use client";

import { startTransition, useState, ViewTransition } from "react";

import { PhotoCarousel } from "@/components/ui/PhotoCarousel";
import { MAX_DISHES } from "@/content/food";
import type { Restaurant } from "@/content/types";
import { useArrowCycle } from "@/lib/keys";
import { stagger } from "@/lib/motion";
import { pad2 } from "@/lib/nav";
import { blip } from "@/lib/sound/sound";

const pagerButton = "px-2.5 py-1 hover:text-ink";
const chip = "px-[11px] py-[5px]";

/** Leaderboard, dish carousel and review. `restaurants` arrive already ranked, best first. */
export function FoodExplorer({ restaurants }: { restaurants: Restaurant[] }) {
  const [index, setIndex] = useState(0);
  const [dishIndex, setDishIndex] = useState<number[]>(() => restaurants.map(() => 0));

  const place = restaurants[index];
  const dishes = place.dishes.slice(0, MAX_DISHES);
  const dish = dishes[Math.min(dishIndex[index], dishes.length - 1)];
  const rank = pad2(index + 1);
  const total = pad2(restaurants.length);

  const select = (i: number) => {
    blip("project");
    startTransition(() => setIndex(i));
  };
  const cycle = (step: number) => select((index + step + restaurants.length) % restaurants.length);
  useArrowCycle(cycle);
  const showDish = (i: number) => {
    blip("photo");
    setDishIndex((prev) => prev.map((v, r) => (r === index ? i : v)));
  };

  return (
    <div className="flex flex-wrap items-start justify-center gap-grid">
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-3.5">
        <ol aria-label="Restaurant rankings" className="hairline-group">
          {restaurants.map((r, i) => {
            const active = i === index;
            return (
              <li key={`${r.name}-${r.city}`}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => select(i)}
                  className={`relative flex w-full items-center gap-3 bg-panel-glass px-[15px] py-[13px] text-left transition-colors duration-150 ${
                    active ? "text-bg" : "text-ink"
                  }`}
                >
                  {/* Glides to the new row on pick (see `.marker` in globals.css). */}
                  {active && (
                    <ViewTransition name="food-row" share="marker" default="none">
                      <span aria-hidden className="absolute inset-0 bg-accent" />
                    </ViewTransition>
                  )}
                  <span className={`relative font-mono text-[11px] ${active ? "opacity-70" : i < 3 ? "text-score" : "opacity-70"}`}>
                    #{pad2(i + 1)}
                  </span>
                  <span className="relative min-w-0 truncate font-display text-[24px] leading-none tracking-[0.05em]">
                    {r.name}
                  </span>
                  <span className="relative ml-auto font-mono text-[13px] tracking-[0.06em]">
                    {r.score.toFixed(1)}
                    <span className="sr-only"> out of 10</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="flex items-center justify-center gap-2.5 font-mono text-[11px] tracking-[0.14em] text-ink-muted">
          <button type="button" aria-label="Previous restaurant" onClick={() => cycle(-1)} className={pagerButton}>
            ◂
          </button>
          <span className="text-ink">
            {rank} / {total}
          </span>
          <button type="button" aria-label="Next restaurant" onClick={() => cycle(1)} className={pagerButton}>
            ▸
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
        <PhotoCarousel
          photos={dishes.map((d) => d.photo)}
          fallbacks={dishes.map((d) => d.name)}
          index={dishIndex[index]}
          onChange={showDish}
          label={place.name}
          revealKey={index}
        />
        {dish && (
          <div
            key={`dish-${index}-${dish.name}`}
            className="flex animate-enter flex-wrap items-center justify-center gap-2.5"
          >
            <span className="font-display text-[26px] leading-none tracking-[0.05em]">{dish.name}</span>
            {dish.tag && (
              <span className={`${chip} bg-accent font-mono text-[10px] font-medium tracking-[0.12em] text-bg`}>
                {dish.tag}
              </span>
            )}
          </div>
        )}
      </div>

      {/* The live region persists to announce; only its content remounts per pick. */}
      <section aria-live="polite" aria-label={place.name} className="flex min-w-0 flex-[1_1_300px] flex-col">
        <div key={index} className="flex flex-col gap-3.5">
          <p className="animate-enter font-mono text-[12px] tracking-[0.3em] text-ink">
            RANK #{rank} / {total}
          </p>
          <div className="flex animate-enter items-baseline justify-between gap-3" style={stagger(0.04)}>
            <h2 className="font-display text-trip-name font-normal text-title">{place.name}</h2>
            <span className="font-mono text-[32px] leading-none text-score">
              {place.score.toFixed(1)}
              <span className="sr-only"> out of 10</span>
            </span>
          </div>
          <div aria-hidden className="h-2 bg-chip">
            <div
              className="h-full origin-left animate-fill bg-score"
              style={{ width: `${place.score * 10}%`, ...stagger(0.12) }}
            />
          </div>
          <ul
            className="flex animate-enter flex-wrap gap-1.5 font-mono text-[10px] font-medium tracking-[0.1em]"
            style={stagger(0.08)}
          >
            {[place.city, place.cuisine, place.visited].map((c) => (
              <li key={c} className={`${chip} bg-chip text-ink`}>
                {c}
              </li>
            ))}
          </ul>
          <div className="animate-enter border-l-2 border-accent bg-panel-glass p-5" style={stagger(0.12)}>
            <p className="text-[16px] leading-[1.55] text-pretty text-ink-dim">{place.review}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
