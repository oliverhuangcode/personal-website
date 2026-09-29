"use client";

import { useEffect, useRef } from "react";
import type * as THREE from "three";

import { LAND_RINGS } from "@/lib/globe/land";
import { clampLat, easeInOutCubic, wrapLonDelta } from "@/lib/globe/projection";
import { faceRotation, graticuleSegments, ringSegments, toVec3 } from "@/lib/globe/sphere";

import type { GlobeProps, LonLatPoint } from "./globe-types";

const FLY_MS = 750;
const DRAG_DEG_PER_PX = 0.4;
/** Movement before a press becomes a drag, so taps on the marker still click. */
const DRAG_THRESHOLD_PX = 3;
const FOV = 28;
/** Camera distance that frames the sphere at ~93% of the view, as the flat globe did. */
const CAMERA_DIST = 4.41;
const MAX_DPR = 2;
const HIT_PX = 30;

interface DragState {
  pointerId: number;
  x: number;
  y: number;
  lon: number;
  lat: number;
  dragging: boolean;
}

/** What the effect exposes so React props can steer the scene without rebuilding it. */
interface SceneApi {
  setCentre: (c: LonLatPoint) => void;
  setTarget: (t: LonLatPoint) => void;
  invalidate: () => void;
}

const RIM_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const RIM_FRAG = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(vN, vV)), 3.0);
    gl_FragColor = vec4(vec3(0.725, 0.529, 1.0) * f, f * 0.55);
  }
