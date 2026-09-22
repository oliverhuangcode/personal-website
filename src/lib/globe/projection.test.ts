import { describe, expect, it } from "vitest";

import { LAND_RINGS } from "./land";
import {
  GLOBE_CENTRE,
  GLOBE_RADIUS,
  clampLat,
  easeInOutCubic,
  graticulePath,
  project,
  ringPath,
  wrapLonDelta,
} from "./projection";

type Pt = { x: number; y: number };

/** Parse an SVG path of M/L commands into subpaths of points. */
function subpaths(d: string): Pt[][] {
  const out: Pt[][] = [];
  for (const m of d.matchAll(/([ML])(-?[\d.]+) (-?[\d.]+)/g)) {
    const pt = { x: Number(m[2]), y: Number(m[3]) };
    if (m[1] === "M") out.push([pt]);
    else out[out.length - 1].push(pt);
  }
  return out;
}

const distFromCentre = (p: Pt) => Math.hypot(p.x - GLOBE_CENTRE, p.y - GLOBE_CENTRE);

describe("project", () => {
  it("maps the view centre to the middle of the disc", () => {
    const p = project(137, 35.4, 137, 35.4);
    expect(p.visible).toBe(true);
    expect(p.x).toBeCloseTo(GLOBE_CENTRE);
    expect(p.y).toBeCloseTo(GLOBE_CENTRE);
  });

  it("puts north up and east right", () => {
    expect(project(0, 10, 0, 0).y).toBeLessThan(GLOBE_CENTRE);
    expect(project(10, 0, 0, 0).x).toBeGreaterThan(GLOBE_CENTRE);
  });

  it("hides the antipode and places 90° away on the limb", () => {
    expect(project(180, 0, 0, 0).visible).toBe(false);
    expect(distFromCentre(project(90, 0, 0, 0))).toBeCloseTo(GLOBE_RADIUS);
  });
});

describe("wrapLonDelta", () => {
  it.each([
    [20, 20],
    [340, -20],
    [-340, 20],
    [-157.9 - 100, 102.1],
    [180, -180],
  ])("wraps %d to %d", (input, expected) => {
    expect(wrapLonDelta(input)).toBeCloseTo(expected);
  });
});

describe("ringPath", () => {
  it("draws a fully visible line as a single subpath", () => {
    const d = ringPath([[0, 0], [10, 0], [10, 10]], 0, 0);
    expect(subpaths(d)).toHaveLength(1);
    expect(subpaths(d)[0]).toHaveLength(3);
  });

  it("returns nothing for a line entirely on the far side", () => {
    expect(ringPath([[170, 0], [180, 10]], 0, 0)).toBe("");
  });

  it("ends and restarts runs exactly on the limb", () => {
    // Equator from -170 to 170 viewed from lon 0: visible between ±90 only.
    const line = Array.from({ length: 35 }, (_, i) => [-170 + i * 10, 0] as const);
    const runs = subpaths(ringPath(line, 0, 0));
    expect(runs).toHaveLength(1);
    const run = runs[0];
    expect(distFromCentre(run[0])).toBeCloseTo(GLOBE_RADIUS, 0);
    expect(distFromCentre(run[run.length - 1])).toBeCloseTo(GLOBE_RADIUS, 0);
  });

  it("closes rings when asked", () => {
    const d = ringPath([[0, 0], [10, 0], [10, 10]], 0, 0, true);
    const run = subpaths(d)[0];
    expect(run).toHaveLength(4);
    expect(run[3]).toEqual(run[0]);
  });

  it("draws across the antimeridian instead of breaking or sweeping", () => {
    const d = ringPath([[178, 0], [-178, 0]], 180, 0);
    const runs = subpaths(d);
    expect(runs).toHaveLength(1);
    expect(Math.abs(runs[0][1].x - runs[0][0].x)).toBeLessThan(15);
  });

  it("finds the horizon along the short way round the antimeridian", () => {
    // Viewed from lon 100: 170 is visible, -160 is hidden. Going east the
    // segment crosses the horizon at lon 190 (≡ -170) on the right limb;
    // naive interpolation would sweep west and cross at lon 10 on the left.
    const d = ringPath([[170, 0], [-160, 0]], 100, 0);
    const [run] = subpaths(d);
    expect(run[run.length - 1].x).toBeGreaterThan(GLOBE_CENTRE + GLOBE_RADIUS - 1);
  });

  it("skips Natural Earth's antimeridian cut seams", () => {
    const d = ringPath([[170, -70], [180, -80], [180, -89], [170, -80]], 180, -80);
    // The 180,-80 → 180,-89 edge is a cut, so we get two separate runs.
    expect(subpaths(d)).toHaveLength(2);
  });
});

describe("land rendering", () => {
  const views: [number, number][] = [
    [-157.9, 21.3], [-120, 37], [137, 35.4], [110, 33], [100, 12],
    [180, 0], [-180, 60], [0, -80], [0, 80], [45, 0],
  ];

  it("loads Natural Earth rings", () => {
    expect(LAND_RINGS.length).toBeGreaterThan(100);
  });

  it.each(views)("never draws a chord across the disc (view %d, %d)", (lon0, lat0) => {
    let longest = 0;
    for (const ring of LAND_RINGS) {
      for (const run of subpaths(ringPath(ring, lon0, lat0))) {
        for (let i = 1; i < run.length; i++) {
          longest = Math.max(longest, Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y));
        }
      }
    }
    // Real 110m coastline segments are short; a chord would span most of the disc.
    expect(longest).toBeLessThan(GLOBE_RADIUS * 0.6);
  });

  it.each(views)("keeps every point on or inside the disc (view %d, %d)", (lon0, lat0) => {
    for (const ring of LAND_RINGS) {
      for (const run of subpaths(ringPath(ring, lon0, lat0))) {
        for (const p of run) expect(distFromCentre(p)).toBeLessThanOrEqual(GLOBE_RADIUS + 0.2);
      }
    }
  });
});

describe("graticule", () => {
  it("produces meridians and parallels", () => {
    expect(subpaths(graticulePath(0, 0)).length).toBeGreaterThanOrEqual(12);
  });
});

describe("helpers", () => {
  it("eases from 0 to 1 symmetrically", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1);
  });

  it("clamps latitude so the globe never flips", () => {
    expect(clampLat(95)).toBe(80);
    expect(clampLat(-95)).toBe(-80);
    expect(clampLat(12)).toBe(12);
  });
});
