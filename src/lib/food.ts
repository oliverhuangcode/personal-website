import type { Photo, Restaurant } from "@/content/types";

/** Highest score first; ties fall back to name so the order is stable. */
export function rankRestaurants(list: readonly Restaurant[]): Restaurant[] {
  return [...list].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** Most recent visit first; undated visits last, then by rank. */
export function byRecent(list: readonly Restaurant[]): Restaurant[] {
  return rankRestaurants(list).sort((a, b) => (b.visited || "").localeCompare(a.visited || ""));
}

const TIERS = [
  [9.5, "RADIANT"],
  [9, "IMMORTAL"],
  [8, "DIAMOND"],
  [7, "PLATINUM"],
  [6, "GOLD"],
] as const;

/** Competitive-rank flavour for a score out of 10. */
export function tierFor(score: number): string {
  return TIERS.find(([min]) => score >= min)?.[1] ?? "IRON";
}

export interface CitySummary {
  slug: string;
  name: string;
  country: string;
  count: number;
  average: number;
  /** Ranked, best first. */
  restaurants: Restaurant[];
  /** Mean of the spots that have coordinates. */
  coords?: { lat: number; lon: number };
  /** The first dish photo from the best-ranked spot that has one. */
  cover?: Photo;
}

const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

/** One entry per city, most spots first (ties by name). */
export function groupByCity(list: readonly Restaurant[]): CitySummary[] {
  const groups = new Map<string, Restaurant[]>();
  for (const r of list) groups.set(r.citySlug, [...(groups.get(r.citySlug) ?? []), r]);

  return [...groups.entries()]
    .map(([slug, members]) => {
      const ranked = rankRestaurants(members);
      const located = ranked.flatMap((r) => (r.coords ? [r.coords] : []));
      return {
        slug,
        name: ranked[0].city,
        country: ranked[0].country,
        count: ranked.length,
        average: Math.round(mean(ranked.map((r) => r.score)) * 10) / 10,
        restaurants: ranked,
        ...(located.length && {
          coords: { lat: mean(located.map((c) => c.lat)), lon: mean(located.map((c) => c.lon)) },
        }),
        cover: ranked.flatMap((r) => r.dishes.flatMap((d) => (d.photo ? [d.photo] : [])))[0],
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Distinct cuisines, alphabetical. */
export function cuisines(list: readonly Restaurant[]): string[] {
  return [...new Set(list.map((r) => r.cuisine).filter(Boolean))].sort();
}

export function averageScore(list: readonly Restaurant[]): number {
  return list.length ? Math.round(mean(list.map((r) => r.score)) * 10) / 10 : 0;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "2026-03-14" -> "MAR 2026". */
export function formatVisited(iso: string): string {
  const [year, month] = iso.split("-");
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

/** -37.8, 144.95 -> "37°48'S 144°57'E", like the boot screen. */
export function formatCoords({ lat, lon }: { lat: number; lon: number }): string {
  const dm = (v: number) => {
    const minutes = Math.round(Math.abs(v) * 60);
    return `${Math.floor(minutes / 60)}°${pad(minutes % 60)}'`;
  };
  return `${dm(lat)}${lat < 0 ? "S" : "N"} ${dm(lon)}${lon < 0 ? "W" : "E"}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