`;

/**
 * The travel globe as a real 3D scene: drag to spin, and it turns to the selected
 * destination. The marker's click target is a real button laid over the canvas, so it
 * is keyboard-reachable and works with assistive tech.
 */
export function Globe3D({ target, flyKey, label, onMarkerClick, onUnsupported }: GlobeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef<HTMLButtonElement>(null);
  const apiRef = useRef<SceneApi | null>(null);
  // Mirrors the live view so tweens and drags always start from where the globe is.
  const centreRef = useRef<LonLatPoint>(target);
  const targetRef = useRef<LonLatPoint>(target);
  const rafRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);

  const setCentre = (c: LonLatPoint) => {
    centreRef.current = c;
    const wrap = wrapRef.current;
    if (wrap) {
      wrap.dataset.lon = c.lon.toFixed(2);
      wrap.dataset.lat = c.lat.toFixed(2);
    }
    apiRef.current?.setCentre(c);
  };

  // Build the scene once.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const marker = markerRef.current;
    if (!canvas || !wrap || !marker) return;

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
        if (!cancelled) onUnsupported?.();
        return;
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setClearColor(0x000000, 0);
      wrap.dataset.renderer = "webgl";

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(FOV, 1, 0.1, 20);
      camera.position.set(0, 0, CAMERA_DIST);
      const globe = new T.Group();
      scene.add(globe);

      // Sea: a dark, softly lit ball. Polygon offset keeps coastlines from z-fighting with it.
      const sea = new T.Mesh(
        new T.SphereGeometry(1, 64, 48),
        new T.MeshStandardMaterial({
          color: 0x0f0e14,
          roughness: 0.95,
          metalness: 0,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        }),
      );
      const lines = (positions: Float32Array, color: number, opacity: number) => {
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.BufferAttribute(positions, 3));
        return new T.LineSegments(g, new T.LineBasicMaterial({ color, transparent: true, opacity }));
      };
      const graticule = lines(graticuleSegments(1.001), 0x2c2935, 0.6);
      const coast = lines(ringSegments(LAND_RINGS, 1.003), 0x6a677a, 0.95);
      globe.add(sea, graticule, coast);

      const rimMat = new T.ShaderMaterial({
        vertexShader: RIM_VERT,
        fragmentShader: RIM_FRAG,
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
        side: T.BackSide,
      });
      const rim = new T.Mesh(new T.SphereGeometry(1.07, 48, 32), rimMat);
      scene.add(rim);

      const key = new T.DirectionalLight(0xffffff, 2.2);
      key.position.set(-2.4, 2.4, 3);
      scene.add(key, new T.AmbientLight(0x6f6a86, 0.9));

      // Destination marker: a diamond standing on the surface, with a ping ring.
      const markerGroup = new T.Group();
      const diamondMat = new T.MeshBasicMaterial({ color: 0xb987ff });
      const diamond = new T.Mesh(new T.OctahedronGeometry(0.05, 0), diamondMat);
      // Long axis out of the surface, so it reads as a standing crystal from the side.
      diamond.scale.set(1, 1, 1.7);
      const pingMat = new T.MeshBasicMaterial({
        color: 0xb987ff,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
      });
      const ping = new T.Mesh(new T.RingGeometry(0.05, 0.062, 40), pingMat);
      diamond.position.z = 0.07;
      // Lifted clear of the sphere: it curves away beneath the ring as the ring widens.
      ping.position.z = 0.016;
      markerGroup.add(diamond, ping);
      globe.add(markerGroup);

      const OUT = new T.Vector3(0, 0, 1);
      const normal = new T.Vector3();
      const setTarget = (t: LonLatPoint) => {
        const [x, y, z] = toVec3(t.lon, t.lat, 1);
        normal.set(x, y, z);
        markerGroup.position.copy(normal);
        // Local +z is "out of the surface". Set in the globe's own space: lookAt works in world space.
        markerGroup.quaternion.setFromUnitVectors(OUT, normal);
      };
      const setCentreView = (c: LonLatPoint) => {
        const [x, y, z] = faceRotation(c.lon, c.lat);
        globe.rotation.set(x, y, z, "XYZ");
      };

      let W = 0;
      let raf = 0;
      let running = false;
      const t0 = performance.now();
      const proj = new T.Vector3();
      const worldN = new T.Vector3();

      const resize = () => {
        const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
        W = canvas.clientWidth;
        const H = canvas.clientHeight;
        if (!W || !H) return false;
        renderer.setPixelRatio(dpr);
        renderer.setSize(W, H, false);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        return true;
      };

      const render = (now: number) => {
        if (!W && !resize()) return;
        // Ping ring: expands and fades, once every 1.8s. Held at rest under reduced motion.
        const k = reduced ? 0.35 : (((now - t0) / 1800) % 1);
        diamond.rotation.z = reduced ? Math.PI / 4 : (now - t0) / 1400;
        ping.scale.setScalar(1 + k * 1.7);
        pingMat.opacity = reduced ? 0.5 : (1 - k) * 0.8;

        globe.updateMatrixWorld(true);
        renderer.render(scene, camera);

        // Park the real button over the marker, and hide it when the marker is on the far side.
        markerGroup.getWorldPosition(proj);
        worldN.copy(proj).normalize();
        const facing = worldN.dot(camera.position.clone().sub(proj).normalize());
        const shown = facing > 0.12;
        proj.project(camera);
        const h = canvas.clientHeight;
        marker.style.visibility = shown ? "visible" : "hidden";
        marker.style.transform = `translate(${((proj.x + 1) / 2) * W - HIT_PX / 2}px, ${((1 - proj.y) / 2) * h - HIT_PX / 2}px)`;
      };

      const frame = (now: number) => {
        render(now);
        if (!reduced && !document.hidden) raf = requestAnimationFrame(frame);
        else running = false;
      };
      const invalidate = () => {
        if (running) return;
        running = true;
        raf = requestAnimationFrame(frame);
      };

      apiRef.current = {
        setCentre: (c) => {
          setCentreView(c);
          invalidate();
        },
        setTarget: (t) => {
          setTarget(t);
          invalidate();
        },
        invalidate,
      };
      setTarget(targetRef.current);
      setCentreView(centreRef.current);
      wrap.dataset.lon = centreRef.current.lon.toFixed(2);
      wrap.dataset.lat = centreRef.current.lat.toFixed(2);

      const ro = new ResizeObserver(() => {
        if (resize()) invalidate();
      });
      ro.observe(canvas);
      const onVisibility = () => {
        if (!document.hidden) invalidate();
      };
      document.addEventListener("visibilitychange", onVisibility);
      invalidate();

      teardown = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        apiRef.current = null;
        scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
        for (const m of [sea.material, graticule.material, coast.material, rimMat, diamondMat, pingMat]) {
          (m as THREE.Material).dispose();
        }
        renderer.dispose();
      };
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [onUnsupported]);

  // Follow the selected destination.
  useEffect(() => {
    targetRef.current = target;
    apiRef.current?.setTarget(target);
  }, [target.lon, target.lat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to it whenever a selection is made. Cancels any in-flight tween, and on unmount.
  useEffect(() => {
    const from = centreRef.current;
    const dLon = wrapLonDelta(target.lon - from.lon);
    const dLat = target.lat - from.lat;
    if (Math.abs(dLon) < 0.01 && Math.abs(dLat) < 0.01) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : FLY_MS;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = duration ? Math.min(1, (now - t0) / duration) : 1;
      const e = easeInOutCubic(k);
      setCentre({ lon: from.lon + dLon * e, lat: from.lat + dLat * e });
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [flyKey, target.lon, target.lat]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const { lon, lat } = centreRef.current;
    dragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, lon, lat, dragging: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.dragging = true;
      cancelAnimationFrame(rafRef.current);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.style.cursor = "grabbing";
    }
    setCentre({ lon: drag.lon - dx * DRAG_DEG_PER_PX, lat: clampLat(drag.lat + dy * DRAG_DEG_PER_PX) });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.style.cursor = "";
  };

  return (
    <div
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="relative aspect-square w-full max-w-[300px] cursor-grab touch-none select-none"
    >
      <canvas ref={canvasRef} role="img" aria-label={`Globe showing ${label}. Drag to spin.`} className="block size-full" />
      <button
        ref={markerRef}
        type="button"
        aria-label={`Centre the globe on ${label}`}
        onClick={onMarkerClick}
        style={{ width: HIT_PX, height: HIT_PX }}
        className="absolute top-0 left-0 cursor-pointer"
      />
    </div>
  );
}
