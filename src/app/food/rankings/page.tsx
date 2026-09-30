import type { Metadata } from "next";

import { FoodHeader } from "@/components/food/FoodHeader";
import { Leaderboard } from "@/components/food/Leaderboard";
import { restaurants } from "@/content/food";
import { groupByCity, rankRestaurants } from "@/lib/food";

export const metadata: Metadata = { title: "Food rankings" };

const ranked = rankRestaurants(restaurants);
const cities = groupByCity(restaurants).map(({ slug, name, count }) => ({ slug, name, count }));

export default function RankingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-gutter py-section">
      <FoodHeader tab="RANKINGS" />
      <Leaderboard restaurants={ranked} cities={cities} />
    </main>
  );
}
