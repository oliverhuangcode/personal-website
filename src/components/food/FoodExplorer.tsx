"use client";

import { startTransition, useEffect, useMemo, useRef, useState, ViewTransition } from "react";

import { PhotoCarousel } from "@/components/ui/PhotoCarousel";
import type { Restaurant } from "@/content/types";
import { byRecent, cuisines, formatVisited, tierFor } from "@/lib/food";
import { useArrowCycle } from "@/lib/keys";
import { stagger } from "@/lib/motion";
import { pad2 } from "@/lib/nav";
import { blip } from "@/lib/sound/sound";

const pagerButton = "px-2.5 py-1 hover:text-ink";
const chip = "px-[11px] py-[5px]";
/** Above this many spots the roster gets a search field. */
const SEARCH_FROM = 15;

type Sort = "RANK" | "RECENT";

/** The active fill glides to a new pick (see `.marker` in globals.css). */
function Highlight({ name }: { name: string }) {
  return (
    <ViewTransition name={name} share="marker" default="none">
      <span aria-hidden className="absolute inset-0 bg-accent" />
    </ViewTransition>
  );
}

function Segment<T extends string>({
  label,
  options,
  value,
  onChange,
  marker,
  disabled = [],
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  marker: string;
  disabled?: readonly T[];
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-px bg-hairline">
      {options.map((option) => {
        const active = option === value;
        const off = disabled.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            disabled={off}
            onClick={() => {
              blip("tab");
              startTransition(() => onChange(option));
            }}
            className={`relative flex-1 bg-panel-raised px-3 py-2.5 text-center transition-colors duration-150 disabled:cursor-not-allowed disabled:text-ink-muted/60 ${
              active ? "text-bg" : "text-ink"
            }`}
          >
            {active && <Highlight name={marker} />}
            <span className="relative">
              {option}
              {off && <span className="ml-1.5 text-[9px] opacity-80">SOON</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * One city's scoreboard, dish carousel and review. `restaurants` arrive ranked, best first;
 * a spot's rank stays its city rank whatever the sort or filter.
 */
export function FoodExplorer({ restaurants }: { restaurants: Restaurant[] }) {
  const [sort, setSort] = useState<Sort>("RANK");
  const [cuisine, setCuisine] = useState<string>();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(restaurants[0]?.slug);
  const [dishIndex, setDishIndex] = useState<Record<string, number>>({});
  const listRef = useRef<HTMLOListElement>(null);

  const rank = useMemo(() => new Map(restaurants.map((r, i) => [r.slug, i + 1])), [restaurants]);
  const kinds = useMemo(() => cuisines(restaurants), [restaurants]);

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    const list = sort === "RANK" ? restaurants : byRecent(restaurants);
    return list.filter(
      (r) =>
        (!cuisine || r.cuisine === cuisine) &&
        (!q || [r.name, r.cuisine, r.area ?? ""].some((field) => field.includes(q))),
    );
  }, [restaurants, sort, cuisine, query]);

  // A filter can hide the pick; fall back to the top visible spot rather than showing nothing.
  const place = visible.find((r) => r.slug === selected) ?? visible[0];
  const position = place ? visible.indexOf(place) : -1;

  // Deep links from the global top 10 land on their spot: /food/<city>?r=<slug>.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("r");
    if (slug && rank.has(slug)) startTransition(() => setSelected(slug));
  }, [rank]);

  // Keep the pick in view inside the scrolling roster without scrolling the page.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!list || !row) return;
    const l = list.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    if (r.top < l.top) list.scrollTop -= l.top - r.top;
    else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom;
  }, [place?.slug]);

  const select = (slug: string) => {
    blip("project");
    startTransition(() => setSelected(slug));
  };
  // Steps from the latest pick, not this render's: presses during a transition all count.
  const cycle = (step: number) => {
    const n = visible.length;
    if (!n) return;
    blip("project");
    startTransition(() =>
      setSelected((prev) => {
        const at = Math.max(0, visible.findIndex((r) => r.slug === prev));
        return visible[(at + step + n) % n].slug;
      }),
    );
  };
  useArrowCycle(cycle);

  const dishes = place?.dishes ?? [];
  const current = place ? Math.min(dishIndex[place.slug] ?? 0, Math.max(dishes.length - 1, 0)) : 0;
  const dish = dishes[current];
  const showDish = (i: number) => {
    if (!place) return;
    blip("photo");
    setDishIndex((prev) => ({ ...prev, [place.slug]: i }));
  };
  const placeRank = place ? pad2(rank.get(place.slug)!) : "";

  return (
    <div className="flex flex-wrap items-start justify-center gap-grid">
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5">
        <div className="flex gap-2 font-mono text-[11px] font-medium tracking-[0.12em]">
          <div className="flex-[2]">
            <Segment label="Sort" options={["RANK", "RECENT"] as const} value={sort} onChange={setSort} marker="food-sort" />
          </div>
          <div className="flex-[2]">
            <Segment
              label="View"
              options={["LIST", "MAP"] as const}
              value="LIST"
              onChange={() => {}}
              marker="food-view"
              disabled={["MAP"]}
            />
          </div>
        </div>

        {restaurants.length > SEARCH_FROM && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SEARCH NAME, CUISINE, AREA"
            aria-label="Search restaurants"
            className="bg-panel-raised px-3 py-2.5 font-mono text-[11px] tracking-[0.12em] text-ink uppercase outline-none placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
        )}

        {kinds.length > 1 && (
          <div
            role="group"
            aria-label="Cuisine"
            className="flex flex-wrap gap-1.5 font-mono text-[10px] font-medium tracking-[0.1em]"
          >
            {[undefined, ...kinds].map((k) => {
              const active = k === cuisine;
              return (
                <button
                  key={k ?? "ALL"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    blip("tab");
                    startTransition(() => setCuisine(k));
                  }}
                  className={`${chip} transition-colors duration-150 ${active ? "bg-accent text-bg" : "bg-chip text-ink hover:bg-border"}`}
                >
                  {k ?? "ALL"}
                </button>
              );
            })}
          </div>
        )}

        <ol
          ref={listRef}
          aria-label="Restaurant rankings"
          className="hairline-group max-h-[min(58dvh,520px)] overflow-y-auto overscroll-contain [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin]"
        >
          {visible.map((r) => {
            const active = r.slug === place?.slug;
            const n = rank.get(r.slug)!;
            return (
              <li key={r.slug}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => select(r.slug)}
                  className={`relative flex w-full items-center gap-3 bg-panel-glass px-[15px] py-[12px] text-left transition-colors duration-150 ${
                    active ? "text-bg" : "text-ink"
                  }`}
                >
                  {active && <Highlight name="food-row" />}
                  <span className={`relative font-mono text-[11px] ${!active && n <= 3 ? "text-score" : "opacity-70"}`}>
                    #{pad2(n)}
                  </span>
                  <span className="relative min-w-0 font-display text-[23px] leading-[1.05] tracking-[0.05em] break-words">
                    {r.name}
                  </span>
                  <span className="relative ml-auto flex shrink-0 items-baseline gap-3 font-mono">
                    <span className="hidden text-[9px] tracking-[0.14em] opacity-70 min-[380px]:inline">
                      {tierFor(r.score)}
                    </span>
                    <span className="w-[30px] text-right text-[13px] tracking-[0.04em]">
                      {r.score.toFixed(1)}
                      <span className="sr-only"> out of 10</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {!visible.length && (
            <li className="bg-panel-glass px-[15px] py-4 font-mono text-[11px] tracking-[0.14em] text-ink-muted">
              NO MATCHES
            </li>
          )}
        </ol>

        <div className="flex items-center justify-center gap-2.5 font-mono text-[11px] tracking-[0.14em] text-ink-muted">
          <button type="button" aria-label="Previous restaurant" onClick={() => cycle(-1)} className={pagerButton}>
            ◂
          </button>
          <span className="text-ink">
            {pad2(position + 1)} / {pad2(visible.length)}
          </span>
          <button type="button" aria-label="Next restaurant" onClick={() => cycle(1)} className={pagerButton}>
            ▸
          </button>
        </div>
      </div>

      {/* Below three columns, the review sits right under the roster and the dishes follow. */}
      {place && (
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 max-[1023px]:order-last">
          <PhotoCarousel
            photos={dishes.map((d) => d.photo)}
            fallbacks={dishes.map((d) => d.name)}
            index={current}
            onChange={showDish}
            label={place.name}
            revealKey={place.slug}
          />
          {dish && (
            <div
              key={`dish-${place.slug}-${current}`}
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
      )}

      {/* The live region persists to announce; only its content remounts per pick. */}
      <section aria-live="polite" aria-label={place?.name ?? "No restaurant"} className="flex min-w-0 flex-[1_1_300px] flex-col">
        {place && (
          <div key={place.slug} className="flex flex-col gap-3.5">
            <p className="flex animate-enter justify-between gap-3 font-mono text-[12px] tracking-[0.3em] text-ink">
              <span>
                RANK #{placeRank} / {pad2(restaurants.length)}
              </span>
              <span className="text-[11px] tracking-[0.2em] text-score">{tierFor(place.score)}</span>
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
              {[place.area, place.cuisine, place.price, place.visited && formatVisited(place.visited)]
                .filter(Boolean)
                .map((c) => (
                  <li key={c} className={`${chip} bg-chip text-ink`}>
                    {c}
                  </li>
                ))}
            </ul>
            {place.review && (
              <div className="animate-enter border-l-2 border-accent bg-panel-glass p-5" style={stagger(0.12)}>
                <p className="text-[16px] leading-[1.55] text-pretty text-ink-dim">{place.review}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
