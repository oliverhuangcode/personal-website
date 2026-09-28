"use client";

import {
  useCallback,
  useLayoutEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import type { GlobeProps } from "./globe-types";
import { DestinationMarker, DOT_PX, MARKER_PX, TargetReticle } from "./TargetReticle";
import { LAND_RINGS } from "@/lib/globe/land";
import {
  GLOBE_CENTRE,
  GLOBE_RADIUS,
  GLOBE_SIZE,
  clampLat,
  easeInOutCubic,
  graticulePath,
  project,
  ringPath,
  wrapLonDelta,
} from "@/lib/globe/projection";

type LonLatPoint = GlobeProps["target"];

const FLY_MS = 750;
const DRAG_DEG_PER_PX = 0.4;
/** Movement before a press becomes a drag, so taps on the marker still click. */
const DRAG_THRESHOLD_PX = 3;

interface DragState {
  pointerId: number;
  x: number;
  y: number;
  lon: number;
  lat: number;
  dragging: boolean;
}

/** Orthographic SVG globe: drag to spin, tweens to the selected destination. */
export function Globe2D({ target, flyKey, label, index = 0, onMarkerClick, destinations = [], onSelect }: GlobeProps) {
  const ids = useId();
  const seaId = `${ids}-sea`;
  const clipId = `${ids}-clip`;

  const [centre, setCentreState] = useState<LonLatPoint>(target);
  const [dragging, setDragging] = useState(false);
  // Mirrors `centre` so tweens and drags always start from the live position.
  const centreRef = useRef(centre);
  const rafRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);

  const setCentre = useCallback((next: LonLatPoint) => {
    centreRef.current = next;
    setCentreState(next);
  }, []);

  // Fly to the target on selection. Cancels any in-flight tween, and on unmount.
  // A layout effect: selection runs in a view transition, which holds passive
  // effects until its animations finish, so the globe would sit still ~0.3s.
  useLayoutEffect(() => {
    const from = centreRef.current;
    const dLon = wrapLonDelta(target.lon - from.lon);
    const dLat = target.lat - from.lat;
    if (Math.abs(dLon) < 0.01 && Math.abs(dLat) < 0.01) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
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
  }, [flyKey, target.lon, target.lat, setCentre]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const { lon, lat } = centreRef.current;
    dragRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lon,
      lat,
      dragging: false,
    };
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
      setDragging(true);
    }
    setCentre({
      lon: drag.lon - dx * DRAG_DEG_PER_PX,
      lat: clampLat(drag.lat + dy * DRAG_DEG_PER_PX),
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  const { land, graticule } = useMemo(
    () => ({
      land: LAND_RINGS.map((ring) =>
        ringPath(ring, centre.lon, centre.lat),
      ).join(""),
      graticule: graticulePath(centre.lon, centre.lat),
    }),
    [centre.lon, centre.lat],
  );
  const marker = project(target.lon, target.lat, centre.lon, centre.lat);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`relative aspect-square w-full max-w-[300px] touch-none select-none ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      <svg
        role="img"
        aria-label={`Globe showing ${label}. Drag to spin.`}
        viewBox={`0 0 ${GLOBE_SIZE} ${GLOBE_SIZE}`}
        className="block size-full overflow-visible"
      >
        <defs>
          <radialGradient id={seaId} cx="34%" cy="28%">
            <stop offset="0%" stopColor="#16151a" />
            <stop offset="62%" stopColor="#0c0b10" />
            <stop offset="100%" stopColor="#08070c" />
          </radialGradient>
          <clipPath id={clipId}>
            <circle cx={GLOBE_CENTRE} cy={GLOBE_CENTRE} r={GLOBE_RADIUS} />
          </clipPath>
        </defs>
        <circle
          cx={GLOBE_CENTRE}
          cy={GLOBE_CENTRE}
          r={GLOBE_RADIUS}
          fill={`url(#${seaId})`}
        />
        <g clipPath={`url(#${clipId})`}>
          <path
            d={graticule}
            fill="none"
            stroke="#221f27"
            strokeWidth={0.6}
            opacity={0.6}
          />
          <path
            d={land}
            fill="none"
            stroke="#4a4856"
            strokeWidth={0.9}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.9}
          />
        </g>
        <circle
          cx={GLOBE_CENTRE}
          cy={GLOBE_CENTRE}
          r={GLOBE_RADIUS}
          fill="none"
          stroke="#332f3d"
        />
      </svg>
      {destinations.map((d, i) => {
        if (i === index) return null;
        const p = project(d.lon, d.lat, centre.lon, centre.lat);
        if (!p.visible) return null;
        return (
          <button
            key={d.label}
            type="button"
            aria-label={`Show ${d.label}`}
            onClick={() => onSelect?.(i)}
            style={{
              width: DOT_PX,
              height: DOT_PX,
              left: `calc(${(p.x / GLOBE_SIZE) * 100}% - ${DOT_PX / 2}px)`,
              top: `calc(${(p.y / GLOBE_SIZE) * 100}% - ${DOT_PX / 2}px)`,
            }}
            className="group absolute cursor-pointer"
          >
            <DestinationMarker visited={d.visited} />
          </button>
        );
      })}
      {marker.visible && (
        <button
          type="button"
          aria-label={`Centre the globe on ${label}`}
          onClick={onMarkerClick}
          style={{
            width: MARKER_PX,
            height: MARKER_PX,
            left: `calc(${(marker.x / GLOBE_SIZE) * 100}% - ${MARKER_PX / 2}px)`,
            top: `calc(${(marker.y / GLOBE_SIZE) * 100}% - ${MARKER_PX / 2}px)`,
          }}
          className="group absolute cursor-pointer"
        >
          <TargetReticle
            target={target}
            label={label}
            lockKey={flyKey}
            flip={marker.x > GLOBE_CENTRE + GLOBE_RADIUS * 0.1}
          />
        </button>
      )}
    </div>
  );
}
