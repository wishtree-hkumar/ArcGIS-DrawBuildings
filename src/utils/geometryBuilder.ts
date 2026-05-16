import Graphic from "@arcgis/core/Graphic";
import Polygon from "@arcgis/core/geometry/Polygon";
import {
    SavedBuilding,
    BuildingParams,
    BuildingVolume,
    RoofType,
    Obstacle,
    FaceSpec,
} from "../types/building.types";
import {
    toCoord,
    closeRing,
    lngLatToLocalMeters,
    rotateLngLatAround,
    R_EARTH,
} from "./geoUtils";

export function buildFaces(
    p: BuildingParams,
    rt: RoofType,
    obs: Obstacle[],
): FaceSpec[] {
    const C = (dx: number, dy: number, dz: number) =>
        toCoord(dx, dy, dz, p.lat, p.lng, p.elev, p.rot);
    const hl = p.len / 2;
    const hw = p.wid / 2;
    const wh = p.wh;
    const pitchH = p.wid * (p.pitch / 100);
    const out: FaceSpec[] = [];

    const wallColor = [200, 200, 200, 1];
    const roofColor = [160, 140, 100, 1];
    const parapetColor = [120, 120, 120, 1];

    // Walls + floor
    out.push({
        desc: "Walls",
        color: wallColor,
        rings: [
            closeRing([C(-hl, -hw, 0), C(hl, -hw, 0), C(hl, -hw, wh), C(-hl, -hw, wh)]),
            closeRing([C(-hl, hw, 0), C(hl, hw, 0), C(hl, hw, wh), C(-hl, hw, wh)]),
            closeRing([C(-hl, -hw, 0), C(-hl, hw, 0), C(-hl, hw, wh), C(-hl, -hw, wh)]),
            closeRing([C(hl, -hw, 0), C(hl, hw, 0), C(hl, hw, wh), C(hl, -hw, wh)]),
        ],
    });

    // Roof
    if (rt === "flat") {
        out.push({
            desc: "Roof_flat",
            color: roofColor,
            rings: [closeRing([C(-hl, -hw, wh), C(hl, -hw, wh), C(hl, hw, wh), C(-hl, hw, wh)])],
        });
    } else if (rt === "gabled") {
        out.push({
            desc: "Roof_gabled",
            color: roofColor,
            rings: [
                closeRing([C(-hl, 0, wh + pitchH), C(hl, 0, wh + pitchH), C(hl, -hw, wh), C(-hl, -hw, wh)]),
                closeRing([C(-hl, 0, wh + pitchH), C(hl, 0, wh + pitchH), C(hl, hw, wh), C(-hl, hw, wh)]),
                closeRing([C(-hl, -hw, wh), C(-hl, 0, wh + pitchH), C(-hl, hw, wh)]),
                closeRing([C(hl, -hw, wh), C(hl, 0, wh + pitchH), C(hl, hw, wh)]),
            ],
        });
    } else if (rt === "monopitch") {
        const rh = pitchH;
        out.push({
            desc: "Roof_monopitch",
            color: roofColor,
            rings: [
                closeRing([C(-hl, -hw, wh), C(hl, -hw, wh), C(hl, hw, wh + rh), C(-hl, hw, wh + rh)]),
                closeRing([C(-hl, -hw, wh), C(-hl, hw, wh + rh), C(-hl, hw, wh)]),
                closeRing([C(hl, -hw, wh), C(hl, hw, wh + rh), C(hl, hw, wh)]),
            ],
        });
    } else if (rt === "sawtooth") {
        const sw = p.wid / p.spans;
        const rings: [number, number, number][][] = [];
        for (let i = 0; i < p.spans; i++) {
            const y0 = -hw + i * sw;
            const y1 = y0 + sw;
            const z0 = wh;
            const z1 = wh + sw * (p.pitch / 100);
            rings.push(closeRing([C(-hl, y0, z0), C(hl, y0, z0), C(hl, y1, z1), C(-hl, y1, z1)]));
            rings.push(closeRing([C(-hl, y0, z0), C(-hl, y1, z1), C(-hl, y1, z0)]));
            rings.push(closeRing([C(hl, y0, z0), C(hl, y1, z1), C(hl, y1, z0)]));
        }
        out.push({ desc: "Roof_sawtooth", color: roofColor, rings });
    } else if (rt === "hipped") {
        const rs = hl - hw * 0.5;
        out.push({
            desc: "Roof_hipped",
            color: roofColor,
            rings: [
                closeRing([C(-rs, 0, wh + pitchH), C(rs, 0, wh + pitchH), C(hl, -hw, wh), C(-hl, -hw, wh)]),
                closeRing([C(-rs, 0, wh + pitchH), C(rs, 0, wh + pitchH), C(hl, hw, wh), C(-hl, hw, wh)]),
                closeRing([C(-hl, -hw, wh), C(-rs, 0, wh + pitchH), C(-hl, hw, wh)]),
                closeRing([C(hl, -hw, wh), C(rs, 0, wh + pitchH), C(hl, hw, wh)]),
            ],
        });
    } else if (rt === "barrel") {
        const rings: [number, number, number][][] = [];
        for (let i = 0; i < 12; i++) {
            const t0 = i / 12;
            const t1 = (i + 1) / 12;
            const y0 = -hw + t0 * p.wid;
            const y1 = -hw + t1 * p.wid;
            const z0 = wh + Math.sin(t0 * Math.PI) * pitchH;
            const z1 = wh + Math.sin(t1 * Math.PI) * pitchH;
            rings.push(closeRing([C(-hl, y0, z0), C(hl, y0, z0), C(hl, y1, z1), C(-hl, y1, z1)]));
        }
        out.push({ desc: "Roof_barrel", color: roofColor, rings });
    }

    if (p.parapet > 0 && rt === "flat") {
        out.push({
            desc: "Parapet",
            color: parapetColor,
            rings: [
                closeRing([C(-hl, -hw, wh), C(hl, -hw, wh), C(hl, -hw, wh + p.parapet), C(-hl, -hw, wh + p.parapet)]),
                closeRing([C(-hl, hw, wh), C(hl, hw, wh), C(hl, hw, wh + p.parapet), C(-hl, hw, wh + p.parapet)]),
                closeRing([C(-hl, -hw, wh), C(-hl, hw, wh), C(-hl, hw, wh + p.parapet), C(-hl, -hw, wh + p.parapet)]),
                closeRing([C(hl, -hw, wh), C(hl, hw, wh), C(hl, hw, wh + p.parapet), C(hl, -hw, wh + p.parapet)]),
            ],
        });
    }

    const roofZAt = (ry: number): number => {
        if (rt === "gabled") return wh + (1 - Math.min(Math.abs(ry) / hw, 1)) * pitchH;
        if (rt === "monopitch") return wh + Math.max(0, Math.min(1, (ry + hw) / p.wid)) * pitchH;
        if (rt === "sawtooth") {
            const spanW = p.wid / p.spans;
            const rel = Math.max(0, Math.min(p.wid - 1e-6, ry + hw));
            const si = Math.min(Math.floor(rel / spanW), p.spans - 1);
            const t = (rel - si * spanW) / spanW;
            return wh + t * spanW * (p.pitch / 100);
        }
        if (rt === "barrel") {
            const t = Math.max(0, Math.min(1, (ry + hw) / p.wid));
            return wh + Math.sin(t * Math.PI) * pitchH;
        }
        if (rt === "hipped") return wh + (1 - Math.min(Math.abs(ry) / hw, 1)) * pitchH;
        return wh;
    };

    for (const o of obs) {
        const sw2 = o.w / 2;
        const sd2 = o.d / 2;
        // Snap obstacle base to the lowest roof point under its footprint so
        // sloped/curved roofs don't show a gap beneath the box. Sample edges
        // (and a few interior y's for curved roofs) since extrema may be interior.
        const ySamples = [o.ry - sd2, o.ry, o.ry + sd2];
        if (rt === "barrel" || rt === "sawtooth") {
            const steps = 6;
            for (let i = 1; i < steps; i++) {
                ySamples.push(o.ry - sd2 + (i / steps) * o.d);
            }
        }
        let bz = Infinity;
        for (const ys of ySamples) {
            const z = roofZAt(ys);
            if (z < bz) bz = z;
        }
        if (!isFinite(bz)) bz = wh;
        const ox = o.rx;
        const oy = o.ry;
        const oz = bz;
        const hx = parseInt(o.color.slice(1, 3), 16);
        const hy = parseInt(o.color.slice(3, 5), 16);
        const hz = parseInt(o.color.slice(5, 7), 16);
        out.push({
            desc: `Obstacle_${o.type}`,
            color: [hx, hy, hz, 1],
            rings: [
                closeRing([C(ox - sw2, oy - sd2, oz), C(ox + sw2, oy - sd2, oz), C(ox + sw2, oy - sd2, oz + o.h), C(ox - sw2, oy - sd2, oz + o.h)]),
                closeRing([C(ox - sw2, oy + sd2, oz), C(ox + sw2, oy + sd2, oz), C(ox + sw2, oy + sd2, oz + o.h), C(ox - sw2, oy + sd2, oz + o.h)]),
                closeRing([C(ox - sw2, oy - sd2, oz), C(ox - sw2, oy + sd2, oz), C(ox - sw2, oy + sd2, oz + o.h), C(ox - sw2, oy - sd2, oz + o.h)]),
                closeRing([C(ox + sw2, oy - sd2, oz), C(ox + sw2, oy + sd2, oz), C(ox + sw2, oy + sd2, oz + o.h), C(ox + sw2, oy - sd2, oz + o.h)]),
                closeRing([C(ox - sw2, oy - sd2, oz + o.h), C(ox + sw2, oy - sd2, oz + o.h), C(ox + sw2, oy + sd2, oz + o.h), C(ox - sw2, oy + sd2, oz + o.h)]),
            ],
            extras: { obstacleType: o.type },
        });
    }

    return out;
}

