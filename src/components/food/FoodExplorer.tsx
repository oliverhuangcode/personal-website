"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { Dropdown } from "@/components/ui/Dropdown";
import { Glide } from "@/components/ui/Glide";
import { PhotoCarousel } from "@/components/ui/PhotoCarousel";
import type { Restaurant } from "@/content/types";
import { cuisines, formatVisited, meterPercent } from "@/lib/food";
import { useArrowCycle } from "@/lib/keys";
import { stagger } from "@/lib/motion";
import { pad2 } from "@/lib/nav";
import { blip } from "@/lib/sound/sound";

/** Small presses give way slightly, so a tap reads as landed. */
const press = "transition-[color,background-color,scale] duration-150 ease-snap active:scale-[0.97]";
const pagerButton = `min-h-9 min-w-9 px-2.5 py-1.5 hover:text-ink ${press}`;
const chip = "px-[11px] py-[5px]";
const label = "font-mono text-[11px] tracking-[0.22em] text-ink-muted";
/** Above this many spots the roster gets a search field. */
const SEARCH_FROM = 15;
/** Rows rendered at once; the rest load in steps of this size. Search and filters cover every spot. */
const PAGE = 25;
/** Below this width the columns stack, so a picked spot's review sits under the list. */
const STACKED = "(max-width: 1023px)";

/**
 * Score bar starting at 5 (see `meterPercent`). It stays mounted across picks, so after
 * its first fill it travels from one score to the next.
 */
function Meter({ score }: { score: number }) {
  return (
    <div aria-hidden className="h-2 bg-chip">
      <div
        className="h-full origin-left animate-meter bg-accent transition-[width] duration-[1400ms] ease-[cubic-bezier(0.33,1,0.68,1)]"
        style={{ width: `${meterPercent(score)}%`, ...stagger(0.12) }}
      />
    </div>
  );
}

function readParams() {
  const params = new URLSearchParams(window.location.search);
  return { r: params.get("r") ?? "", cuisine: params.get("cuisine") ?? "", q: params.get("q") ?? "" };
}

/**
 * One city's scoreboard, dishes and review. `restaurants` arrive ranked, best first;
 * a spot's rank stays its city rank whatever the filter. The filter, search and pick
 * live in the URL, so a view can be shared and survives Back.
 */
