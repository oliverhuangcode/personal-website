import type { ExternalLink, Photo, TimelineEntry } from "./types";

/**
 * Public URL of the Cloudflare R2 bucket that holds every photo (see `scripts/photos.mjs`).
 * ⚠️ PLACEHOLDER until the bucket's custom domain is connected.
 */
export const MEDIA_BASE = "https://media.example.com";

export const site = {
  name: "Oliver Huang",
  title: "SOFTWARE ENGINEER",
  /** Melbourne, shown on the boot screen. */
  coordinates: "37°48'S, 144°57'E",
  bio: "Software engineer, originally from Auckland and now based in Melbourne. I studied at AUT and then Monash, ran projects for the Monash Association of Coding, and I'm joining Atlassian as a graduate in 2027.",
  /** Full-bleed image behind every page. Unset until a photo is supplied. */
  background: undefined as Photo | undefined,
};

export const readout: [label: string, value: string][] = [
  ["BASE", "MELBOURNE, AU"],
  ["FROM", "AUCKLAND, NZ"],
];

export const timeline: TimelineEntry[] = [
  { year: "2027", org: "ATLASSIAN", role: "Graduate software engineer" },
  { year: "2026", org: "MONASH UNIVERSITY", role: "Graduated" },
  { year: "2025", org: "ATLASSIAN", role: "Software engineering intern" },
  { year: "2025", org: "MONASH ASSOCIATION OF CODING", role: "Projects director" },
  { year: "2024", org: "MONASH ASSOCIATION OF CODING", role: "Projects officer" },
  { year: "2024", org: "MONASH UNIVERSITY", role: "Started, Melbourne" },
  { year: "2022–23", org: "AUCKLAND UNIVERSITY OF TECHNOLOGY", role: "Auckland" },
];

export const links: ExternalLink[] = [
  { label: "LINKEDIN", href: "https://www.linkedin.com/in/oliverhuang03/" },
  { label: "GITHUB", href: "https://github.com/oliverhuangcode" },
  { label: "INSTAGRAM", href: "https://www.instagram.com/olivrhuang/" },
  { label: "EMAIL", href: "mailto:oliverwhuang@gmail.com" },
];
