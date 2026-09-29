/**
 * Geometry and timing for the home page's holographic spike.
 *
 * Model units: y grows downward and the device spans y −1.26 … 1.04, centred
 * on the y axis. Everything here is pure so it can be tested without a canvas.
 */

export type Vec3 = [x: number, y: number, z: number];
export type FaceKind = "shell" | "core" | "seam";

export interface Face {
  pts: Vec3[];
  /** Centre of the part the face belongs to, used to orient its normal outward. */
  centre: Vec3;
  kind: FaceKind;
}

const TAU = Math.PI * 2;
/** Prism corners pointing at the struts and feet. */
const T0 = Math.PI / 2;
/** Rotated a third of a turn from T0: faces toward the struts instead of corners. */
const T1 = T0 + Math.PI / 3;
const CORNERS = [T0, T0 + TAU / 3, T0 + (2 * TAU) / 3];

/** An n-sided prism (or frustum) between y0 and y1: its sides plus both caps. */
function prism(
  n: number,
  rTop: number,
  rBot: number,
  y0: number,
  y1: number,
  off: number,
  kind: FaceKind,
): Face[] {
  const ring = (r: number, y: number): Vec3[] =>
    Array.from({ length: n }, (_, i) => {
      const a = off + (i / n) * TAU;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    });
  const top = ring(rTop, y0);
  const bot = ring(rBot, y1);
  const centre: Vec3 = [0, (y0 + y1) / 2, 0];
  const faces: Face[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push({ pts: [top[i], top[j], bot[j], bot[i]], centre, kind });
  }
  faces.push({ pts: top.slice().reverse(), centre, kind });
  faces.push({ pts: bot, centre, kind });
  return faces;
}

/** A box sitting at angle `ang`, `rad` from the axis; `taper` shrinks its top. */
function box(
  ang: number,
  rad: number,
  w: number,
  d: number,
  y0: number,
  y1: number,
  taper: number,
  kind: FaceKind,
): Face[] {
  const cx = Math.cos(ang) * rad;
  const cz = Math.sin(ang) * rad;
  const ux = Math.cos(ang);
  const uz = Math.sin(ang);
  const vx = -uz;
  const vz = ux;
  const signs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const corner = (sw: number, sd: number, y: number, t: number): Vec3 => [
    cx + ux * sd * d * t + vx * sw * w * t,
    y,
    cz + uz * sd * d * t + vz * sw * w * t,
  ];
  const top = signs.map(([sw, sd]) => corner(sw, sd, y0, taper));
  const bot = signs.map(([sw, sd]) => corner(sw, sd, y1, 1));
  const centre: Vec3 = [cx, (y0 + y1) / 2, cz];
  const faces: Face[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    faces.push({ pts: [top[i], top[j], bot[j], bot[i]], centre, kind });
  }
  faces.push({ pts: top.slice().reverse(), centre, kind });
  faces.push({ pts: bot, centre, kind });
  return faces;
}

/**
 * The device as a list of parts, top to bottom. Both renderers build from this: the flat
 * canvas turns each part into hard-edged faces (`buildSpike`), the 3D scene into bevelled
 * meshes.
 */
export type Part =
  | { shape: "prism"; sides: number; rTop: number; rBot: number; y0: number; y1: number; off: number; kind: FaceKind; name: string }
  | { shape: "box"; ang: number; rad: number; w: number; d: number; y0: number; y1: number; taper: number; kind: FaceKind; name: string };

const P = (name: string, sides: number, rTop: number, rBot: number, y0: number, y1: number, off: number, kind: FaceKind): Part => ({
  shape: "prism",
  name,
  sides,
  rTop,
  rBot,
  y0,
  y1,
  off,
  kind,
});
const B = (name: string, ang: number, rad: number, w: number, d: number, y0: number, y1: number, taper: number): Part => ({
  shape: "box",
  name,
  ang,
  rad,
  w,
  d,
  y0,
  y1,
  taper,
  kind: "shell",
});

