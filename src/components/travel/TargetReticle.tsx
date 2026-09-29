import type { LonLatPoint } from "./globe-types";

/** Marker size in CSS px; also the marker's hit target. Its tip is the bottom-centre. */
export const PIN_W = 28;
export const PIN_H = 40;

const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;

// A map pin in a 28x40 box: head centred at (14, 12), tip at (14, 39.5) on the target.
const PIN = "M14 39.5C14 39.5 3 26 3 12a11 11 0 0 1 22 0c0 14-11 27.5-11 27.5Z";
const PIN_INNER = "M14 35C14 35 5.5 24.5 5.5 12a8.5 8.5 0 0 1 17 0c0 12.5-8.5 23-8.5 23Z";
// Left half catches the light, right half falls away: reads as a bevel, not a flat sticker.
const HALF_LIT = "M14 39.5C14 39.5 3 26 3 12a11 11 0 0 1 11-11Z";
const HALF_SHADE = "M14 1a11 11 0 0 1 11 11c0 14-11 27.5-11 27.5Z";
const CORE = { x: 14, y: 12 };

/**
 * The destination marker: a map pin given a game-HUD finish: hollow and double-outlined,
 * bevel-lit, with chevron wings that lock on, and a readout tag with
 * the coordinates. Purely decorative: it sits inside the marker button, which carries the
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
  const { x, y } = CORE;
  return (
    <span
      aria-hidden
      key={lockKey}
      className="pointer-events-none absolute inset-0 text-accent transition-colors duration-150 group-hover:text-accent-hover"
    >
      <svg viewBox={`0 0 ${PIN_W} ${PIN_H}`} className="absolute inset-0 size-full overflow-visible">
        {/* Contact shadow where the stem meets the ground. */}
        <ellipse cx={14} cy={40} rx={6} ry={1.8} fill="#000" opacity={0.55} />
      </svg>
      <svg
        viewBox={`0 0 ${PIN_W} ${PIN_H}`}
        className="absolute inset-0 size-full animate-drop overflow-visible drop-shadow-[0_4px_5px_rgb(0_0_0/0.7)]"
      >
        <path d={PIN} fill="var(--color-bg)" fillOpacity={0.72} />
        <path d={HALF_LIT} fill="currentColor" fillOpacity={0.2} />
        <path d={HALF_SHADE} fill="currentColor" fillOpacity={0.05} />
        <path d={PIN} fill="none" stroke="currentColor" strokeWidth={1.5} />
        <path d={PIN_INNER} fill="none" stroke="currentColor" strokeWidth={0.75} opacity={0.55} />
        {/* Highlight glint on the crown. */}
        <path d="M10.5 1.6A11 11 0 0 1 17.5 1.6" fill="none" stroke="var(--color-title)" strokeWidth={1.5} opacity={0.9} />
        {/* The pin's eye, cut through to the ground. */}
        <circle cx={x} cy={y} r={5} fill="var(--color-bg)" stroke="currentColor" strokeWidth={1.25} />
        {/* Core: a hollow diamond around a pip. */}
        <path d={`M${x} ${y - 2.6}L${x + 2.6} ${y}L${x} ${y + 2.6}L${x - 2.6} ${y}Z`} fill="none" stroke="currentColor" strokeWidth={1} />
        <rect x={x - 0.9} y={y - 0.9} width={1.8} height={1.8} fill="var(--color-title)" transform={`rotate(45 ${x} ${y})`} />
      </svg>
      <svg
        viewBox={`0 0 ${PIN_W} ${PIN_H}`}
        className="absolute inset-0 size-full animate-lock overflow-visible"
        style={{ transformOrigin: `50% ${(CORE.y / PIN_H) * 100}%` }}
      >
        <path d="M-1.5 6L-6.5 12L-1.5 18M29.5 6L34.5 12L29.5 18" fill="none" stroke="currentColor" strokeWidth={1.5} />
      </svg>
      <span
        className={`absolute top-[-2px] animate-tag drop-shadow-[0_3px_4px_rgb(0_0_0/0.6)] ${
          flip ? "right-[calc(100%+12px)]" : "left-[calc(100%+12px)]"
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
