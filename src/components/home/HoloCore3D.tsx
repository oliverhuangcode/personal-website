"use client";

import { useEffect, useRef } from "react";
import type * as THREE from "three";

import { trianglesOf } from "@/lib/holo/geometry";
import { CYCLE, REST, buildSpike, chargeAt } from "@/lib/holo/spike";

// Colour channels mirror the tokens in globals.css: accent #b987ff, bg #08070c.
const ACC_HEX = 0xb987ff;
const ACC_RGB = "185,135,255";
const FOV = 38;
const MAX_DPR = 2;
const POOL_FLASHES = 18;
const POOL_MOTES = 160;
const FLASH_SEGMENTS = 22;
/** Flash ribbon layers, widest and faintest first: [width in px at S = 130, alpha, tint]. */
const FLASH_LAYERS = [
  [56, 0.03, "acc"],
  [32, 0.06, "acc"],
  [17, 0.12, "acc"],
  [8.5, 0.3, "acc"],
  [4.2, 0.75, "mid"],
  [2, 1, "hot"],
] as const;
const TINT = { acc: [185, 135, 255], mid: [236, 220, 255], hot: [255, 250, 255] } as const;

interface Flash {
  live: boolean;
  y: number;
  r: number;
  tilt: number;
  a: number;
  /** Angular speed, rad/s; the sign is the direction of travel. */
  w: number;
  span: number;
  ph: number;
  life: number;
  max: number;
  amp: number;
}

function newFlash(hot: boolean): Flash {
  return {
    live: true,
    y: -0.75 + Math.random() * 1.3,
    r: 0.3 + Math.random() * 0.28,
    tilt: (Math.random() - 0.5) * 0.5,
    a: Math.random() * Math.PI * 2,
    w: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 7),
    span: 0.9 + Math.random() * 1.6 + (hot ? 0.8 : 0),
    ph: Math.random() * 10,
    life: 0,
    max: 0.14 + Math.random() * 0.26,
    amp: 0.7 + Math.random() * 0.5,
  };
}

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

interface HoloCore3DProps {
  /** Called if WebGL or the 3D library is unavailable, so the caller can fall back to 2D. */
  onUnsupported: () => void;
}

