import type { Project } from "./types";

// ⚠️ PLACEHOLDER — invented copy from the design prototype. Replace with real projects.
export const projects: Project[] = [
  {
    name: "ATLAS",
    role: "FULL-STACK",
    year: "2026",
    kind: "WEB APP",
    status: "SHIPPED",
    overview:
      "A scheduling tool for esports orgs. Built and shipped in six weeks; four teams use it to run their weekly scrims.",
    myRole: "Solo build. Schema, API, front end, deploys.",
    stack: "TypeScript, React, Node, Postgres. Hosted on Fly.io.",
    result:
      "Four orgs onboarded in the first month. Scrim scheduling went from hours of group chat to minutes.",
  },
  {
    name: "VERGE",
    role: "FRONT END",
    year: "2025",
    kind: "MARKETING SITE",
    status: "LIVE",
    overview: "Marketing site and storefront for a small hardware studio making desk accessories.",
    myRole: "Front end and performance work alongside one back-end engineer.",
    stack: "Astro, TypeScript, Stripe, Cloudflare.",
    result:
      "Largest contentful paint under one second. Launch week was their biggest preorder day to date.",
  },
  {
    name: "KILN",
    role: "PLATFORM",
    year: "2025",
    kind: "INTERNAL TOOLING",
    status: "IN USE",
    overview:
      "A component library and CLI covering forms, tables and auth flows for a twelve-person product team.",
    myRole: "Owned the library end to end, including docs and migration guides.",
    stack: "React, TypeScript, Storybook, Changesets.",
    result: "Cut feature setup time roughly in half. Engineers stopped rebuilding the same table.",
  },
  {
    name: "NORTH",
    role: "BACK END",
    year: "2024",
    kind: "REALTIME",
    status: "SHIPPED",
    overview:
      "Live scoring and overlay service for a local LAN tournament, driving broadcast graphics from a single source of truth.",
    myRole: "Solo. Websocket server, admin panel and OBS browser sources.",
    stack: "Node, Redis, WebSockets, Svelte admin.",
    result: "Ran two events without a dropped connection. Organisers reused it the following year.",
  },
  {
    name: "SIGNAL",
    role: "SIDE PROJECT",
    year: "2024",
    kind: "MOBILE",
    status: "PROTOTYPE",
    overview:
      "A companion app for reviewing your own matches: timeline scrubbing with tagged mistakes you can jump between.",
    myRole: "Self-directed. Design and build.",
    stack: "React Native, SQLite, ffmpeg.",
    result: "Unshipped. Kept here because the interaction model is the best thing in this list.",
  },
  {
    name: "RELAY",
    role: "HARDWARE",
    year: "2023",
    kind: "WEEKEND BUILD",
    status: "RUNNING",
    overview:
      "A physical status display for my desk showing calendar, CI status and what I'm listening to.",
    myRole: "Solo weekend build.",
    stack: "Raspberry Pi, Python, e-ink panel.",
    result: "Still running. Has never once told me anything useful before 9am.",
  },
];
