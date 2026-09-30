import { mediaPhoto } from "./media";
import type { Project } from "./types";

// Newest first: the page opens on the first project. Screenshots come from
// .photo-inbox/projects/<slug>/cover.* via `npm run photos`.
export const projects: Project[] = [
  {
    name: "MONMAP",
    overview:
      "A course planner for Monash students, replacing MonPlan after it was shut down in June 2026. Drag units onto a year-by-year grid and it checks prerequisites and offerings against the handbook as you go.",
    stack:
      "Next.js, TypeScript and Postgres with Drizzle. A scraper pulls every handbook year (about 37k units) from CourseLoop.",
    url: "https://monmap.monashcoding.com",
    repo: "https://github.com/monashcoding/monmap",
    screenshot: mediaPhoto("projects/monmap/cover", "The MonMap planner showing a year-by-year unit grid"),
  },
  {
    name: "WEAVE",
    overview:
      "A mobile-first web app for finding clothes and trying them on virtually. Built by a team of six in a weekend, it placed 3rd overall at UNIHACK 2025.",
    stack:
      "Next.js front end with a Go API, MongoDB and Auth0. Image processing runs on AWS Lambda, and try-ons use the FASHN API.",
    url: "https://unihack.jasondev.me",
    repo: "https://github.com/jason301c/unihack-2025",
    screenshot: mediaPhoto("projects/weave/cover", "The Weave app showing a virtual try-on"),
  },
  {
    name: "JOB BOARD",
    overview:
      "A job board for Australian students looking for internships and graduate roles. Listings are pulled from several sources every day, deduplicated, then cleaned up and summarised with AI.",
    stack:
      "Next.js, React, TypeScript, Mantine and Tailwind on MongoDB. Go scrapers, deployed to Azure Container Apps.",
    url: "https://jobs.monashcoding.com",
    repo: "https://github.com/monashcoding/mploy-app",
    screenshot: mediaPhoto("projects/mploy/cover", "The MPLOY job board with filters and a list of listings"),
  },
];
