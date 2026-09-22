# Oliver Huang — personal site

A five-page personal site built to the tactical-HUD design in `design_handoff_personal_site`:
dark ground, chamfered panels, condensed display type, keyboard navigation, a boot sequence
and an interactive SVG globe.

## Stack

- **Next.js 16 (App Router) + TypeScript**, static export (`output: "export"`) — every route
  pre-renders to HTML in `out/`, so it hosts anywhere (Vercel, GitHub Pages, S3).
- **Tailwind v4**, with the design tokens defined in `@theme` in `src/app/globals.css`.
  No component library: the design is entirely bespoke, so one would only get in the way.
- **next/font** self-hosts Bebas Neue, Chakra Petch and Azeret Mono — no layout shift, no
  requests to Google.
- No animation library. Everything is CSS keyframes plus one `requestAnimationFrame` tween
  for the globe.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Static export into `out/` |
| `npm start` | Serve the built `out/` locally |
| `npm test` | Unit tests (globe projection, nav) |
| `npm run test:e2e` | Browser checks against `out/` — needs `npm run build` first |
| `npm run test:a11y` | axe-core scan of every page — needs `npm run build` first |
| `npm run sfx:preview` | Render every UI click to `sfx-preview/*.wav` to listen to |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |

## Layout

```
src/
  app/            routes: / /about /projects /travel /food, plus layout and template
  components/
    site/         header, footer, boot screen, background, keyboard nav
    projects/     character-select style project browser
    travel/       globe, destination list, photo carousel
    ui/           MediaFrame, NavLink
  content/        all copy and data as typed modules — edit these, not the components
  lib/
    globe/        projection maths and Natural Earth coastlines (unit tested)
    sound/        Web Audio click synthesis and the SFX preference
    nav.ts        page order for keys 1–5 and arrow cycling
```

## Editing content

Everything lives in `src/content`. `projects.ts` and `food.ts` are still the **placeholder
copy invented for the prototype** and are marked as such — replace them.

Photos go in `public/` and are referenced as `{ src, alt }`:

```ts
photos: [{ src: "/photos/travel/japan-1.jpg", alt: "Fushimi Inari at dawn" }],
```

The carousel renders exactly as many slides as there are photos (max 8 per trip) and hides
its controls at 0 or 1. Frames with no photo stay empty rather than showing a broken image.
To add the full-bleed background, set `site.background` in `src/content/site.ts`.

## Design decisions worth knowing

- **State is never carried by colour alone.** Selected items also carry a filled block or a
  word, and planned trips say `PLANNED` in text. Keep it that way.
- **The globe** is an orthographic projection re-generated every frame. Coastlines are drawn
  stroke-only; if you ever switch to filled land you must close partial rings along the limb
  with SVG arc commands. The coastline data is Natural Earth 1:110m (public domain) via
  `world-atlas`, so the prototype's hand-authored `land.js` is gone.
- **The boot screen** plays once per session and is skipped entirely under
  `prefers-reduced-motion`. That decision is made by a tiny inline script before first paint,
  so returning visitors never see a flash of it.
- **Sound** is off by default, never auto-plays, and is persisted in `localStorage`. Each click
  is synthesised in three layers — noise transient, inharmonic FM body, quiet fifth — which is
  what makes it read as a mechanism rather than a beep. `npm run sfx:preview` renders them to
  .wav so changes can be judged by ear, and fails on clipping or a non-silent tail (a pop).
- **Food scores** keep the prototype's one-off `#7fb8de` (`--color-score`) rather than the
  accent. That is deliberate — don't "fix" it to match the token table.
- **The boot overlay never takes pointer events.** It is decorative and sits above everything
  for three seconds; if it can be clicked, the whole page is dead for that window. There is an
  e2e test for exactly this.

### Where this departs from the handoff

- The header logo, the `OPEN TO WORK` chip and the `STACK` readout row are described in the
  handoff README but had been deleted from the latest prototype. The prototype was followed.
  Re-adding any of them is a few lines.
- The handoff specifies no mobile layout. Below 640px the nav type steps down and the SFX
  toggle moves into the footer, where the keyboard hint (meaningless without a keyboard) is
  hidden.

## Still needed

1. Six real projects — name, year, kind, status, overview, role, stack, outcome
2. The real food log
3. All photography: background, one screenshot per project, up to 8 per trip, one per dish
