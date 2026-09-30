import generated from "./food.generated.json";
import { mediaPhoto } from "./media";
import type { Restaurant } from "./types";

import { slugify } from "@/lib/slug";

export const MAX_DISHES = 8;

/**
 * The food log. `food.generated.json` is written by `npm run food:sync` from the Google Sheet
 * (see docs/food.md); dish photos are joined on here from the R2 manifest, keyed
 * "food/<restaurant>/<dish>", so a new upload shows without re-syncing the sheet.
 */
export const restaurants: Restaurant[] = (generated as Restaurant[]).map((r) => ({
  ...r,
  dishes: r.dishes.slice(0, MAX_DISHES).map((d) => {
    const photo = mediaPhoto(`food/${r.slug}/${slugify(d.name)}`, `${d.name} at ${r.name}`);
    return photo ? { ...d, photo } : d;
  }),
}));
