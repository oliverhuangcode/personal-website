import Image from "next/image";

import { site } from "@/content/site";

/** Full-bleed photo behind every page, under a fixed scrim. Renders nothing until a photo is set. */
export function Background() {
  if (!site.background) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <Image src={site.background.src} alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#08070cee_0%,#08070c99_34%,#08070c66_60%,#08070cf2_100%)]" />
    </div>
  );
}
