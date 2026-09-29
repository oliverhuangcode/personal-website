"use client";

import { useEffect, useRef } from "react";
import type * as THREE from "three";

// Colour channels mirror the tokens in globals.css: accent #b987ff, bg #08070c.
const ACC_HEX = 0xb987ff;
const ACC_RGB = "185,135,255";
const FOV = 38;
const MAX_DPR = 2;
const POOL_MOTES = 160;
/** Steady brightness of the device's lights, 0–1. Held constant: no heartbeat, no flare. */
const GLOW = 0.5;
const ARC_SEGMENTS = 40;
/**
 * Arc ribbon layers, widest and faintest first: [width in px at S = 130, alpha, tint].
 * Bloom supplies the wide, soft falloff, so only the body and hot core are drawn.
 */
const ARC_LAYERS = [
  [10, 0.1, "acc"],
  [5, 0.28, "acc"],
  [2.6, 0.6, "mid"],
  [1.2, 0.85, "hot"],
] as const;
const TINT = { acc: [185, 135, 255], mid: [236, 220, 255], hot: [255, 250, 255] } as const;

/**
 * Arcs of light that revolve around the spike on tilted orbits, each a bright head with a
 * fading tail. Radii and heights keep them clear of the claws, horns and cables.
 * `speed` is rad/s (sign is direction); `span` is the tail length in radians.
 */
