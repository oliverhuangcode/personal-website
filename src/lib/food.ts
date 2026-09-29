import type { Restaurant } from "@/content/types";

/** Highest score first; ties fall back to name so the order is stable. */
export function rankRestaurants(list: readonly Restaurant[]): Restaurant[] {
  return [...list].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
