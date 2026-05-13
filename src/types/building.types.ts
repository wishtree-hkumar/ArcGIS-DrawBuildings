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
    pitch: number;
    spans: number;
}

export interface CustomFootprint {
    // Vertices in [lng, lat] (open ring — last != first; we close on render).
    ringLngLat: [number, number][];
    centerLat: number;
    centerLng: number;
    baseZ: number; // sampled ground elevation (m ASL)
}

export interface SavedBuilding {
    id: string;
    params: BuildingParams;
    roofType: RoofType;
    obstacles: Obstacle[];
    custom?: CustomFootprint;
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
    extras?: Record<string, any>;
}
