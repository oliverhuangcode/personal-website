/**
 * Spin energy for the 3D spike: scrolling winds it up, and it slowly runs down when you stop.
 * The scene reads it to set brightness, spawn sparks off the core, and let arcs of fire start
 * swirling around the device. Pure functions, so the feel can be tuned and tested without a
 * renderer.
 */

/** Energy gained per pixel of wheel travel: roughly fifteen notches from rest to full. */
export const SCROLL_GAIN = 0.00065;
/** Energy lost per second once you stop. Full to empty takes about twenty seconds. */
export const DECAY_PER_S = 0.05;
/** Below this the device is at rest: no arcs, no sparks. */
export const REST_THRESHOLD = 0.03;
/** How quickly the visible level follows the real one, per second. */
const FOLLOW_PER_S = 1.6;

/** Winds up the energy by a wheel or swipe delta, in pixels. */
export function addSpin(energy: number, delta: number): number {
  return Math.min(1, energy + Math.abs(delta) * SCROLL_GAIN);
}

/** Runs the energy down over `dt` seconds. */
export function decay(energy: number, dt: number): number {
  return Math.max(0, energy - DECAY_PER_S * dt);
}

/** Eases the level on screen toward the real energy, so changes glide rather than jump. */
export function follow(shown: number, energy: number, dt: number): number {
  return shown + (energy - shown) * Math.min(1, dt * FOLLOW_PER_S);
}

/** Device brightness (0–1): a dim silhouette at rest, climbing as it winds up. */
export function glowFor(shown: number): number {
  return 0.18 + shown * 0.82;
}

/** Tone-mapping exposure: the whole scene sits darker behind the name until you spin it. */
export function exposureFor(shown: number): number {
  return 0.55 + shown * 0.55;
}

/** Clusters of 2–4 sparks per second: none at rest, more often as it winds up. */
export function arcRate(shown: number): number {
  return shown < REST_THRESHOLD ? 0 : 0.8 + shown * 4.5;
}

/** Sparks per second thrown off the core. */
export function sparkRate(shown: number): number {
  return shown < REST_THRESHOLD ? 0 : Math.pow(shown, 1.2) * 55;
}
