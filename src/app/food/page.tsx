import type { Metadata } from "next";

import { FoodExplorer } from "@/components/food/FoodExplorer";
import { restaurants } from "@/content/food";
import { rankRestaurants } from "@/lib/food";

export const metadata: Metadata = { title: "Food" };

const ranked = rankRestaurants(restaurants);

export default function FoodPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-5 px-gutter py-section">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-page-title font-normal text-title">FOOD</h1>
        <p className="font-mono text-[12px] tracking-[0.2em] text-ink-muted">RANKED OUT OF 10 · ◂ ▸ TO BROWSE</p>
      </header>
      <FoodExplorer restaurants={ranked} />
    </main>
  );
}
