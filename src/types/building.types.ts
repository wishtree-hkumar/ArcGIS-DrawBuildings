export type RoofType =
    | "flat"
    | "gabled"
    | "monopitch"
    | "sawtooth"
    | "hipped"
    | "barrel";

export interface Obstacle {
    type: string;
    color: string;
    rx: number;
    ry: number;
    w: number;
    d: number;
    h: number;
}

export interface BuildingParams {
    name: string;
    lat: number;
    lng: number;
    elev: number;
    len: number;
    wid: number;
    wh: number;
    rot: number;
    parapet: number;
    parapetWidth: number;
    pitch: number;
    spans: number;
}

export interface CustomFootprint {
    // Outer vertices in [lng, lat] (open ring — last != first; we close on render).
    ringLngLat: [number, number][];
    // Optional inner rings = courtyards / holes. Each is an open ring in [lng, lat],
    // wound opposite to the outer ring (ArcGIS Polygon convention).
    holesLngLat?: [number, number][][];
    centerLat: number;
    centerLng: number;
    baseZ: number; // sampled ground elevation (m ASL)
    scale?: number; // uniform scale factor applied around centroid at render time (default 1)
}

/**
 * A stacked volume on top of a parent building (think: tower core on a podium,
 * raised mechanical penthouse, second-floor wing).
 *
 * The footprint is stored in LOCAL METERS in the parent's UNROTATED frame —
 * same convention as `Obstacle.rx/ry` — so the volume rides along when the
 * parent is moved, rotated, or scaled.
 */
export interface BuildingVolume {
    id: string;
    /** Outer ring in local meters relative to parent center (unrotated frame). */
    ringLocal: [number, number][];
    /** Optional courtyard cutouts, same frame. */
    holesLocal?: [number, number][][];
    /** Vertical offset from the parent's roof top (m). 0 = sits directly on. */
    baseOffset: number;
    wh: number;
    roofType: RoofType;
    pitch: number;
    parapet: number;
    parapetWidth: number;
    /** Rotation around the volume's centroid (deg, CCW). Composed with parent.rot. */
    rotDeg?: number;
    /** Optional color tint (#rrggbb). */
    wallColorHex?: string;
    roofColorHex?: string;
}

export interface SavedBuilding {
    id: string;
    params: BuildingParams;
    roofType: RoofType;
    obstacles: Obstacle[];
    custom?: CustomFootprint;
    /** Optional stack of additional volumes sitting on top of this building. */
    volumes?: BuildingVolume[];
}

export const OBSTACLE_PRESETS: {
    type: string;
    color: string;
    w: number;
    d: number;
    h: number;
    sub: string;
}[] = [
    { type: "HVAC Unit", color: "#ff6b35", w: 2, d: 2, h: 1.2, sub: "AC/heating" },
    { type: "Exhaust Vent", color: "#a855f7", w: 0.8, d: 0.8, h: 0.6, sub: "fan/pipe" },
    { type: "Skylight", color: "#00d4ff", w: 3, d: 1.5, h: 0.1, sub: "glazed" },
    { type: "Stairwell", color: "#f59e0b", w: 4, d: 4, h: 2.5, sub: "access" },
    { type: "Chimney", color: "#ef4444", w: 0.6, d: 0.6, h: 1.5, sub: "stack" },
    { type: "Water Tank", color: "#10b981", w: 2.5, d: 2.5, h: 2, sub: "storage" },
    { type: "Ridge Beam", color: "#6b7280", w: 8, d: 0.3, h: 0.3, sub: "structural" },
];

export interface FaceSpec {
    desc: string;
    color: number[];
    rings: [number, number, number][][];
    /**
     * If true, all `rings` are emitted as a SINGLE multi-ring Polygon
     * (outer + holes) instead of one Polygon per ring. Required for
     * roofs/parapets with courtyard cutouts.
     */
    multiRing?: boolean;
    extras?: Record<string, any>;
}
