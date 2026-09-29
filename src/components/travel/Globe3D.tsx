"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";

import { LAND_RINGS } from "@/lib/globe/land";
import { clampLat, easeInOutCubic, wrapLonDelta } from "@/lib/globe/projection";
import { faceRotation, graticuleSegments, ringSegments, toVec3 } from "@/lib/globe/sphere";

import type { Destination, GlobeProps, LonLatPoint } from "./globe-types";
import { DestinationMarker, DOT_PX, MARKER_PX, TargetReticle } from "./TargetReticle";

const FLY_MS = 750;
const DRAG_DEG_PER_PX = 0.4;
/** Movement before a press becomes a drag, so taps on the marker still click. */
const DRAG_THRESHOLD_PX = 3;
const FOV = 28;
/** Camera distance that frames the sphere at ~93% of the view, as the flat globe did. */
const CAMERA_DIST = 4.41;
const MAX_DPR = 2;

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

/**
 * The travel globe as a real 3D scene: drag to spin, and it turns to the selected
 * destination. The marker's click target is a real button laid over the canvas, so it
 * is keyboard-reachable and works with assistive tech.
 */
const NO_DESTINATIONS: Destination[] = [];

export function Globe3D({
  target,
  flyKey,
  label,
  index = 0,
  onMarkerClick,
  destinations = NO_DESTINATIONS,
  onSelect,
  onUnsupported,
}: GlobeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef<HTMLButtonElement>(null);
  const apiRef = useRef<SceneApi | null>(null);
  // Mirrors the live view so tweens and drags always start from where the globe is.
  const centreRef = useRef<LonLatPoint>(target);
  const targetRef = useRef<LonLatPoint>(target);
  const rafRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  // The other destinations' buttons, and what the scene needs to place them.
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const destinationsRef = useRef(destinations);
  const indexRef = useRef(index);
  // Readout tag side: flips left when the marker is on the right half of the globe.
  const [flip, setFlip] = useState(false);

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

      const key = new T.DirectionalLight(0xffffff, 2.2);
      key.position.set(-2.4, 2.4, 3);
      scene.add(key, new T.AmbientLight(0x6f6a86, 0.9));

      // Anchor for the destination marker. The marker itself is HTML laid over the canvas
      // (see TargetReticle), parked each frame at this point's projection.
      const markerGroup = new T.Group();
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
      const proj = new T.Vector3();
      const worldN = new T.Vector3();
      const toCamera = new T.Vector3();

      /** Park `el` over `world` (a point on the globe, in world space); hide it on the far side. */
      const place = (el: HTMLElement, world: THREE.Vector3, size: number) => {
        worldN.copy(world).normalize();
        const facing = worldN.dot(toCamera.copy(camera.position).sub(world).normalize());
        proj.copy(world).project(camera);
        const h = canvas.clientHeight;
        el.style.visibility = facing > 0.12 ? "visible" : "hidden";
        el.style.transform = `translate(${((proj.x + 1) / 2) * W - size / 2}px, ${((1 - proj.y) / 2) * h - size / 2}px)`;
        return proj.x;
      };
      const spot = new T.Vector3();

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

      const render = () => {
        if (!W && !resize()) return;
        globe.updateMatrixWorld(true);
        renderer.render(scene, camera);

        // Park the real buttons over their markers.
        setFlip(place(marker, markerGroup.getWorldPosition(spot), MARKER_PX) > 0.1);
        destinationsRef.current.forEach((d, i) => {
          const el = dotRefs.current[i];
          if (!el || i === indexRef.current) return;
          const [x, y, z] = toVec3(d.lon, d.lat, 1);
          place(el, globe.localToWorld(spot.set(x, y, z)), DOT_PX);
        });
      };

      // Nothing in the scene animates on its own, so draw only when something changed.
      const frame = () => {
        running = false;
        render();
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
        for (const m of [sea.material, graticule.material, coast.material]) {
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

  // Re-place the other markers when the list or the selection changes.
  useEffect(() => {
    destinationsRef.current = destinations;
    indexRef.current = index;
    apiRef.current?.invalidate();
  }, [destinations, index]);

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
      {destinations.map((d, i) =>
        i === index ? null : (
          <button
            key={d.label}
            ref={(el) => {
              dotRefs.current[i] = el;
            }}
            type="button"
            aria-label={`Show ${d.label}`}
            onClick={() => onSelect?.(i)}
            style={{ width: DOT_PX, height: DOT_PX, visibility: "hidden" }}
            className="group absolute top-0 left-0 cursor-pointer"
          >
            <DestinationMarker visited={d.visited} />
          </button>
        ),
      )}
      <button
        ref={markerRef}
        type="button"
        aria-label={`Centre the globe on ${label}`}
        onClick={onMarkerClick}
        style={{ width: MARKER_PX, height: MARKER_PX }}
        className="group absolute top-0 left-0 cursor-pointer"
      >
        <TargetReticle
          target={target}
          label={label}
          visited={destinations[index]?.visited}
          lockKey={flyKey}
          flip={flip}
        />
      </button>
    </div>
  );
}
