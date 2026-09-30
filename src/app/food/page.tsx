import type { Metadata } from "next";

import { CitySelect } from "@/components/food/CitySelect";
import { NavLink } from "@/components/ui/NavLink";
import { restaurants } from "@/content/food";
import { averageScore, cuisines, groupByCity, meterPercent, rankRestaurants, TIERS, tierFor } from "@/lib/food";
import { stagger } from "@/lib/motion";
import { pad2 } from "@/lib/nav";

export const metadata: Metadata = { title: "Food" };

const cities = groupByCity(restaurants);
const top = rankRestaurants(restaurants).slice(0, 10);
const stats: [label: string, value: string][] = [
  ["SPOTS", String(restaurants.length)],
  ["CITIES", String(cities.length)],
  ["CUISINES", String(cuisines(restaurants).length)],
  ["AVG SCORE", averageScore(restaurants).toFixed(1)],
];
const tierKey = TIERS.map(([min, name], i) => `${name} ${i === TIERS.length - 1 ? `<${TIERS[i - 1][0]}` : `${min}+`}`);

const sectionLabel = "font-mono text-[11px] tracking-[0.22em] text-ink-muted";

export default function FoodPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-gutter py-section">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-page-title font-normal text-title">FOOD</h1>
        <p className="font-mono text-[12px] tracking-[0.2em] text-ink-muted">SELECT A CITY · ◂ ▸ TO BROWSE</p>
        <dl className="flex flex-wrap justify-center gap-x-5 gap-y-1 font-mono text-[12px] tracking-[0.16em]">
          {stats.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="text-ink-muted">{label}</dt>
              <dd className={label === "AVG SCORE" ? "text-score" : "text-ink"}>{value}</dd>
            </div>
          ))}
        </dl>
      </header>

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
                className="sweep grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-x-3 bg-panel-glass px-4 py-2.5 text-ink sm:grid-cols-[34px_minmax(0,1fr)_120px_minmax(80px,160px)_92px_40px]"
              >
                <span className={`font-mono text-[11px] ${i < 3 ? "text-score" : "text-ink-muted"}`}>#{pad2(i + 1)}</span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-display text-[22px] leading-[1.05] tracking-[0.05em] break-words">{r.name}</span>
                  {/* Narrow screens drop the city column, so the city rides under the name. */}
                  <span className="font-mono text-[11px] tracking-[0.12em] opacity-75 sm:hidden">{r.city}</span>
                </span>
                <span className="hidden font-mono text-[11px] tracking-[0.12em] break-words opacity-75 sm:block">{r.city}</span>
                <span aria-hidden className="hidden h-1.5 bg-chip sm:block">
                  <span
                    className="block h-full origin-left animate-meter bg-score"
                    style={{ width: `${meterPercent(r.score)}%`, ...stagger(0.3 + i * 0.06) }}
                  />
                </span>
                <span className="hidden font-mono text-[11px] tracking-[0.12em] opacity-75 sm:block">{tierFor(r.score)}</span>
                <span className="text-right font-mono text-[14px]">
                  {r.score.toFixed(1)}
                  <span className="sr-only"> out of 10</span>
                </span>
              </NavLink>
            </li>
          ))}
        </ol>
        <p className="font-mono text-[11px] tracking-[0.14em] text-ink-muted">
          SCORES OUT OF 10 · BARS RUN 5–10 · {tierKey.join(" · ")}
        </p>
      </section>
    </main>
  );
}
