import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site is fully static: every route pre-renders to HTML in `out/`.
  output: "export",
  // Default image optimisation needs a server; photos are pre-sized in /public.
  images: { unoptimized: true },
};

export default nextConfig;
