export interface Photo {
  /** Path under /public, e.g. "/photos/travel/honolulu-1.jpg". */
  src: string;
  alt: string;
}

export interface Project {
  name: string;
  /** Short discipline label shown above the name, e.g. "FULL-STACK". */
  role: string;
  year: string;
  kind: string;
  status: string;
  overview: string;
  myRole: string;
  stack: string;
  result: string;
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
  name: string;
  city: string;
  cuisine: string;
  /** When you ate there, e.g. "SEP 2026". */
  visited: string;
  /** Out of 10, one decimal place. Rank is derived from this. */
  score: number;
  review: string;
  /** Up to MAX_DISHES. The carousel shows one slide per dish. */
  dishes: Dish[];
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
