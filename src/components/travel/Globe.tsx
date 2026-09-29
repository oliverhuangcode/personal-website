"use client";

import { useCallback, useState } from "react";

import { Globe2D } from "./Globe2D";
import { Globe3D } from "./Globe3D";
import type { GlobeProps } from "./globe-types";

/** The travel globe: a real 3D scene, or the flat SVG drawing where WebGL isn't available. */
export function Globe(props: Omit<GlobeProps, "onUnsupported">) {
  const [webgl, setWebgl] = useState(true);
  const fallBack = useCallback(() => setWebgl(false), []);
  return webgl ? <Globe3D {...props} onUnsupported={fallBack} /> : <Globe2D {...props} />;
}
