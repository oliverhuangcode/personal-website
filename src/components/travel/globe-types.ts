export interface LonLatPoint {
  lon: number;
  lat: number;
}

export interface GlobeProps {
  /** The selected destination. The globe flies here whenever `flyKey` changes. */
  target: LonLatPoint;
  flyKey: number;
  label: string;
  onMarkerClick: () => void;
  /** Called by the 3D globe if WebGL is unavailable, so the caller can fall back to 2D. */
  onUnsupported?: () => void;
}
