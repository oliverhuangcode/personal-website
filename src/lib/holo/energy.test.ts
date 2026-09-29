import { describe, expect, it } from "vitest";

import {
  REST_THRESHOLD,
  addSpin,
  arcRate,
  decay,
  exposureFor,
  follow,
  glowFor,
  sparkRate,
} from "./energy";

describe("spin energy", () => {
  it("builds gradually with scrolling rather than jumping to full", () => {
    let e = 0;
    const levels: number[] = [];
    for (let i = 0; i < 20; i++) {
      e = addSpin(e, 100);
      levels.push(e);
    }
    expect(levels[0]).toBeLessThan(0.1);
    expect(levels[4]).toBeLessThan(0.5);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    expect(levels.at(-1)).toBe(1);
  });

  it("counts scrolling in either direction", () => {
    expect(addSpin(0, -120)).toBeCloseTo(addSpin(0, 120));
  });

  it("runs down slowly when you stop, and never below zero", () => {
    expect(decay(1, 1)).toBeGreaterThan(0.9);
    expect(decay(0.02, 5)).toBe(0);
  });

  it("eases the visible level toward the real one", () => {
    const next = follow(0, 1, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(0.1);
    expect(follow(0.5, 0.5, 0.1)).toBe(0.5);
  });
});

describe("what the energy drives", () => {
  it("rests dim, then brightens the more you spin", () => {
    expect(glowFor(0)).toBeLessThan(0.25);
    expect(glowFor(1)).toBe(1);
    expect(exposureFor(0)).toBeLessThan(exposureFor(1));
  });

  it("shows no arcs or sparks until you start spinning", () => {
    expect(arcRate(0)).toBe(0);
    expect(sparkRate(0)).toBe(0);
    expect(arcRate(REST_THRESHOLD / 2)).toBe(0);
    expect(arcRate(0.2)).toBeGreaterThan(0);
    expect(sparkRate(0.2)).toBeGreaterThan(0);
  });

  it("throws more arcs and sparks as it winds up", () => {
    expect(arcRate(1)).toBeGreaterThan(arcRate(0.3));
    expect(sparkRate(1)).toBeGreaterThan(sparkRate(0.3));
  });
});
