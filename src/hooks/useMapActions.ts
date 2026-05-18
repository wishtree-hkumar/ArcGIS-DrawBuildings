import { useBuildingStore } from "../context/BuildingContext";
import { makeBuildingGraphics } from "../utils/geometryBuilder";
import { SavedBuilding, RoofType, Obstacle, BuildingParams } from "../types/building.types";
import { toLat, toLng, setEdgeLength } from "../utils/geoUtils";

export function useMapActions() {
    const {
        buildingsRef, setBuildingsCount,
        selectedBuildingIdRef, setSelectedBuildingId,
        placementModeRef, setPlacementMode,
        pendingCustomRef, setCustomDrawMode,
        paramsRef,
        drawLayerRef, sketchRef,
        setCustomRev
    } = useBuildingStore();

    const renderBuilding = (b: SavedBuilding) => {
        const layer = drawLayerRef.current;
        if (!layer) return;
        const old = layer.graphics.toArray().filter((g) => (g.attributes as any)?.buildingId === b.id);
        layer.removeMany(old);
        layer.addMany(makeBuildingGraphics(b));
    };

    const startPlacement = () => {
        placementModeRef.current = true;
        setPlacementMode(true);
    };

    const startCustomDraw = () => {
        if (!sketchRef.current) return;
        pendingCustomRef.current = { wh: paramsRef.current.wh, parapet: paramsRef.current.parapet, name: paramsRef.current.name };
        setCustomDrawMode(true);
        sketchRef.current.create("polygon");
    };

    const editSelected = () => {
        const bid = selectedBuildingIdRef.current;
        const layer = drawLayerRef.current;
        if (!bid || !layer || !sketchRef.current) return;
        const groupGraphics = layer.graphics.toArray().filter((gr) => (gr.attributes as any)?.buildingId === bid);
        sketchRef.current.update(groupGraphics, { tool: "transform", enableRotation: false, enableScaling: false, enableZ: false, multipleSelectionEnabled: true } as any);
    };

    const deleteSelected = () => {
        const bid = selectedBuildingIdRef.current;
        const layer = drawLayerRef.current;
        if (!bid || !layer) return;
        const old = layer.graphics.toArray().filter((gr) => (gr.attributes as any)?.buildingId === bid);
        layer.removeMany(old);
        delete buildingsRef.current[bid];
        selectedBuildingIdRef.current = null;
        setSelectedBuildingId(null);
        setBuildingsCount(Object.keys(buildingsRef.current).length);
    };

    const duplicateSelected = () => {
        const bid = selectedBuildingIdRef.current;
        if (!bid) return;
        const src = buildingsRef.current[bid];
        if (!src) return;
        const id = `b_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const copy: SavedBuilding = {
            id,
            params: { ...src.params, lat: src.params.lat + toLat(15), lng: src.params.lng + toLng(15, src.params.lat), name: `${src.params.name}_copy` },
            roofType: src.roofType,
            obstacles: src.obstacles.map((o) => ({ ...o })),
            custom: src.custom ? { ...src.custom } : undefined
        };
        buildingsRef.current[id] = copy;
        renderBuilding(copy);
        setBuildingsCount(Object.keys(buildingsRef.current).length);
    };

    const exportAll = () => {
        const list = Object.values(buildingsRef.current);
        if (list.length === 0) {
            alert("No buildings to export.");
            return;
        }

        const remapDesc = (d: string): string => {
            if (!d) return "Unknown";
            if (d === "Walls") return "Main_Building";
            return d;
        };
        const colorFor = (desc: string): string => {
            if (desc === "Main_Building") return " 200 200 200";
            if (desc.startsWith("Roof")) return " 160 140 100";
            if (desc === "Parapet") return " 120 120 120";
            return " 180 180 180";
        };
        const round = (v: number, p = 2) => Math.round(v * Math.pow(10, p)) / Math.pow(10, p);

        const projectXY = (lng: number, lat: number, cLng: number, cLat: number) => {
            const cosLat = Math.cos((cLat * Math.PI) / 180);
            const x = (lng - cLng) * (Math.PI / 180) * 6371000 * cosLat;
            const y = (lat - cLat) * (Math.PI / 180) * 6371000;
            return [x, y];
        };
        const polygonArea3D = (ring: number[][]): number => {
            if (ring.length < 3) return 0;
            const cLng = ring[0][0];
            const cLat = ring[0][1];
            const pts = ring.map((p) => {
                const [x, y] = projectXY(p[0], p[1], cLng, cLat);
                return [x, y, p[2] || 0];
            });
            let nx = 0, ny = 0, nz = 0;
            for (let i = 1; i < pts.length - 1; i++) {
                const a = pts[0], b = pts[i], c = pts[i + 1];
                const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
                const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
                nx += uy * vz - uz * vy;
                ny += uz * vx - ux * vz;
                nz += ux * vy - uy * vx;
            }
            return Math.abs(Math.hypot(nx, ny, nz)) / 2;
        };
        const footprintArea = (b: SavedBuilding): number => {
            if (b.custom) {
                const ring = b.custom.ringLngLat;
                if (ring.length < 3) return 0;
                const r3: number[][] = ring.map((p) => [p[0], p[1], 0]);
                r3.push([ring[0][0], ring[0][1], 0]);
                return polygonArea3D(r3);
            }
            return b.params.len * b.params.wid;
        };

        let oid = 1;
        const features: any[] = [];
        const layer = drawLayerRef.current!;

        for (const b of list) {
            const gs = layer.graphics.toArray().filter((gr) => (gr.attributes as any)?.buildingId === b.id);
            const groups = new Map<string, number[][][]>();
            const order: string[] = [];
            for (const g of gs) {
                const geom: any = g.geometry?.toJSON();
                if (!geom || !geom.rings || geom.rings.length === 0) continue;
                const ring: number[][] = geom.rings[0].map((pt: number[]) =>
                    pt.length >= 3 ? [pt[0], pt[1], pt[2]] : [pt[0], pt[1], 0]
                );
                const desc = remapDesc((g.attributes as any)?.description || "Unknown");
                if (!groups.has(desc)) { groups.set(desc, []); order.push(desc); }
                groups.get(desc)!.push(ring);
            }

            const fp = footprintArea(b);
            const wh = b.params.wh;
            const parapet = b.params.parapet || 0;
            const pitchH = (b.params.wid || 0) * ((b.params.pitch || 0) / 100);

            for (const desc of order) {
                const rings = groups.get(desc)!;
                const coordinates = rings.map((r) => [r]);
                let Height = wh;
                let Height2 = wh;
                let AreaSize = 0;
                let Volume = 0;

                if (desc === "Main_Building") {
                    Height = wh;
                    Height2 = wh;
                    AreaSize = fp;
                    Volume = fp * wh;
                } else if (desc.startsWith("Roof")) {
                    Height = wh;
                    if (desc === "Roof_flat") {
                        Height2 = wh;
                        Volume = 0;
                    } else {
                        Height2 = wh + pitchH;
                        Volume = fp * pitchH / 2;
                    }
                    AreaSize = fp;
                } else if (desc === "Parapet") {
                    Height = parapet;
                    Height2 = parapet;
                    AreaSize = rings.reduce((s, r) => s + polygonArea3D(r), 0);
                    Volume = 0;
                } else {
                    AreaSize = rings.reduce((s, r) => s + polygonArea3D(r), 0);
                }

                features.push({
                    type: "Feature",
                    properties: {
                        OBJECTID: oid,
                        Planet_Id: String(oid),
                        Description: desc,
                        Height: round(Height, 3),
                        Color: colorFor(desc),
                        Height2: round(Height2, 3),
                        AreaSize: round(AreaSize, 2),
                        Volume: round(Volume, 2),
                        MBID: String(oid),
                        Created_By: "OptimalPV",
                        Building: b.params.name,
                    },
                    geometry: { type: "MultiPolygon", coordinates },
                });
                oid++;
            }
        }

        const gj = {
            type: "FeatureCollection",
            name: list.map((b) => b.params.name).join("_"),
            crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
            features,
        };
        const blob = new Blob([JSON.stringify(gj, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${list.map((b) => b.params.name).join("_")}.geojson`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const mutateBuilding = (fn: (b: SavedBuilding) => void) => {
        const bid = selectedBuildingIdRef.current;
        if (!bid) return;
        const b = buildingsRef.current[bid];
        if (!b) return;
        fn(b);
        renderBuilding(b);
        setCustomRev((r) => r + 1);
    };

    const mutateCustom = (fn: (b: SavedBuilding) => void) => {
        mutateBuilding((b) => { if (b.custom) fn(b); });
    };

    const setParam = <K extends keyof BuildingParams>(key: K, value: BuildingParams[K]) => {
        mutateBuilding((b) => { b.params[key] = value; });
    };

    const setRoofTypeOf = (rt: RoofType) => {
        mutateBuilding((b) => {
            if (b.custom) {
                b.roofType = rt === "monopitch" ? "monopitch" : "flat";
            } else {
                b.roofType = rt;
            }
        });
    };

    const setObstaclesOf = (updater: (prev: Obstacle[]) => Obstacle[]) => {
        mutateBuilding((b) => { b.obstacles = updater(b.obstacles); });
    };

    const setCustomEdgeLength = (edgeIdx: number, meters: number) => {
        mutateCustom((b) => {
            const ring = b.custom!.ringLngLat;
            const a = ring[edgeIdx];
            const next = ring[(edgeIdx + 1) % ring.length];
            const moved = setEdgeLength(a, next, Math.max(0.5, meters));
            ring[(edgeIdx + 1) % ring.length] = moved;
        });
    };

    const setCustomRoofType = (rt: RoofType) => setRoofTypeOf(rt);
    const setCustomWallHeight = (wh: number) => setParam("wh", wh);
    const setCustomParapet = (p: number) => setParam("parapet", p);
    const setCustomPitch = (pct: number) => setParam("pitch", pct);
    
    return {
        renderBuilding,
        startPlacement,
        startCustomDraw,
        editSelected,
        deleteSelected,
        duplicateSelected,
        exportAll,
        mutateBuilding,
        mutateCustom,
        setParam,
        setRoofTypeOf,
        setObstaclesOf,
        setCustomEdgeLength,
        setCustomRoofType,
        setCustomWallHeight,
        setCustomParapet,
        setCustomPitch
    };
}
