import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import { bevelledPart } from "./bevel";
import type { Part } from "./spike";

/**
 * The detailed 3D spike: a machined, three-way symmetric device in the spirit of Valorant's
 * Spike. Armoured base on three clawed feet, a glass chamber holding an energy core, a
 * casing ring that rises as it charges, braced struts, cables, and a crowned cap.
 *
 * World units, y up. The floor is at y = −1.04 and the emitter tops out near 1.33, the same
 * envelope as the flat drawing in `spike.ts`, so the page layout does not move.
 *
 * Everything that animates is driven from `update()` with the same charge / flare / heartbeat
 * signals the scene already computes; this module owns no clock of its own.
 */

// ── Palette ────────────────────────────────────────────────────────────────
// Accent #b987ff mirrors the site token; the hot white is the same hue pushed to white.
const ACC = new THREE.Color(0xb987ff);
const HOT = new THREE.Color(0xf4ecff);

const FLOOR = -1.04;
const TAU = Math.PI * 2;
/** Corners of the triangular body point at the feet and struts. */
const T0 = Math.PI / 2;
const CORNERS = [T0, T0 + TAU / 3, T0 + (2 * TAU) / 3];
/** Face centres sit halfway between corners. */
const FACES = CORNERS.map((a) => a + Math.PI / 3);

export interface SpikeFrame {
  /** Seconds since start (0 under reduced motion). */
  t: number;
  dt: number;
  /** 0–1: how armed the device is. */
  charge: number;
  /** 0–1: the peak flare. */
  flare: number;
  /** Heartbeat phase in radians; it advances faster as the charge climbs. */
  beatPhase: number;
  /** Overall glow multiplier the scene derives from the above. */
  glowK: number;
}

export interface SpikeModel {
  group: THREE.Group;
  update(f: SpikeFrame): void;
  dispose(): void;
}

// ── Geometry helpers ───────────────────────────────────────────────────────

/** A rounded triangular (or n-sided) prism between two world heights, via the shared bevel builder. */
function prism(sides: number, rBot: number, rTop: number, yBot: number, yTop: number, off = T0): THREE.BufferGeometry {
  const part: Part = {
    shape: "prism",
    name: "",
    sides,
    rTop,
    rBot,
    // Part space is y-down.
    y0: -yTop,
    y1: -yBot,
    off,
    kind: "shell",
  };
  return bevelledPart(part);
}

/** A bevelled box standing at `ang`, `rad` from the axis, between two world heights. */
function post(ang: number, rad: number, w: number, d: number, yBot: number, yTop: number, taper = 1): THREE.BufferGeometry {
  return bevelledPart({ shape: "box", name: "", ang, rad, w, d, y0: -yTop, y1: -yBot, taper, kind: "shell" });
}

/**
 * A side profile in (radial, y) extruded tangentially by `width`, then turned to face `ang`.
 * Used for the claws and the crown's horns, which no prism can describe.
 */
function profile(points: [number, number][], width: number, ang: number, bevel = 0.012): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([r, y]) => new THREE.Vector2(r, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  // Shape x is radial; rotating by −ang sends +x to (cos ang, 0, sin ang).
  // rotateY carries the extrusion's own smooth bevel normals with it.
  geo.rotateY(-ang);
  return geo;
}

/** Place a small object on a sloped face: centred at `pos`, its +z along `normal`. */
function onFace(obj: THREE.Object3D, pos: THREE.Vector3, normal: THREE.Vector3): THREE.Object3D {
  obj.position.copy(pos);
  obj.lookAt(pos.clone().add(normal));
  return obj;
}

/**
 * The outward normal and a point on the face of a rounded triangular prism, at face angle
 * `phi` and height `y`. The inradius of a triangle is half its circumradius.
 */
function faceFrame(phi: number, rBot: number, rTop: number, yBot: number, yTop: number, y: number) {
  const k = (y - yBot) / (yTop - yBot);
  const inBot = rBot / 2;
  const inTop = rTop / 2;
  const r = inBot + (inTop - inBot) * k;
  const tilt = Math.atan2(inBot - inTop, yTop - yBot);
  const dir = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
  const normal = new THREE.Vector3(Math.cos(phi) * Math.cos(tilt), Math.sin(tilt), Math.sin(phi) * Math.cos(tilt));
  return { pos: dir.multiplyScalar(r).setY(y), normal, tangent: new THREE.Vector3(-Math.sin(phi), 0, Math.cos(phi)) };
}

