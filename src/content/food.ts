import generated from "./food.generated.json";
import { mediaPhotos } from "./media";
import type { LoggedRestaurant, Restaurant } from "./types";

export const MAX_DISHES = 8;
export const MAX_FOOD_PHOTOS = 12;

/**
 * The food log. `food.generated.json` is written by `npm run food:sync` from the Google Sheet
 * (see docs/food.md); photos are joined on here from the R2 manifest, keyed
 * "food/<restaurant>/<file>", so a new upload shows without re-syncing the sheet.
 */
export const restaurants: Restaurant[] = (generated as LoggedRestaurant[]).map((r) => ({
  ...r,
  dishes: r.dishes.slice(0, MAX_DISHES),
  photos: mediaPhotos(`food/${r.slug}`, (i) => `${r.name}, photo ${i + 1}`).slice(0, MAX_FOOD_PHOTOS),
}));
