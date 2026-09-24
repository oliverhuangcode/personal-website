import { describe, expect, it } from "vitest";

import { BUILD, CHARGE_FLOOR, CYCLE, PEAK, REST, buildSpike, chargeAt, project, rotate } from "./spike";

describe("chargeAt", () => {
  it("rests at the floor", () => {
    expect(chargeAt(0)).toEqual({ charge: CHARGE_FLOOR, flare: 0 });
    expect(chargeAt(REST - 0.01).charge).toBe(CHARGE_FLOOR);
  });

  it("builds slowly, then fast", () => {
    const mid = chargeAt(REST + BUILD / 2).charge;
    expect(mid).toBeGreaterThan(CHARGE_FLOOR);
    expect(mid).toBeLessThan(0.5);
  });

  it("flares fully halfway through the peak", () => {
    const { charge, flare } = chargeAt(REST + BUILD + PEAK / 2);
    expect(charge).toBe(1);
    expect(flare).toBeCloseTo(1);
  });

  it("releases back to the floor", () => {
    expect(chargeAt(CYCLE - 1e-9).charge).toBeCloseTo(CHARGE_FLOOR);
  });

  it("has no jumps at the phase boundaries", () => {
    for (const b of [REST, REST + BUILD, REST + BUILD + PEAK, CYCLE]) {
      expect(Math.abs(chargeAt(b - 1e-6).charge - chargeAt(b).charge)).toBeLessThan(1e-3);
    }
  });

  it("wraps around the cycle", () => {
    expect(chargeAt(CYCLE + 3)).toEqual(chargeAt(3));
  });
});

describe("buildSpike", () => {
  const faces = buildSpike();

  it("has nine prisms and six boxes", () => {
    expect(faces).toHaveLength(9 * 5 + 6 * 6);
  });

  it("keeps the glow column inside the struts", () => {
    const core = faces.filter((f) => f.kind === "core").flatMap((f) => f.pts);
    expect(core.length).toBeGreaterThan(0);
    for (const [x, , z] of core) expect(Math.hypot(x, z)).toBeLessThan(0.31);
  });
});

describe("rotate and project", () => {
  it("leaves the origin in place", () => {
    expect(rotate([0, 0, 0], 1.2, 0.3)).toEqual([0, 0, 0]);
  });

  it("does not scale points on the image plane", () => {
    expect(project([1, -1, 0], 100, 50, 10)).toEqual([110, 40, 0]);
  });

  it("shrinks points further away", () => {
    const near = project([1, 0, -1], 0, 0, 10)[0];
    const far = project([1, 0, 1], 0, 0, 10)[0];
    expect(near).toBeGreaterThan(far);
  });
});
