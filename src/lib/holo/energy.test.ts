import { describe, expect, it } from "vitest";

import {
  ACTIVE_THRESHOLD,
  addActivity,
  addSpin,
  arcRate,
  decay,
  exposureFor,
  follow,
  glowFor,
  settle,
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
    expect(glowFor(0)).toBeLessThan(0.3);
    expect(glowFor(1)).toBe(1);
    expect(exposureFor(0)).toBeLessThan(exposureFor(1));
  });

  it("spawns nothing unless you're spinning it right now", () => {
    expect(arcRate(0, 0)).toBe(0);
    expect(sparkRate(0, 0)).toBe(0);
    // Fully charged but not being spun: the glow stays, the effects don't.
    expect(arcRate(1, 0)).toBe(0);
    expect(sparkRate(1, 0)).toBe(0);
    expect(arcRate(1, ACTIVE_THRESHOLD / 2)).toBe(0);
  });

  it("throws more arcs and sparks the higher the charge while spinning", () => {
    expect(arcRate(0.1, 1)).toBeGreaterThan(0);
    expect(sparkRate(0.1, 1)).toBeGreaterThan(0);
    expect(arcRate(1, 1)).toBeGreaterThan(arcRate(0.3, 1));
    expect(sparkRate(1, 1)).toBeGreaterThan(sparkRate(0.3, 1));
  });
});

describe("activity", () => {
  it("jumps up on a scroll, then fades out gradually over a few seconds", () => {
    let x = 0;
    for (let i = 0; i < 10; i++) x = addActivity(x, 120);
    expect(x).toBe(1);
    const after = (seconds: number) => {
      let y = x;
      for (let i = 0; i < seconds * 60; i++) y = settle(y, 1 / 60);
      return y;
    };
    // Still sparking a second after you stop, just less…
    expect(after(1)).toBeGreaterThan(ACTIVE_THRESHOLD);
    expect(sparkRate(1, after(1))).toBeLessThan(sparkRate(1, 1));
    // …and quiet a few seconds later.
    expect(after(3.5)).toBeLessThan(ACTIVE_THRESHOLD);
  });

  it("stops the effects long before the charge runs down", () => {
    let charge = 0;
    let act = 0;
    for (let i = 0; i < 20; i++) {
      charge = addSpin(charge, 120);
      act = addActivity(act, 120);
    }
    for (let i = 0; i < 4 * 60; i++) {
      charge = decay(charge, 1 / 60);
      act = settle(act, 1 / 60);
    }
    expect(sparkRate(charge, act)).toBe(0);
    expect(glowFor(charge)).toBeGreaterThan(0.7);
  });
});