/** A radial-gradient or drawn texture; falls back to a flat texel off the DOM (unit tests). */
function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  if (typeof document === "undefined") {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Shaders ────────────────────────────────────────────────────────────────

const VIEW_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying float vY;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vY = position.y;
    gl_Position = projectionMatrix * mv;
  }
`;

/** The energy column: fresnel rim, a hot centre, and bands of charge climbing it. */
const CORE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uCharge;
  uniform float uFlare;
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vV;
  varying float vY;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float rim = pow(1.0 - facing, 2.0);
    float centre = pow(facing, 5.0);
    float bands = 0.5 + 0.5 * sin(vY * 13.0 - uTime * (2.0 + uCharge * 7.0));
    bands = smoothstep(0.4, 1.0, bands) * (0.2 + uCharge * 0.8);
    float flicker = 0.92 + 0.08 * sin(uTime * 37.0 + vY * 5.0);
    float energy = (0.03 + rim * 0.6 + centre * (0.25 + uCharge * 1.2) + bands * 0.45) * flicker;
    energy *= 0.35 + uCharge * 1.05 + uFlare * 0.6;
    vec3 hot = mix(uColor, vec3(1.0), clamp(uCharge * 0.5 + uFlare * 0.45 + centre * 0.35, 0.0, 1.0));
    gl_FragColor = vec4(hot * energy, 1.0);
  }
`;

/** Glass: nearly invisible face-on, a crisp bright edge at grazing angles, tinted by the core. */
const GLASS_FRAG = /* glsl */ `
  uniform float uGlow;
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vV;
  varying float vY;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float edge = pow(1.0 - facing, 4.0);
    // Two faint horizontal reflection streaks, like a studio softbox on a tube.
    float streak = smoothstep(0.02, 0.0, abs(fract(vY * 0.9 + 0.2) - 0.5) - 0.45) * 0.05;
    float a = edge * 0.75 + streak + 0.008;
    vec3 c = mix(vec3(0.85, 0.82, 0.95), uColor, 0.45) * (0.5 + uGlow * 0.5);
    gl_FragColor = vec4(c * a, 1.0);
  }
`;

/** Expanding shockwave shell: bright only at its silhouette, fading as it grows. */
const SHELL_FRAG = /* glsl */ `
  uniform float uAlpha;
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vV;
  varying float vY;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float edge = pow(1.0 - facing, 3.0);
    gl_FragColor = vec4(uColor * edge * uAlpha, 1.0);
  }
`;

// ── The model ──────────────────────────────────────────────────────────────

