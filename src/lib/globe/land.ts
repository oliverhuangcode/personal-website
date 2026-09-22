import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { MultiPolygon, Polygon } from "geojson";
import land110m from "world-atlas/land-110m.json";

import type { LonLat } from "./projection";

/**
 * Natural Earth 1:110m land (public domain), flattened to coastline rings.
 * Includes lake holes: the globe draws coastlines stroke-only, so every ring
 * is just a line to trace.
 */
function loadLandRings(): LonLat[][] {
  const topo = land110m as unknown as Topology<{ land: GeometryCollection }>;
  const rings: LonLat[][] = [];
  for (const f of feature(topo, topo.objects.land).features) {
    const geom = f.geometry as Polygon | MultiPolygon;
    const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    for (const polygon of polygons) {
      for (const ring of polygon) rings.push(ring.map(([lon, lat]) => [lon, lat] as const));
    }
  }
  return rings;
}

export const LAND_RINGS: readonly LonLat[][] = loadLandRings();
