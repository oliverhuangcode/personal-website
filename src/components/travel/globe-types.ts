export interface LonLatPoint {
  lon: number;
  lat: number;
}

/** A trip shown on the globe as a marker of its own. */
export interface Destination extends LonLatPoint {
  label: string;
  visited: boolean;
}

export interface GlobeProps {
  /** The selected destination. The globe flies here whenever `flyKey` changes. */
  target: LonLatPoint;
  flyKey: number;
  label: string;
  /** Position in the destination list, shown in the marker readout. */
  index?: number;
  onMarkerClick: () => void;
  /** Every trip, marked on the globe; the one at `index` is drawn as the selected ping. */
  destinations?: Destination[];
  onSelect?: (index: number) => void;
  /** Called by the 3D globe if WebGL is unavailable, so the caller can fall back to 2D. */
  onUnsupported?: () => void;
}
