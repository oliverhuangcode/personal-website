import { describe, expect, it } from "vitest";

import type { Restaurant } from "@/content/types";

import { rankRestaurants } from "./food";

const r = (name: string, score: number): Restaurant => ({
  name,
  score,
  city: "",
  cuisine: "",
  visited: "",
  review: "",
  dishes: [],
});

describe("rankRestaurants", () => {
  it("orders by score, highest first, breaking ties by name", () => {
    const ranked = rankRestaurants([r("B", 8), r("C", 9.5), r("A", 8)]);
    expect(ranked.map((x) => x.name)).toEqual(["C", "A", "B"]);
  });

  it("leaves the input untouched", () => {
    const list = [r("A", 1), r("B", 2)];
    rankRestaurants(list);
    expect(list.map((x) => x.name)).toEqual(["A", "B"]);
  });
});
