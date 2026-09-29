/**
 * How the 3D spike responds to being spun. Two signals, deliberately separate:
 *
 * - **Charge** builds with every scroll or swipe and drains slowly once you stop. It sets how
 *   bright the device glows, so it feels like it's charging up.
 * - **Activity** says whether you're spinning it right now. It spikes on each scroll and eases
 *   back to zero over about three seconds. Sparks and arcs spawn in proportion to it, so when you
 *   stop, the effects outside the device thin out and die away gradually rather than cutting off,
 *   while the glow lingers longer still.
 *
 * Pure functions, so the feel can be tuned and tested without a renderer.
 */

/** Energy gained per pixel of wheel travel: roughly fifteen notches from rest to full. */
export const SCROLL_GAIN = 0.00065;
/** Charge lost per second once you stop. Full to empty takes about twelve seconds. */
export const DECAY_PER_S = 0.08;
/** Activity gained per pixel of wheel travel: a single notch is enough to start effects. */
export const ACTIVITY_GAIN = 0.006;
/** Activity lost per second: it fades out over about three seconds after your last scroll. */
export const ACTIVITY_DECAY_PER_S = 0.35;
/** Below this you're not spinning it: no new sparks or arcs. */
export const ACTIVE_THRESHOLD = 0.05;
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

/** Marks the device as being spun right now, by a wheel or swipe delta in pixels. */
export function addActivity(activity: number, delta: number): number {
  return Math.min(1, activity + Math.abs(delta) * ACTIVITY_GAIN);
}

/** Lets activity fall away over `dt` seconds. */
export function settle(activity: number, dt: number): number {
  return Math.max(0, activity - ACTIVITY_DECAY_PER_S * dt);
}

/** Eases the level on screen toward the real energy, so changes glide rather than jump. */
export function follow(shown: number, energy: number, dt: number): number {
  return shown + (energy - shown) * Math.min(1, dt * FOLLOW_PER_S);
}

/** Device brightness (0–1): a dim silhouette at rest, climbing as it charges. */
export function glowFor(shown: number): number {
  return 0.25 + shown * 0.75;
}

/**
 * Tone-mapping exposure: barely moves. Spinning brightens the core, its glow and the sparks,
 * not the outer shell, which stays dark because the light is inside it.
 */
export function exposureFor(shown: number): number {
  return 0.62 + shown * 0.12;
}

/**
 * Clusters of 2–4 sparks per second. Nothing unless you're spinning it right now; while you
 * are, more come the higher the charge.
 */
export function arcRate(shown: number, activity: number): number {
  return activity < ACTIVE_THRESHOLD ? 0 : activity * (0.8 + shown * 4.5);
}

/** Sparks per second thrown off the core, on the same terms as the arcs. */
export function sparkRate(shown: number, activity: number): number {
  return activity < ACTIVE_THRESHOLD ? 0 : activity * (6 + Math.pow(shown, 1.2) * 50);
}
