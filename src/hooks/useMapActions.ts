import { useBuildingStore } from "../context/BuildingContext";
import { makeBuildingGraphics } from "../utils/geometryBuilder";
import { SavedBuilding, RoofType } from "../types/building.types";
import { toLat, toLng, setEdgeLength } from "../utils/geoUtils";

export function useMapActions() {
    const {
        buildingsRef, setBuildingsCount,
        selectedBuildingIdRef, setSelectedBuildingId,
        placementModeRef, setPlacementMode,
        pendingCustomRef, setCustomDrawMode,
        roofTypeRef, paramsRef, setParams,
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
        sketchRef.current.update(groupGraphics, { tool: "transform", enableRotation: true, enableScaling: false, multipleSelectionEnabled: true } as any);
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
        let oid = 1;
        const features: any[] = [];
        for (const b of list) {
            const layer = drawLayerRef.current!;
            const gs = layer.graphics.toArray().filter((gr) => (gr.attributes as any)?.buildingId === b.id);
            for (const g of gs) {
                features.push({
                    type: "Feature",
                    properties: { OBJECTID: oid++, Building: b.params.name, Description: g.attributes?.description },
                    geometry: g.geometry?.toJSON(),
                });
            }
        }
        const gj = { type: "FeatureCollection", crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } }, features };
        const blob = new Blob([JSON.stringify(gj, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${list.map((b) => b.params.name).join("_")}.geojson`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const mutateCustom = (fn: (b: SavedBuilding) => void) => {
        const bid = selectedBuildingIdRef.current;
        if (!bid) return;
        const b = buildingsRef.current[bid];
        if (!b?.custom) return;
        fn(b);
        renderBuilding(b);
        setCustomRev((r) => r + 1);
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

    const setCustomRoofType = (rt: RoofType) => {
        mutateCustom((b) => {
            b.roofType = rt === "monopitch" ? "monopitch" : "flat";
        });
    };

    const setCustomWallHeight = (wh: number) => mutateCustom((b) => { b.params.wh = wh; });
    const setCustomParapet = (p: number) => mutateCustom((b) => { b.params.parapet = p; });
    const setCustomPitch = (pct: number) => mutateCustom((b) => { b.params.pitch = pct; });
    
    return {
        renderBuilding,
        startPlacement,
        startCustomDraw,
        editSelected,
        deleteSelected,
        duplicateSelected,
        exportAll,
        mutateCustom,
        setCustomEdgeLength,
        setCustomRoofType,
        setCustomWallHeight,
        setCustomParapet,
        setCustomPitch
    };
}
