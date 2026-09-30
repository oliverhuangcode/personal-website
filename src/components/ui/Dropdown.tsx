"use client";

import { useEffect, useId, useRef, useState } from "react";

import { blip } from "@/lib/sound/sound";

export interface DropdownOption {
  value: string;
  label: string;
  /** Shown right-aligned, e.g. how many spots match. */
  count?: number;
}

interface DropdownProps {
  /** Names the control, shown muted before the value, e.g. "CUISINE". */
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
}

/** Drawn, not a glyph: two strokes that flip when the menu opens. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 10 6"
      className={`h-1.5 w-2.5 shrink-0 transition-transform duration-200 ease-snap ${open ? "rotate-180" : ""}`}
    >
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

/**
 * HUD select: a chamfered trigger over a listbox that unfolds downward.
 * Keyboard follows the ARIA listbox pattern — ↑/↓, Home/End, type-to-jump, Enter to pick,
 * Esc to close — and every key it handles is kept from the page's own shortcuts.
 */
export function Dropdown({ label, value, options, onChange, className = "" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  const show = (at = selectedIndex) => {
    setActive(at);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const pick = (i: number) => {
    if (options[i].value !== value) {
      blip("tab");
      onChange(options[i].value);
    }
    close();
  };

  // Focus the list when it opens, and close on any press outside.
  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  // Keep the highlighted option in view inside the list only.
  useEffect(() => {
    if (!open) return;
    const ul = list.current;
    const li = ul?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!ul || !li) return;
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop;
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight) {
      ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight;
    }
  }, [active, open]);

  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((a) => Math.min(last, a + 1)),
      ArrowUp: () => setActive((a) => Math.max(0, a - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      PageDown: () => setActive((a) => Math.min(last, a + 8)),
      PageUp: () => setActive((a) => Math.max(0, a - 8)),
      Enter: () => pick(active),
      " ": () => pick(active),
      Escape: () => close(),
      // ← and → belong to the page's picks; swallow them while the menu is open.
      ArrowLeft: () => {},
      ArrowRight: () => {},
    };
    if (e.key === "Tab") return close(false);
    const handler = keys[e.key];
    if (handler) {
      e.preventDefault();
      handler();
      return;
    }
    // Type to jump: the next option starting with that letter.
    if (e.key.length === 1 && /\S/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const ch = e.key.toUpperCase();
      const order = [...options.keys()].map((k) => (active + 1 + k) % options.length);
      const hit = order.find((i) => options[i].label.toUpperCase().startsWith(ch));
      if (hit !== undefined) setActive(hit);
    }
  };

  return (
    <div ref={root} className={`relative font-mono text-[11px] tracking-[0.12em] ${className}`}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`${label}: ${selected.label}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show(e.key === "ArrowUp" ? options.length - 1 : selectedIndex);
          }
        }}
        className={`chamfer-br flex w-full items-center gap-2.5 bg-panel-raised py-2.5 pr-4 pl-3 text-left transition-colors duration-150 hover:bg-chip ${
          open ? "text-accent" : "text-ink"
        }`}
      >
        <span className="text-ink-muted">{label}</span>
        <span className={`min-w-0 flex-1 truncate ${value ? "text-accent" : ""}`}>{selected.label}</span>
        {selected.count !== undefined && <span className="text-ink-muted">{selected.count}</span>}
        <Chevron open={open} />
      </button>
      {/* The trigger's underline: accent while the menu is open or a filter is set. */}
      <span
        aria-hidden
        className={`absolute inset-x-0 bottom-0 h-px transition-colors duration-150 ${open || value ? "bg-accent" : "bg-border-strong"}`}
      />

      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKey}
          className="absolute inset-x-0 top-[calc(100%+4px)] z-30 flex max-h-[min(320px,50dvh)] animate-drop flex-col gap-px overflow-y-auto overscroll-contain border border-border-strong bg-hairline shadow-[0_18px_40px_-12px_rgb(0_0_0/0.8)] outline-none [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin]"
        >
          {options.map((o, i) => {
            const isSelected = i === selectedIndex;
            const isActive = i === active;
            return (
              <li
                key={o.value}
                id={`${id}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`relative flex cursor-pointer items-center gap-3 py-2.5 pr-4 pl-3 transition-colors duration-100 ${
                  isActive ? "bg-panel-raised text-ink" : "bg-panel text-ink-dim"
                }`}
              >
                {/* Selected marks with a square, the active row with a sweep line on its left edge. */}
                <span
                  aria-hidden
                  className={`size-1.5 shrink-0 ${isSelected ? "bg-accent" : "border border-border-strong"}`}
                />
                <span className={`min-w-0 flex-1 truncate ${isSelected ? "text-accent" : ""}`}>{o.label}</span>
                {o.count !== undefined && <span className="text-ink-muted">{o.count}</span>}
                {isActive && <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-accent" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