export function buildSpikeModel(): SpikeModel {
  const group = new THREE.Group();
  group.name = "spike";
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const mat = <M extends THREE.Material>(m: M) => (materials.add(m), m);

  // Armour: lacquered gunmetal with a world-space wear pattern in the roughness, so broad
  // faces break up into satin and polished patches instead of reading as flat CG plastic.
  const armour = mat(
    new THREE.MeshPhysicalMaterial({
      color: 0x2c2a35,
      metalness: 0.85,
      roughness: 0.38,
      clearcoat: 0.65,
      clearcoatRoughness: 0.2,
      emissive: ACC,
      emissiveIntensity: 0,
    }),
  );
  armour.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWear;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWear = position * 9.0;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWear;
        float wearHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float wearNoise(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(wearHash(i), wearHash(i + vec3(1,0,0)), f.x), mix(wearHash(i + vec3(0,1,0)), wearHash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(wearHash(i + vec3(0,0,1)), wearHash(i + vec3(1,0,1)), f.x), mix(wearHash(i + vec3(0,1,1)), wearHash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        float wear = wearNoise(vWear) * 0.6 + wearNoise(vWear * 3.7) * 0.4;
        roughnessFactor = clamp(roughnessFactor * (0.7 + wear * 0.6), 0.08, 1.0);`,
      );
  };
  // Bright machined trim for brackets, pistons, bands and bolts.
  const trim = mat(new THREE.MeshPhysicalMaterial({ color: 0x8d8a9c, metalness: 1, roughness: 0.36, clearcoat: 0.2 }));
  // Matte black polymer for cables, vents and pads.
  const polymer = mat(new THREE.MeshStandardMaterial({ color: 0x111016, metalness: 0.1, roughness: 0.72 }));
  // Emissive trims are not tone mapped, so they stay saturated and bloom like a game's light strips.
  const seamMat = mat(new THREE.MeshBasicMaterial({ color: ACC, toneMapped: false }));
  const channelMat = mat(new THREE.MeshBasicMaterial({ color: ACC, toneMapped: false }));
  const underglowMat = mat(new THREE.MeshBasicMaterial({ color: ACC, toneMapped: false }));
  const emitterMat = mat(new THREE.MeshBasicMaterial({ color: HOT, toneMapped: false }));
  const filamentMat = mat(new THREE.MeshBasicMaterial({ color: HOT, toneMapped: false }));
  const coreMat = mat(
    new THREE.ShaderMaterial({
      vertexShader: VIEW_VERT,
      fragmentShader: CORE_FRAG,
      uniforms: { uTime: { value: 0 }, uCharge: { value: 0 }, uFlare: { value: 0 }, uColor: { value: ACC.clone() } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const glassMat = mat(
    new THREE.ShaderMaterial({
      vertexShader: VIEW_VERT,
      fragmentShader: GLASS_FRAG,
      uniforms: { uGlow: { value: 0 }, uColor: { value: ACC.clone() } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  const add = (geo: THREE.BufferGeometry, m: THREE.Material, name: string, shadow = true) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.name = name;
    if (shadow) mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // ── Base ────────────────────────────────────────────────────────────────
  add(prism(3, 0.9, 0.86, FLOOR, -0.9), armour, "plinth");
  const BODY = { rBot: 0.74, rTop: 0.6, yBot: -0.9, yTop: -0.62 };
  add(prism(3, BODY.rBot, BODY.rTop, BODY.yBot, BODY.yTop), armour, "body");
  add(prism(3, 0.685, 0.685, -0.757, -0.742), seamMat, "glowing seam", false);
  add(prism(3, 0.6, 0.5, -0.62, -0.48), armour, "collar");
  add(prism(3, 0.52, 0.52, -0.495, -0.47), trim, "collar band");

  // Face details on the body: an armour plate, vents, bolts, and a row of three light cells.
  const cells: THREE.Mesh[] = [];
  const cellMats: THREE.MeshBasicMaterial[] = [];
  FACES.forEach((phi, fi) => {
    const f = (y: number) => faceFrame(phi, BODY.rBot, BODY.rTop, BODY.yBot, BODY.yTop, y);
    const plate = f(-0.69);
    const plateMesh = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.1, 0.018, 2, 0.006), trim);
    plateMesh.name = `face plate ${fi + 1}`;
    plateMesh.castShadow = plateMesh.receiveShadow = true;
    group.add(onFace(plateMesh, plate.pos.clone().addScaledVector(plate.normal, 0.004), plate.normal));

    for (let i = 0; i < 3; i++) {
      const m = mat(new THREE.MeshBasicMaterial({ color: ACC, toneMapped: false }));
      cellMats.push(m);
      const cell = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.028, 0.012, 1, 0.004), m);
      cell.name = `light cell ${fi * 3 + i + 1}`;
      const p = plate.pos.clone().addScaledVector(plate.tangent, (i - 1) * 0.085).addScaledVector(plate.normal, 0.014);
      group.add(onFace(cell, p, plate.normal));
      cells.push(cell);
    }

    const vent = f(-0.84);
    for (let s = 0; s < 4; s++) {
      const slat = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.012, 0.012, 1, 0.004), polymer);
      slat.name = `vent ${fi + 1}.${s + 1}`;
      const p = vent.pos.clone().addScaledVector(vent.normal, 0.004);
      p.y += (s - 1.5) * 0.02;
      group.add(onFace(slat, p, vent.normal));
    }
    for (const side of [-1, 1]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 10), trim);
      bolt.name = "bolt";
      bolt.geometry.rotateX(Math.PI / 2);
      const p = plate.pos.clone().addScaledVector(plate.tangent, side * 0.2).addScaledVector(plate.normal, 0.008);
      group.add(onFace(bolt, p, plate.normal));
    }
  });

  // Three claws: a side profile with a knee, a heel and a toe, flanked by twin pistons.
  CORNERS.forEach((a, i) => {
    add(
      profile(
        [
          [0.5, -0.46],
          [0.64, -0.44],
          [0.78, -0.62],
          [0.96, -0.95],
          [1.04, FLOOR],
          [0.62, FLOOR],
          [0.6, -0.9],
          [0.52, -0.72],
        ],
        0.17,
        a,
      ),
      armour,
      `claw ${i + 1}`,
    );
    const radial = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    add(post(a, 0.95, 0.1, 0.07, FLOOR, FLOOR + 0.03), polymer, `claw pad ${i + 1}`);
    for (const side of [-1, 1]) {
      const from = radial.clone().multiplyScalar(0.6).setY(-0.52).addScaledVector(tangent, side * 0.11);
      const to = radial.clone().multiplyScalar(0.86).setY(-0.9).addScaledVector(tangent, side * 0.11);
      const len = from.distanceTo(to);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const up = to.clone().sub(from).normalize();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 12), trim);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, len * 0.5, 14), armour);
      for (const [m, off] of [
        [rod, 0],
        [sleeve, -len * 0.22],
      ] as const) {
        m.name = "piston";
        m.position.copy(mid).addScaledVector(up, off);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
        m.castShadow = true;
        group.add(m);
      }
    }
  });

  // ── Core chamber ────────────────────────────────────────────────────────
  const CH_BOT = -0.47;
  const CH_TOP = 0.86;
  const chH = CH_TOP - CH_BOT;
  const chMid = (CH_BOT + CH_TOP) / 2;

  const core = add(new THREE.CylinderGeometry(0.17, 0.17, chH - 0.04, 48, 1, true), coreMat, "energy core", false);
  core.position.y = chMid;
  core.renderOrder = 2;
  const filament = add(new THREE.CylinderGeometry(0.02, 0.02, chH - 0.06, 12, 1, true), filamentMat, "filament", false);
  filament.position.y = chMid;
  const glass = add(new THREE.CylinderGeometry(0.31, 0.31, chH, 64, 1, true), glassMat, "glass chamber", false);
  glass.position.y = chMid;
  glass.renderOrder = 3;

  for (const [y, name] of [
    [CH_BOT, "chamber base ring"],
    [CH_TOP, "chamber top ring"],
  ] as const) {
    const band = add(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 64), trim, name);
    band.position.y = y;
    const lip = add(new THREE.TorusGeometry(0.315, 0.007, 8, 64), seamMat, `${name} light`, false);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = y + (y === CH_BOT ? 0.035 : -0.035);
  }

  // Energy rings rise through the core; faster as it charges.
  const ringMats: THREE.MeshBasicMaterial[] = [];
  const energyRings = Array.from({ length: 4 }, (_, i) => {
    const m = mat(
      new THREE.MeshBasicMaterial({ color: HOT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    ringMats.push(m);
    const ring = add(new THREE.TorusGeometry(0.2, 0.008, 8, 48), m, `energy ring ${i + 1}`, false);
    ring.rotation.x = Math.PI / 2;
    return ring;
  });

  // A thin helix of light wound around the core.
  const helixPts = Array.from({ length: 160 }, (_, i) => {
    const u = i / 159;
    const ang = u * TAU * 3.5;
    return new THREE.Vector3(Math.cos(ang) * 0.245, CH_BOT + 0.05 + u * (chH - 0.1), Math.sin(ang) * 0.245);
  });
  const helixMat = mat(
    new THREE.MeshBasicMaterial({ color: ACC, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  const helix = add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts), 240, 0.0045, 6), helixMat, "helix", false);

  // Mid clamp: a band around the glass, braced to each strut.
  const clamp = add(new THREE.CylinderGeometry(0.345, 0.345, 0.06, 64), armour, "mid clamp");
  clamp.position.y = 0.12;
  CORNERS.forEach((a, i) => add(post(a, 0.39, 0.03, 0.05, 0.1, 0.14), trim, `clamp arm ${i + 1}`));

  // The casing ring: three armour segments that ride up the chamber as it charges.
  const casing = new THREE.Group();
  casing.name = "casing ring";
  CORNERS.forEach((a, i) => {
    const arc = TAU / 3 - 0.32;
    // Wider than the mid clamp, so the casing slides over it rather than through it.
    const seg = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.026, 10, 32, arc), armour);
    seg.name = `casing segment ${i + 1}`;
    seg.rotation.x = Math.PI / 2;
    seg.rotation.z = a + Math.PI / 3 - arc / 2;
    seg.castShadow = true;
    casing.add(seg);
    const light = new THREE.Mesh(new THREE.TorusGeometry(0.374, 0.005, 6, 32, arc), channelMat);
    light.rotation.copy(seg.rotation);
    casing.add(light);
  });
  group.add(casing);

  // ── Struts ──────────────────────────────────────────────────────────────
  CORNERS.forEach((a, i) => {
    add(post(a, 0.44, 0.06, 0.07, CH_BOT, CH_TOP), armour, `strut ${i + 1}`);
    add(post(a, 0.44, 0.085, 0.09, CH_BOT - 0.02, CH_BOT + 0.1), trim, `strut foot bracket ${i + 1}`);
    add(post(a, 0.44, 0.085, 0.09, CH_TOP - 0.1, CH_TOP + 0.02), trim, `strut head bracket ${i + 1}`);
    // A glowing channel on the face that looks at the core.
    add(post(a, 0.44 - 0.072, 0.012, 0.004, CH_BOT + 0.14, CH_TOP - 0.14), channelMat, `strut channel ${i + 1}`, false);
    const radial = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    for (const y of [CH_BOT + 0.04, CH_TOP - 0.04]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 10), polymer);
      bolt.name = "bolt";
      bolt.geometry.rotateX(Math.PI / 2);
      const p = radial.clone().multiplyScalar(0.495).setY(y);
      group.add(onFace(bolt, p, radial));
    }
  });

  // A cable up the outside of each strut, bracket to bracket, clipped to the strut at mid height.
  CORNERS.forEach((a, i) => {
    const radial = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const at = (r: number, y: number, side: number) => radial.clone().multiplyScalar(r).setY(y).addScaledVector(tangent, side);
    const curve = new THREE.CatmullRomCurve3([
      at(0.52, CH_BOT + 0.08, 0.035),
      at(0.555, -0.1, 0.045),
      at(0.545, 0.45, 0.045),
      at(0.52, CH_TOP - 0.08, 0.035),
    ]);
    add(new THREE.TubeGeometry(curve, 48, 0.014, 10), polymer, `cable ${i + 1}`);
    for (const u of [0.35, 0.7]) {
      const clip = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.006, 6, 16), trim);
      clip.name = "cable clip";
      const p = curve.getPoint(u);
      clip.position.copy(p);
      clip.lookAt(p.clone().add(curve.getTangent(u)));
      group.add(clip);
    }
  });

  // ── Cap ─────────────────────────────────────────────────────────────────
  add(prism(3, 0.64, 0.64, 0.858, 0.874), underglowMat, "cap underglow", false);
  add(prism(3, 0.66, 0.9, 0.86, 0.94), armour, "cap lip");
  const CROWN = { rBot: 0.9, rTop: 0.42, yBot: 0.94, yTop: 1.14 };
  add(prism(3, CROWN.rBot, CROWN.rTop, CROWN.yBot, CROWN.yTop), armour, "crown");
  add(prism(3, 0.28, 0.2, 1.14, 1.26), armour, "crown boss");
  add(new THREE.CylinderGeometry(0.075, 0.09, 0.05, 32), trim, "emitter housing").position.y = 1.285;
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 32), emitterMat, "emitter", false).position.y = 1.315;

  // Down-swept horns at the crown's corners.
  CORNERS.forEach((a, i) =>
    add(
      profile(
        [
          [0.7, 1.0],
          [0.92, 0.97],
          [1.06, 0.8],
          [1.0, 0.77],
          [0.87, 0.87],
          [0.72, 0.9],
        ],
        0.11,
        a,
        0.012,
      ),
      armour,
      `horn ${i + 1}`,
    ),
  );

  // A trim plate and two indicator lights on each crown face.
  FACES.forEach((phi, fi) => {
    const f = faceFrame(phi, CROWN.rBot, CROWN.rTop, CROWN.yBot, CROWN.yTop, 1.03);
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.07, 0.014, 2, 0.005), trim);
    plate.name = `crown plate ${fi + 1}`;
    plate.castShadow = true;
    group.add(onFace(plate, f.pos.clone().addScaledVector(f.normal, 0.004), f.normal));
    for (const side of [-1, 1]) {
      const light = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.018, 0.01, 1, 0.003), channelMat);
      light.name = "crown light";
      const p = f.pos.clone().addScaledVector(f.tangent, side * 0.06).addScaledVector(f.normal, 0.013);
      group.add(onFace(light, p, f.normal));
    }
  });

  // ── Floor HUD ring ──────────────────────────────────────────────────────
  const hudTex = canvasTexture(512, (g, s) => {
    const c = s / 2;
    g.strokeStyle = "rgba(185,135,255,1)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(c, c, s * 0.44, 0, TAU);
    g.stroke();
    g.lineWidth = 2;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU;
      const long = i % 6 === 0;
      const r0 = s * (long ? 0.4 : 0.415);
      g.globalAlpha = long ? 1 : 0.55;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      g.lineTo(c + Math.cos(a) * s * 0.43, c + Math.sin(a) * s * 0.43);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.lineWidth = 6;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      g.beginPath();
      g.arc(c, c, s * 0.47, a + 0.2, a + 0.75);
      g.stroke();
    }
  });
  textures.add(hudTex);
  const hudMat = mat(
    new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  const hud = add(new THREE.PlaneGeometry(3.1, 3.1), hudMat, "floor hud", false);
  hud.rotation.x = -Math.PI / 2;
  hud.position.y = FLOOR + 0.004;
  hud.renderOrder = 1;

  // Light spilling from the core onto the struts, clamp and the cap's underside.
  const coreLights = [-0.2, 0.55].map((y) => {
    const l = new THREE.PointLight(ACC, 0, 2.6, 1.8);
    l.position.set(0, y, 0);
    group.add(l);
    return l;
  });

  const hotCol = new THREE.Color();
  const pulse = (x: number, sharp: number) => Math.pow(Math.max(0, Math.sin(x)), sharp);

  return {
    group,
    update({ t, dt, charge, flare, beatPhase, glowK }) {
      const beat = pulse(beatPhase, 6);
      const white = Math.min(1, charge * 0.55 + flare * 0.45);
      hotCol.copy(ACC).lerp(HOT, white);

      armour.emissiveIntensity = glowK * 0.015;
      coreMat.uniforms.uTime.value = t;
      coreMat.uniforms.uCharge.value = charge + beat * 0.1;
      coreMat.uniforms.uFlare.value = flare;
      glassMat.uniforms.uGlow.value = Math.min(1.5, glowK);
      filamentMat.color.copy(HOT).multiplyScalar(0.55 + Math.min(glowK, 1.6) * 0.9);
      emitterMat.color.copy(HOT).multiplyScalar(0.4 + beat * 1.2 + flare);
      seamMat.color.copy(hotCol).multiplyScalar(0.55 + glowK * 0.8);
      underglowMat.color.copy(hotCol).multiplyScalar(0.35 + glowK * 0.6);
      channelMat.color.copy(hotCol).multiplyScalar(0.35 + beat * 0.9 + charge * 0.5);
      for (const l of coreLights) l.intensity = 0.15 + Math.min(glowK, 1.6) * 1.7;

      // Light cells chase around the body on every beat, like the device counting down.
      cellMats.forEach((m, i) => {
        const on = pulse(beatPhase - i * 0.33, 10);
        m.color.copy(hotCol).multiplyScalar(0.12 + on * (1.2 + charge));
      });

      // Energy rings climb the core and fade in and out at the ends.
      const climb = (0.2 + charge * 1.1) * dt;
      energyRings.forEach((ring, i) => {
        const span = CH_TOP - CH_BOT - 0.12;
        const base = ((ring.userData.u as number | undefined) ?? i / energyRings.length) + climb / span;
        const u = base % 1;
        ring.userData.u = u;
        ring.position.y = CH_BOT + 0.06 + u * span;
        ringMats[i].opacity = Math.sin(u * Math.PI) * (0.25 + charge * 0.75 + flare * 0.5);
        ring.scale.setScalar(1 + beat * 0.05);
      });

      helix.rotation.y = t * (0.6 + charge * 2.4);
      helixMat.opacity = 0.15 + charge * 0.5 + flare * 0.3;

      // The casing rides up as it charges and drops back on release.
      casing.position.y = -0.36 + Math.pow(charge, 1.4) * 1.0;
      casing.rotation.y = -t * 0.15;

      hud.rotation.z = t * 0.12;
      hudMat.opacity = 0.12 + beat * 0.12 + charge * 0.2 + flare * 0.3;
    },
    dispose() {
      group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      for (const m of materials) m.dispose();
      for (const tex of textures) tex.dispose();
    },
  };
}

// ── Shockwaves ─────────────────────────────────────────────────────────────

export interface Shockwaves {
  group: THREE.Group;
  /** Starts a wave; `strength` 0–1 scales its size and brightness. */
  fire(strength?: number): void;
  update(dt: number): void;
  dispose(): void;
}

const WAVE_TIME = 1.15;

/**
 * Detonation-style shockwaves: a bright ring racing out across the floor and a fresnel shell
 * expanding around the device, both fading as they grow. A small pool, reused.
 */
export function createShockwaves(count = 4): Shockwaves {
  const group = new THREE.Group();
  group.name = "shockwaves";
  const ringTex = canvasTexture(256, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2);
    grad.addColorStop(0, "rgba(185,135,255,0)");
    grad.addColorStop(0.72, "rgba(185,135,255,0.35)");
    grad.addColorStop(0.9, "rgba(244,236,255,1)");
    grad.addColorStop(1, "rgba(185,135,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
  const shellGeo = new THREE.SphereGeometry(1, 48, 32);
  const ringGeo = new THREE.PlaneGeometry(2, 2);
  const waves = Array.from({ length: count }, () => {
    const ringMat = new THREE.MeshBasicMaterial({
      map: ringTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = FLOOR + 0.006;
    ring.renderOrder = 1;
    const shellMat = new THREE.ShaderMaterial({
      vertexShader: VIEW_VERT,
      fragmentShader: SHELL_FRAG,
      uniforms: { uAlpha: { value: 0 }, uColor: { value: ACC.clone() } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.y = 0.1;
    ring.visible = shell.visible = false;
    group.add(ring, shell);
    return { ring, shell, ringMat, shellMat, age: -1, strength: 1 };
  });

  return {
    group,
    fire(strength = 1) {
      // Reuse the oldest wave if every slot is busy.
      const w = waves.find((x) => x.age < 0) ?? waves.reduce((a, b) => (a.age > b.age ? a : b));
      w.age = 0;
      w.strength = Math.min(1, Math.max(0.2, strength));
    },
    update(dt) {
      for (const w of waves) {
        if (w.age < 0) continue;
        w.age += dt;
        const k = w.age / WAVE_TIME;
        if (k >= 1) {
          w.age = -1;
          w.ring.visible = w.shell.visible = false;
          continue;
        }
        const ease = 1 - Math.pow(1 - k, 3);
        const fade = Math.pow(1 - k, 2) * w.strength;
        w.ring.visible = w.shell.visible = true;
        w.ring.scale.setScalar(0.6 + ease * 2.6 * (0.6 + w.strength * 0.4));
        w.ringMat.opacity = fade;
        w.shell.scale.setScalar(0.5 + ease * 2.4 * (0.6 + w.strength * 0.4));
        w.shellMat.uniforms.uAlpha.value = fade * 0.6;
      }
    },
    dispose() {
      shellGeo.dispose();
      ringGeo.dispose();
      ringTex.dispose();
      for (const w of waves) {
        w.ringMat.dispose();
        w.shellMat.dispose();
      }
    },
  };
}
