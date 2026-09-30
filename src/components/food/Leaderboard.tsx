"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { Dropdown } from "@/components/ui/Dropdown";
import { NavLink } from "@/components/ui/NavLink";
import type { Restaurant } from "@/content/types";
import { cuisines } from "@/lib/food";
import { stagger } from "@/lib/motion";
import { blip } from "@/lib/sound/sound";

/** Rows per page; SHOW MORE adds another page. */
const PAGE = 10;

const label = "font-mono text-[11px] tracking-[0.22em] text-ink-muted";
const press = "transition-[color,background-color,scale] duration-150 ease-snap active:scale-[0.97]";
/** Shared by the column header and every row so the columns line up. */
const row =
  "grid grid-cols-[52px_52px_minmax(0,1fr)] items-center gap-x-3 pr-4 sm:grid-cols-[88px_72px_minmax(0,1fr)_minmax(90px,160px)] sm:gap-x-4 sm:pr-6";

export interface CityOption {
  slug: string;
  name: string;
  count: number;
}

/** The #1 marker: a four-point spark, drawn to sit beside the rank numeral. */
function Star() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="size-3 text-accent transition-colors duration-[360ms] group-hover:text-bg group-focus-visible:text-bg"
    >
      <path d="M6 0 7.4 4.6 12 6 7.4 7.4 6 12 4.6 7.4 0 6 4.6 4.6Z" fill="currentColor" />
    </svg>
  );
}

function countBy(list: readonly Restaurant[], key: (r: Restaurant) => string) {
  const counts = new Map<string, number>();
  for (const r of list) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);
  return counts;
}

/**
 * Every spot, ranked. Rank is the position in the current view, so filtering to a city
 * reads as that city's board and its #1 gets the crown. City and cuisine live in the URL
 * (?city=<slug>&cuisine=<CUISINE>), so a filtered board can be shared.
 */