const ARCS = [
  { r: 0.84, y: 0.15, tilt: 0.3, node: 0.0, speed: 0.9, span: 2.4, phase: 0.0 },
  { r: 0.98, y: -0.28, tilt: -0.2, node: 2.1, speed: -0.65, span: 2.0, phase: 2.4 },
  { r: 0.76, y: 0.52, tilt: 0.18, node: 4.2, speed: 1.15, span: 1.7, phase: 4.1 },
  { r: 1.04, y: -0.6, tilt: 0.1, node: 1.0, speed: -0.5, span: 2.8, phase: 1.3 },
] as const;

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
 * The home page's holographic spike as a real 3D scene: a detailed, softly lit device
 * with arcs of light revolving around it and motes drifting off the core. The glow is
 * steady. The wheel spins it and the pointer tilts the camera. Under reduced motion it
 * renders one still frame.
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
      renderer.toneMappingExposure = 1.05;
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
      scene.environmentIntensity = 0.32;

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
      scene.add(key, rimLight, new T.HemisphereLight(0x8a86a0, 0x08070c, 0.15));

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

      // ── Light ribbons ─────────────────────────────────────────────────
      // One mesh per flash holding all its layers. Camera-facing quads are rebuilt each frame.
      const L = ARC_LAYERS.length;
      const rowVerts = (ARC_SEGMENTS + 1) * 2;
      const ribbonIndex = (() => {
        const idx: number[] = [];
        for (let l = 0; l < L; l++) {
          for (let k = 0; k < ARC_SEGMENTS; k++) {
            const a = l * rowVerts + k * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
        }
        return idx;
      })();
      const ribbonMat = new T.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
        side: T.DoubleSide,
      });
      const ribbons = ARCS.map(() => {
        const geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.BufferAttribute(new Float32Array(L * rowVerts * 3), 3));
        geo.setAttribute("color", new T.BufferAttribute(new Float32Array(L * rowVerts * 4), 4));
        geo.setIndex(ribbonIndex);
        const m = new T.Mesh(geo, ribbonMat);
        m.frustumCulled = false;
        m.renderOrder = 3;
        group.add(m);
        return m;
      });

      // ── Motes ─────────────────────────────────────────────────────────
      const mPos = new Float32Array(POOL_MOTES * 3);
      const mSize = new Float32Array(POOL_MOTES);
      const mAlpha = new Float32Array(POOL_MOTES);
      const motes = Array.from({ length: POOL_MOTES }, () => ({ live: false, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1 }));
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

        // Steady light: the device, bloom and haze hold one level; only mechanical parts move.
        model.update({ t, dt: reduced ? 0 : dt, glow: GLOW });
        // Bloom blurs in screen pixels, so on a small canvas the same glow covers far more of the
        // object and the page. Scale it with the device's on-screen size.
        const bloomK = Math.min(1, Math.max(0.45, S / 160));
        bloom.strength = 0.32 * bloomK;
        bloom.radius = 0.28 * bloomK;
        haze.material.opacity = 0.012;
        haze.scale.set(6.4, 6.4, 1);
        poolMat.opacity = 0.05;

        // Camera position in the group's frame, for billboarding the ribbons.
        camPos.copy(camera.position);
        group.worldToLocal(camPos);

        // Arcs of light revolving around the spike: a bright head and a fading tail on a tilted
        // orbit. Built as camera-facing ribbons so they stay the same width from any angle, and
        // depth-tested so they pass behind the device.
        ARCS.forEach((arc, ai) => {
          const mesh = ribbons[ai];
          const head = arc.phase + arc.speed * t;
          const dir = Math.sign(arc.speed);
          const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
          const col = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
          const cl: number[] = [];
          for (let k = 0; k <= ARC_SEGMENTS; k++) {
            const u = k / ARC_SEGMENTS;
            const ang = head - dir * u * arc.span;
            // A faint shimmer in radius keeps the line from reading as a rigid wire.
            const rr = arc.r + Math.sin(u * 7 + ai * 1.7 + t * 3) * 0.008;
            const yy = arc.y + Math.sin(ang - arc.node) * arc.tilt * rr;
            cl.push(Math.cos(ang) * rr, yy, Math.sin(ang) * rr);
          }
          for (let k = 0; k <= ARC_SEGMENTS; k++) {
            const u = k / ARC_SEGMENTS;
            // Rounded head, long soft tail.
            const shape = Math.min(1, u * 14) * Math.pow(1 - u, 1.6);
            const a = Math.max(0, k - 1) * 3;
            const b = Math.min(ARC_SEGMENTS, k + 1) * 3;
            tmpA.set(cl[b] - cl[a], cl[b + 1] - cl[a + 1], cl[b + 2] - cl[a + 2]); // tangent
            viewLocal.set(camPos.x - cl[k * 3], camPos.y - cl[k * 3 + 1], camPos.z - cl[k * 3 + 2]);
            side.crossVectors(tmpA, viewLocal).normalize();
            for (let l = 0; l < L; l++) {
              const [w, al, tint] = ARC_LAYERS[l];
              const half = (w / 130) * (0.35 + 0.65 * shape) * 0.5;
              const v = l * rowVerts + k * 2;
              tmpB.set(cl[k * 3], cl[k * 3 + 1], cl[k * 3 + 2]);
              pos.setXYZ(v, tmpB.x + side.x * half, tmpB.y + side.y * half, tmpB.z + side.z * half);
              pos.setXYZ(v + 1, tmpB.x - side.x * half, tmpB.y - side.y * half, tmpB.z - side.z * half);
              const [r, g, bl] = TINT[tint];
              const alpha = al * shape * 0.8;
              col.setXYZW(v, r / 255, g / 255, bl / 255, alpha);
              col.setXYZW(v + 1, r / 255, g / 255, bl / 255, alpha);
            }
          }
          pos.needsUpdate = col.needsUpdate = true;
        });

        // Motes drift up off the core at a slow, steady rate.
        if (!reduced) {
          for (let i = spawnCount(4 * dt); i > 0; i--) {
            const free = motes.findIndex((m) => !m.live);
            if (free < 0) break;
            const ang = Math.random() * Math.PI * 2;
            const r = 0.2 + Math.random() * 0.5;
            tmpA.set(Math.cos(ang) * r, 0.6 - Math.random() * 1.3, Math.sin(ang) * r).applyMatrix4(group.matrixWorld);
            mPos.set([tmpA.x, tmpA.y, tmpA.z], free * 3);
            Object.assign(motes[free], {
              live: true,
              vx: (Math.random() - 0.5) * 0.08,
              vy: 0.07 + Math.random() * 0.2,
              vz: (Math.random() - 0.5) * 0.08,
              life: 0,
              max: 1.2 + Math.random() * 1.6,
              r: 1 + Math.random() * 2.2,
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
            m.vx += (Math.random() - 0.5) * 0.04 * dt * 60 * 0.1;
            mPos[i * 3] += m.vx * dt;
            mPos[i * 3 + 1] += m.vy * dt;
            mPos[i * 3 + 2] += m.vz * dt;
            mAlpha[i] = Math.sin((m.life / m.max) * Math.PI) * 0.55;
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
      };
      const onPointerMove = (e: PointerEvent) => {
        mouseX = e.clientX / window.innerWidth - 0.5;
        mouseY = e.clientY / window.innerHeight - 0.5;
      };
      const ro = new ResizeObserver(() => resize());
      ro.observe(canvas);

      window.addEventListener("wheel", onWheel, { passive: true });
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