export function buildCustomFaces(b: SavedBuilding): FaceSpec[] {
    const c = b.custom!;
    const rot = b.params.rot || 0;
    const scale = c.scale ?? 1;
    const scaled: [number, number][] = scale === 1
        ? c.ringLngLat
        : c.ringLngLat.map(([lng, lat]) => [
              c.centerLng + (lng - c.centerLng) * scale,
              c.centerLat + (lat - c.centerLat) * scale,
          ] as [number, number]);
    const ring: [number, number][] = rot
        ? scaled.map(
              ([lng, lat]) =>
                  rotateLngLatAround(lng, lat, c.centerLat, c.centerLng, rot) as [number, number],
          )
        : scaled;
    const wh = b.params.wh;
    const parapet = b.params.parapet;
    const baseZ = c.baseZ;
    const out: FaceSpec[] = [];
    const wallColor = [200, 200, 200, 1];
    const roofColor = [160, 140, 100, 1];
    const parapetColor = [120, 120, 120, 1];

    const closed = [...ring, ring[0]];

    // ----- Holes (courtyards) -----
    // Apply the same scale + rotation pipeline to every inner ring.
    const transformRing = (r: [number, number][]): [number, number][] => {
        const sc = scale === 1
            ? r
            : r.map(([lng, lat]) => [
                c.centerLng + (lng - c.centerLng) * scale,
                c.centerLat + (lat - c.centerLat) * scale,
            ] as [number, number]);
        return rot
            ? sc.map(([lng, lat]) => rotateLngLatAround(lng, lat, c.centerLat, c.centerLng, rot) as [number, number])
            : sc;
    };
    // Signed area in local meters → > 0 means CCW.
    const signedArea = (r: [number, number][]): number => {
        let s = 0;
        for (let i = 0; i < r.length; i++) {
            const a = lngLatToLocalMeters(r[i][0], r[i][1], c.centerLat, c.centerLng);
            const b = lngLatToLocalMeters(r[(i + 1) % r.length][0], r[(i + 1) % r.length][1], c.centerLat, c.centerLng);
            s += a.x * b.y - b.x * a.y;
        }
        return s;
    };
    const outerCCW = signedArea(ring) > 0;
    const holes: [number, number][][] = (c.holesLngLat ?? []).map((h) => {
        const t = transformRing(h);
        // Holes must be wound opposite to the outer ring (ArcGIS Polygon spec).
        const holeCCW = signedArea(t) > 0;
        return holeCCW === outerCCW ? t.slice().reverse() : t;
    });

    let topZ: (lng: number, lat: number) => number;
    if (b.roofType === "monopitch") {
        const ys = ring.map((v) => lngLatToLocalMeters(v[0], v[1], c.centerLat, c.centerLng).y);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const span = Math.max(maxY - minY, 0.01);
        const rise = span * (b.params.pitch / 100);
        topZ = (lng, lat) => {
            const { y } = lngLatToLocalMeters(lng, lat, c.centerLat, c.centerLng);
            return baseZ + wh + ((y - minY) / span) * rise;
        };
    } else {
        topZ = () => baseZ + wh;
    }

    for (let i = 0; i < closed.length - 1; i++) {
        const [x1, y1] = closed[i];
        const [x2, y2] = closed[i + 1];
        const t1 = topZ(x1, y1);
        const t2 = topZ(x2, y2);
        out.push({
            desc: "Wall",
            color: wallColor,
            rings: [[[x1, y1, baseZ], [x2, y2, baseZ], [x2, y2, t2], [x1, y1, t1], [x1, y1, baseZ]]],
        });
    }

    // Inner walls for each hole (extruded down from roof to base).
    for (const h of holes) {
        const closedH = [...h, h[0]];
        for (let i = 0; i < closedH.length - 1; i++) {
            const [x1, y1] = closedH[i];
            const [x2, y2] = closedH[i + 1];
            const t1 = topZ(x1, y1);
            const t2 = topZ(x2, y2);
            out.push({
                desc: "WallInner",
                color: wallColor,
                rings: [[[x1, y1, baseZ], [x2, y2, baseZ], [x2, y2, t2], [x1, y1, t1], [x1, y1, baseZ]]],
            });
        }
    }

    const roofRing = closed.map(([x, y]) => [x, y, topZ(x, y)] as [number, number, number]);
    const roofHoleRings = holes.map((h) =>
        [...h, h[0]].map(([x, y]) => [x, y, topZ(x, y)] as [number, number, number])
    );
    out.push({
        desc: `Roof_${b.roofType}_custom`,
        color: roofColor,
        rings: [roofRing, ...roofHoleRings],
        multiRing: roofHoleRings.length > 0,
    });

    if (parapet > 0) {
        const parapetWidth = Math.max(0, b.params.parapetWidth || 0);
        const mPerDegLatP = R_EARTH * (Math.PI / 180);
        const mPerDegLngP = R_EARTH * Math.cos((c.centerLat * Math.PI) / 180) * (Math.PI / 180);
        const localRing = ring.map((v) => lngLatToLocalMeters(v[0], v[1], c.centerLat, c.centerLng));
        const nR = localRing.length;
        let cross = 0;
        for (let i = 0; i < nR; i++) {
            const a = localRing[i];
            const bb = localRing[(i + 1) % nR];
            cross += a.x * bb.y - bb.x * a.y;
        }
        const ccw = cross > 0;
        const innerLocal: { x: number; y: number }[] = [];
        if (parapetWidth > 0) {
            for (let i = 0; i < nR; i++) {
                const prev = localRing[(i - 1 + nR) % nR];
                const curr = localRing[i];
                const next = localRing[(i + 1) % nR];
                const d1x = curr.x - prev.x, d1y = curr.y - prev.y;
                const d2x = next.x - curr.x, d2y = next.y - curr.y;
                const l1 = Math.hypot(d1x, d1y) || 1;
                const l2 = Math.hypot(d2x, d2y) || 1;
                const u1x = d1x / l1, u1y = d1y / l1;
                const u2x = d2x / l2, u2y = d2y / l2;
                const n1x = ccw ? -u1y : u1y;
                const n1y = ccw ? u1x : -u1x;
                const n2x = ccw ? -u2y : u2y;
                const n2y = ccw ? u2x : -u2x;
                const p1x = prev.x + parapetWidth * n1x;
                const p1y = prev.y + parapetWidth * n1y;
                const p2x = curr.x + parapetWidth * n2x;
                const p2y = curr.y + parapetWidth * n2y;
                const det = u1x * -u2y - (-u2x) * u1y;
                let px: number, py: number;
                if (Math.abs(det) < 1e-9) {
                    px = p2x; py = p2y;
                } else {
                    const t = ((p2x - p1x) * -u2y - (p2y - p1y) * -u2x) / det;
                    px = p1x + t * u1x;
                    py = p1y + t * u1y;
                }
                innerLocal.push({ x: px, y: py });
            }
        }
        const innerLngLat: [number, number][] = innerLocal.map(({ x, y }) => [
            c.centerLng + x / mPerDegLngP,
            c.centerLat + y / mPerDegLatP,
        ]);
        for (let i = 0; i < closed.length - 1; i++) {
            const [x1, y1] = closed[i];
            const [x2, y2] = closed[i + 1];
            const t1 = topZ(x1, y1);
            const t2 = topZ(x2, y2);
            out.push({
                desc: "Parapet",
                color: parapetColor,
                rings: [[[x1, y1, t1], [x2, y2, t2], [x2, y2, t2 + parapet], [x1, y1, t1 + parapet], [x1, y1, t1]]],
            });
            if (parapetWidth > 0) {
                const i2 = (i + 1) % nR;
                const [ix1, iy1] = innerLngLat[i];
                const [ix2, iy2] = innerLngLat[i2];
                const it1 = topZ(ix1, iy1);
                const it2 = topZ(ix2, iy2);
                out.push({
                    desc: "ParapetInner",
                    color: parapetColor,
                    rings: [[[ix1, iy1, it1], [ix2, iy2, it2], [ix2, iy2, it2 + parapet], [ix1, iy1, it1 + parapet], [ix1, iy1, it1]]],
                });
                out.push({
                    desc: "ParapetTop",
                    color: parapetColor,
                    rings: [[[x1, y1, t1 + parapet], [x2, y2, t2 + parapet], [ix2, iy2, it2 + parapet], [ix1, iy1, it1 + parapet], [x1, y1, t1 + parapet]]],
                });
            }
        }
    }

    const rotRad = (rot * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);
    const mPerDegLat = R_EARTH * (Math.PI / 180);
    const mPerDegLng = R_EARTH * Math.cos((c.centerLat * Math.PI) / 180) * (Math.PI / 180);
    const localToLngLat = (mx: number, my: number): [number, number] => [
        c.centerLng + mx / mPerDegLng,
        c.centerLat + my / mPerDegLat,
    ];
    const rotateLocal = (x: number, y: number): [number, number] => [
        x * cosR - y * sinR,
        x * sinR + y * cosR,
    ];

    for (const o of b.obstacles) {
        const cx = o.rx * scale;
        const cy = o.ry * scale;
        const sw2 = o.w / 2;
        const sd2 = o.d / 2;
        const corners: [number, number][] = [
            [cx - sw2, cy - sd2],
            [cx + sw2, cy - sd2],
            [cx + sw2, cy + sd2],
            [cx - sw2, cy + sd2],
        ].map(([x, y]) => rotateLocal(x, y)) as [number, number][];
        const world = corners.map(([mx, my]) => localToLngLat(mx, my));
        const [rcx, rcy] = rotateLocal(cx, cy);
        const [centerLng, centerLat] = localToLngLat(rcx, rcy);
        const bz = topZ(centerLng, centerLat);
        const [c0, c1, c2, c3] = world;
        const hx = parseInt(o.color.slice(1, 3), 16);
        const hy = parseInt(o.color.slice(3, 5), 16);
        const hz = parseInt(o.color.slice(5, 7), 16);
        const col = [hx, hy, hz, 1];
        out.push({
            desc: `Obstacle_${o.type}`,
            color: col,
            rings: [
                [[c0[0], c0[1], bz], [c1[0], c1[1], bz], [c1[0], c1[1], bz + o.h], [c0[0], c0[1], bz + o.h], [c0[0], c0[1], bz]],
                [[c3[0], c3[1], bz], [c2[0], c2[1], bz], [c2[0], c2[1], bz + o.h], [c3[0], c3[1], bz + o.h], [c3[0], c3[1], bz]],
                [[c0[0], c0[1], bz], [c3[0], c3[1], bz], [c3[0], c3[1], bz + o.h], [c0[0], c0[1], bz + o.h], [c0[0], c0[1], bz]],
                [[c1[0], c1[1], bz], [c2[0], c2[1], bz], [c2[0], c2[1], bz + o.h], [c1[0], c1[1], bz + o.h], [c1[0], c1[1], bz]],
                [[c0[0], c0[1], bz + o.h], [c1[0], c1[1], bz + o.h], [c2[0], c2[1], bz + o.h], [c3[0], c3[1], bz + o.h], [c0[0], c0[1], bz + o.h]],
            ],
            extras: { obstacleType: o.type },
        });
    }

    return out;
}

