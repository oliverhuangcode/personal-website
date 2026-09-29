import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { bevelledPart } from "./bevel";
import { SPIKE_PARTS } from "./spike";

describe("bevelledPart", () => {
  it.each(SPIKE_PARTS.map((p) => [p.name, p] as const))("%s spans its part's height, y-up", (_, part) => {
    const geo = bevelledPart(part);
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    expect(box.max.y).toBeCloseTo(-part.y0, 3);
    expect(box.min.y).toBeCloseTo(-part.y1, 3);
  });

  it.each(SPIKE_PARTS.map((p) => [p.name, p] as const))("%s has finite, unit normals", (_, part) => {
    const n = bevelledPart(part).getAttribute("normal");
    for (let i = 0; i < n.count; i++) {
      const len = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
      expect(Number.isFinite(len)).toBe(true);
      expect(len).toBeCloseTo(1, 3);
    }
  });

  it("keeps a prism within its radius at top and bottom", () => {
    const cap = SPIKE_PARTS.find((p) => p.name === "faceted triangular cap")!;
    if (cap.shape !== "prism") throw new Error("expected a prism");
    const pos = bevelledPart(cap).getAttribute("position");
    let maxBot = 0;
    let maxTop = 0;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      if (pos.getY(i) < -cap.y1 + 0.001) maxBot = Math.max(maxBot, r);
      if (pos.getY(i) > -cap.y0 - 0.001) maxTop = Math.max(maxTop, r);
    }
    // Rounded corners pull the outline in from the sharp-cornered circumradius, never out.
    expect(maxBot).toBeLessThanOrEqual(cap.rBot + 1e-6);
    expect(maxBot).toBeGreaterThan(cap.rBot * 0.7);
    expect(maxTop).toBeLessThanOrEqual(cap.rTop + 1e-6);
  });

  it("puts a box part at its angle and radius", () => {
    const foot = SPIKE_PARTS.find((p) => p.name === "wedge foot 1")!;
    if (foot.shape !== "box") throw new Error("expected a box");
    const geo = bevelledPart(foot);
    geo.computeBoundingBox();
    const c = geo.boundingBox!.getCenter(new THREE.Vector3());
    expect(Math.hypot(c.x, c.z)).toBeCloseTo(foot.rad, 1);
    expect(Math.atan2(c.z, c.x)).toBeCloseTo(foot.ang, 1);
  });

  it("smooths the edges: welded vertices, far fewer than a flat-shaded mesh", () => {
    const geo = bevelledPart(SPIKE_PARTS.find((p) => p.name === "plinth")!);
    expect(geo.index).not.toBeNull();
    expect(geo.getAttribute("position").count).toBeLessThan(geo.index!.count);
  });
});

describe("bevelledPart roundness", () => {
  it("rounds a glow column toward a cylinder without growing it", () => {
    const column = SPIKE_PARTS.find((p) => p.kind === "core")!;
    if (column.shape !== "prism") throw new Error("expected a prism");
    const pos = bevelledPart(column, 0.45).getAttribute("position");
    const radii: number[] = [];
    for (let i = 0; i < pos.count; i++) radii.push(Math.hypot(pos.getX(i), pos.getZ(i)));
    const max = Math.max(...radii);
    expect(max).toBeLessThanOrEqual(column.rTop + 1e-6);
    // Sharp corners would reach the full circumradius; heavy rounding pulls them well in.
    expect(max).toBeLessThan(column.rTop * 0.85);
  });
});
