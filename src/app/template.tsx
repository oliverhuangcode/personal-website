import { ViewTransition } from "react";

/** Navigations carry no type on browser back/forward; those get a plain crossfade. */
const byDirection = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "nav-fade" };

/**
 * Remounts on every navigation, so each page enters and exits: sliding in from
 * the side of the header it sits on (types come from NavLink and KeyboardNav).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={byDirection} exit={byDirection} default="none">
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}
