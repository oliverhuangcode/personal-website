import type { NextConfig } from "next";

import { MEDIA_BASE } from "./src/content/site";

const nextConfig: NextConfig = {
  // The site is fully static: every route pre-renders to HTML in `out/`.
  output: "export",
  images: {
    // Photos are pre-sized WebPs (see scripts/photos.mjs), so there's nothing left to optimise.
    unoptimized: true,
    remotePatterns: [new URL(`${MEDIA_BASE}/**`)],
  },
};

export default nextConfig;
