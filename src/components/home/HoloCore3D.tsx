"use client";

import { useEffect, useRef } from "react";
import type * as THREE from "three";

import { addSpin, arcRate, decay, exposureFor, follow, glowFor, sparkRate } from "@/lib/holo/energy";

// Colour channels mirror the tokens in globals.css: accent #b987ff, bg #08070c.
const ACC_HEX = 0xb987ff;
const ACC_RGB = "185,135,255";
const FOV = 38;
const MAX_DPR = 2;
const POOL_SPARKS = 220;
const ARC_POOL = 7;
const ARC_SEGMENTS = 48;
/** Half-width of an arc ribbon in model units: room for the smoky flame around the core line. */
const ARC_HALF_WIDTH = 0.13;
const TAU = Math.PI * 2;

/**
 * A swirl of light around the device, like a ring of fire: a thin bright core line wrapped in
 * wispy flame that drifts along it, pale lavender at the head deepening to purple at the tail
 * (the site's accent family, no other hue). Each one
 * appears at a random radius, height and tilt, sweeps round in either direction for a second
 * or two, and fades.
 */
interface Arc {
  live: boolean;
  r: number;
  y: number;
  tilt: number;
  node: number;
  /** Head angle, radians. */
  a: number;
  /** Angular speed, rad/s; the sign is the direction of travel. */
  w: number;
  span: number;
  life: number;
  max: number;
  seed: number;
}

function newArc(): Arc {
  return {
    live: true,
    r: 0.7 + Math.random() * 0.36,
    y: -0.5 + Math.random() * 1.15,
    tilt: (Math.random() - 0.5) * 0.9,
    node: Math.random() * TAU,
    a: Math.random() * TAU,
    w: (Math.random() < 0.5 ? -1 : 1) * (1.3 + Math.random() * 2),
    span: 1.5 + Math.random() * 2.2,
    life: 0,
    max: 1 + Math.random() * 1.4,
    seed: Math.random() * 100,
  };
}

const ARC_VERT = /* glsl */ `
  attribute vec3 aInfo;
  attribute float aAlpha;
  varying vec3 vInfo;
  varying float vAlpha;
  void main() {
    vInfo = aInfo;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
/** vInfo: x = along the arc (0 head → 1 tail), y = across (0–1, core at 0.5), z = seed. */
const ARC_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vInfo;
  varying float vAlpha;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * n(p); p *= 2.07; a *= 0.5; }
    return s;
  }
  void main() {
    float u = vInfo.x;
    float d = abs(vInfo.y * 2.0 - 1.0);
    float seed = vInfo.z;
    // The core: a thin, hot line.
    float core = smoothstep(0.07, 0.0, d) + smoothstep(0.22, 0.0, d) * 0.25;
    // The flame: turbulent wisps that lick outward from the core and drift along the arc. Two
    // octave bands, one broad and slow, one fine and fast, so it reads as smoke, not blur.
    float broad = fbm(vec2(u * 7.0 + seed - uTime * 0.7, d * 2.2 - uTime * 1.4 + seed));
    float fine = fbm(vec2(u * 23.0 - uTime * 2.1 + seed * 3.0, d * 6.0 - uTime * 3.0));
    float flame = broad * 0.7 + fine * 0.45;
    float reach = d - (flame - 0.45) * 1.25;
    float smoke = smoothstep(0.9, 0.05, reach) * smoothstep(0.02, 0.35, flame);
    // Fade in at the head, burn out toward the tail.
    float along = smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.55, u);
    // Accent #b987ff family only: pale lavender head, deep purple tail.
    vec3 lavender = vec3(0.6, 0.44, 1.0);
    vec3 purple = vec3(0.4, 0.18, 0.86);
    vec3 col = mix(lavender, purple, smoothstep(0.2, 0.85, u));
    vec3 c = col * smoke * 0.95 + mix(col, vec3(1.0), 0.45) * core * 1.1;
    gl_FragColor = vec4(c * along * vAlpha, 1.0);
  }
`;

