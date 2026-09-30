"use client";

import { useRouter } from "next/navigation";

import { useArrowCycle } from "@/lib/keys";
import { blip } from "@/lib/sound/sound";

/** ← / → step between the food tabs, wrapping, like the header's ↑ / ↓ step between pages. */
export function FoodTabKeys({ hrefs, current }: { hrefs: readonly string[]; current: number }) {
  const router = useRouter();
  useArrowCycle((step) => {
    const next = hrefs[(current + step + hrefs.length) % hrefs.length];
    blip("nav");
    router.push(next, { transitionTypes: [step > 0 ? "nav-forward" : "nav-back"] });
  });
  return null;
}
