import type { LonLatPoint } from "./globe-types";

/** Pin size in CSS px; also the marker's hit target. Its tip is the bottom-centre. */
export const PIN_W = 26;
export const PIN_H = 34;

const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;

// Pin in a 26x34 box: head centred at (13, 12), tip at (13, 34), with a hole cut through the head.
const HEAD = { x: 13, y: 12, r: 10 };
const PIN_PATH =
  `M13 33.5C13 33.5 3 21.5 3 12a10 10 0 0 1 20 0c0 9.5-10 21.5-10 21.5Z` +
  `M17 12a4 4 0 1 0-8 0a4 4 0 1 0 8 0Z`;

/**
 * The destination marker: a map pin with a HUD finish. It drops onto the target as the
 * flight lands, corner brackets lock around its head, and a readout tag shows the
 * coordinates. Purely decorative: it sits inside the marker button, which carries the
 * accessible label.
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
  const b = HEAD.r + 4;
  const arm = 5;
  const [l, t, r, btm] = [HEAD.x - b, HEAD.y - b, HEAD.x + b, HEAD.y + b];
  return (
    <span aria-hidden key={lockKey} className="pointer-events-none absolute inset-0 text-accent">
      <svg
        viewBox={`0 0 ${PIN_W} ${PIN_H}`}
        className="absolute inset-0 size-full animate-lock overflow-visible"
        style={{ transformOrigin: `50% ${(HEAD.y / PIN_H) * 100}%` }}
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          d={`M${l} ${t + arm}V${t}H${l + arm} M${r - arm} ${t}H${r}V${t + arm} M${r} ${btm - arm}V${btm}H${r - arm} M${l + arm} ${btm}H${l}V${btm - arm}`}
        />
      </svg>
      <svg viewBox={`0 0 ${PIN_W} ${PIN_H}`} className="absolute inset-0 size-full animate-drop overflow-visible">
        <path d={PIN_PATH} fill="currentColor" fillRule="evenodd" stroke="var(--color-bg)" strokeWidth={1} />
        {/* Crosshair ticks and a pip inside the hole. */}
        <path
          stroke="currentColor"
          strokeWidth={1}
          d={`M${HEAD.x} ${HEAD.y - 2.6}V${HEAD.y - 1.6} M${HEAD.x} ${HEAD.y + 1.6}V${HEAD.y + 2.6} M${HEAD.x - 2.6} ${HEAD.y}H${HEAD.x - 1.6} M${HEAD.x + 1.6} ${HEAD.y}H${HEAD.x + 2.6}`}
        />
        <circle cx={HEAD.x} cy={HEAD.y} r={0.9} fill="currentColor" />
      </svg>
      <span
        className={`absolute top-[-4px] flex animate-tag flex-col gap-px border-l border-accent bg-bg/80 px-1.5 py-1 font-mono text-[9px] leading-none tracking-[0.12em] whitespace-nowrap ${
          flip ? "right-[calc(100%+8px)] items-end border-r border-l-0" : "left-[calc(100%+8px)]"
        }`}
      >
        <span className="text-ink">
          TGT-{String(index + 1).padStart(3, "0")} · {label.toUpperCase()}
        </span>
        <span className="text-ink-muted">
          {fmt(target.lat, "N", "S")} {fmt(target.lon, "E", "W")}
        </span>
      </span>
    </span>
  );
}
