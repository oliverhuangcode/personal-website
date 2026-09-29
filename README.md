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
- **Three.js** for the two 3D scenes (the home spike and the travel globe), imported on demand
  so it stays out of every other page and out of first paint. Everything else is CSS keyframes
  plus a `requestAnimationFrame` tween for the globe. No animation library.

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
    nav.ts        page order for keys 1–5 and ↑↓ cycling
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

- **↑ and ↓ cycle pages; ← and → are left alone**, so they stay available to whatever control
  has focus. Note that ↑↓ therefore take over from scrolling — fine on these short pages, but
  worth remembering if one ever gets long.
- **State is never carried by colour alone.** Selected items also carry a filled block or a
  word, and planned trips say `PLANNED` in text. Keep it that way.
- **The globe** is a real Three.js sphere. Coastlines and the graticule are line segments on its
  surface (`lib/globe/sphere.ts`, unit tested), and depth testing hides the far side, so there is
  no horizon clipping to get right. Drag and the fly-to tween steer the group's rotation.
  The marker's click target is a real `<button>` laid over the canvas and repositioned each
  frame, so it is keyboard-reachable; it is hidden while the marker is on the far side. The
  coastline data is Natural Earth 1:110m (public domain) via `world-atlas`.
- **The home spike** is a detailed Three.js model in the spirit of Valorant's Spike
  (`lib/holo/model.ts`, unit tested): a three-tier armoured base with plates, vents, bolts and a
  row of light cells; three claws with twin pistons; a glass chamber around an energy core with
  rising energy rings, a helix and a hot filament; a segmented casing ring that rides up as it
  charges; braced struts with glowing channels; cables; and a crown with horns and an emitter.
  Rounded parts come from `lib/holo/bevel.ts`, so nothing has a hard CG edge. The finish is
  stylised rather than photoreal: matte painted gunmetal with a faint world-space wear pattern,
  satin trim and polymer, soft fill lighting with almost no environment reflection, and only
  a faint accent rim, since the light comes from inside.
  **Motion:** at rest the spike is a dark silhouette behind the name, so the name leads.
  Scrolling (or a vertical swipe on a phone) spins it and drives two separate signals
  (`lib/holo/energy.ts`, unit tested). **Charge** builds with every scroll and drains over about
  twelve seconds; it brightens the core, its glow and the bloom, so it feels like charging up.
  **Activity** says you're spinning it right now and eases out over about three seconds after
  your last scroll. Sparks from the core and bolts of soft lightning spawn in proportion to it,
  more of them the higher the charge, so when you stop they thin out and fade rather than cut
  off. Each bolt zigzags between random kinks that re-jolt 14 times a second, with one or two
  thinner forks branching off; it's drawn as a camera-facing ribbon with a soft bright line and
  halo (lavender to deep purple), so it reads thicker and gentler than real lightning. The light lives
  inside the core: the core's point lights are short range, and the outer shell stays dark and
  matte. Mechanical parts (energy rings, helix, the casing ring riding up and down) move on
  their own; there's no heartbeat, flare or floor ring. The canvas publishes `data-energy` and
  `data-activity` for tests. The additive shaders write opacity equal to their brightness: the canvas is
  transparent, and full opacity on faint edges showed up as dark smudges over the page. Bloom is scaled to the spike's
  on-screen size so it can't wash out the name on phones. The hero text is `select-none`, since
  drags there spin the spike. The flat canvas fallback (no WebGL) still draws the older design
  from the
  simpler part list in `lib/holo/spike.ts`.
  **Startup:** on a first visit the scene is built only after the boot intro ends, and shaders
  are compiled with `compileAsync` before the first frame, then the canvas fades in. Building it
  during the intro froze the main thread and stuttered the intro. Keep heavy scene work out of
  that window.
- **Both scenes fall back to the earlier flat drawings** (`HoloCore2D`, `Globe2D`) if WebGL or
  the Three.js chunk is unavailable, rather than going blank. The e2e suite checks this by
  launching with WebGL disabled. Delete the 2D files if you would rather not maintain them.
- **The boot screen** plays once per session and is skipped entirely under
  `prefers-reduced-motion`. That decision is made by a tiny inline script before first paint,
  so returning visitors never see a flash of it. Add **`?boot`** to any URL to replay it
  (e.g. `/travel?boot`) — handy for reviewing the intro. It overrides the once-per-session
  flag but never `prefers-reduced-motion`.
- **Motion is for feedback, not decoration.** The ambient pieces (boot, holo core, globe) are
  already busy, so everything else only moves when it tells you something: picking a project
  or trip wipes the frame in and slides the copy after it (keyed on the selection, so every
  pick replays it), and food meters fill on arrival. All of it is fast (≤0.35s, one
  decelerating curve, no bounce). Key the *children* of an `aria-live` region, never the
  region itself, or screen readers stop announcing. Reduced motion zeroes durations and
  delays alike.
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