export function FoodExplorer({ restaurants }: { restaurants: Restaurant[] }) {
  const [cuisine, setCuisine] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  // Rows from this index on arrived with the last SHOW MORE, so only they animate in.
  const [revealFrom, setRevealFrom] = useState(Infinity);
  const resetPaging = () => {
    setLimit(PAGE);
    setRevealFrom(Infinity);
  };
  const [selected, setSelected] = useState(restaurants[0]?.slug);
  const [dishIndex, setDishIndex] = useState<Record<string, number>>({});
  const listRef = useRef<HTMLOListElement>(null);
  const reviewRef = useRef<HTMLElement>(null);
  const revealReview = useRef(false);

  const rank = useMemo(() => new Map(restaurants.map((r, i) => [r.slug, i + 1])), [restaurants]);
  const kinds = useMemo(() => cuisines(restaurants), [restaurants]);
  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of restaurants) counts.set(r.cuisine, (counts.get(r.cuisine) ?? 0) + 1);
    return counts;
  }, [restaurants]);

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    // "12" or "#12" jumps straight to that rank.
    const asRank = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : undefined;
    return restaurants.filter(
      (r) =>
        (!cuisine || r.cuisine === cuisine) &&
        (!q || rank.get(r.slug) === asRank || [r.name, r.cuisine, r.area ?? ""].some((field) => field.includes(q))),
    );
  }, [restaurants, cuisine, query, rank]);

  // A filter can hide the pick; fall back to the top visible spot rather than showing nothing.
  const place = visible.find((r) => r.slug === selected) ?? visible[0];
  const position = place ? visible.indexOf(place) : -1;
  // Stepping or deep-linking past the loaded rows loads down to the pick.
  const shown = visible.slice(0, Math.max(limit, position + 1));
  const filtered = Boolean(cuisine || query);

  // Restore a shared view: /food/<city>?r=<slug>&cuisine=<CUISINE>&q=<text>.
  useEffect(() => {
    const { r, cuisine: c, q } = readParams();
    startTransition(() => {
      if (r && rank.has(r)) setSelected(r);
      if (c && kinds.includes(c)) setCuisine(c);
      if (q) setQuery(q);
    });
  }, [rank, kinds]);

  // Mirror the view into the URL without adding history entries.
  useEffect(() => {
    const params = new URLSearchParams();
    if (place && place.slug !== visible[0]?.slug) params.set("r", place.slug);
    if (cuisine) params.set("cuisine", cuisine);
    if (query) params.set("q", query);
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [place, visible, cuisine, query]);

  // Keep the pick in view inside the scrolling roster (wide screens) without scrolling the page.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !row || list.scrollHeight <= list.clientHeight) return;
    const l = list.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    if (r.top < l.top) list.scrollTop -= l.top - r.top;
    else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom;
  }, [place?.slug]);

  // Stacked, the review is below the list: bring it up so a tap visibly did something. This waits
  // for the pick to render, because a scroll started mid view-transition gets cut short.
  useEffect(() => {
    if (!revealReview.current) return;
    revealReview.current = false;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() =>
      reviewRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [place?.slug]);

  const select = (slug: string) => {
    blip("project");
    revealReview.current = window.matchMedia(STACKED).matches;
    startTransition(() => setSelected(slug));
  };
  // Steps from the latest pick, not this render's: presses during a transition all count.
  const cycle = (step: number) => {
    const n = visible.length;
    if (n < 2) return;
    blip("project");
    startTransition(() =>
      setSelected((prev) => {
        const at = Math.max(0, visible.findIndex((r) => r.slug === prev));
        return visible[(at + step + n) % n].slug;
      }),
    );
  };
  useArrowCycle(cycle);

  const clearFilters = () => {
    blip("tab");
    resetPaging();
    startTransition(() => {
      setCuisine("");
      setQuery("");
    });
  };

  const dishes = place?.dishes ?? [];
  const pictured = dishes.filter((d) => d.photo);
  const current = place ? Math.min(dishIndex[place.slug] ?? 0, Math.max(pictured.length - 1, 0)) : 0;
  const showPhoto = (i: number) => {
    if (!place) return;
    blip("photo");
    setDishIndex((prev) => ({ ...prev, [place.slug]: i }));
  };
  const placeRank = place ? rank.get(place.slug)! : 0;

  return (
    <div className="flex flex-wrap items-start justify-center gap-grid">
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5">
        <div className="flex flex-wrap items-stretch gap-2 font-mono text-[11px] font-medium tracking-[0.12em]">
          {kinds.length > 1 && (
            <Dropdown
              label="CUISINE"
              value={cuisine}
              options={[
                { value: "", label: "ALL", count: restaurants.length },
                ...kinds.map((k) => ({ value: k, label: k, count: kindCounts.get(k) })),
              ]}
              onChange={(next) => {
                resetPaging();
                startTransition(() => setCuisine(next));
              }}
              className="min-w-[200px] flex-1"
            />
          )}
          {/* Not a control yet: a status tag until the map exists. */}
          <span className="ml-auto flex items-center border border-border px-3 py-2.5 text-ink-muted">MAP · SOON</span>
        </div>

        {restaurants.length > SEARCH_FROM && (
          <input
            type="search"
            value={query}
            onChange={(e) => {
              resetPaging();
              setQuery(e.target.value);
            }}
            placeholder="SEARCH NAME, CUISINE, AREA OR #RANK"
            aria-label="Search restaurants by name, cuisine, area or rank"
            className="bg-panel-raised px-3 py-2.5 font-mono text-[11px] tracking-[0.12em] text-ink uppercase outline-none placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
        )}

        {/* Keyed on the cuisine so a new filter fades its list in; typing in search doesn't. */}
        <ol
          key={cuisine || "all"}
          ref={listRef}
          data-glide-root
          aria-label="Restaurant rankings"
          className="hairline-group isolate animate-swap lg:max-h-[min(58dvh,520px)] lg:overflow-y-auto lg:overscroll-contain [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin]"
        >
          {shown.map((r, i) => {
            const active = r.slug === place?.slug;
            const n = rank.get(r.slug)!;
            const arriving = i >= revealFrom;
            return (
              <li
                key={r.slug}
                className={arriving ? "animate-enter" : undefined}
                style={arriving ? stagger(Math.min((i - revealFrom) * 0.03, 0.24)) : undefined}
              >
                <button
                  type="button"
                  aria-current={active}
                  onClick={() => select(r.slug)}
                  className={`relative flex w-full items-center gap-3 bg-panel-glass px-[15px] py-[12px] text-left transition-colors duration-150 ${
                    active ? "text-bg" : "text-ink hover:bg-panel-raised"
                  }`}
                >
                  {active && <Glide id="food-row" className="inset-0 z-10 bg-accent" />}
                  <span className={`relative z-20 font-mono text-[11px] ${!active && n <= 3 ? "text-accent" : "opacity-75"}`}>
                    #{pad2(n)}
                  </span>
                  <span className="relative z-20 min-w-0 font-display text-[23px] leading-[1.05] tracking-[0.05em] break-words">
                    {r.name}
                  </span>
                  <span className="relative z-20 ml-auto w-[30px] shrink-0 text-right font-mono text-[13px] tracking-[0.04em]">
                    {r.score.toFixed(1)}
                    <span className="sr-only"> out of 10</span>
                  </span>
                </button>
              </li>
            );
          })}
          {shown.length < visible.length && (
            <li>
              <button
                type="button"
                onClick={() => {
                  blip("tab");
                  setRevealFrom(shown.length);
                  setLimit(shown.length + PAGE);
                }}
                className="sweep w-full bg-panel-glass px-[15px] py-3 text-left font-mono text-[11px] tracking-[0.14em] text-ink-muted"
              >
                SHOW {Math.min(PAGE, visible.length - shown.length)} MORE · {visible.length - shown.length} LEFT
              </button>
            </li>
          )}
          {!visible.length && (
            <li className="flex items-center justify-between gap-3 bg-panel-glass px-[15px] py-3 font-mono text-[11px] tracking-[0.14em] text-ink-muted">
              NO MATCHES
              <button type="button" onClick={clearFilters} className={`px-2 py-1 text-accent hover:text-accent-hover ${press}`}>
                CLEAR FILTERS
              </button>
            </li>
          )}
        </ol>

        {visible.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-ink-muted">
            <button type="button" aria-label="Previous restaurant" onClick={() => cycle(-1)} className={pagerButton}>
              ◂
            </button>
            <span className="text-ink">
              {pad2(position + 1)} / {pad2(visible.length)}
              {filtered && <span className="text-ink-muted"> SHOWN</span>}
            </span>
            <button type="button" aria-label="Next restaurant" onClick={() => cycle(1)} className={pagerButton}>
              ▸
            </button>
          </div>
        )}
      </div>

      {/* One short announcement per pick, rather than the whole review read out again. */}
      <p aria-live="polite" className="sr-only">
        {place ? `Rank ${placeRank}: ${place.name}, ${place.score.toFixed(1)} out of 10` : "No matches"}
      </p>

      <section
        ref={reviewRef}
        aria-label={place ? `${place.name} review` : "Review"}
        className="flex min-w-0 flex-[1_1_300px] scroll-mt-[72px] flex-col gap-3.5 lg:order-last"
      >
        {place && (
          <>
            {/* No entrance and not keyed by pick: the text swaps in place rather than blanking
                and fading back in, on a pick and on arriving at the page. */}
            <div className="flex flex-col gap-3.5">
              <p className="font-mono text-[12px] tracking-[0.3em] text-ink">
                RANK #{pad2(placeRank)} / {pad2(restaurants.length)}
              </p>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-trip-name font-normal text-title">{place.name}</h2>
                <span className="font-mono text-[32px] leading-none text-accent">
                  {place.score.toFixed(1)}
                  <span className="sr-only"> out of 10</span>
                </span>
              </div>
            </div>
            <Meter score={place.score} />
            <div className="flex flex-col gap-3.5">
              <ul className="flex flex-wrap gap-1.5 font-mono text-[11px] font-medium tracking-[0.1em]">
                {[place.area, place.cuisine, place.price, place.visited && formatVisited(place.visited)]
                  .filter(Boolean)
                  .map((c) => (
                    <li key={c} className={`${chip} bg-chip text-ink`}>
                      {c}
                    </li>
                  ))}
              </ul>
              {place.review && (
                <div className="border-l-2 border-accent bg-panel-glass p-5">
                  <p className="text-[16px] leading-[1.55] text-pretty text-ink-dim">{place.review}</p>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* In three columns the dishes sit in the middle, as the globe does on Travel; stacked, they follow
          the review. Photos get the carousel; every dish gets a line. */}
      {place && dishes.length > 0 && (
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 max-[1023px]:order-last">
          {pictured.length > 0 && (
            <PhotoCarousel
              photos={pictured.map((d) => d.photo)}
              index={current}
              onChange={showPhoto}
              label={place.name}
              revealKey={place.slug}
            />
          )}
          <h3 className={label}>{dishes.length === 1 ? "DISH" : "DISHES"}</h3>
          <ul className="hairline-group">
            {dishes.map((d, i) => {
              const photoAt = pictured.indexOf(d);
              const showing = photoAt !== -1 && photoAt === current;
              const body = (
                <>
                  <span
                    className={`min-w-0 font-display text-[22px] leading-[1.05] tracking-[0.05em] break-words ${
                      showing ? "text-accent" : "text-ink"
                    }`}
                  >
                    {d.name}
                  </span>
                  {d.tag && (
                    <span className="ml-auto shrink-0 border border-accent/70 px-2 py-[3px] font-mono text-[11px] tracking-[0.12em] text-accent">
                      {d.tag}
                    </span>
                  )}
                </>
              );
              const row = "flex w-full items-center gap-3 bg-panel-glass px-[15px] py-3 text-left";
              return (
                <li key={i}>
                  {photoAt === -1 ? (
                    <div className={row}>{body}</div>
                  ) : (
                    <button
                      type="button"
                      aria-current={showing}
                      aria-label={`Show photo: ${d.name}`}
                      onClick={() => showPhoto(photoAt)}
                      className={`${row} transition-colors duration-150 hover:bg-panel-raised`}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
