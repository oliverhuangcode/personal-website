export interface Photo {
  /** Absolute URL, or a path under /public. */
  src: string;
  alt: string;
  /** A smaller copy for thumbnails and cards. */
  thumb?: string;
  width?: number;
  height?: number;
  /** Dominant colour, painted while the photo loads. */
  color?: string;
}

export interface Project {
  name: string;
  overview: string;
  stack: string;
  /** Live site. */
  url?: string;
  /** Source code. */
  repo?: string;
  screenshot?: Photo;
}

export type TripStatus = "VISITED" | "PLANNED";

export interface Trip {
  name: string;
  status: TripStatus;
  cities: string[];
  note: string;
  lat: number;
  lon: number;
  /** Up to MAX_TRIP_PHOTOS. The carousel shows exactly as many slides as photos. */
  photos: Photo[];
}

export interface Dish {
  name: string;
  photo?: Photo;
  /** Optional callout chip, e.g. "MUST ORDER", "SKIP". */
  tag?: string;
}

export interface Restaurant {
  slug: string;
  name: string;
  city: string;
  citySlug: string;
  area?: string;
  cuisine: string;
  /** "$" to "$$$$". */
  price?: string;
  /** ISO date, e.g. "2026-03-14". */
  visited: string;
  /** Out of 10, one decimal place. Rank is derived from this. */
  score: number;
  review: string;
  /** Up to MAX_DISHES. The carousel shows one slide per dish. */
  dishes: Dish[];
  coords?: { lat: number; lon: number };
}

export interface TimelineEntry {
  year: string;
  org: string;
  role: string;
}

export interface ExternalLink {
  label: string;
  href: string;
}