/**
 * Compute the parent's roof-top elevation (m ASL) — the surface that stacked
 * volumes sit on. Uses the building's center for sloped roofs (good enough for
 * v1; flat roofs are exact).
 */
function parentRoofTopZ(b: SavedBuilding): number {
    return b.custom ? b.custom.baseZ + b.params.wh : b.params.elev + b.params.wh;
}

/** Get parent's center lat/lng (world coords, unrotated frame origin). */
function parentCenter(b: SavedBuilding): { lat: number; lng: number } {
    return b.custom
        ? { lat: b.custom.centerLat, lng: b.custom.centerLng }
        : { lat: b.params.lat, lng: b.params.lng };
}

/**
 * Render a stacked volume by synthesizing a temp SavedBuilding and reusing
 * `buildCustomFaces`. The volume's local-meter ring is translated to world
 * lng/lat WITHOUT rotation; parent's rotation is applied by buildCustomFaces.
 */
function buildVolumeFaces(parent: SavedBuilding, vol: BuildingVolume): FaceSpec[] {
    const center = parentCenter(parent);
    const mPerDegLat = R_EARTH * (Math.PI / 180);
    const mPerDegLng = R_EARTH * Math.cos((center.lat * Math.PI) / 180) * (Math.PI / 180);
    const localToLngLat = (mx: number, my: number): [number, number] => [
        center.lng + mx / mPerDegLng,
        center.lat + my / mPerDegLat,
    ];
    // Pre-rotate volume ring around its OUTER centroid by vol.rotDeg (parent.rot
    // is applied later by buildCustomFaces, so this composes correctly).
    const rotDeg = vol.rotDeg ?? 0;
    const n0 = vol.ringLocal.length;
    let cxR = 0, cyR = 0;
    for (const [x, y] of vol.ringLocal) { cxR += x; cyR += y; }
    cxR /= n0; cyR /= n0;
    const rad = (rotDeg * Math.PI) / 180;
    const cosR2 = Math.cos(rad), sinR2 = Math.sin(rad);
    const applyRot = (pts: [number, number][]): [number, number][] => {
        if (!rotDeg) return pts;
        return pts.map(([x, y]) => {
            const dx = x - cxR, dy = y - cyR;
            return [cxR + dx * cosR2 - dy * sinR2, cyR + dx * sinR2 + dy * cosR2] as [number, number];
        });
    };
    const ringLngLat = applyRot(vol.ringLocal).map(([x, y]) => localToLngLat(x, y));
    const holesLngLat = vol.holesLocal?.map((h) => applyRot(h).map(([x, y]) => localToLngLat(x, y)));
    const baseZ = parentRoofTopZ(parent) + vol.baseOffset;

    const temp: SavedBuilding = {
        id: parent.id,
        params: {
            ...parent.params,
            wh: vol.wh,
            parapet: vol.parapet,
            parapetWidth: vol.parapetWidth,
            pitch: vol.pitch,
            // rot inherited from parent so volume rotates with it
        },
        roofType: vol.roofType,
        obstacles: [],
        custom: {
            ringLngLat,
            holesLngLat,
            centerLat: center.lat,
            centerLng: center.lng,
            baseZ,
            scale: 1,
        },
    };

    const faces = buildCustomFaces(temp);

    // Tag faces so they're identifiable + tint per-volume colors if requested.
    const wallTint = vol.wallColorHex ? hexToRgba(vol.wallColorHex) : null;
    const roofTint = vol.roofColorHex ? hexToRgba(vol.roofColorHex) : null;
    return faces.map((f) => {
        const isWall = f.desc === "Wall" || f.desc === "WallInner";
        const isRoof = f.desc.startsWith("Roof_");
        const color = isWall && wallTint ? wallTint : isRoof && roofTint ? roofTint : f.color;
        return {
            ...f,
            color,
            desc: `Vol_${vol.id}_${f.desc}`,
            extras: { ...(f.extras || {}), volumeId: vol.id },
        };
    });
}

