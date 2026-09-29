"use client";

import { useCallback, useState } from "react";

import { HoloCore2D } from "./HoloCore2D";
import { HoloCore3D } from "./HoloCore3D";

/** The home page's spike: a real 3D scene, or the flat canvas drawing where WebGL isn't available. */
export function HoloCore() {
  const [webgl, setWebgl] = useState(true);
  const fallBack = useCallback(() => setWebgl(false), []);
  return webgl ? <HoloCore3D onUnsupported={fallBack} /> : <HoloCore2D />;
}
