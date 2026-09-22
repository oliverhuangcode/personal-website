/** Remounts on every navigation, so each page gets the entry animation. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="relative z-10 flex flex-1 animate-rise flex-col">{children}</div>;
}