export const SPIKE_PARTS: readonly Part[] = [
  P("top boss", 3, 0.2, 0.28, -1.26, -1.14, T0, "shell"),
  P("faceted triangular cap", 3, 0.42, 0.9, -1.14, -0.94, T0, "shell"),
  P("cap lip", 3, 0.9, 0.66, -0.94, -0.86, T0, "shell"),
  P("triangular glow column", 3, 0.3, 0.3, -0.86, 0.5, T1, "core"),
  ...CORNERS.map((a, i) => B(`corner strut ${i + 1}`, a, 0.44, 0.06, 0.07, -0.87, 0.52, 1)),
  P("mid band", 3, 0.4, 0.4, -0.14, -0.06, T1, "shell"),
  P("collar taper", 3, 0.5, 0.6, 0.48, 0.62, T0, "shell"),
  P("thick body", 3, 0.6, 0.74, 0.62, 0.9, T0, "shell"),
  P("glowing seam", 3, 0.685, 0.685, 0.74, 0.755, T0, "seam"),
  P("plinth", 3, 0.82, 0.86, 0.9, 1.04, T0, "shell"),
  ...CORNERS.map((a, i) => B(`wedge foot ${i + 1}`, a, 0.76, 0.14, 0.2, 0.4, 1.04, 0.3)),
];

/** Every face of the device, top to bottom. */
export function buildSpike(): Face[] {
  return SPIKE_PARTS.flatMap((p) =>
    p.shape === "prism"
      ? prism(p.sides, p.rTop, p.rBot, p.y0, p.y1, p.off, p.kind)
      : box(p.ang, p.rad, p.w, p.d, p.y0, p.y1, p.taper, p.kind),
  );
}

// ── Charge cycle: rest → slow build → peak flare → release ────────────────

export const REST = 2.5;
export const BUILD = 7.5;
export const PEAK = 0.7;
export const RELEASE = 2.2;
export const CYCLE = REST + BUILD + PEAK + RELEASE;
export const CHARGE_FLOOR = 0.08;

const smoothstep = (x: number) => x * x * (3 - 2 * x);

/** Charge (0–1) and flare (0–1, only during the peak) at `c` seconds into the cycle. */
export function chargeAt(c: number): { charge: number; flare: number } {
  const t = ((c % CYCLE) + CYCLE) % CYCLE;
  const span = 1 - CHARGE_FLOOR;
  if (t < REST) return { charge: CHARGE_FLOOR, flare: 0 };
  if (t < REST + BUILD) return { charge: CHARGE_FLOOR + span * Math.pow((t - REST) / BUILD, 2.2), flare: 0 };
  if (t < REST + BUILD + PEAK) return { charge: 1, flare: Math.sin(((t - REST - BUILD) / PEAK) * Math.PI) };
  return { charge: CHARGE_FLOOR + span * (1 - smoothstep((t - REST - BUILD - PEAK) / RELEASE)), flare: 0 };
}

// ── View transform ────────────────────────────────────────────────────────

/** Spin about the vertical axis, then tilt toward the viewer about x. */
export function rotate(p: Vec3, spin: number, tilt: number): Vec3 {
  const c1 = Math.cos(spin);
  const s1 = Math.sin(spin);
  const x1 = p[0] * c1 + p[2] * s1;
  const z1 = -p[0] * s1 + p[2] * c1;
  const c2 = Math.cos(tilt);
  const s2 = Math.sin(tilt);
  return [x1, p[1] * c2 - z1 * s2, p[1] * s2 + z1 * c2];
}

/** Perspective onto the screen: scale `S` px per unit, camera `F` units back. Keeps z for depth tests. */
export function project(v: Vec3, cx: number, cy: number, S: number, F = 5): Vec3 {
  const k = F / (F + v[2]);
  return [cx + v[0] * S * k, cy + v[1] * S * k, v[2]];
}
