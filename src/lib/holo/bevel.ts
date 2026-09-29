import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { Part } from "./spike";

/**
 * Rounded, bevelled meshes for the 3D spike, built from the same part list as the flat
 * drawing. Hard 90° edges are what make a model read as low-poly: nothing catches the
 * light along them. Here every vertical edge is filleted and every cap edge is bevelled,
 * then normals are smoothed across the rounding only, so flat faces stay flat and the
 * edges pick up a thin highlight — the look of a machined game prop.
 *
 * Model space in `spike.ts` has y growing downward; everything returned here is y-up.
 */

/** Corner fillet and cap bevel, as a fraction of the part's smallest dimension, with a hard cap. */
const FILLET = 0.22;
const MAX_FILLET = 0.05;
const BEVEL = 0.28;
const MAX_BEVEL = 0.028;
const CURVE_SEGMENTS = 5;
const BEVEL_SEGMENTS = 3;

/** A closed outline through `pts` with each corner replaced by a quadratic fillet of radius `r`. */
function roundedOutline(pts: THREE.Vector2[], r: number): THREE.Shape {
  const n = pts.length;
  const shape = new THREE.Shape();
  const cut = (from: THREE.Vector2, to: THREE.Vector2) => {
    const d = to.clone().sub(from);
    return from.clone().add(d.setLength(Math.min(r, d.length() / 2)));
  };
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const a = cut(cur, prev);
    const b = cut(cur, next);
    if (i === 0) shape.moveTo(a.x, a.y);
    else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(cur.x, cur.y, b.x, b.y);
  }
  shape.closePath();
  return shape;
}

/**
 * Shape-space outline of a part at its reference size, plus the centre it tapers about.
 * Shape (sx, sy) becomes world (sx, y, −sy) once the extrusion is stood upright.
 */
function outline(part: Part): { pts: THREE.Vector2[]; centre: THREE.Vector2; ref: number; min: number } {
  if (part.shape === "prism") {
    const ref = (part.rTop + part.rBot) / 2;
    const pts = Array.from({ length: part.sides }, (_, i) => {
      const a = part.off + (i / part.sides) * Math.PI * 2;
      return new THREE.Vector2(Math.cos(a) * ref, -Math.sin(a) * ref);
    });
    // Edge length of the n-gon is the smallest in-plane dimension.
    const min = 2 * ref * Math.sin(Math.PI / part.sides);
    return { pts, centre: new THREE.Vector2(0, 0), ref, min };
  }
  const { ang, rad, w, d } = part;
  const cx = Math.cos(ang) * rad;
  const cz = Math.sin(ang) * rad;
  const u = [Math.cos(ang), Math.sin(ang)];
  const v = [-u[1], u[0]];
  const corner = (sw: number, sd: number) =>
    new THREE.Vector2(cx + u[0] * sd * d + v[0] * sw * w, -(cz + u[1] * sd * d + v[1] * sw * w));
  const pts = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  return { pts, centre: new THREE.Vector2(cx, -cz), ref: 1, min: 2 * Math.min(w, d) };
}

/** Scale at the top and bottom of the part, relative to its reference outline. */
function taperOf(part: Part, ref: number): { top: number; bot: number } {
  return part.shape === "prism" ? { top: part.rTop / ref, bot: part.rBot / ref } : { top: part.taper, bot: 1 };
}

/**
 * One part as a smooth-edged mesh geometry, in y-up world units. `roundness` (0–0.5) overrides
 * the corner fillet as a fraction of the part's edge length: near 0.5 the outline becomes a
 * rounded triangle, which lets a glowing part shade as a volume rather than a flat pane.
 */
export function bevelledPart(part: Part, roundness?: number): THREE.BufferGeometry {
  const { pts, centre, ref, min } = outline(part);
  const height = part.y1 - part.y0;
  const bevel = Math.min(MAX_BEVEL, height * BEVEL * 0.5, min * BEVEL * 0.5);
  const fillet = roundness === undefined ? Math.min(MAX_FILLET, min * FILLET) : min * roundness;

  // Inset the outline by the bevel so the bevel grows it back to the true size.
  const inset = pts.map((p) => {
    const dir = p.clone().sub(centre);
    return centre.clone().add(dir.setLength(Math.max(0.001, dir.length() - bevel * 1.4)));
  });
  const geo = new THREE.ExtrudeGeometry(roundedOutline(inset, fillet), {
    depth: Math.max(0.001, height - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: BEVEL_SEGMENTS,
    curveSegments: roundness === undefined ? CURVE_SEGMENTS : 16,
  });

  // Stand it up (extrusion along +y), then place it: world y runs from −y1 (bottom) to −y0 (top).
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -part.y1 + bevel, 0);

  // Taper about the part's own centre, linearly from bottom to top.
  const { top, bot } = taperOf(part, ref);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const yBot = -part.y1;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - yBot) / height));
    const k = bot + (top - bot) * t;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const cx = centre.x;
    const cz = -centre.y;
    pos.setXYZ(i, cx + (x - cx) * k, pos.getY(i), cz + (z - cz) * k);
  }

  // Weld duplicate vertices so normals can be averaged across the rounding.
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  const welded = mergeVertices(geo, 1e-5);
  geo.dispose();
  welded.computeVertexNormals();
  welded.computeBoundingSphere();
  return welded;
}
