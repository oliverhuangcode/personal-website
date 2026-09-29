import { describe, expect, it } from "vitest";

import { faceRotation, graticuleSegments, ringSegments, rotateToFront, toVec3 } from "./sphere";

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe("toVec3", () => {
  it("puts the equator at Greenwich facing the viewer", () => close(toVec3(0, 0), [0, 0, 1]));
  it("puts 90°E on +x and the north pole on +y", () => {
    close(toVec3(90, 0), [1, 0, 0]);
    close(toVec3(0, 90), [0, 1, 0]);
  });
  it("scales by radius", () => expect(Math.hypot(...toVec3(35, -20, 1.5))).toBeCloseTo(1.5, 6));
});

describe("rotateToFront", () => {
  it.each([
    [0, 0],
    [139.7, 35.7],
    [-157.8, 21.3],
    [-74, 40.7],
    [151.2, -33.9],
  ])("brings %s°, %s° to face the viewer", (lon, lat) => {
    close(rotateToFront(toVec3(lon, lat), lon, lat), [0, 0, 1]);
  });
  it("keeps the north pole pointing up when facing the equator", () => {
    close(rotateToFront([0, 1, 0], 40, 0), [0, 1, 0]);
  });
  it("returns radians", () => close(faceRotation(90, 45), [Math.PI / 4, -Math.PI / 2, 0]));
});

describe("ringSegments", () => {
  it("emits one segment per edge, six floats each", () => {
    const seg = ringSegments([[[0, 0], [10, 0], [10, 10]]], 1);
    expect(seg.length).toBe(2 * 6);
  });
  it("drops edges that run along the antimeridian", () => {
    const seg = ringSegments([[[180, 10], [-180, 20], [-170, 20]]], 1);
    expect(seg.length).toBe(1 * 6);
  });
  it("lies on the requested radius", () => {
    const seg = ringSegments([[[20, 30], [25, 35]]], 1.01);
    expect(Math.hypot(seg[0], seg[1], seg[2])).toBeCloseTo(1.01, 5);
  });
});

describe("graticuleSegments", () => {
  it("is non-empty and on the sphere", () => {
    const seg = graticuleSegments(1);
    expect(seg.length).toBeGreaterThan(1000);
    expect(Math.hypot(seg[0], seg[1], seg[2])).toBeCloseTo(1, 5);
  });
});
