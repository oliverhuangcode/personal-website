import { describe, expect, it } from "vitest";

import { trianglesOf } from "./geometry";
import { buildSpike } from "./spike";

describe("trianglesOf", () => {
  const faces = buildSpike();

  it.each(["shell", "core", "seam"] as const)("emits whole triangles for %s", (kind) => {
    const { positions, normals } = trianglesOf(faces, kind);
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.length % 9).toBe(0);
    expect(normals.length).toBe(positions.length);
  });

  it("emits unit normals", () => {
    const { normals } = trianglesOf(faces, "shell");
    for (let i = 0; i < normals.length; i += 3) {
      expect(Math.hypot(normals[i], normals[i + 1], normals[i + 2])).toBeCloseTo(1, 5);
    }
  });

  it("winds every triangle so its geometric normal agrees with the stored one", () => {
    for (const kind of ["shell", "core", "seam"] as const) {
      const { positions: p, normals: n } = trianglesOf(faces, kind);
      for (let t = 0; t < p.length; t += 9) {
        const e1 = [p[t + 3] - p[t], p[t + 4] - p[t + 1], p[t + 5] - p[t + 2]];
        const e2 = [p[t + 6] - p[t], p[t + 7] - p[t + 1], p[t + 8] - p[t + 2]];
        const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        expect(g[0] * n[t] + g[1] * n[t + 1] + g[2] * n[t + 2]).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  it("flips y so the top boss is highest", () => {
    const { positions } = trianglesOf(faces, "shell");
    const ys = Array.from({ length: positions.length / 3 }, (_, i) => positions[i * 3 + 1]);
    expect(Math.max(...ys)).toBeCloseTo(1.26, 5);
    expect(Math.min(...ys)).toBeCloseTo(-1.04, 5);
  });
});
