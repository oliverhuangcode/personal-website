import { describe, expect, it } from "vitest";

import {
  collectMapsLinks,
  coordsFromMapsUrl,
  isMapsLink,
  parseCoords,
  parseCsv,
  parseDate,
  parseDishes,
  parseSheet,
  placeFromMapsUrl,
  slugify,
} from "./food-sheet";

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

describe("Maps links", () => {
  const place =
    "https://www.google.com/maps/place/Ichiran/@-37.8101,144.9620,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-37.8102438!4d144.9627581";

  it("recognises full and short links, and nothing else", () => {
    expect(isMapsLink(place)).toBe(true);
    expect(isMapsLink("https://maps.app.goo.gl/AbC123")).toBe(true);
    expect(isMapsLink("https://maps.google.com/?q=Ichiran")).toBe(true);
    expect(isMapsLink("-37.8, 144.9")).toBe(false);
    expect(isMapsLink("https://example.com/maps")).toBe(false);
  });

  it("prefers the place pin, then the viewport, then a coordinate query", () => {
    expect(coordsFromMapsUrl(place)).toEqual({ lat: -37.8102438, lon: 144.9627581 });
    expect(coordsFromMapsUrl("https://www.google.com/maps/@-37.81,144.96,15z")).toEqual({ lat: -37.81, lon: 144.96 });
    expect(coordsFromMapsUrl("https://maps.google.com/?q=-37.81,144.96")).toEqual({ lat: -37.81, lon: 144.96 });
    expect(coordsFromMapsUrl("https://maps.google.com/?q=Ichiran&ftid=0x1:0x2")).toBeUndefined();
  });

  it("reads the place text from a query link", () => {
    expect(placeFromMapsUrl("https://maps.google.com/?q=Ichiran,+211+La+Trobe+St&ftid=0x1")).toBe("Ichiran, 211 La Trobe St");
    expect(placeFromMapsUrl("https://maps.google.com/?q=-37.81,144.96")).toBeUndefined();
  });

  it("collects each link once, skipping the header", () => {
    const csv = `name,city,score,maps\nA,X,8,https://maps.app.goo.gl/a\nB,X,8,https://maps.app.goo.gl/a\nC,X,8,`;
    expect(collectMapsLinks(csv)).toEqual(["https://maps.app.goo.gl/a"]);
  });
});

describe("parseDate", () => {
  it("reads ISO dates and the day-first dates a Google Form writes", () => {
    expect(parseDate("2026-03-14")).toBe("2026-03-14");
    expect(parseDate("2026-03")).toBe("2026-03");
    expect(parseDate("2026-10-01 19:02:11")).toBe("2026-10-01");
    expect(parseDate("14/03/2026")).toBe("2026-03-14");
    expect(parseDate("1/10/2026 19:02:11")).toBe("2026-10-01");
    expect(parseDate("03/14/2026")).toBeUndefined();
    expect(parseDate("March")).toBeUndefined();
  });
});

describe("parseSheet", () => {
  it("reads a Google Form's responses: maps links, and the timestamp as the visit date", () => {
    const csv = [
      "Timestamp,name,city,score,visited,area,maps",
      "1/10/2026 19:02:11,Ichiran,Melbourne,9,,,https://maps.app.goo.gl/a",
      "1/10/2026 19:05:00,Lune,Melbourne,9.5,2026-09-20,Fitzroy,https://maps.app.goo.gl/b",
      "1/10/2026 19:06:00,Nowhere,Melbourne,6,,,https://maps.app.goo.gl/missing",
    ].join("\n");
    const places = {
      "https://maps.app.goo.gl/a": { lat: -37.81, lon: 144.96, area: "Melbourne CBD" },
      "https://maps.app.goo.gl/b": { lat: -37.8, lon: 144.98, area: "Collingwood" },
    };
    const { restaurants, warnings } = parseSheet(csv, places);
    const bySlug = Object.fromEntries(restaurants.map((r) => [r.slug, r]));

    expect(bySlug.ichiran).toMatchObject({ visited: "2026-10-01", area: "MELBOURNE CBD", coords: { lat: -37.81, lon: 144.96 } });
    expect(bySlug.lune).toMatchObject({ visited: "2026-09-20", area: "FITZROY" });
    expect(bySlug.nowhere).not.toHaveProperty("coords");
    expect(warnings).toEqual(["row 4 (Nowhere): couldn't find where the Maps link points"]);
  });

  it("builds restaurants and skips bad rows with a warning", () => {
    const csv = [
      HEADER,
      'Ichiran,Melbourne,CBD,Ramen,$$,2026-03-14,9.24,"Great, really.","Tonkotsu [MUST ORDER]","-37.8, 144.9"',
      ",Melbourne,,,,,8,,,",
      "Nope,Melbourne,,,,,eleven,,,",
      "Ichiran,Melbourne,,,,,7,,,",
      "Pie Cart,Auckland,,,cheap,2026/03/14,7,,,here",
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
    const { restaurants, warnings } = prices("$$$ ($50-100)", "$ (<$20)", "$$$$$", "$$cheap");
    const bySlug = Object.fromEntries(restaurants.map((r) => [r.slug, r.price]));
    expect(bySlug).toEqual({ "spot-0": "$$$", "spot-1": "$", "spot-2": undefined, "spot-3": undefined });
    expect(warnings.filter((w) => w.includes("price"))).toHaveLength(2);
  });

  it("refuses a sheet without the required columns", () => {
    expect(() => parseSheet("title,place\nx,y")).toThrow(/"name" column/);
  });
});
