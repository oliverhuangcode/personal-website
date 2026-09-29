"use client";

import { MediaFrame } from "@/components/ui/MediaFrame";
import type { Photo } from "@/content/types";

interface PhotoCarouselProps {
  /** A slide without a photo shows its `fallbacks` entry in an empty frame. */
  photos: (Photo | undefined)[];
  fallbacks?: string[];
  index: number;
  onChange: (index: number) => void;
  label: string;
  /** Changing this replays the frame's reveal, e.g. on picking another trip. */
  revealKey?: string | number;
}

const arrow = "px-2 py-0.5 font-mono text-[12px] text-ink-muted hover:text-ink";

/** One slide per photo. Controls only appear when there is more than one. */
export function PhotoCarousel({ photos, fallbacks, index, onChange, label, revealKey }: PhotoCarouselProps) {
  const count = photos.length;
  const current = count ? Math.min(index, count - 1) : 0;
  const go = (i: number) => onChange((i + count) % count);

  return (
    <div className="flex flex-col gap-2.5">
      <div key={`${revealKey}-${current}`} className="animate-wipe">
        <MediaFrame
          photo={photos[current]}
          fallback={fallbacks?.[current]}
          sizes="(min-width: 1280px) 400px, (min-width: 800px) 33vw, 100vw"
          className="chamfer-x-sm aspect-[4/3]"
        />
      </div>
      {count > 1 && (
        <div role="group" aria-label={`${label} photos`} className="flex items-center justify-center gap-2">
          <button type="button" aria-label="Previous photo" onClick={() => go(current - 1)} className={arrow}>
            ◂
          </button>
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Photo ${i + 1} of ${count}`}
              aria-current={i === current}
              onClick={() => go(i)}
              className={`h-1 w-6 transition-colors duration-150 ${i === current ? "bg-accent" : "bg-border-strong"}`}
            />
          ))}
          <button type="button" aria-label="Next photo" onClick={() => go(current + 1)} className={arrow}>
            ▸
          </button>
        </div>
      )}
    </div>
  );
}
