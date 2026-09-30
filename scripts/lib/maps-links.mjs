/**
 * Turns Google Maps links from the sheet into coordinates and a suburb.
 *
 * A share link (maps.app.goo.gl/…) is followed to the full URL, which usually carries the
 * place's pin. A link that only names the place (?q=Name,+Address) is geocoded with
 * OpenStreetMap instead. Answers are cached in a committed file, so each link is looked up
 * once, and a link that fails is simply retried on the next sync.
 */
import { readFileSync, writeFileSync } from "node:fs";

export const CACHE = "src/content/maps-links.generated.json";

const UA = "olivrhuang.com food-sync (github.com/oliverhuangcode/personal-website)";
const NOMINATIM = "https://nominatim.openstreetmap.org";

/** Follows redirects by hand so the Maps URL is seen before any consent page. */
async function expand(url) {
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10_000),
    });
    const next = res.headers.get("location");
    if (!next || res.status < 300 || res.status >= 400) return current;
    current = new URL(next, current).href;
    if (/google\.[a-z.]+\/maps|maps\.google\./.test(current) && !/consent\./.test(current)) return current;
  }
  return current;
}

// Nominatim allows one request a second.
let lastCall = 0;
async function nominatim(path) {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(`${NOMINATIM}${path}`, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`OpenStreetMap responded ${res.status}`);
  return res.json();
}

const suburb = (address = {}) =>
  address.suburb ?? address.neighbourhood ?? address.quarter ?? address.city_district ?? address.town;

/** "Ichiran, 211 La Trobe St, Melbourne VIC 3000" — drops leading parts until a match. */
async function geocode(text) {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < parts.length - 1 || i === 0; i++) {
    const q = encodeURIComponent(parts.slice(i).join(", "));
    const [hit] = await nominatim(`/search?format=jsonv2&addressdetails=1&limit=1&q=${q}`);
    if (hit) return { lat: Number(hit.lat), lon: Number(hit.lon), area: suburb(hit.address) };
  }
  return undefined;
}

async function reverse({ lat, lon }) {
  const hit = await nominatim(`/reverse?format=jsonv2&zoom=16&lat=${lat}&lon=${lon}`);
  return suburb(hit?.address);
}

const round = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Returns { link: { lat, lon, area? } } for every link it could place, and a warning
 * for each it couldn't. `helpers` comes from src/lib/food-sheet.ts.
 */
export async function resolveMapsLinks(links, { coordsFromMapsUrl, placeFromMapsUrl }) {
  let cache = {};
  try {
    cache = JSON.parse(readFileSync(CACHE, "utf8"));
  } catch {}

  const warnings = [];
  const todo = links.filter((link) => !cache[link]);
  for (const link of todo) {
    try {
      const full = await expand(link);
      let place = coordsFromMapsUrl(full);
      if (place) place = { ...place, area: await reverse(place) };
      else {
        const text = placeFromMapsUrl(full);
        place = text ? await geocode(text) : undefined;
      }
      if (!place) {
        warnings.push(`Maps link ${link}: no location in ${full}`);
        continue;
      }
      cache[link] = { lat: round(place.lat), lon: round(place.lon), ...(place.area && { area: place.area }) };
    } catch (e) {
      warnings.push(`Maps link ${link}: ${e.message}, will retry next sync`);
    }
  }

  // Only links still in the sheet are kept, in a stable order for readable diffs.
  const kept = Object.fromEntries(links.filter((l) => cache[l]).sort().map((l) => [l, cache[l]]));
  const json = `${JSON.stringify(kept, null, 2)}\n`;
  let previous = "";
  try {
    previous = readFileSync(CACHE, "utf8");
  } catch {}
  if (json !== previous && (links.length || previous)) writeFileSync(CACHE, json);

  return { places: kept, warnings };
}