export function Leaderboard({ restaurants, cities }: { restaurants: Restaurant[]; cities: CityOption[] }) {
  const [city, setCity] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [limit, setLimit] = useState(PAGE);
  // Rows from this index on animate in: everything on first paint, then only SHOW MORE arrivals.
  const [revealFrom, setRevealFrom] = useState(0);

  // The cuisine control shows whenever the whole log has a choice, so scoping to a city never moves the row.
  const hasCuisines = useMemo(() => cuisines(restaurants).length > 1, [restaurants]);
  const inCity = useMemo(() => restaurants.filter((r) => !city || r.citySlug === city), [restaurants, city]);
  const kinds = useMemo(() => cuisines(inCity), [inCity]);
  const kindCounts = useMemo(() => countBy(inCity, (r) => r.cuisine), [inCity]);
  const visible = useMemo(() => inCity.filter((r) => !cuisine || r.cuisine === cuisine), [inCity, cuisine]);
  const shown = visible.slice(0, limit);
  const scope = cities.find((c) => c.slug === city);

  // Restore a shared view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("city") ?? "";
    const k = params.get("cuisine") ?? "";
    const known = cities.some((x) => x.slug === c);
    startTransition(() => {
      if (known) setCity(c);
      if (k && restaurants.some((r) => r.cuisine === k && (!known || r.citySlug === c))) setCuisine(k);
    });
  }, [cities, restaurants]);

  // Mirror the view into the URL without adding history entries.
  useEffect(() => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (cuisine) params.set("cuisine", cuisine);
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [city, cuisine]);

  const refilter = (apply: () => void) => {
    setLimit(PAGE);
    setRevealFrom(Infinity);
    startTransition(apply);
  };
  const pickCity = (next: string) =>
    refilter(() => {
      setCity(next);
      // A cuisine the new city doesn't have would leave the board empty; drop it instead.
      if (cuisine && !restaurants.some((r) => r.cuisine === cuisine && (!next || r.citySlug === next))) setCuisine("");
    });
  const clearFilters = () => {
    blip("tab");
    refilter(() => {
      setCity("");
      setCuisine("");
    });
  };

  return (
    <section aria-labelledby="board-title" className="flex flex-col gap-2.5">
      {(cities.length > 1 || hasCuisines) && (
        <div className="flex flex-wrap gap-2 font-mono text-[11px] font-medium tracking-[0.12em]">
          {cities.length > 1 && (
            <Dropdown
              label="CITY"
              value={city}
              options={[
                { value: "", label: "ALL", count: restaurants.length },
                ...cities.map((c) => ({ value: c.slug, label: c.name, count: c.count })),
              ]}
              onChange={pickCity}
              className="min-w-[220px] flex-1"
            />
          )}
          {hasCuisines && (
            <Dropdown
              label="CUISINE"
              value={cuisine}
              options={[
                { value: "", label: "ALL", count: inCity.length },
                ...kinds.map((k) => ({ value: k, label: k, count: kindCounts.get(k) })),
              ]}
              onChange={(next) => refilter(() => setCuisine(next))}
              className="min-w-[220px] flex-1"
            />
          )}
        </div>
      )}

      <div className="flex flex-col gap-px">
        {/* Title plate, lit like the HOME tab: the one bright surface on the page. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-px">
          <h2
            id="board-title"
            className="bg-title px-4 py-3 text-center font-display text-[clamp(30px,4vw,44px)] leading-none font-normal tracking-[0.04em] break-words text-bg"
          >
            {scope ? scope.name : "ALL"}
          </h2>
          <p className="flex flex-col justify-center bg-panel-raised px-4 text-right font-mono text-[11px] tracking-[0.16em] text-ink-muted sm:px-6">
            <span>{cuisine || "ALL CUISINES"}</span>
            <span className="text-ink">
              {visible.length} {visible.length === 1 ? "SPOT" : "SPOTS"}
            </span>
          </p>
        </div>

        <div aria-hidden className={`${row} ${label} bg-panel py-2`}>
          <span className="text-center">RANK</span>
          <span className="text-center">SCORE</span>
          <span>SPOT</span>
          <span className="hidden text-right sm:block">CITY</span>
        </div>

        {/* Keyed on the filter so a new view fades in as a whole. */}
        <ol key={`${city}|${cuisine}`} aria-label="Restaurant rankings" className="hairline-group animate-swap">
          {shown.map((r, i) => {
            const first = i === 0;
            const arriving = i >= revealFrom;
            return (
              <li
                key={`${r.citySlug}/${r.slug}`}
                className={arriving ? "animate-enter" : undefined}
                style={arriving ? stagger(Math.min(0.1 + (i - revealFrom) * 0.03, 0.4)) : undefined}
              >
                <NavLink
                  href={`/food/${r.citySlug}?r=${r.slug}`}
                  className={`group sweep ${row} [--sweep-duration:0.6s] [--sweep-ease:cubic-bezier(0.33,1,0.68,1)] bg-panel-glass text-ink ${first ? "py-4" : "py-2"}`}
                >
                  <span className="flex items-center justify-center gap-1.5 self-stretch border-r border-hairline transition-colors duration-[360ms] group-hover:border-bg/20">
                    <span className={`font-display leading-none ${first ? "text-[44px] sm:text-[56px]" : "text-[26px] sm:text-[30px]"}`}>
                      <span className="sr-only">Rank </span>
                      {i + 1}
                    </span>
                    {first && <Star />}
                  </span>
                  <span
                    className={`text-center font-mono transition-colors duration-[360ms] ${first ? "text-[20px] sm:text-[24px]" : "text-[15px] sm:text-[17px]"} ${i < 3 ? "text-accent" : ""} group-hover:text-bg group-focus-visible:text-bg`}
                  >
                    {r.score.toFixed(1)}
                    <span className="sr-only"> out of 10</span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className={`font-display leading-[1.05] tracking-[0.05em] break-words ${first ? "text-[30px] sm:text-[36px]" : "text-[22px]"}`}>
                      {r.name}
                    </span>
                    {/* Narrow screens drop the city column, so the city takes the price's place in the subtitle. */}
                    <span className="font-mono text-[11px] tracking-[0.14em] opacity-70">
                      <span className="sm:hidden">{[r.city, r.cuisine].filter(Boolean).join(" · ")}</span>
                      <span className="hidden sm:inline">{[r.cuisine, r.price].filter(Boolean).join(" · ")}</span>
                    </span>
                  </span>
                  <span className="hidden text-right font-mono text-[12px] tracking-[0.14em] break-words sm:block">
                    {r.city}
                  </span>
                </NavLink>
              </li>
            );
          })}

          {visible.length > shown.length && (
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
              {restaurants.length ? "NO MATCHES" : "NO SPOTS LOGGED YET"}
              {restaurants.length > 0 && (
                <button type="button" onClick={clearFilters} className={`px-2 py-1 text-accent hover:text-accent-hover ${press}`}>
                  CLEAR FILTERS
                </button>
              )}
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}
