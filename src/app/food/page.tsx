import type { Metadata } from "next";

import { CitySelect } from "@/components/food/CitySelect";
import { FoodHeader } from "@/components/food/FoodHeader";
import { restaurants } from "@/content/food";
import { groupByCity } from "@/lib/food";

export const metadata: Metadata = { title: "Food" };

const cities = groupByCity(restaurants);

export default function FoodPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-gutter py-section">
      <FoodHeader tab="CITIES" />
      <CitySelect cities={cities} />
    </main>
  );
}
