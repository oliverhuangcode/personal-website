import { SoundToggle } from "./SoundToggle";

export function Footer() {
  return (
    <footer className="relative z-20 flex items-center justify-center gap-4 border-t border-hairline bg-panel-glass px-gutter py-3 font-mono text-[11px] tracking-[0.14em] text-ink-muted">
      {/* Keyboard hints are meaningless without a keyboard; small screens get the SFX toggle here instead. */}
      <span className="hidden sm:inline">1–5 NAVIGATE · ↑↓ CYCLE · S SOUND</span>
      <SoundToggle className="sm:hidden" />
    </footer>
  );
}
