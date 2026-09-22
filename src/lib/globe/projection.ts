/**
 * Orthographic globe projection and path generation.
 *
 * Pure functions only — no React, no DOM — so they can be unit tested and
 * re-run every animation frame. Coordinates are `[lon, lat]` in degrees.
 */

export type LonLat = readonly [lon: number, lat: number];

export interface Projected {
  /** false when the point is on the far side of the sphere. */
  visible: boolean;
  x: number;
  y: number;
}

export const GLOBE_SIZE = 300;
export const GLOBE_CENTRE = 150;
export const GLOBE_RADIUS = 140;

const RAD = Math.PI / 180;
const HORIZON_ITERATIONS = 12;
/** Natural Earth cuts rings along the antimeridian; those edges are not coastline. */
const SEAM_LON = 179.99;
const POLE_LAT = 89.99;

export function project(lon: number, lat: number, lon0: number, lat0: number): Projected {
  const p = lat * RAD;
  const l = (lon - lon0) * RAD;
  const p0 = lat0 * RAD;
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  return {
    visible: cosc >= 0,
    x: GLOBE_CENTRE + GLOBE_RADIUS * Math.cos(p) * Math.sin(l),
    y:
      GLOBE_CENTRE -
      GLOBE_RADIUS * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)),
  };
}

/** Wrap a longitude difference into [-180, 180] so interpolation takes the short way round. */
export function wrapLonDelta(delta: number): number {
  return ((((delta + 180) % 360) + 360) % 360) - 180;
}

/**
 * Bisect between a visible point `a` and a hidden point `b` to find where the
 * segment crosses the horizon. Interpolates along the short way round the
 * antimeridian, so a 179° → -179° segment does not sweep through lon 0.
 */
function horizon(a: LonLat, b: LonLat, lon0: number, lat0: number): Projected {
  const dLon = wrapLonDelta(b[0] - a[0]);
  const dLat = b[1] - a[1];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < HORIZON_ITERATIONS; i++) {
    const m = (lo + hi) / 2;
    if (project(a[0] + dLon * m, a[1] + dLat * m, lon0, lat0).visible) lo = m;
    else hi = m;
  }
  const t = (lo + hi) / 2;
  return project(a[0] + dLon * t, a[1] + dLat * t, lon0, lat0);
}

function isSeam(a: LonLat, b: LonLat): boolean {
  const bothOnAntimeridian = Math.abs(a[0]) > SEAM_LON && Math.abs(b[0]) > SEAM_LON;
  const bothAtPole = Math.abs(a[1]) > POLE_LAT && Math.abs(b[1]) > POLE_LAT;
  return bothOnAntimeridian || bothAtPole;
}

const fmt = (p: Projected) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;

/**
 * Build an SVG path for a polyline on the globe, clipped at the horizon.
 *
 * Hidden runs are dropped, and each visible run is extended to the exact
 * horizon crossing so lines meet the limb instead of stopping short or
 * drawing a chord across the disc. Pass `closed` for rings whose last point
 * does not repeat the first.
 */
export function ringPath(
  ring: readonly LonLat[],
  lon0: number,
  lat0: number,
  closed = false,
): string {
  const pts = closed && ring.length > 0 ? [...ring, ring[0]] : ring;
  let d = "";
  let open = false;
  let prev: LonLat | null = null;
  let prevVis = false;

  for (const pt of pts) {
    const p = project(pt[0], pt[1], lon0, lat0);

    if (prev && isSeam(prev, pt)) {
      // Not a real edge: skip it and restart the run at this point.
      open = p.visible;
      if (open) d += `M${fmt(p)}`;
    } else if (p.visible && open) {
      d += `L${fmt(p)}`;
    } else if (p.visible) {
      // Entering view: start at the horizon crossing if we came from behind.
      d += prev && !prevVis ? `M${fmt(horizon(pt, prev, lon0, lat0))}L` : "M";
      d += fmt(p);
      open = true;
    } else if (open && prev) {
      // Leaving view: finish the run exactly on the limb.
      d += `L${fmt(horizon(prev, pt, lon0, lat0))}`;
      open = false;
    }
    prev = pt;
    prevVis = p.visible;
  }
  return d;
}

/** Meridians every 30°, parallels every 30° from -60 to 60, sampled at 4°. */
export function graticulePath(lon0: number, lat0: number): string {
  let d = "";
  for (let lon = -180; lon < 180; lon += 30) {
    const line: LonLat[] = [];
    for (let lat = -90; lat <= 90; lat += 4) line.push([lon, lat]);
    d += ringPath(line, lon0, lat0);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const line: LonLat[] = [];
    for (let lon = -180; lon <= 180; lon += 4) line.push([lon, lat]);
    d += ringPath(line, lon0, lat0);
  }
  return d;
}

export function easeInOutCubic(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

export const clampLat = (lat: number) => Math.max(-80, Math.min(80, lat));
