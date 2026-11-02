import type { MetadataRoute } from "next";

import { restaurants } from "@/content/food";
import { SITE_URL } from "@/content/site";
import { groupByCity } from "@/lib/food";

// The site is a static export, so the sitemap is built once at build time.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/about", "/projects", "/travel", "/food", "/food/rankings"];
  const cities = groupByCity(restaurants).map((c) => `/food/${c.slug}`);
  return [...pages, ...cities].map((path) => ({
    url: `${SITE_URL}${path}`,
    priority: path === "" ? 1 : path === "/about" ? 0.8 : 0.5,
  }));
}