/**
 * The home page's holographic spike as a real 3D scene: a lit, faceted device whose
 * core charges, flares and releases on a loop, with ribbons of light whipping
 * around it. The wheel spins it, a press kicks the charge, and the pointer tilts
 * the camera. Under reduced motion it renders one still frame.
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
      try {
        T = await import("three");
        if (cancelled) return;
        renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
      } catch {
        if (!cancelled) onUnsupported();
        return;
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setClearColor(0x000000, 0);
      canvas.dataset.renderer = "webgl";

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(FOV, 1, 0.1, 50);
      const group = new T.Group();
      // The old view sat the device a little below centre so the name has room above it.
      group.position.y = -0.13;
      scene.add(group);

      // ── The device ────────────────────────────────────────────────────
      const faces = buildSpike();
      const meshGeo = (kind: "shell" | "core" | "seam") => {
        const { positions, normals } = trianglesOf(faces, kind);
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.BufferAttribute(positions, 3));
        g.setAttribute("normal", new T.BufferAttribute(normals, 3));
        return g;
      };
      const shellGeo = meshGeo("shell");
      const shellMat = new T.MeshStandardMaterial({
        color: 0x2c2a36,
        roughness: 0.42,
        metalness: 0.3,
        emissive: ACC_HEX,
        emissiveIntensity: 0,
      });
      const shell = new T.Mesh(shellGeo, shellMat);
      const edges = new T.LineSegments(
        new T.EdgesGeometry(shellGeo, 20),
        new T.LineBasicMaterial({ color: 0x08070c, transparent: true, opacity: 0.6 }),
      );
      const glowMat = () =>
        new T.MeshBasicMaterial({
          color: ACC_HEX,
          transparent: true,
          blending: T.AdditiveBlending,
          depthWrite: false,
          side: T.DoubleSide,
        });
      const coreMat = glowMat();
      const seamMat = glowMat();
      const core = new T.Mesh(meshGeo("core"), coreMat);
      const seam = new T.Mesh(meshGeo("seam"), seamMat);
      core.renderOrder = seam.renderOrder = 2;
      group.add(shell, edges, core, seam);

      // Light spilling from the core onto the inside faces of the struts and cap.
      const coreLight = new T.PointLight(ACC_HEX, 0, 3.2, 1.6);
      coreLight.position.set(0, 0.2, 0);
      group.add(coreLight);
      const key = new T.DirectionalLight(0xf2eeff, 3.1);
      key.position.set(-2.25, 4, 2.75);
      const rimLight = new T.DirectionalLight(ACC_HEX, 1.1);
      rimLight.position.set(3, 1, -3);
      scene.add(key, rimLight, new T.HemisphereLight(0x8a86a0, 0x08070c, 0.22));

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
      group.add(pool);

      // ── Light ribbons ─────────────────────────────────────────────────
      // One mesh per flash holding all its layers. Camera-facing quads are rebuilt each frame.
      const L = FLASH_LAYERS.length;
      const rowVerts = (FLASH_SEGMENTS + 1) * 2;
      const ribbonIndex = (() => {
        const idx: number[] = [];
        for (let l = 0; l < L; l++) {
          for (let k = 0; k < FLASH_SEGMENTS; k++) {
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
      const flashes: Flash[] = Array.from({ length: POOL_FLASHES }, () => ({ ...newFlash(false), live: false }));
      const ribbons = flashes.map(() => {
        const geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.BufferAttribute(new Float32Array(L * rowVerts * 3), 3));
        geo.setAttribute("color", new T.BufferAttribute(new Float32Array(L * rowVerts * 4), 4));
        geo.setIndex(ribbonIndex);
        const m = new T.Mesh(geo, ribbonMat);
        m.frustumCulled = false;
        m.visible = false;
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

      // ── State ─────────────────────────────────────────────────────────
      let spin = 0.35;
      let boost = 0;
      let tiltX = 0;
      let tiltY = 0;
      let mouseX = 0;
      let mouseY = 0;
      let cyc = REST * 0.6;
      let kick = 0;
      let beatPhase = 0;
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

        // Reduced motion holds a faint, steady glow.
        let charge = 0.15;
        let flare = 0;
        if (!reduced) {
          cyc = (cyc + dt * (1 + kick * 1.5)) % CYCLE;
          kick = Math.max(0, kick - dt * 0.25);
          ({ charge, flare } = chargeAt(cyc));
          charge = Math.min(1, charge + kick * 0.5);
          // The heartbeat quickens as it charges, like a device arming.
          beatPhase += dt * (0.9 + charge * charge * 5.5) * Math.PI * 2;
          boost *= 0.95;
          if (Math.abs(boost) < 0.0002) boost = 0;
          spin += 0.0035 + boost + charge * charge * 0.006;
          tiltX += (mouseY * 0.2 - tiltX) * 0.05;
          tiltY += (mouseX * 0.35 - tiltY) * 0.05;
        }
        const beat = 0.5 + 0.5 * Math.sin(beatPhase);
        const glowK = 0.55 + charge * 0.75 + beat * (0.08 + charge * 0.22) + flare * 0.9;

        // Camera: a fixed height above the device, distance set so 1 unit ≈ S px.
        const elev = 0.2 + tiltX;
        const dist = H / S / 2 / Math.tan((FOV * Math.PI) / 360);
        camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
        camera.lookAt(0, 0, 0);
        group.rotation.y = spin + tiltY;
        group.updateMatrixWorld(true);

        // Materials driven by the charge.
        shellMat.emissiveIntensity = glowK * 0.035;
        coreLight.intensity = 0.4 + glowK * 5;
        const white = Math.min(1, charge * 0.55 + flare * 0.45);
        coreMat.color.setRGB(185 / 255 + (1 - 185 / 255) * white, 135 / 255 + (1 - 135 / 255) * white, 1);
        coreMat.opacity = Math.min(1, (0.3 + 0.3 * 0.6) * glowK);
        seamMat.color.copy(coreMat.color);
        seamMat.opacity = Math.min(1, 0.5 * glowK);
        haze.material.opacity = 0.03 + charge * 0.07 + flare * 0.14;
        const hazeSize = (3 + charge * 1.2) * 2;
        haze.scale.set(hazeSize, hazeSize, 1);
        poolMat.opacity = Math.min(0.85, 0.2 * glowK);

        // Camera position in the group's frame, for billboarding the ribbons.
        camPos.copy(camera.position);
        group.worldToLocal(camPos);

        // Flashes spawn faster as the charge climbs.
        if (!reduced) {
          for (let i = spawnCount((0.5 + charge * charge * 13 + flare * 26) * dt); i > 0; i--) {
            const free = flashes.findIndex((f) => !f.live);
            if (free < 0) break;
            flashes[free] = newFlash(charge > 0.8);
          }
        }
        flashes.forEach((fl, fi) => {
          const mesh = ribbons[fi];
          if (fl.live && !reduced) {
            fl.life += dt;
            fl.a += fl.w * dt;
            if (fl.life >= fl.max) fl.live = false;
          }
          mesh.visible = fl.live;
          if (!fl.live) return;

          const env = Math.sin((fl.life / fl.max) * Math.PI);
          const inten = env * fl.amp * (0.55 + 0.45 * charge) + flare * 0.3;
          const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
          const col = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
          const cl: number[] = [];
          for (let k = 0; k <= FLASH_SEGMENTS; k++) {
            const u = k / FLASH_SEGMENTS;
            const ang = fl.a - Math.sign(fl.w) * u * fl.span;
            const rr = fl.r + Math.sin(u * 9 + fl.ph + t * 14) * 0.035;
            const yy = fl.y + Math.sin(ang) * fl.tilt * rr + Math.sin(u * 11 + fl.ph * 2 + t * 18) * 0.03;
            cl.push(Math.cos(ang) * rr, -yy, Math.sin(ang) * rr);
          }
          for (let k = 0; k <= FLASH_SEGMENTS; k++) {
            const u = k / FLASH_SEGMENTS;
            const shape = Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.6; // fat head, soft tail
            const a = Math.max(0, k - 1) * 3;
            const b = Math.min(FLASH_SEGMENTS, k + 1) * 3;
            tmpA.set(cl[b] - cl[a], cl[b + 1] - cl[a + 1], cl[b + 2] - cl[a + 2]); // tangent
            viewLocal.set(camPos.x - cl[k * 3], camPos.y - cl[k * 3 + 1], camPos.z - cl[k * 3 + 2]);
            side.crossVectors(tmpA, viewLocal).normalize();
            for (let l = 0; l < L; l++) {
              const [w, al, tint] = FLASH_LAYERS[l];
              const half = (w / 130) * (0.25 + 0.75 * shape) * 0.5;
              const v = l * rowVerts + k * 2;
              tmpB.set(cl[k * 3], cl[k * 3 + 1], cl[k * 3 + 2]);
              pos.setXYZ(v, tmpB.x + side.x * half, tmpB.y + side.y * half, tmpB.z + side.z * half);
              pos.setXYZ(v + 1, tmpB.x - side.x * half, tmpB.y - side.y * half, tmpB.z - side.z * half);
              const [r, g, bl] = TINT[tint];
              const alpha = al * inten * (0.3 + 0.7 * shape);
              col.setXYZW(v, r / 255, g / 255, bl / 255, alpha);
              col.setXYZW(v + 1, r / 255, g / 255, bl / 255, alpha);
            }
          }
          pos.needsUpdate = col.needsUpdate = true;
        });

        // Motes rise off the core, denser as it charges.
        if (!reduced) {
          for (let i = spawnCount((charge * charge * 28 + flare * 40) * dt); i > 0; i--) {
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

        renderer.render(scene, camera);
      };

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
        kick = Math.min(0.6, kick + Math.abs(e.deltaY) * 0.0015);
      };
      const onPointerMove = (e: PointerEvent) => {
        mouseX = e.clientX / window.innerWidth - 0.5;
        mouseY = e.clientY / window.innerHeight - 0.5;
      };
      const onPointerDown = () => {
        kick = Math.min(0.6, kick + 0.3);
      };
      const ro = new ResizeObserver(() => resize());
      ro.observe(canvas);

      window.addEventListener("wheel", onWheel, { passive: true });
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("visibilitychange", onVisibility);
      if (!document.hidden) start();

      function dispose() {
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
        });
        for (const mat of [shellMat, coreMat, seamMat, poolMat, ribbonMat, moteMat, haze.material]) mat.dispose();
        hazeTex.dispose();
        poolTex.dispose();
        renderer.dispose();
      }
      teardown = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("wheel", onWheel);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("visibilitychange", onVisibility);
        dispose();
      };
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [onUnsupported]);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 block size-full" />;
}
