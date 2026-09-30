import type { Metadata } from "next";

import { CitySelect } from "@/components/food/CitySelect";
import { NavLink } from "@/components/ui/NavLink";
import { restaurants } from "@/content/food";
import { averageScore, cuisines, groupByCity, rankRestaurants, tierFor } from "@/lib/food";
import { stagger } from "@/lib/motion";
import { pad2 } from "@/lib/nav";

export const metadata: Metadata = { title: "Food" };

const cities = groupByCity(restaurants);
const top = rankRestaurants(restaurants).slice(0, 10);
const stats: [label: string, value: string][] = [
  ["SPOTS", String(restaurants.length)],
  ["CITIES", String(cities.length)],
  ["CUISINES", String(cuisines(restaurants).length)],
  ["AVG", averageScore(restaurants).toFixed(1)],
];

const sectionLabel = "font-mono text-[11px] tracking-[0.22em] text-ink-muted";

export default function FoodPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-gutter py-section">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-page-title font-normal text-title">FOOD</h1>
        <p className="font-mono text-[12px] tracking-[0.2em] text-ink-muted">SELECT A CITY · ◂ ▸ TO BROWSE</p>
      </header>

      <dl className="grid grid-cols-2 gap-px bg-hairline font-mono sm:grid-cols-4">
        {stats.map(([label, value], i) => (
          <div
            key={label}
            style={stagger(i * 0.03)}
            className="flex animate-enter items-baseline justify-between gap-3 bg-panel-glass px-4 py-3"
          >
            <dt className="text-[11px] tracking-[0.18em] text-ink-muted">{label}</dt>
            <dd className={`text-[20px] ${label === "AVG" ? "text-score" : "text-ink"}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <CitySelect cities={cities} />

      <section aria-labelledby="global-top" className="flex flex-col gap-2.5">
        <h2 id="global-top" className={sectionLabel}>
          GLOBAL TOP {top.length}
        </h2>
        <ol className="hairline-group">
          {top.map((r, i) => (
            <li key={`${r.citySlug}/${r.slug}`} style={stagger(0.2 + i * 0.03)} className="animate-enter">
              <NavLink
                href={`/food/${r.citySlug}?r=${r.slug}`}
                className="sweep grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-x-3 bg-panel-glass px-4 py-2.5 text-ink sm:grid-cols-[34px_minmax(0,1fr)_110px_minmax(80px,160px)_84px_40px]"
              >
                <span className={`font-mono text-[11px] ${i < 3 ? "text-score" : "text-ink-muted"}`}>#{pad2(i + 1)}</span>
                <span className="font-display text-[22px] leading-[1.05] tracking-[0.05em] break-words">{r.name}</span>
                <span className="hidden font-mono text-[10px] tracking-[0.12em] break-words opacity-70 sm:block">{r.city}</span>
                <span aria-hidden className="hidden h-1.5 bg-chip sm:block">
                  <span
                    className="block h-full origin-left animate-meter bg-score"
                    style={{ width: `${r.score * 10}%`, ...stagger(0.3 + i * 0.06) }}
                  />
                </span>
                <span className="hidden font-mono text-[10px] tracking-[0.14em] opacity-70 sm:block">{tierFor(r.score)}</span>
                <span className="text-right font-mono text-[14px]">
                  {r.score.toFixed(1)}
                  <span className="sr-only"> out of 10</span>
                </span>
              </NavLink>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
