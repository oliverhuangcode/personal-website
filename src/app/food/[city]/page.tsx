import type { Metadata } from "next";

import { FoodExplorer } from "@/components/food/FoodExplorer";
import { NavLink } from "@/components/ui/NavLink";
import { restaurants } from "@/content/food";
import { formatCoords, groupByCity } from "@/lib/food";

const cities = groupByCity(restaurants);

// Every city is pre-rendered; anything else is a 404 in the static export.
export const dynamicParams = false;

export function generateStaticParams() {
  return cities.map((c) => ({ city: c.slug }));
}

const find = async (params: Promise<{ city: string }>) => {
  const { city } = await params;
  return cities.find((c) => c.slug === city)!;
};

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const city = await find(params);
  const name = city.name.charAt(0) + city.name.slice(1).toLowerCase();
  return { title: `Food in ${name}` };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const city = await find(params);
  const details = [
    `${city.count} ${city.count === 1 ? "SPOT" : "SPOTS"}`,
    `AVG ${city.average.toFixed(1)}`,
    city.coords && formatCoords(city.coords),
  ].filter((d): d is string => Boolean(d));

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-5 px-gutter py-section">
      <header className="relative flex flex-col items-center gap-3">
        <NavLink
          href="/food"
          className="self-start px-1 py-1 font-mono text-[11px] tracking-[0.16em] text-ink-muted hover:text-ink md:absolute md:top-0 md:left-0"
        >
          ◂ ALL CITIES
        </NavLink>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display text-page-title font-normal text-title">{city.name}</h1>
          <p className="font-mono text-[12px] tracking-[0.2em] text-ink-muted">
            {details.map((d, i) => (
              <span key={d} className="whitespace-nowrap">
                {i > 0 && " · "}
                {d}
              </span>
            ))}
          </p>
        </div>
      </header>
      <FoodExplorer restaurants={city.restaurants} />
    </main>
  );
}
