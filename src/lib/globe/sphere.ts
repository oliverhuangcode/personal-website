/**
 * Maths for the 3D globe, kept free of Three.js so it can be unit tested.
 * Coordinates are `[lon, lat]` in degrees; vectors are `[x, y, z]` with y up and
 * +z pointing at the viewer.
 */

import type { LonLat } from "./projection";

export type Vec3 = [x: number, y: number, z: number];

const RAD = Math.PI / 180;
/** Natural Earth cuts rings along the antimeridian and at the poles; those edges are not coastline. */
const SEAM_LON = 179.99;
const POLE_LAT = 89.99;

export function toVec3(lon: number, lat: number, radius = 1): Vec3 {
  const p = lat * RAD;
  const l = lon * RAD;
  return [radius * Math.cos(p) * Math.sin(l), radius * Math.sin(p), radius * Math.cos(p) * Math.cos(l)];
}

/**
 * Euler angles (XYZ order, radians) that turn the globe so `lon`/`lat` faces the viewer:
 * spin about y by −lon, then tip about x by +lat.
 */
export function faceRotation(lon: number, lat: number): Vec3 {
  return [lat * RAD, -lon * RAD, 0];
}

/** The same rotation applied by hand, for tests and hit-testing without a scene graph. */
export function rotateToFront(v: Vec3, lon: number, lat: number): Vec3 {
  const [ax, ay] = faceRotation(lon, lat);
  const x1 = v[0] * Math.cos(ay) + v[2] * Math.sin(ay);
  const z1 = -v[0] * Math.sin(ay) + v[2] * Math.cos(ay);
  return [x1, v[1] * Math.cos(ax) - z1 * Math.sin(ax), v[1] * Math.sin(ax) + z1 * Math.cos(ax)];
}

function isSeam(a: LonLat, b: LonLat): boolean {
  return (
    (Math.abs(a[0]) > SEAM_LON && Math.abs(b[0]) > SEAM_LON) ||
    (Math.abs(a[1]) > POLE_LAT && Math.abs(b[1]) > POLE_LAT)
  );
}

/** Line-segment endpoints (x,y,z pairs) tracing every ring, minus the seams. */
export function ringSegments(rings: readonly (readonly LonLat[])[], radius: number): Float32Array {
  const out: number[] = [];
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) {
      if (isSeam(ring[i - 1], ring[i])) continue;
      out.push(...toVec3(ring[i - 1][0], ring[i - 1][1], radius), ...toVec3(ring[i][0], ring[i][1], radius));
    }
  }
  return new Float32Array(out);
}

/** Meridians every 30°, parallels every 30° from −60 to 60, sampled at 4°. */
export function graticuleSegments(radius: number): Float32Array {
  const lines: LonLat[][] = [];
  for (let lon = -180; lon < 180; lon += 30) {
    const line: LonLat[] = [];
    for (let lat = -90; lat <= 90; lat += 4) line.push([lon, lat]);
    lines.push(line);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const line: LonLat[] = [];
    for (let lon = -180; lon <= 180; lon += 4) line.push([lon, lat]);
    lines.push(line);
  }
  return ringSegments(lines, radius);
}
