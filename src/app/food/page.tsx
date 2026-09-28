import type { Metadata } from "next";

import { MediaFrame } from "@/components/ui/MediaFrame";
import { dishes } from "@/content/food";
import { stagger } from "@/lib/motion";

export const metadata: Metadata = { title: "Food" };

export default function FoodPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-[22px] px-gutter py-section">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-page-title font-normal text-title">FOOD</h1>
        <p className="font-mono text-[12px] tracking-[0.2em] text-ink-muted">EATEN AND RATED OUT OF 10</p>
      </header>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,310px),1fr))] gap-3">
        {dishes.map((dish, i) => (
          <li
            key={`${dish.name}-${dish.city}`}
            style={stagger(i * 0.05)}
            className="group chamfer-tr flex animate-enter flex-col bg-panel-glass"
          >
            <MediaFrame
              photo={dish.photo}
              sizes="(min-width: 1280px) 420px, 100vw"
              className="aspect-[16/10]"
              zoom
            />
            <div className="flex flex-col gap-3 p-[18px]">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[32px] leading-none font-normal tracking-[0.04em]">{dish.name}</h2>
                <span className="font-mono text-[20px] text-score">
                  {dish.score.toFixed(1)}
                  <span className="sr-only"> out of 10</span>
                </span>
              </div>
              <div aria-hidden className="h-2 bg-chip">
                {/* Meters fill just after their card lands, staggered down the grid, so the scores read as data. */}
                <div
                  className="h-full origin-left animate-fill bg-score"
                  style={{ width: `${dish.score * 10}%`, ...stagger(0.15 + i * 0.05) }}
                />
              </div>
              <p className="font-mono text-[11px] tracking-[0.12em] text-ink-muted">
                {dish.city} · {dish.type}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
