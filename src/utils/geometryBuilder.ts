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
