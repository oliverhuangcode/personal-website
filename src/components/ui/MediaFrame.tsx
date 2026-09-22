import Image from "next/image";

import type { Photo } from "@/content/types";

interface MediaFrameProps {
  photo?: Photo;
  sizes: string;
  /** Aspect ratio, chamfer and any other frame styling. */
  className?: string;
  /** Shown centred when there is no photo yet. */
  fallback?: React.ReactNode;
}

/** A dark panel that holds a photo, or stays an empty frame until one is supplied. */
export function MediaFrame({ photo, sizes, className = "", fallback }: MediaFrameProps) {
  return (
    <div className={`relative overflow-hidden bg-panel ${className}`}>
      {photo ? (
        <Image src={photo.src} alt={photo.alt} fill sizes={sizes} className="object-cover" />
      ) : (
        fallback && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] tracking-[0.16em] text-border-strong">
            {fallback}
          </div>
        )
      )}
    </div>
  );
}
