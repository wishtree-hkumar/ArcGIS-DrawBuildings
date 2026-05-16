// Generate ready-to-place CustomFootprint shapes from simple parameters.
// Coordinates are produced in [lng, lat] around the given center, by
// converting LOCAL meters → degrees with the standard equirectangular approx.

import { CustomFootprint } from "../types/building.types";
import { R_EARTH } from "./geoUtils";

export type TemplateId =
    | "rectangle"
    | "L-shape"
    | "T-shape"
    | "U-shape"
    | "plus"
    | "courtyard";

export interface TemplateParams {
    /** Overall bounding length (m, x-axis). */
    len: number;
    /** Overall bounding width (m, y-axis). */
    wid: number;
    /** Arm thickness for L/T/U/+ (m). Ignored for rectangle/courtyard. */
    arm?: number;
    /** Inner-courtyard inset (m). Used by courtyard template. */
    courtyardInset?: number;
}

interface Center { lat: number; lng: number; baseZ: number; }

function localToLngLat(mx: number, my: number, c: Center): [number, number] {
    const mPerDegLat = R_EARTH * (Math.PI / 180);
    const mPerDegLng = R_EARTH * Math.cos((c.lat * Math.PI) / 180) * (Math.PI / 180);
    return [c.lng + mx / mPerDegLng, c.lat + my / mPerDegLat];
}

function ringFromLocal(pts: [number, number][], c: Center): [number, number][] {
    return pts.map(([x, y]) => localToLngLat(x, y, c));
}

/**
 * Build a footprint for a given template, centered at (c.lat, c.lng) with the
 * given baseZ. Returns CustomFootprint ready to drop into a SavedBuilding.
 *
 * All local coordinates are in the building's UNROTATED frame (matching how
 * `buildCustomFaces` consumes `ringLngLat`).
 */
export function makeTemplateFootprint(
    id: TemplateId,
    p: TemplateParams,
    c: Center,
): CustomFootprint {
    const hl = p.len / 2;
    const hw = p.wid / 2;
    const arm = Math.max(1, Math.min(p.arm ?? Math.min(p.len, p.wid) / 3, Math.min(p.len, p.wid) / 2));
    const inset = Math.max(1, p.courtyardInset ?? Math.min(p.len, p.wid) / 5);

    let local: [number, number][];
    let holesLocal: [number, number][][] | undefined;

    switch (id) {
        case "rectangle":
            local = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]];
            break;

        case "L-shape":
            // Long horizontal arm on bottom, vertical arm rising on the left.
            local = [
                [-hl, -hw],
                [hl, -hw],
                [hl, -hw + arm],
                [-hl + arm, -hw + arm],
                [-hl + arm, hw],
                [-hl, hw],
            ];
            break;

        case "T-shape":
            // Horizontal cap on top, stem going down center.
            local = [
                [-hl, hw - arm],
                [hl, hw - arm],
                [hl, hw],
                [-hl, hw],
                [-hl, hw - arm],
                [-arm / 2, hw - arm],
                [-arm / 2, -hw],
                [arm / 2, -hw],
                [arm / 2, hw - arm],
            ];
            // Simpler well-formed T:
            local = [
                [-arm / 2, -hw],
                [arm / 2, -hw],
                [arm / 2, hw - arm],
                [hl, hw - arm],
                [hl, hw],
                [-hl, hw],
                [-hl, hw - arm],
                [-arm / 2, hw - arm],
            ];
            break;

        case "U-shape":
            // Open top — like a C laid on its back. Arms go up on left and right.
            local = [
                [-hl, -hw],
                [hl, -hw],
                [hl, hw],
                [hl - arm, hw],
                [hl - arm, -hw + arm],
                [-hl + arm, -hw + arm],
                [-hl + arm, hw],
                [-hl, hw],
            ];
            break;

        case "plus":
            // Greek-cross / plus-sign.
            local = [
                [-arm / 2, -hw],
                [arm / 2, -hw],
                [arm / 2, -arm / 2],
                [hl, -arm / 2],
                [hl, arm / 2],
                [arm / 2, arm / 2],
                [arm / 2, hw],
                [-arm / 2, hw],
                [-arm / 2, arm / 2],
                [-hl, arm / 2],
                [-hl, -arm / 2],
                [-arm / 2, -arm / 2],
            ];
            break;

        case "courtyard":
            // Outer rectangle with an inner rectangular cutout (light well).
            local = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]];
            holesLocal = [[
                [-hl + inset, -hw + inset],
                [hl - inset, -hw + inset],
                [hl - inset, hw - inset],
                [-hl + inset, hw - inset],
            ]];
            break;

        default:
            local = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]];
    }

    const center: Center = c;
    const ringLngLat = ringFromLocal(local, center);
    const holesLngLat = holesLocal?.map((h) => ringFromLocal(h, center));

    return {
        ringLngLat,
        holesLngLat,
        centerLat: c.lat,
        centerLng: c.lng,
        baseZ: c.baseZ,
    };
}

export const TEMPLATE_LIST: { id: TemplateId; label: string; icon: string }[] = [
    { id: "rectangle", label: "Rectangle", icon: "▭" },
    { id: "L-shape", label: "L-shape", icon: "L" },
    { id: "T-shape", label: "T-shape", icon: "T" },
    { id: "U-shape", label: "U-shape", icon: "U" },
    { id: "plus", label: "Plus / Cross", icon: "+" },
    { id: "courtyard", label: "Courtyard", icon: "▢" },
];
