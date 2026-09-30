import { mediaPhotos } from "./media";
import type { Trip } from "./types";

import { slugify } from "@/lib/slug";

export const MAX_TRIP_PHOTOS = 8;

const log: Trip[] = [
  {
    name: "HONOLULU",
    status: "VISITED",
    cities: ["OAHU"],
    note: "Warm water and nothing else on the schedule.",
    lat: 21.3,
    lon: -157.9,
    photos: [],
  },
  {
    name: "CALIFORNIA",
    status: "VISITED",
    cities: ["LOS ANGELES", "SAN FRANCISCO", "YOSEMITE"],
    note: "Cities at each end, granite in the middle.",
    lat: 37.0,
    lon: -120.0,
    photos: [],
  },
  {
    name: "JAPAN",
    status: "PLANNED",
    cities: ["TOKYO", "KYOTO", "OSAKA"],
    note: "Three cities, one rail pass.",
    lat: 35.4,
    lon: 137.0,
    photos: [],
  },
  {
    name: "CHINA",
    status: "PLANNED",
    cities: ["XI'AN", "CHONGQING", "CHENGDU", "BEIJING", "SHANGHAI"],
    note: "The long one. Five cities west to east.",
    lat: 33.0,
    lon: 110.0,
    photos: [],
  },
  {
    name: "THAILAND",
    status: "PLANNED",
    cities: ["BANGKOK", "KOH TAO"],
    note: "City first, then diving.",
    lat: 12.0,
    lon: 100.0,
    photos: [],
  },
];

/** Photos uploaded with `npm run photos` from .photo-inbox/travel/<trip>/ join each trip's list. */
export const trips: Trip[] = log.map((trip) => ({
  ...trip,
  photos: [...trip.photos, ...mediaPhotos(`travel/${slugify(trip.name)}`, (i) => `${trip.name} photo ${i + 1}`)],
}));
