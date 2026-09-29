import type { LonLatPoint } from "./globe-types";

// Markers follow the "1D Ping" spec in the Map Icons design file. Its geometry is in
// design units, drawn inside a group turned 45°; SCALE maps one unit to CSS px.
const SCALE = 1;

/** Selected marker box in CSS px (40 design units); also its hit target. Centred on the destination. */
export const MARKER_PX = 40 * SCALE;
/** Hit target for the other destinations' markers, in CSS px. */
export const DOT_PX = 24;

const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;

/** viewBox centred on the origin, `px` CSS px across. */
const box = (px: number) => {
  const h = px / SCALE / 2;
  return `${-h} ${-h} ${h * 2} ${h * 2}`;
};

/** Square with half-side `h`, centred on the origin. */
const square = (h: number) => ({ x: -h, y: -h, width: h * 2, height: h * 2 });

/** Gradient from `from` (a colour-mix stop) at the near edge to transparent at the far edge. */
const fade = (flip: boolean, from: string, hold: string) =>
  `linear-gradient(to ${flip ? "left" : "right"}, color-mix(in srgb, ${from}, transparent) ${hold}, transparent)`;

/** A radar ring: a square outline growing from half-side 4 to 16 while fading out. Slower than the spec's 1.4s. */
function Ring({ begin }: { begin: string }) {
  const anim = { dur: "2.2s", begin, repeatCount: "indefinite" };
  return (
    <rect {...square(4)} fill="none" stroke="currentColor" strokeWidth={0.8} opacity={0}>
      <animate attributeName="x" values="-4;-16" {...anim} />
      <animate attributeName="y" values="-4;-16" {...anim} />
      <animate attributeName="width" values="8;32" {...anim} />
      <animate attributeName="height" values="8;32" {...anim} />
      <animate attributeName="opacity" values="1;0" {...anim} />
    </rect>
  );
}

/**
 * The selected destination's marker: a radar ping. A solid diamond with two square rings
 * radiating out from it, half a cycle apart, and a callout with the name and coordinates.
 * Purely decorative: it sits inside the marker button, which carries the accessible label
 * and a `group` class for hover.
 *
 * `lockKey` replays the entrance each time a destination is selected; `flip` puts the
 * tag on the left when the marker is on the right half, so it stays inside the view.
 */
export function TargetReticle({
  target,
  label,
  lockKey,
  flip,
}: {
  target: LonLatPoint;
  label: string;
  lockKey: number;
  flip: boolean;
}) {
  return (
    <span
      aria-hidden
      key={lockKey}
      className="pointer-events-none absolute inset-0 text-accent transition-colors duration-150 group-hover:text-accent-hover"
    >
      <svg viewBox={box(MARKER_PX)} className="absolute inset-0 size-full overflow-visible">
        <g transform="rotate(45)">
          {/* SMIL ignores prefers-reduced-motion, so the rings are simply not drawn there. */}
          <g className="motion-reduce:hidden">
            <Ring begin="0s" />
            <Ring begin="1.1s" />
          </g>
          <rect {...square(3.5)} fill="currentColor" className="origin-center animate-pop [transform-box:fill-box]" />
        </g>
      </svg>
      {/* Callout, Valorant-style: no box, just a dark strip fading out behind the text, a
          slanted accent bar on the near edge and a hairline across the top. */}
      <span
        className={`absolute top-1/2 -translate-y-1/2 animate-tag ${
          flip ? "right-[calc(50%+16px)]" : "left-[calc(50%+16px)]"
        }`}
      >
        <span
          className={`relative flex flex-col gap-[5px] py-[7px] whitespace-nowrap ${
            flip ? "items-end pr-3.5 pl-12" : "items-start pr-12 pl-3.5"
          }`}
          style={{ background: fade(flip, "var(--color-bg) 92%", "35%") }}
        >
          <span className={`absolute inset-y-0 w-[3px] -skew-x-[14deg] bg-current ${flip ? "right-0" : "left-0"}`} />
          <span
            className="absolute top-0 left-0 h-px w-full"
            style={{ background: fade(flip, "var(--color-ink) 45%", "0%") }}
          />
          <span className="font-display text-[21px] leading-[0.85] tracking-[0.08em] text-title [text-shadow:0_1px_6px_rgb(0_0_0/0.8)]">
            {label}
          </span>
          <span
            className={`flex items-center gap-1.5 font-mono text-[9px] leading-none tracking-[0.14em] text-ink-muted tabular-nums ${
              flip ? "flex-row-reverse" : ""
            }`}
          >
            <span className="size-[5px] rotate-45 bg-current text-accent" />
            {fmt(target.lat, "N", "S")} {fmt(target.lon, "E", "W")}
          </span>
        </span>
      </span>
    </span>
  );
}

/**
 * An unselected destination, per the Ping spec: a light diamond in a dark square frame if
 * visited, a dotted diamond if planned. Decorative; it sits inside the button that
 * selects that destination.
 */
export function DestinationMarker({ visited }: { visited: boolean }) {
  return (
    <svg aria-hidden viewBox={box(DOT_PX)} className="pointer-events-none absolute inset-0 size-full overflow-visible">
      <g transform="rotate(45)" className="text-ink transition-colors duration-150 group-hover:text-accent-hover">
        {visited ? (
          <>
            <rect {...square(8)} fill="none" className="stroke-border-strong group-hover:stroke-accent" />
            <rect {...square(3.5)} fill="currentColor" />
          </>
        ) : (
          <rect
            {...square(4)}
            fill="none"
            strokeWidth={1.3}
            strokeLinecap="round"
            strokeDasharray="0 2"
            className="stroke-ink-muted group-hover:stroke-accent-hover"
          />
        )}
      </g>
    </svg>
  );
}
