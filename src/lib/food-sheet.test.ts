import { describe, expect, it } from "vitest";

import { parseCoords, parseCsv, parseDishes, parseSheet, slugify } from "./food-sheet";

const HEADER = "name,city,area,cuisine,price,visited,score,review,dishes,coords";

describe("slugify", () => {
  it("lowercases, strips accents and joins words with hyphens", () => {
    expect(slugify("Crème Brûlée & Co.")).toBe("creme-brulee-and-co");
    expect(slugify("  Ramen Egg ")).toBe("ramen-egg");
  });
});

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, commas and newlines inside quotes", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
    ]);
  });

  it("drops blank lines and a byte-order mark", () => {
    expect(parseCsv("﻿a\n\n,\nb")).toEqual([["a"], ["b"]]);
  });
});

describe("parseDishes", () => {
  it("splits on semicolons and reads [TAGS]", () => {
    expect(parseDishes("Tonkotsu [must order]; Kaedama ;; Spam rice [SKIP]")).toEqual([
      { name: "TONKOTSU", tag: "MUST ORDER" },
      { name: "KAEDAMA" },
      { name: "SPAM RICE", tag: "SKIP" },
    ]);
  });
});

describe("parseCoords", () => {
  it("reads a Google Maps copy and rejects out-of-range values", () => {
    expect(parseCoords("-37.8136, 144.9631")).toEqual({ lat: -37.8136, lon: 144.9631 });
    expect(parseCoords("91, 0")).toBeUndefined();
    expect(parseCoords("nowhere")).toBeUndefined();
  });
});

describe("parseSheet", () => {
  it("builds restaurants and skips bad rows with a warning", () => {
    const csv = [
      HEADER,
      'Ichiran,Melbourne,CBD,Ramen,$$,2026-03-14,9.24,"Great, really.","Tonkotsu [MUST ORDER]","-37.8, 144.9"',
      ",Melbourne,,,,,8,,,",
      "Nope,Melbourne,,,,,eleven,,,",
      "Ichiran,Melbourne,,,,,7,,,",
      "Pie Cart,Auckland,,,cheap,14/03/2026,7,,,here",
    ].join("\n");
    const { restaurants, warnings } = parseSheet(csv);

    expect(restaurants.map((r) => r.slug)).toEqual(["pie-cart", "ichiran"]);
    expect(restaurants[1]).toMatchObject({
      name: "ICHIRAN",
      citySlug: "melbourne",
      score: 9.2,
      price: "$$",
      visited: "2026-03-14",
      review: "Great, really.",
      dishes: [{ name: "TONKOTSU", tag: "MUST ORDER" }],
      coords: { lat: -37.8, lon: 144.9 },
    });
    expect(restaurants[0]).not.toHaveProperty("price");
    expect(restaurants[0].visited).toBe("");
    expect(warnings).toHaveLength(6);
    expect(warnings.join("\n")).toMatch(/row 3: skipped, no name/);
    expect(warnings.join("\n")).toMatch(/duplicate in Melbourne/);
  });

  it("reads the $ run from a dropdown label and rejects anything else", () => {
    const row = (price: string, i: number) => `Spot ${i},Melbourne,,,"${price}",,8,,,`;
    const prices = (...values: string[]) => parseSheet([HEADER, ...values.map(row)].join("\n"));
    const { restaurants, warnings } = prices("$$$ ($40-80)", "$ (<$20)", "$$$$$", "$$cheap");
    const bySlug = Object.fromEntries(restaurants.map((r) => [r.slug, r.price]));
    expect(bySlug).toEqual({ "spot-0": "$$$", "spot-1": "$", "spot-2": undefined, "spot-3": undefined });
    expect(warnings.filter((w) => w.includes("price"))).toHaveLength(2);
  });

  it("refuses a sheet without the required columns", () => {
    expect(() => parseSheet("title,place\nx,y")).toThrow(/"name" column/);
  });
});