/** How many to spawn this frame when `expected` are due on average. */
function spawnCount(expected: number): number {
  let n = 0;
  for (let left = expected; left > 0; left -= 1) if (Math.random() < left) n++;
  return n;
}

function glowTexture(T: typeof THREE, stops: [number, string][]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [at, col] of stops) grad.addColorStop(at, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

const MOTE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uPx;
  void main() {
    vAlpha = aAlpha;
    gl_PointSize = aSize * uPx;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const MOTE_FRAG = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = pow(1.0 - d, 1.6) * vAlpha;
    gl_FragColor = vec4(vec3(0.90, 0.84, 1.0) * a, a);
  }
`;

/**
 * Resolves once the boot intro has finished, or at once if it isn't playing. Building the
 * scene compiles shaders, which can hold the main thread; the intro covers the spike anyway,
 * so waiting costs nothing visible and keeps the intro smooth.
 */
function afterIntro(): Promise<void> {
  const boot = document.querySelector<HTMLElement>(".boot-screen");
  const playing = boot && document.documentElement.dataset.boot !== "skip" && getComputedStyle(boot).display !== "none";
  if (!playing) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      boot.removeEventListener("animationend", onEnd);
      clearTimeout(timer);
      resolve();
    };
    const onEnd = (e: AnimationEvent) => {
      if (e.target === boot) done();
    };
    boot.addEventListener("animationend", onEnd);
    // Backstop in case the animation event never arrives (tab hidden, styles changed).
    const timer = setTimeout(done, 3200);
  });
}

/** Everything besides Three.js core that the scene needs, fetched in parallel with it. */
async function loadExtras() {
  const [composer, render, bloom, output, room, model] = await Promise.all([
    import("three/examples/jsm/postprocessing/EffectComposer.js"),
    import("three/examples/jsm/postprocessing/RenderPass.js"),
    import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
    import("three/examples/jsm/postprocessing/OutputPass.js"),
    import("three/examples/jsm/environments/RoomEnvironment.js"),
    import("@/lib/holo/model"),
  ]);
  return {
    EffectComposer: composer.EffectComposer,
    RenderPass: render.RenderPass,
    UnrealBloomPass: bloom.UnrealBloomPass,
    OutputPass: output.OutputPass,
    RoomEnvironment: room.RoomEnvironment,
    buildSpikeModel: model.buildSpikeModel,
  };
}

interface HoloCore3DProps {
  /** Called if WebGL or the 3D library is unavailable, so the caller can fall back to 2D. */
  onUnsupported: () => void;
}

/**
 * The home page's holographic spike as a real 3D scene: a detailed device that rests as a
 * dim silhouette behind the name. Scrolling (or swiping) spins it and winds it up: it slowly
 * brightens, throws sparks off its core, and arcs of fire start swirling around it; stop and
 * it runs back down. The pointer tilts the camera. Under reduced motion it renders one still
 * frame at rest.
 *
 * Three.js is imported on demand so it stays out of the page's first paint.
 */
export function HoloCore3D({ onUnsupported }: HoloCore3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let teardown = () => {};

    (async () => {
      let T: typeof THREE;
      let renderer: THREE.WebGLRenderer;
      let mods: Awaited<ReturnType<typeof loadExtras>>;
      try {
        [T, mods] = await Promise.all([import("three"), loadExtras(), afterIntro()]);
        if (cancelled) return;
        renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
      } catch {
        if (!cancelled) onUnsupported();
        return;
      }
      const { EffectComposer, RenderPass, UnrealBloomPass, OutputPass, RoomEnvironment, buildSpikeModel } = mods;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setClearColor(0x000000, 0);
      // Filmic response so highlights roll off instead of clipping, like a game engine's.
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = exposureFor(0);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFShadowMap;
      canvas.dataset.renderer = "webgl";

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(FOV, 1, 0.1, 50);
      const group = new T.Group();
      // The old view sat the device a little below centre so the name has room above it.
      group.position.y = -0.13;
      scene.add(group);

      // Reflections come from a studio environment: without one, metal has nothing to mirror
      // and reads as flat plastic.
      const pmrem = new T.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      // Low: a matte, stylised finish wants soft fill, not mirror reflections.
      scene.environmentIntensity = 0.16;

      // ── The device ────────────────────────────────────────────────────
      const model = buildSpikeModel();
      group.add(model.group);

      const key = new T.DirectionalLight(0xf2eeff, 2.6);
      key.position.set(-2.25, 4, 2.75);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = key.shadow.camera.bottom = -1.8;
      key.shadow.camera.right = key.shadow.camera.top = 1.8;
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 10;
      key.shadow.bias = -0.0006;
      key.shadow.normalBias = 0.02;
      key.shadow.radius = 4;
      // Accent rim from behind, so the silhouette separates from the dark page.
      const rimLight = new T.DirectionalLight(ACC_HEX, 1.5);
      rimLight.position.set(3, 1.5, -3);
      scene.add(key, rimLight, new T.HemisphereLight(0x9a94b8, 0x100e18, 0.45));

      // Soft contact shadow where the plinth meets the floor: what makes it sit, not float.
      const contactTex = glowTexture(T, [
        [0, "rgba(0,0,0,0.9)"],
        [0.55, "rgba(0,0,0,0.45)"],
        [1, "rgba(0,0,0,0)"],
      ]);
      const contactMat = new T.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false });
      const contact = new T.Mesh(new T.PlaneGeometry(2.3, 2.3), contactMat);
      contact.rotation.x = -Math.PI / 2;
      contact.position.y = -1.035;
      contact.renderOrder = 1;
      group.add(contact);

      // ── Haze and floor pool ───────────────────────────────────────────
      const hazeTex = glowTexture(T, [[0, `rgba(${ACC_RGB},1)`], [1, `rgba(${ACC_RGB},0)`]]);
      const haze = new T.Sprite(
        new T.SpriteMaterial({ map: hazeTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false }),
      );
      haze.position.set(0, 0.1, -1.2);
      scene.add(haze);

      const poolTex = glowTexture(T, [
        [0, "rgba(200,160,255,1)"],
        [0.4, `rgba(${ACC_RGB},0.3)`],
        [1, `rgba(${ACC_RGB},0)`],
      ]);
      const poolMat = new T.MeshBasicMaterial({
        map: poolTex,
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
      });
      const pool = new T.Mesh(new T.PlaneGeometry(5, 5), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = -1.03;
      pool.renderOrder = 1;
      group.add(pool);

      // ── Arcs of light ─────────────────────────────────────────────────
      // One camera-facing ribbon per arc, rebuilt each frame; the flame is drawn in the shader.
      const rowVerts = (ARC_SEGMENTS + 1) * 2;
      const ribbonIndex: number[] = [];
      for (let k = 0; k < ARC_SEGMENTS; k++) {
        const a = k * 2;
        ribbonIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const ribbonMat = new T.ShaderMaterial({
        vertexShader: ARC_VERT,
        fragmentShader: ARC_FRAG,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
        side: T.DoubleSide,
      });
      const arcs: Arc[] = Array.from({ length: ARC_POOL }, () => ({ ...newArc(), live: false }));
      const ribbons = arcs.map(() => {
        const geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.BufferAttribute(new Float32Array(rowVerts * 3), 3));
        geo.setAttribute("aInfo", new T.BufferAttribute(new Float32Array(rowVerts * 3), 3));
        geo.setAttribute("aAlpha", new T.BufferAttribute(new Float32Array(rowVerts), 1));
        geo.setIndex(ribbonIndex);
        const m = new T.Mesh(geo, ribbonMat);
        m.frustumCulled = false;
        m.visible = false;
        m.renderOrder = 3;
        group.add(m);
        return m;
      });

      // ── Motes ─────────────────────────────────────────────────────────
      const mPos = new Float32Array(POOL_SPARKS * 3);
      const mSize = new Float32Array(POOL_SPARKS);
      const mAlpha = new Float32Array(POOL_SPARKS);
      const motes = Array.from({ length: POOL_SPARKS }, () => ({ live: false, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1 }));
      const moteGeo = new T.BufferGeometry();
      moteGeo.setAttribute("position", new T.BufferAttribute(mPos, 3));
      moteGeo.setAttribute("aSize", new T.BufferAttribute(mSize, 1));
      moteGeo.setAttribute("aAlpha", new T.BufferAttribute(mAlpha, 1));
      const moteMat = new T.ShaderMaterial({
        vertexShader: MOTE_VERT,
        fragmentShader: MOTE_FRAG,
        uniforms: { uPx: { value: 1 } },
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
      });
      const points = new T.Points(moteGeo, moteMat);
      points.frustumCulled = false;
      points.renderOrder = 4;
      scene.add(points);

      // ── Post-processing ───────────────────────────────────────────────
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new T.Vector2(256, 256), 0.4, 0.28, 0.8);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());

      // ── State ─────────────────────────────────────────────────────────
      let spin = 0.35;
      let boost = 0;
      /** Spin energy (see lib/holo/energy): what scrolling winds up, and what's shown of it. */
      let energy = 0;
      let shown = 0;
      let lastReport = 0;
      let touchY: number | null = null;
      let tiltX = 0;
      let tiltY = 0;
      let mouseX = 0;
      let mouseY = 0;
      let W = 0;
      let H = 0;
      let S = 1;
      let raf = 0;
      let last = performance.now();
      const t0 = last;

      const resize = () => {
        const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        if (!W || !H) return false;
        renderer.setPixelRatio(dpr);
        renderer.setSize(W, H, false);
        composer.setPixelRatio(dpr);
        composer.setSize(W, H);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        // Px per model unit at the origin, matching the 2D version's sizing.
        S = Math.min(W * 0.18, H * 0.25);
        moteMat.uniforms.uPx.value = dpr * (S / 130);
        return true;
      };

      const camPos = new T.Vector3();
      const viewLocal = new T.Vector3();
      const tmpA = new T.Vector3();
      const tmpB = new T.Vector3();
      const side = new T.Vector3();

      const frame = (now: number) => {
        if (!W && !resize()) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = reduced ? 0 : (now - t0) / 1000;

        if (!reduced) {
          boost *= 0.95;
          if (Math.abs(boost) < 0.0002) boost = 0;
          spin += 0.0035 + boost;
          tiltX += (mouseY * 0.2 - tiltX) * 0.05;
          tiltY += (mouseX * 0.35 - tiltY) * 0.05;
        }

        // Camera: a fixed height above the device, distance set so 1 unit ≈ S px.
        const elev = 0.2 + tiltX;
        const dist = H / S / 2 / Math.tan((FOV * Math.PI) / 360);
        camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
        camera.lookAt(0, 0, 0);
        group.rotation.y = spin + tiltY;
        group.updateMatrixWorld(true);

        if (!reduced) {
          energy = decay(energy, dt);
          shown = follow(shown, energy, dt);
        }
        // Published for tests and debugging, a few times a second rather than every frame.
        if (now - lastReport > 250) {
          canvas.dataset.energy = Math.max(0, shown).toFixed(2);
          lastReport = now;
        }
        model.update({ t, dt: reduced ? 0 : dt, glow: glowFor(shown) });
        renderer.toneMappingExposure = exposureFor(shown);
        // Bloom blurs in screen pixels, so on a small canvas the same glow covers far more of the
        // object and the page. Scale it with the device's on-screen size.
        const bloomK = Math.min(1, Math.max(0.45, S / 160));
        bloom.strength = (0.2 + shown * 0.45) * bloomK;
        bloom.radius = 0.28 * bloomK;
        haze.material.opacity = 0.006 + shown * 0.03;
        haze.scale.set(6.4, 6.4, 1);
        poolMat.opacity = 0.02 + shown * 0.08;

        // Camera position in the group's frame, for billboarding the ribbons.
        camPos.copy(camera.position);
        group.worldToLocal(camPos);

        // Arcs of fire swirl up only once it's spinning, more often the more it's wound up.
        if (!reduced) {
          for (let i = spawnCount(arcRate(shown) * dt); i > 0; i--) {
            const free = arcs.findIndex((a) => !a.live);
            if (free < 0) break;
            arcs[free] = newArc();
          }
        }
        ribbonMat.uniforms.uTime.value = t;
        // Each is a camera-facing ribbon (same width from any angle), depth-tested so it passes
        // behind the device. The path is a smooth tilted circle with a slight breathing wobble.
        arcs.forEach((arc, ai) => {
          const mesh = ribbons[ai];
          if (arc.live && !reduced) {
            arc.life += dt;
            arc.a += arc.w * dt;
            if (arc.life >= arc.max) arc.live = false;
          }
          mesh.visible = arc.live;
          if (!arc.live) return;

          const k01 = arc.life / arc.max;
          const inten = Math.sin(k01 * Math.PI) * (0.6 + shown * 0.5);
          const dir = Math.sign(arc.w);
          const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
          const info = mesh.geometry.getAttribute("aInfo") as THREE.BufferAttribute;
          const alpha = mesh.geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
          const cl: number[] = [];
          for (let k = 0; k <= ARC_SEGMENTS; k++) {
            const u = k / ARC_SEGMENTS;
            const ang = arc.a - dir * u * arc.span;
            const rr = arc.r + Math.sin(u * 5 + arc.seed + t * 1.3) * 0.012;
            const yy = arc.y + Math.sin(ang - arc.node) * arc.tilt * rr;
            cl.push(Math.cos(ang) * rr, yy, Math.sin(ang) * rr);
          }
          for (let k = 0; k <= ARC_SEGMENTS; k++) {
            const u = k / ARC_SEGMENTS;
            const a = Math.max(0, k - 1) * 3;
            const b = Math.min(ARC_SEGMENTS, k + 1) * 3;
            tmpA.set(cl[b] - cl[a], cl[b + 1] - cl[a + 1], cl[b + 2] - cl[a + 2]); // tangent
            viewLocal.set(camPos.x - cl[k * 3], camPos.y - cl[k * 3 + 1], camPos.z - cl[k * 3 + 2]);
            side.crossVectors(tmpA, viewLocal).normalize();
            // Narrows slightly toward the tail, where the flame thins out.
            const half = ARC_HALF_WIDTH * (1 - u * 0.35);
            const v = k * 2;
            tmpB.set(cl[k * 3], cl[k * 3 + 1], cl[k * 3 + 2]);
            pos.setXYZ(v, tmpB.x + side.x * half, tmpB.y + side.y * half, tmpB.z + side.z * half);
            pos.setXYZ(v + 1, tmpB.x - side.x * half, tmpB.y - side.y * half, tmpB.z - side.z * half);
            info.setXYZ(v, u, 0, arc.seed);
            info.setXYZ(v + 1, u, 1, arc.seed);
            alpha.setX(v, inten);
            alpha.setX(v + 1, inten);
          }
          pos.needsUpdate = info.needsUpdate = alpha.needsUpdate = true;
        });

        // Sparks fly out from the core, thicker the more it's wound up.
        if (!reduced) {
          for (let i = spawnCount(sparkRate(shown) * dt); i > 0; i--) {
            const free = motes.findIndex((m) => !m.live);
            if (free < 0) break;
            const ang = Math.random() * TAU;
            tmpA.set(Math.cos(ang) * 0.1, -0.4 + Math.random() * 1.2, Math.sin(ang) * 0.1).applyMatrix4(group.matrixWorld);
            mPos.set([tmpA.x, tmpA.y, tmpA.z], free * 3);
            // Outward from the axis, in world space, with a little lift.
            const speed = 0.7 + Math.random() * 1.3;
            tmpB.set(Math.cos(ang) * speed, -0.1 + Math.random() * 0.6, Math.sin(ang) * speed).applyQuaternion(group.quaternion);
            Object.assign(motes[free], {
              live: true,
              vx: tmpB.x,
              vy: tmpB.y,
              vz: tmpB.z,
              life: 0,
              max: 0.4 + Math.random() * 0.7,
              r: 1.1 + Math.random() * 1.4,
            });
            mSize[free] = motes[free].r * 6;
          }
          motes.forEach((m, i) => {
            if (!m.live) {
              mAlpha[i] = 0;
              return;
            }
            m.life += dt;
            if (m.life >= m.max) {
              m.live = false;
              mAlpha[i] = 0;
              return;
            }
            // Air drag and a touch of gravity, so sparks arc and slow rather than fly straight.
            const drag = Math.max(0, 1 - dt * 1.4);
            m.vx *= drag;
            m.vz *= drag;
            m.vy = m.vy * drag - 0.5 * dt;
            mPos[i * 3] += m.vx * dt;
            mPos[i * 3 + 1] += m.vy * dt;
            mPos[i * 3 + 2] += m.vz * dt;
            mAlpha[i] = Math.pow(1 - m.life / m.max, 1.5) * 0.9;
          });
          moteGeo.getAttribute("position").needsUpdate = true;
          moteGeo.getAttribute("aSize").needsUpdate = true;
          moteGeo.getAttribute("aAlpha").needsUpdate = true;
        }

        composer.render();
      };

      // Compile every shader before the first frame. Where the browser supports parallel
      // compilation this happens off the main thread instead of freezing the page for a beat.
      try {
        await renderer.compileAsync(scene, camera);
      } catch {
        // Older drivers: the first render compiles synchronously instead.
      }
      if (cancelled) {
        model.dispose();
        renderer.dispose();
        return;
      }

      // Fade in once there is something to show, rather than popping in mid-page.
      requestAnimationFrame(() => (canvas.dataset.ready = ""));

      // Reduced motion: one still frame, redrawn only when the canvas resizes.
      if (reduced) {
        const ro = new ResizeObserver(() => {
          if (resize()) frame(performance.now());
        });
        ro.observe(canvas);
        teardown = () => {
          ro.disconnect();
          dispose();
        };
        return;
      }

      const loop = (now: number) => {
        frame(now);
        raf = requestAnimationFrame(loop);
      };
      const start = () => {
        cancelAnimationFrame(raf);
        last = performance.now();
        raf = requestAnimationFrame(loop);
      };
      const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start());
      const onWheel = (e: WheelEvent) => {
        boost = Math.max(-0.12, Math.min(0.12, boost + e.deltaY * 0.0006));
        energy = addSpin(energy, e.deltaY);
      };
      const onPointerMove = (e: PointerEvent) => {
        mouseX = e.clientX / window.innerWidth - 0.5;
        mouseY = e.clientY / window.innerHeight - 0.5;
      };
      const ro = new ResizeObserver(() => resize());
      ro.observe(canvas);

      // Phones have no wheel: a vertical swipe spins and winds it up the same way.
      const onTouchStart = (e: TouchEvent) => {
        touchY = e.touches[0]?.clientY ?? null;
      };
      const onTouchMove = (e: TouchEvent) => {
        const y = e.touches[0]?.clientY;
        if (y === undefined || touchY === null) return;
        const dy = (touchY - y) * 2;
        touchY = y;
        boost = Math.max(-0.12, Math.min(0.12, boost + dy * 0.0006));
        energy = addSpin(energy, dy);
      };
      window.addEventListener("wheel", onWheel, { passive: true });
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("pointermove", onPointerMove);
      document.addEventListener("visibilitychange", onVisibility);
      if (!document.hidden) start();

      function dispose() {
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
        });
        model.dispose();
        for (const mat of [contactMat, poolMat, ribbonMat, moteMat, haze.material]) mat.dispose();
        for (const tex of [hazeTex, poolTex, contactTex, envTex]) tex.dispose();
        pmrem.dispose();
        composer.dispose();
        renderer.dispose();
      }
      teardown = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("wheel", onWheel);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("visibilitychange", onVisibility);
        dispose();
      };
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [onUnsupported]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 block size-full opacity-0 transition-opacity duration-500 ease-out data-ready:opacity-100"
    />
  );
}
