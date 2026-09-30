"use client";

import Image from "next/image";
import { useState } from "react";

import type { Photo } from "@/content/types";

interface MediaFrameProps {
  photo?: Photo;
  sizes: string;
  /** Aspect ratio, chamfer and any other frame styling. */
  className?: string;
  /** Shown centred when there is no photo yet. */
  fallback?: React.ReactNode;
  /** Ease the photo in slightly while an ancestor `group` is hovered. */
  zoom?: boolean;
  /** Use the photo's small copy, for thumbnails and cards. */
  thumb?: boolean;
  /** Extra classes on the image itself, e.g. a darkening filter. */
  imageClassName?: string;
}

/**
 * A dark panel that holds a photo, or stays an empty frame until one is supplied.
 * While a photo loads the frame shows its dominant colour, then the photo fades in.
 */
export function MediaFrame({
  photo,
  sizes,
  className = "",
  fallback,
  zoom = false,
  thumb = false,
  imageClassName = "",
}: MediaFrameProps) {
  const src = photo && (thumb && photo.thumb ? photo.thumb : photo.src);
  const [loaded, setLoaded] = useState<string>();

  return (
    <div className={`relative overflow-hidden bg-panel ${className}`} style={{ backgroundColor: photo?.color }}>
      {photo && src ? (
        <Image
          key={src}
          src={src}
          alt={photo.alt}
          fill
          sizes={sizes}
          // A cached photo can finish before hydration, so check `complete` as well as onLoad.
          ref={(img) => {
            if (img?.complete) setLoaded(src);
          }}
          onLoad={() => setLoaded(src)}
          className={`object-cover transition-[opacity,scale] duration-500 ease-snap ${
            loaded === src ? "opacity-100" : "opacity-0"
          } ${zoom ? "group-hover:scale-[1.04]" : ""} ${imageClassName}`}
        />
      ) : (
        fallback && (
          <div className="absolute inset-0 flex items-center justify-center p-3 text-center font-mono text-[11px] tracking-[0.16em] text-ink-muted">
            {fallback}
          </div>
        )
      )}
    </div>
  );
}
