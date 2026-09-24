"use client";

import { useEffect, useRef } from "react";

import { CYCLE, REST, type Vec3, buildSpike, chargeAt, project, rotate } from "@/lib/holo/spike";

// Colour channels mirror the tokens in globals.css: accent #b987ff, bg #08070c.
const ACC = [185, 135, 255];
const ACC_RGB = ACC.join(",");
const SHELL = [34, 32, 42];
const LIGHT: Vec3 = (() => {
  const v: Vec3 = [-0.45, -0.8, -0.55];
  const m = Math.hypot(...v);
  return v.map((x) => x / m) as Vec3;
})();
/** Flash stroke layers, widest and faintest first: [width, alpha]. */
const FLASH_LAYERS = [
  [56, 0.03],
  [32, 0.06],
  [17, 0.12],
  [8.5, 0.3],
  [4.2, 0.75],
  [2, 1],
] as const;
const FLASH_SEGMENTS = 22;
const MAX_DPR = 2;

interface Flash {
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

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
}

function spawnFlash(hot: boolean): Flash {
  return {
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

/**
 * The home page's holographic spike: a flat-shaded 3D device drawn on a 2D
 * canvas whose core charges, flares and releases on a loop, with arcs of light
 * whipping around it. The wheel spins it, a press kicks the charge, and the
 * pointer tilts it. Under reduced motion it draws one still frame.
 */
export function HoloCore() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const faces = buildSpike();

    let spin = 0.35;
    let boost = 0;
    let tiltX = 0;
    let tiltY = 0;
    let mouseX = 0;
    let mouseY = 0;
    let cyc = REST * 0.6;
    let kick = 0;
    let beatPhase = 0;
    let flashes: Flash[] = [];
    let motes: Mote[] = [];
    let raf = 0;
    let last = performance.now();
    const t0 = last;

    const frame = (now: number) => {
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
      }
      const beat = 0.5 + 0.5 * Math.sin(beatPhase);

      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      if (!reduced) {
        boost *= 0.95;
        if (Math.abs(boost) < 0.0002) boost = 0;
        spin += 0.0035 + boost + charge * charge * 0.006;
        tiltX += (mouseY * 0.2 - tiltX) * 0.05;
        tiltY += (mouseX * 0.35 - tiltY) * 0.05;
      }
      const glowK = 0.55 + charge * 0.75 + beat * (0.08 + charge * 0.22) + flare * 0.9;
      const S = Math.min(W * 0.18, H * 0.25);
      const cx = W / 2;
      const cy = H / 2 + S * 0.13;
      const view = (p: Vec3) => rotate(p, spin + tiltY, 0.2 + tiltX);
      const proj = (v: Vec3) => project(v, cx, cy, S);

      // Haze, then the pool of light on the floor.
      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * (3 + charge * 1.2));
      g.addColorStop(0, `rgba(${ACC_RGB},${(0.03 + charge * 0.07 + flare * 0.14).toFixed(3)})`);
      g.addColorStop(1, `rgba(${ACC_RGB},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const floorY = proj(view([0, 1, 0]))[1];
      ctx.save();
      ctx.translate(cx, floorY);
      ctx.scale(1, 0.26);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 2.5);
      g.addColorStop(0, `rgba(200,160,255,${Math.min(0.85, 0.2 * glowK).toFixed(3)})`);
      g.addColorStop(0.4, `rgba(${ACC_RGB},${Math.min(0.4, 0.06 * glowK).toFixed(3)})`);
      g.addColorStop(1, `rgba(${ACC_RGB},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, S * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Flashes spawn faster as the charge climbs.
      if (!reduced) {
        for (let i = spawnCount((0.5 + charge * charge * 13 + flare * 26) * dt); i > 0; i--) {
          flashes.push(spawnFlash(charge > 0.8));
        }
        flashes = flashes.filter((fl) => {
          fl.life += dt;
          fl.a += fl.w * dt;
          return fl.life < fl.max;
        });
      }

      const flashPass = (behind: boolean) => {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        for (const fl of flashes) {
          const env = Math.sin((fl.life / fl.max) * Math.PI);
          const inten = env * fl.amp * (0.55 + 0.45 * charge) + flare * 0.3;
          const pts: Vec3[] = [];
          for (let k = 0; k <= FLASH_SEGMENTS; k++) {
            const u = k / FLASH_SEGMENTS;
            const ang = fl.a - Math.sign(fl.w) * u * fl.span;
            const rr = fl.r + Math.sin(u * 9 + fl.ph + t * 14) * 0.035;
            const yy = fl.y + Math.sin(ang) * fl.tilt * rr + Math.sin(u * 11 + fl.ph * 2 + t * 18) * 0.03;
            pts.push(proj(view([Math.cos(ang) * rr, yy, Math.sin(ang) * rr])));
          }
          FLASH_LAYERS.forEach(([w, al], li) => {
            const tint = li >= 5 ? "255,250,255" : li === 4 ? "236,220,255" : ACC_RGB;
            for (let k = 0; k < FLASH_SEGMENTS; k++) {
              const zc = (pts[k][2] + pts[k + 1][2]) / 2;
              if (behind !== zc > 0) continue;
              const u = k / FLASH_SEGMENTS;
              const shape = Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.6; // fat head, soft tail
              ctx.lineWidth = Math.max(0.6, w * (S / 130) * (0.25 + 0.75 * shape));
              ctx.strokeStyle = `rgba(${tint},${(al * inten * (0.3 + 0.7 * shape)).toFixed(3)})`;
              ctx.beginPath();
              ctx.moveTo(pts[k][0], pts[k][1]);
              ctx.lineTo(pts[k + 1][0], pts[k + 1][1]);
              ctx.stroke();
            }
          });
        }
        ctx.restore();
      };
      flashPass(true);

      // The device: cull back faces, then paint far to near.
      const visible = faces
        .map((face) => {
          const v = face.pts.map(view);
          const e1 = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
          const e2 = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
          let n: Vec3 = [
            e1[1] * e2[2] - e1[2] * e2[1],
            e1[2] * e2[0] - e1[0] * e2[2],
            e1[0] * e2[1] - e1[1] * e2[0],
          ];
          const nm = Math.hypot(...n) || 1;
          n = n.map((x) => x / nm) as Vec3;
          const cen = v.reduce<Vec3>(
            (s, p) => [s[0] + p[0] / v.length, s[1] + p[1] / v.length, s[2] + p[2] / v.length],
            [0, 0, 0],
          );
          const pc = view(face.centre);
          const out = [cen[0] - pc[0], cen[1] - pc[1], cen[2] - pc[2]];
          if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) n = n.map((x) => -x) as Vec3;
          return { v, n, cen, kind: face.kind };
        })
        .filter((fc) => fc.n[2] < 0.05)
        .sort((p, q) => q.cen[2] - p.cen[2]);

      ctx.globalAlpha = 0.8;
      for (const fc of visible) {
        const pts = fc.v.map(proj);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        if (fc.kind === "shell") {
          const lam = Math.max(0, fc.n[0] * LIGHT[0] + fc.n[1] * LIGHT[1] + fc.n[2] * LIGHT[2]);
          const r = Math.hypot(fc.cen[0], fc.cen[2]);
          const toAxis = r > 0.001 ? Math.max(0, -(fc.n[0] * fc.cen[0] + fc.n[2] * fc.cen[2]) / r) : 0;
          const near = Math.max(0, 1 - r / 0.7);
          const up = Math.max(0, fc.n[1]) * Math.max(0, 1 - Math.abs(fc.cen[1] - 0.9) / 0.5);
          const glow = (toAxis * near * 0.8 + up * 0.3 + 0.04) * glowK;
          const shade = 0.2 + 0.7 * lam;
          const col = SHELL.map((c, i) => Math.min(255, Math.round(c * shade + ACC[i] * glow * 0.45)));
          ctx.fillStyle = `rgb(${col.join(",")})`;
          ctx.fill();
          ctx.strokeStyle = "rgba(8,7,12,0.55)";
          ctx.lineWidth = 0.7;
          ctx.stroke();
        } else {
          const facing = Math.max(0, -fc.n[2]);
          const isCore = fc.kind === "core";
          const k = (isCore ? 0.3 + 0.3 * facing : 0.5) * glowK;
          const w = Math.min(1, facing * 0.5 + charge * 0.55 + flare * 0.45);
          const col = [Math.round(ACC[0] + (255 - ACC[0]) * w), Math.round(ACC[1] + (255 - ACC[1]) * w), 255];
          ctx.shadowColor = `rgba(${ACC_RGB},0.8)`;
          ctx.shadowBlur = (isCore ? 10 : 5) + charge * 16 + flare * 16;
          ctx.fillStyle = `rgba(${col.join(",")},${Math.min(1, k).toFixed(3)})`;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      ctx.globalAlpha = 1;
      flashPass(false);

      // Motes rise off the core, denser as it charges.
      if (!reduced) {
        for (let i = spawnCount((charge * charge * 28 + flare * 40) * dt); i > 0; i--) {
          const ang = Math.random() * Math.PI * 2;
          const r = 0.2 + Math.random() * 0.5;
          const p = proj(view([Math.cos(ang) * r, -0.6 + Math.random() * 1.3, Math.sin(ang) * r]));
          motes.push({
            x: p[0],
            y: p[1],
            vx: (Math.random() - 0.5) * 0.25,
            vy: -(0.25 + Math.random() * 0.6),
            r: 1 + Math.random() * 2.2,
            life: 0,
            max: 1.2 + Math.random() * 1.6,
          });
        }
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        motes = motes.filter((m) => (m.life += dt) < m.max);
        for (const m of motes) {
          m.x += m.vx;
          m.y += m.vy;
          m.vx += (Math.random() - 0.5) * 0.04;
          const al = Math.sin((m.life / m.max) * Math.PI) * 0.55;
          const rg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3);
          rg.addColorStop(0, `rgba(230,215,255,${al.toFixed(3)})`);
          rg.addColorStop(1, `rgba(${ACC_RGB},0)`);
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    };

    // Reduced motion: one still frame, redrawn only when the canvas resizes.
    if (reduced) {
      const ro = new ResizeObserver(() => frame(performance.now()));
      ro.observe(canvas);
      return () => ro.disconnect();
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

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 block size-full" />;
}
