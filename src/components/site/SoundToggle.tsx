"use client";

import { toggleSound, useSoundEnabled } from "@/lib/sound/sound";

export function SoundToggle({ className = "" }: { className?: string }) {
  const on = useSoundEnabled();
  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-pressed={on}
      aria-label="Sound effects"
      className={`flex items-center gap-[9px] border border-hairline px-[13px] py-[9px] font-mono text-[11px] font-medium tracking-[0.12em] text-ink transition-colors duration-150 hover:border-accent ${className}`}
    >
      <span>SFX</span>
      <span className="text-accent">{on ? "ON" : "OFF"}</span>
    </button>
  );
}
