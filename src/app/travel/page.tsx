import type { Metadata } from "next";

import { TravelExplorer } from "@/components/travel/TravelExplorer";
import { trips } from "@/content/trips";

export const metadata: Metadata = { title: "Travel" };

export default function TravelPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-5 px-gutter py-section">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-page-title font-normal text-title">TRAVEL</h1>
        <p className="font-mono text-[12px] tracking-[0.2em] text-ink-muted">SELECT A DESTINATION · DRAG TO SPIN</p>
      </header>
      <TravelExplorer trips={trips} />
    </main>
  );
}
