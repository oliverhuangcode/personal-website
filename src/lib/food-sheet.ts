/**
 * Turns the published food spreadsheet (CSV) into restaurants.
 *
 * Pure functions only — `scripts/food-sync.mjs` bundles this file, and the
 * tests run it directly. Photos are joined on by the script, not here.
 */

import type { Dish, Restaurant } from "../content/types";

import { slugify } from "./slug";

// Re-exported for the scripts, which bundle this file.
export { slugify };

/** RFC 4180 CSV: quoted fields, doubled quotes, and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** "Tonkotsu [MUST ORDER]; Kaedama" -> dishes with optional tags. */
export function parseDishes(cell: string): Dish[] {
  return cell
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
      const name = (match ? match[1] : part).trim().toUpperCase();
      const tag = match?.[2].trim().toUpperCase();
      return tag ? { name, tag } : { name };
    })
    .filter((dish) => dish.name !== "");
}

/** "-37.8136, 144.9631" as copied from Google Maps. */
export function parseCoords(cell: string): { lat: number; lon: number } | undefined {
  const match = cell.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  return { lat, lon };
}

export const COLUMNS = [
  "name",
  "city",
  "area",
  "cuisine",
  "price",
  "visited",
  "score",
  "review",
  "dishes",
  "coords",
] as const;

export interface SheetResult {
  restaurants: Restaurant[];
  /** One line per skipped row or ignored cell, for the sync log. */
  warnings: string[];
}

/**
 * Validates every row. A bad row is skipped with a warning rather than failing the
 * sync, so one typo on a phone can't hold back the rest of the log.
 */
export function parseSheet(csv: string): SheetResult {
  const [header, ...rows] = parseCsv(csv);
  const warnings: string[] = [];
  if (!header) return { restaurants: [], warnings: ["sheet is empty"] };

  const index = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));
  for (const required of ["name", "city", "score"]) {
    if (!index.has(required)) throw new Error(`sheet is missing the "${required}" column`);
  }
  const cell = (row: string[], col: (typeof COLUMNS)[number]) => {
    const i = index.get(col);
    return i === undefined ? "" : (row[i] ?? "").trim();
  };

  const restaurants: Restaurant[] = [];
  const seen = new Set<string>();

  rows.forEach((row, n) => {
    const line = `row ${n + 2}`;
    const name = cell(row, "name");
    const city = cell(row, "city");
    const scoreText = cell(row, "score");
    const score = Number(scoreText);

    if (!name) return warnings.push(`${line}: skipped, no name`);
    if (!city) return warnings.push(`${line} (${name}): skipped, no city`);
    if (scoreText === "" || !Number.isFinite(score) || score < 0 || score > 10) {
      return warnings.push(`${line} (${name}): skipped, score "${scoreText}" is not 0–10`);
    }

    const citySlug = slugify(city);
    const slug = slugify(name);
    const key = `${citySlug}/${slug}`;
    if (seen.has(key)) return warnings.push(`${line} (${name}): skipped, duplicate in ${city}`);
    seen.add(key);

    const visited = cell(row, "visited");
    if (visited && !/^\d{4}-\d{2}(-\d{2})?$/.test(visited)) {
      warnings.push(`${line} (${name}): visited "${visited}" ignored, use YYYY-MM-DD`);
    }
    const price = cell(row, "price");
    if (price && !/^\${1,4}$/.test(price)) warnings.push(`${line} (${name}): price "${price}" ignored, use $ to $$$$`);
    const coordsText = cell(row, "coords");
    const coords = coordsText ? parseCoords(coordsText) : undefined;
    if (coordsText && !coords) warnings.push(`${line} (${name}): coords "${coordsText}" ignored, use "lat, lon"`);

    const area = cell(row, "area");
    restaurants.push({
      slug,
      name: name.toUpperCase(),
      city: city.toUpperCase(),
      citySlug,
      ...(area && { area: area.toUpperCase() }),
      cuisine: cell(row, "cuisine").toUpperCase(),
      ...(/^\${1,4}$/.test(price) && { price }),
      visited: /^\d{4}-\d{2}(-\d{2})?$/.test(visited) ? visited : "",
      score: Math.round(score * 10) / 10,
      review: cell(row, "review"),
      dishes: parseDishes(cell(row, "dishes")),
      ...(coords && { coords }),
    });
  });

  // Stable order keeps the committed JSON's diffs readable.
  restaurants.sort((a, b) => a.citySlug.localeCompare(b.citySlug) || a.slug.localeCompare(b.slug));
  return { restaurants, warnings };
}
