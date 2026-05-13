import Graphic from "@arcgis/core/Graphic";
import Polygon from "@arcgis/core/geometry/Polygon";
import {
    SavedBuilding,
    BuildingParams,
    RoofType,
    Obstacle,
    FaceSpec,
} from "../types/building.types";
import {
    toCoord,
    closeRing,
    lngLatToLocalMeters,
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

    for (const o of obs) {
        let bz = wh;
        if (rt === "gabled") bz = wh + (1 - Math.abs(o.ry) / hw) * pitchH;
        else if (rt === "monopitch") bz = wh + ((o.ry + hw) / p.wid) * pitchH;
        else if (rt === "sawtooth") {
            const spanW = p.wid / p.spans;
            const si = Math.floor((o.ry + hw) / spanW);
            const t = ((o.ry + hw) % spanW) / spanW;
            bz = wh + Math.min(si, p.spans - 1) * spanW * (p.pitch / 100) + t * spanW * (p.pitch / 100);
        } else if (rt === "barrel") {
            const t = (o.ry + hw) / p.wid;
            bz = wh + Math.sin(t * Math.PI) * pitchH;
        } else if (rt === "hipped") {
            bz = wh + (1 - Math.abs(o.ry) / hw) * pitchH;
        }
        const sw2 = o.w / 2;
        const sd2 = o.d / 2;
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
    const ring = c.ringLngLat;
    const wh = b.params.wh;
    const parapet = b.params.parapet;
    const baseZ = c.baseZ;
    const out: FaceSpec[] = [];
    const wallColor = [200, 200, 200, 1];
    const roofColor = [160, 140, 100, 1];
    const parapetColor = [120, 120, 120, 1];

    const closed = [...ring, ring[0]];

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

    const roofRing = closed.map(([x, y]) => [x, y, topZ(x, y)] as [number, number, number]);
    out.push({
        desc: `Roof_${b.roofType}_custom`,
        color: roofColor,
        rings: [roofRing],
    });

    if (parapet > 0 && b.roofType !== "monopitch") {
        for (let i = 0; i < closed.length - 1; i++) {
            const [x1, y1] = closed[i];
            const [x2, y2] = closed[i + 1];
            out.push({
                desc: "Parapet",
                color: parapetColor,
                rings: [[[x1, y1, baseZ + wh], [x2, y2, baseZ + wh], [x2, y2, baseZ + wh + parapet], [x1, y1, baseZ + wh + parapet], [x1, y1, baseZ + wh]]],
            });
        }
    }

    for (const o of b.obstacles) {
        const lat = c.centerLat + (o.ry / R_EARTH) * (180 / Math.PI);
        const lng = c.centerLng + (o.rx / (R_EARTH * Math.cos((c.centerLat * Math.PI) / 180))) * (180 / Math.PI);
        const bz = topZ(lng, lat);
        const dLat = (o.d / 2 / R_EARTH) * (180 / Math.PI);
        const dLng = (o.w / 2 / (R_EARTH * Math.cos((c.centerLat * Math.PI) / 180))) * (180 / Math.PI);
        const x1 = lng - dLng, x2 = lng + dLng, y1 = lat - dLat, y2 = lat + dLat;
        const hx = parseInt(o.color.slice(1, 3), 16);
        const hy = parseInt(o.color.slice(3, 5), 16);
        const hz = parseInt(o.color.slice(5, 7), 16);
        const col = [hx, hy, hz, 1];
        out.push({
            desc: `Obstacle_${o.type}`,
            color: col,
            rings: [
                [[x1, y1, bz], [x2, y1, bz], [x2, y1, bz + o.h], [x1, y1, bz + o.h], [x1, y1, bz]],
                [[x1, y2, bz], [x2, y2, bz], [x2, y2, bz + o.h], [x1, y2, bz + o.h], [x1, y2, bz]],
                [[x1, y1, bz], [x1, y2, bz], [x1, y2, bz + o.h], [x1, y1, bz + o.h], [x1, y1, bz]],
                [[x2, y1, bz], [x2, y2, bz], [x2, y2, bz + o.h], [x2, y1, bz + o.h], [x2, y1, bz]],
                [[x1, y1, bz + o.h], [x2, y1, bz + o.h], [x2, y2, bz + o.h], [x1, y2, bz + o.h], [x1, y1, bz + o.h]],
            ],
            extras: { obstacleType: o.type },
        });
    }

    return out;
}

export function makeBuildingGraphics(b: SavedBuilding): Graphic[] {
    const faces = b.custom ? buildCustomFaces(b) : buildFaces(b.params, b.roofType, b.obstacles);
    const sr = { wkid: 4326 } as any;
    const graphics: Graphic[] = [];
    for (const f of faces) {
        for (const ring of f.rings) {
            graphics.push(
                new Graphic({
                    geometry: new Polygon({
                        spatialReference: sr,
                        rings: [ring as any],
                    }),
                    symbol: {
                        type: "polygon-3d",
                        symbolLayers: [{
                            type: "fill",
                            material: { color: f.color },
                            outline: { color: [25, 25, 25, 1], size: 1.2 },
                            edges: { type: "solid", color: [25, 25, 25, 1], size: 1.2, extensionLength: 0 } as any,
                        }],
                    } as any,
                    attributes: {
                        buildingId: b.id,
                        buildingName: b.params.name,
                        description: f.desc,
                        ...(f.extras || {}),
                    },
                })
            );
        }
    }
    return graphics;
}