function hexToRgba(hex: string): number[] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const bl = parseInt(hex.slice(5, 7), 16);
    return [r, g, bl, 1];
}

export function makeBuildingGraphics(b: SavedBuilding): Graphic[] {
    const faces = b.custom ? buildCustomFaces(b) : buildFaces(b.params, b.roofType, b.obstacles);
    if (b.volumes?.length) {
        for (const v of b.volumes) {
            faces.push(...buildVolumeFaces(b, v));
        }
    }
    const sr = { wkid: 4326 } as any;
    const graphics: Graphic[] = [];
    const symbol = (color: number[]) => ({
        type: "polygon-3d",
        symbolLayers: [{
            type: "fill",
            material: { color },
            outline: { color: [25, 25, 25, 1], size: 1.2 },
            edges: { type: "solid", color: [25, 25, 25, 1], size: 1.2, extensionLength: 0 } as any,
        }],
    } as any);
    const attrs = (f: FaceSpec) => ({
        buildingId: b.id,
        buildingName: b.params.name,
        description: f.desc,
        ...(f.extras || {}),
    });
    for (const f of faces) {
        if (f.multiRing) {
            graphics.push(new Graphic({
                geometry: new Polygon({ spatialReference: sr, rings: f.rings as any }),
                symbol: symbol(f.color),
                attributes: attrs(f),
            }));
        } else {
            for (const ring of f.rings) {
                graphics.push(new Graphic({
                    geometry: new Polygon({ spatialReference: sr, rings: [ring as any] }),
                    symbol: symbol(f.color),
                    attributes: attrs(f),
                }));
            }
        }
    }
    return graphics;
}
