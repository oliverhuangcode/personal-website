import type { LonLatPoint } from "./globe-types";

/** Marker size in CSS px; also the marker's hit target. It is centred on the destination. */
export const MARKER_PX = 36;

const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;

const C = MARKER_PX / 2;
/** A square turned 45°, centred on the marker, reaching `r` px from the centre. */
const diamond = (r: number) => `M${C} ${C - r}L${C + r} ${C}L${C} ${C + r}L${C - r} ${C}Z`;

/**
 * The selected destination's marker: a radar ping. A solid diamond with square rings
 * radiating out from just around it, and a readout tag carrying the coordinates. Purely decorative: it sits inside the marker button, which carries the
 * accessible label and a `group` class for hover.
 *
 * `lockKey` replays the lock-on each time a destination is selected; `flip` puts the
 * tag on the left when the marker is on the right half, so it stays inside the view.
 */
export function TargetReticle({
  target,
  label,
  index,
  lockKey,
  flip,
}: {
  target: LonLatPoint;
  label: string;
  index: number;
  lockKey: number;
  flip: boolean;
}) {
  const box = `0 0 ${MARKER_PX} ${MARKER_PX}`;
  return (
    <span
      aria-hidden
      key={lockKey}
      className="pointer-events-none absolute inset-0 text-accent transition-colors duration-150 group-hover:text-accent-hover"
    >
      {/* Radar rings: two, half a cycle apart, so one is always on its way out. */}
      {[0.6, 1.6].map((delay) => (
        <svg
          key={delay}
          viewBox={box}
          className="absolute inset-0 size-full animate-radar overflow-visible opacity-0"
          style={{ animationDelay: `${delay}s` }}
        >
          <path d={diamond(6.5)} fill="none" stroke="currentColor" strokeWidth={1} />
        </svg>
      ))}
      <svg
        viewBox={box}
        className="absolute inset-0 size-full animate-pop overflow-visible drop-shadow-[0_2px_3px_rgb(0_0_0/0.6)]"
      >
        <path d={diamond(5.5)} fill="currentColor" />
      </svg>
      <span
        className={`absolute top-[calc(50%-13px)] animate-tag drop-shadow-[0_3px_4px_rgb(0_0_0/0.6)] ${
          flip ? "right-[calc(100%+4px)]" : "left-[calc(100%+4px)]"
        }`}
      >
        <span
          className={`flex flex-col gap-[3px] border-accent bg-bg/85 px-2 py-[5px] font-mono text-[9px] leading-none tracking-[0.12em] whitespace-nowrap ${
            flip ? "items-end border-r" : "border-l"
          }`}
          style={{
            clipPath: flip
              ? "polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px)"
              : "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)",
          }}
        >
          <span className="text-ink">
            <span className="text-accent">TGT-{String(index + 1).padStart(3, "0")}</span> · {label.toUpperCase()}
          </span>
          <span className="text-ink-muted tabular-nums">
            {fmt(target.lat, "N", "S")} {fmt(target.lon, "E", "W")}
          </span>
        </span>
      </span>
    </span>
  );
}

/** Hit target for the other destinations' markers, in CSS px. */
export const DOT_PX = 22;

const D = DOT_PX / 2;
const dot = (r: number) => `M${D} ${D - r}L${D + r} ${D}L${D} ${D + r}L${D - r} ${D}Z`;

/**
 * An unselected destination: a white diamond in a thin frame if visited, a dotted outline
 * if planned. Decorative; it sits inside the button that selects that destination.
 */
export function DestinationMarker({ visited }: { visited: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${DOT_PX} ${DOT_PX}`}
      className="pointer-events-none absolute inset-0 size-full text-ink-dim transition-colors duration-150 group-hover:text-accent-hover"
    >
      {visited ? (
        <>
          <path d={dot(6)} fill="var(--color-bg)" fillOpacity={0.6} stroke="currentColor" strokeWidth={1} strokeOpacity={0.6} />
          <path d={dot(3)} fill="var(--color-title)" className="group-hover:fill-accent-hover" />
        </>
      ) : (
        <path d={dot(4)} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="1.5 1.5" />
      )}
    </svg>
  );
}
