/** Underline with an arrow resting on it and a crossed stem hanging below — marks the current page or tab. */
export function SelectedMarker() {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] bg-accent" />
      <svg
        aria-hidden
        viewBox="0 0 12 20"
        className="pointer-events-none absolute left-1/2 top-full h-5 w-3 -translate-x-1/2 -translate-y-[7px] fill-accent"
      >
        <path d="M6 1 10 6H2Z" />
        <rect x="5.5" y="6" width="1" height="12" />
        <rect x="2" y="11" width="8" height="1" />
        <rect x="3.5" y="14" width="5" height="1" />
      </svg>
    </>
  );
}
