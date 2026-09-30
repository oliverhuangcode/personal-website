import type { Photo } from "./types";

import manifest from "./media.generated.json";
import { MEDIA_BASE } from "./site";

/** Written by `npm run photos`: one entry per uploaded photo, keyed like "food/ichiran/tonkotsu". */
export interface MediaEntry {
  full: string;
  thumb: string;
  width: number;
  height: number;
  color: string;
}

const entries = manifest as Record<string, MediaEntry>;

const url = (path: string) => `${MEDIA_BASE}/${path}`;

function toPhoto(entry: MediaEntry, alt: string): Photo {
  return {
    src: url(entry.full),
    thumb: url(entry.thumb),
    width: entry.width,
    height: entry.height,
    color: entry.color,
    alt,
  };
}

/** The photo uploaded under `key`, if there is one. */
export function mediaPhoto(key: string, alt: string): Photo | undefined {
  const entry = entries[key];
  return entry && toPhoto(entry, alt);
}

/** Every photo under a folder, e.g. "travel/japan", in file-name order. */
export function mediaPhotos(prefix: string, alt: (i: number) => string): Photo[] {
  return Object.keys(entries)
    .filter((key) => key.startsWith(`${prefix}/`))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((key, i) => toPhoto(entries[key], alt(i)));
}
