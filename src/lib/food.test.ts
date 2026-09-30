import { describe, expect, it } from "vitest";

import type { Restaurant } from "@/content/types";

import { byRecent, formatCoords, formatVisited, groupByCity, rankRestaurants, tierFor } from "./food";

const r = (name: string, score: number, extra: Partial<Restaurant> = {}): Restaurant => ({
  slug: name.toLowerCase(),
  name,
  score,
  city: "MELBOURNE",
  citySlug: "melbourne",
  cuisine: "",
  visited: "",
  review: "",
  dishes: [],
  ...extra,
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

describe("byRecent", () => {
  it("puts the latest visit first and undated ones last", () => {
    const list = [r("Old", 9, { visited: "2025-01-01" }), r("None", 10), r("New", 5, { visited: "2026-05-01" })];
    expect(byRecent(list).map((x) => x.name)).toEqual(["New", "Old", "None"]);
  });
});

describe("tierFor", () => {
  it("maps scores onto tiers at the boundaries", () => {
    expect([10, 9.5, 9.4, 9, 8, 7.9, 7, 6, 5.9, 0].map(tierFor)).toEqual([
      "RADIANT",
      "RADIANT",
      "IMMORTAL",
      "IMMORTAL",
      "DIAMOND",
      "PLATINUM",
      "PLATINUM",
      "GOLD",
      "IRON",
      "IRON",
    ]);
  });
});

describe("groupByCity", () => {
  it("groups, ranks inside each city, and orders cities by size", () => {
    const photo = { src: "x", alt: "x" };
    const cities = groupByCity([
      r("Pie", 7, { city: "AUCKLAND", citySlug: "auckland", coords: { lat: -36, lon: 174 } }),
      r("A", 8, { coords: { lat: -37, lon: 144 } }),
      r("B", 9, { dishes: [{ name: "X", photo }] }),
      r("C", 7, { coords: { lat: -38, lon: 146 } }),
    ]);
    expect(cities.map((c) => [c.slug, c.count, c.average])).toEqual([
      ["melbourne", 3, 8],
      ["auckland", 1, 7],
    ]);
    expect(cities[0].restaurants.map((x) => x.name)).toEqual(["B", "A", "C"]);
    expect(cities[0].coords).toEqual({ lat: -37.5, lon: 145 });
    expect(cities[0].cover).toBe(photo);
  });
});

describe("formatting", () => {
  it("formats visit months and coordinates", () => {
    expect(formatVisited("2026-03-14")).toBe("MAR 2026");
    expect(formatVisited("2026")).toBe("2026");
    expect(formatCoords({ lat: -37.8136, lon: 144.9631 })).toBe("37°49'S 144°58'E");
    expect(formatCoords({ lat: 35.6999, lon: -0.01 })).toBe("35°42'N 0°01'W");
  });
});
