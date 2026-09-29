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

// Leader from the ping to the tag, in px from the marker centre (y is up-negative).
const LEAD = { elbow: 20, x: 30, y: -16 };
// Tag outline: top-far and bottom-near corners clipped, mirrored when flipped.
const CHAMFER = "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 6px 100%, 0 calc(100% - 6px))";
const CHAMFER_FLIP = "polygon(8px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 8px)";

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
 * radiating out from it, half a cycle apart, and a callout tag with the name, status and
 * coordinates.
 * Purely decorative: it sits inside the marker button, which carries the accessible label
 * and a `group` class for hover.
 *
 * `lockKey` replays the entrance each time a destination is selected; `flip` puts the
 * tag on the left when the marker is on the right half, so it stays inside the view.
 */
export function TargetReticle({
  target,
  label,
  visited,
  lockKey,
  flip,
}: {
  target: LonLatPoint;
  label: string;
  /** Shown as a status chip; omitted when unknown. */
  visited?: boolean;
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
      {/* Callout: an elbowed leader draws out from the ping, then the tag wipes on at its end. */}
      <span className={`absolute top-1/2 ${flip ? "right-1/2 -scale-x-100" : "left-1/2"}`}>
        <svg width={LEAD.x + 1} height={-LEAD.y + 1} viewBox={`0 ${LEAD.y} ${LEAD.x + 1} ${-LEAD.y + 1}`} className="absolute top-0 left-0 -translate-y-full overflow-visible">
          <path
            d={`M9 -5L${LEAD.elbow} ${LEAD.y}H${LEAD.x}`}
            pathLength={1}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            className="animate-draw [stroke-dasharray:1]"
          />
          <rect x={LEAD.x - 1} y={LEAD.y - 1} width={2} height={2} fill="currentColor" className="animate-tag" />
        </svg>
      </span>
      <span
        className={`absolute animate-tag drop-shadow-[0_4px_8px_rgb(0_0_0/0.8)] ${
          flip ? "right-[calc(50%+var(--lead-x))]" : "left-[calc(50%+var(--lead-x))]"
        }`}
        style={{ "--lead-x": `${LEAD.x}px`, top: `calc(50% + ${LEAD.y}px)`, transform: "translateY(-50%)" } as React.CSSProperties}
      >
        <span
          className={`relative flex flex-col gap-[5px] bg-panel-raised py-[7px] pr-3 pl-2.5 whitespace-nowrap ${flip ? "items-end" : "items-start"}`}
          style={{ clipPath: flip ? CHAMFER_FLIP : CHAMFER }}
        >
          {/* Accent strip across the top edge, and a notch in the far corner. */}
          <span className={`absolute top-0 h-[2px] w-5 bg-current ${flip ? "right-0" : "left-0"}`} />
          <span
            className={`absolute bottom-0 size-[5px] bg-current ${flip ? "left-0" : "right-0"}`}
            style={{ clipPath: flip ? "polygon(0 0, 0 100%, 100% 100%)" : "polygon(100% 0, 100% 100%, 0 100%)" }}
          />
          <span className="font-display text-[19px] leading-[0.85] tracking-[0.06em] text-title">{label}</span>
          <span className={`flex items-center gap-1.5 font-mono text-[9px] leading-none tracking-[0.1em] ${flip ? "flex-row-reverse" : ""}`}>
            {visited !== undefined && (
              <span className={`px-1 py-[3px] font-medium ${visited ? "bg-accent text-bg" : "bg-chip text-ink"}`}>
                {visited ? "VISITED" : "PLANNED"}
              </span>
            )}
            <span className="text-ink-dim tabular-nums">
              {fmt(target.lat, "N", "S")} {fmt(target.lon, "E", "W")}
            </span>
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
