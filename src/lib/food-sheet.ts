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

const MAPS_HOST = /^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.|maps\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)/i;

/** A Google Maps link, full or a short share link. */
export function isMapsLink(cell: string): boolean {
  return MAPS_HOST.test(cell.trim());
}

/**
 * Coordinates written into a full Maps URL. A place's pin (!3d…!4d…) beats the
 * viewport (@lat,lon), which beats a coordinate query (?q=lat,lon).
 */
export function coordsFromMapsUrl(url: string): { lat: number; lon: number } | undefined {
  const pin = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) return parseCoords(`${pin[1]},${pin[2]}`);
  const view = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (view) return parseCoords(`${view[1]},${view[2]}`);
  const query = url.match(/[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i);
  if (query) return parseCoords(`${query[1]},${query[2]}`);
  return undefined;
}

/** The place text in a link like maps.google.com/?q=Ichiran,+211+La+Trobe+St — for geocoding. */
export function placeFromMapsUrl(url: string): string | undefined {
  const q = url.match(/[?&](?:q|query)=([^&]+)/i)?.[1];
  if (!q) return undefined;
  const text = decodeURIComponent(q.replace(/\+/g, " ")).trim();
  return text && !parseCoords(text) ? text : undefined;
}

/** Where a Maps link points, as resolved by the sync script. */
export interface MapsPlace {
  lat: number;
  lon: number;
  /** Suburb or neighbourhood, used when the sheet's area is blank. */
  area?: string;
}

/** Every Maps link in the sheet, so the sync can resolve them before parsing. */
export function collectMapsLinks(csv: string): string[] {
  const links = new Set<string>();
  for (const row of parseCsv(csv).slice(1)) {
    for (const cell of row) if (isMapsLink(cell)) links.add(cell.trim());
  }
  return [...links];
}

/**
 * "2026-03-14", "2026-03", a form timestamp "2026-10-01 19:02:11", or the day-first
 * dates an Australian sheet shows by default ("14/03/2026").
 */
export function parseDate(cell: string): string | undefined {
  const text = cell.trim();
  const iso = text.match(/^(\d{4}-\d{2}(?:-\d{2})?)(?:\s|$)/);
  if (iso) return iso[1];
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
  if (!dmy) return undefined;
  const [, d, m, y] = dmy;
  if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return undefined;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
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
  "maps",
  "timestamp",
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
export function parseSheet(csv: string, places: Record<string, MapsPlace> = {}): SheetResult {
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

    // A form entry with no visit date was logged on the day, so its timestamp stands in.
    const visitedText = cell(row, "visited");
    const visited = visitedText ? parseDate(visitedText) : parseDate(cell(row, "timestamp"));
    if (visitedText && !visited) {
      warnings.push(`${line} (${name}): visited "${visitedText}" ignored, use YYYY-MM-DD`);
    }
    // Only the leading $ run counts, so a dropdown label like "$$ ($20-50)" reads as "$$".
    const priceText = cell(row, "price");
    const price = priceText.match(/^(\${1,4})(?!\$)(?:\s|\(|$)/)?.[1] ?? "";
    if (priceText && !price) warnings.push(`${line} (${name}): price "${priceText}" ignored, use $ to $$$$`);
    // Either column takes "lat, lon" or a Google Maps link.
    const coordsText = cell(row, "coords") || cell(row, "maps");
    const link = isMapsLink(coordsText) ? coordsText : "";
    const place: MapsPlace | undefined = link ? (places[link] ?? coordsFromMapsUrl(link)) : undefined;
    const coords = link ? place && { lat: place.lat, lon: place.lon } : coordsText ? parseCoords(coordsText) : undefined;
    if (link && !coords) warnings.push(`${line} (${name}): couldn't find where the Maps link points`);
    else if (coordsText && !coords) warnings.push(`${line} (${name}): coords "${coordsText}" ignored, use "lat, lon" or a Maps link`);

    const area = cell(row, "area") || place?.area || "";
    restaurants.push({
      slug,
      name: name.toUpperCase(),
      city: city.toUpperCase(),
      citySlug,
      ...(area && { area: area.toUpperCase() }),
      cuisine: cell(row, "cuisine").toUpperCase(),
      ...(price && { price }),
      visited: visited ?? "",
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
