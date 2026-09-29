import type { Face, FaceKind } from "./spike";

/**
 * Triangles for every face of one kind, ready for a BufferGeometry.
 *
 * `spike.ts` models the device with y growing downward; Three.js is y-up, so y is
 * flipped here. Each face is fan-triangulated and wound so its normal points away
 * from the centre of the part it belongs to, which makes the lighting correct
 * regardless of how the face's points were ordered.
 */
export function trianglesOf(faces: readonly Face[], kind: FaceKind): { positions: Float32Array; normals: Float32Array } {
  const positions: number[] = [];
  const normals: number[] = [];

  for (const face of faces) {
    if (face.kind !== kind) continue;
    let pts = face.pts.map(([x, y, z]) => [x, -y, z]);
    const c = [face.centre[0], -face.centre[1], face.centre[2]];

    const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const e1 = sub(pts[1], pts[0]);
    const e2 = sub(pts[2], pts[0]);
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const mid = pts.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / pts.length);
    const out = sub(mid, c);
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) {
      pts = pts.slice().reverse();
      n = n.map((v) => -v);
    }
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((v) => v / len);

    for (let i = 1; i < pts.length - 1; i++) {
      for (const p of [pts[0], pts[i], pts[i + 1]]) {
        positions.push(p[0], p[1], p[2]);
        normals.push(n[0], n[1], n[2]);
      }
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals) };
}
