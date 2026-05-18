export const R_EARTH = 6371000;

export const toLng = (dx: number, lat: number) =>
    (dx / (R_EARTH * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);

export const toLat = (dy: number) => (dy / R_EARTH) * (180 / Math.PI);

export function toCoord(
    dx: number,
    dy: number,
    dz: number,
    lat: number,
    lng: number,
    elev: number,
    rot: number,
): [number, number, number] {
    const rad = (rot * Math.PI) / 180;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    return [
        Math.round((lng + toLng(rx, lat)) * 1e12) / 1e12,
        Math.round((lat + toLat(ry)) * 1e12) / 1e12,
        Math.round((elev + dz) * 1000) / 1000,
    ];
}

export const closeRing = (pts: [number, number, number][]) => [...pts, pts[0]];

// Distance between two [lng,lat] points in meters, planar approx.
export function edgeMeters(a: [number, number], b: [number, number]): number {
    const meanLat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
    const dx = (b[0] - a[0]) * (Math.PI / 180) * R_EARTH * Math.cos(meanLat);
    const dy = (b[1] - a[1]) * (Math.PI / 180) * R_EARTH;
    return Math.hypot(dx, dy);
}

// Move b along the (b - a) direction so that |b' - a| equals targetMeters.
export function setEdgeLength(
    a: [number, number],
    b: [number, number],
    targetMeters: number,
): [number, number] {
    const meanLat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
    const dx = (b[0] - a[0]) * (Math.PI / 180) * R_EARTH * Math.cos(meanLat);
    const dy = (b[1] - a[1]) * (Math.PI / 180) * R_EARTH;
    const len = Math.hypot(dx, dy) || 1;
    const k = targetMeters / len;
    const newDx = dx * k;
    const newDy = dy * k;
    const newLng =
        a[0] + (newDx / (R_EARTH * Math.cos(meanLat))) * (180 / Math.PI);
    const newLat = a[1] + (newDy / R_EARTH) * (180 / Math.PI);
    return [newLng, newLat];
}

// Rotate a [lng, lat] point around a center by `rotDeg` degrees, matching
// toCoord's convention (CCW in local meters: rx = x*cos - y*sin, ry = x*sin + y*cos).
export function rotateLngLatAround(
    lng: number,
    lat: number,
    cLat: number,
    cLng: number,
    rotDeg: number,
): [number, number] {
    if (!rotDeg) return [lng, lat];
    const rad = (rotDeg * Math.PI) / 180;
    const cosLat = Math.cos((cLat * Math.PI) / 180);
    const x = (lng - cLng) * (Math.PI / 180) * R_EARTH * cosLat;
    const y = (lat - cLat) * (Math.PI / 180) * R_EARTH;
    const rx = x * Math.cos(rad) - y * Math.sin(rad);
    const ry = x * Math.sin(rad) + y * Math.cos(rad);
    const newLng = cLng + (rx / (R_EARTH * cosLat)) * (180 / Math.PI);
    const newLat = cLat + (ry / R_EARTH) * (180 / Math.PI);
    return [newLng, newLat];
}

// Convert a [lng, lat] vertex into meters relative to a center.
export function lngLatToLocalMeters(
    lng: number,
    lat: number,
    cLat: number,
    cLng: number,
): { x: number; y: number } {
    const x =
        (lng - cLng) *
        (Math.PI / 180) *
        R_EARTH *
        Math.cos((cLat * Math.PI) / 180);
    const y = (lat - cLat) * (Math.PI / 180) * R_EARTH;
    return { x, y };
}
