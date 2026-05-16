import { useBuildingStore } from "../context/BuildingContext";
import { makeBuildingGraphics } from "../utils/geometryBuilder";
import { SavedBuilding, RoofType, Obstacle, BuildingParams, BuildingVolume } from "../types/building.types";
import { lngLatToLocalMeters } from "../utils/geoUtils";
import { toLat, toLng, setEdgeLength } from "../utils/geoUtils";
import { makeTemplateFootprint, TemplateId } from "../utils/footprintTemplates";

export function useMapActions() {
    const {
        buildingsRef, setBuildingsCount,
        selectedBuildingIdRef, setSelectedBuildingId,
        placementModeRef, setPlacementMode,
        pendingCustomRef, setCustomDrawMode,
        paramsRef,
        drawLayerRef, sketchRef, viewRef,
        pendingVolumeRef, setVolumeDrawMode,
        editingTargetRef, setEditMode, editLayerRef,
        setCustomRev
    } = useBuildingStore();

    const renderBuilding = (b: SavedBuilding) => {
        const layer = drawLayerRef.current;
        if (!layer) return;
        const old = layer.graphics
            .toArray()
            .filter((g) => {
                const a = g.attributes as any;
                return a?.buildingId === b.id && !a?.editHandle;
            });
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

    const placeTemplate = async (
        id: TemplateId,
        opts: { len: number; wid: number; arm?: number; courtyardInset?: number },
    ) => {
        const view = viewRef.current;
        if (!view) return;
        // Use camera ground-projection (map center) as drop point.
        const center: any = (view as any).center;
        const lat = center?.latitude ?? paramsRef.current.lat;
        const lng = center?.longitude ?? paramsRef.current.lng;

        let groundElev = paramsRef.current.elev;
        try {
            if (view.map?.ground) {
                const Point = (await import("@arcgis/core/geometry/Point")).default;
                const sp = new Point({ latitude: lat, longitude: lng, spatialReference: { wkid: 4326 } as any });
                const r = await view.map.ground.queryElevation(sp);
                const z = (r.geometry as any)?.z;
                if (typeof z === "number" && !Number.isNaN(z)) groundElev = z;
            }
        } catch (e) {
            console.warn("Template ground sample failed", e);
        }

        const footprint = makeTemplateFootprint(id, opts, { lat, lng, baseZ: groundElev });

        const bid = `b_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const b: SavedBuilding = {
            id: bid,
            params: {
                ...paramsRef.current,
                lat,
                lng,
                elev: groundElev,
                len: opts.len,
                wid: opts.wid,
                rot: 0,
                name: `${paramsRef.current.name}_${id}`,
            },
            // Templates start as flat-roof (parapet edits still apply).
            roofType: "flat",
            obstacles: [],
            custom: footprint,
        };
        buildingsRef.current[bid] = b;
        renderBuilding(b);
        selectedBuildingIdRef.current = bid;
        setSelectedBuildingId(bid);
        setBuildingsCount(Object.keys(buildingsRef.current).length);
        setCustomRev((r) => r + 1);
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
        let oid = 1;
        const features: any[] = [];
        for (const b of list) {
            const layer = drawLayerRef.current!;
            const gs = layer.graphics.toArray().filter((gr) => (gr.attributes as any)?.buildingId === b.id);
            for (const g of gs) {
                const geom: any = g.geometry?.toJSON();
                if (!geom || !geom.rings) continue;
                const coordinates = geom.rings.map((ring: number[][]) =>
                    ring.map((pt) => (pt.length >= 3 ? [pt[0], pt[1], pt[2]] : [pt[0], pt[1]]))
                );
                features.push({
                    type: "Feature",
                    properties: { OBJECTID: oid++, Building: b.params.name, Description: g.attributes?.description },
                    geometry: { type: "Polygon", coordinates },
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

    // ----- Stacked-volume actions (Phase B: multi-level massing) -----

    /** Compute parent's bbox in LOCAL meters (unrotated frame). Used to size new volumes. */
    const parentLocalBBox = (b: SavedBuilding) => {
        if (b.custom) {
            const xs: number[] = [], ys: number[] = [];
            for (const [lng, lat] of b.custom.ringLngLat) {
                const { x, y } = lngLatToLocalMeters(lng, lat, b.custom.centerLat, b.custom.centerLng);
                xs.push(x); ys.push(y);
            }
            return {
                minX: Math.min(...xs), maxX: Math.max(...xs),
                minY: Math.min(...ys), maxY: Math.max(...ys),
            };
        }
        const hl = b.params.len / 2, hw = b.params.wid / 2;
        return { minX: -hl, maxX: hl, minY: -hw, maxY: hw };
    };

    /** Add a default centered rectangular volume sitting on the parent's roof, ~60% size. */
    const addVolumeToSelected = () => {
        const bid = selectedBuildingIdRef.current;
        if (!bid) return;
        const b = buildingsRef.current[bid];
        if (!b) return;
        const bb = parentLocalBBox(b);
        const cx = (bb.minX + bb.maxX) / 2;
        const cy = (bb.minY + bb.maxY) / 2;
        const w = (bb.maxX - bb.minX) * 0.6;
        const d = (bb.maxY - bb.minY) * 0.6;
        const ring: [number, number][] = [
            [cx - w / 2, cy - d / 2],
            [cx + w / 2, cy - d / 2],
            [cx + w / 2, cy + d / 2],
            [cx - w / 2, cy + d / 2],
        ];
        const vol: BuildingVolume = {
            id: `v_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            ringLocal: ring,
            baseOffset: 0,
            wh: 3,
            roofType: "flat",
            pitch: 0,
            parapet: 0,
            parapetWidth: 0,
            wallColorHex: "#e8c060",
            roofColorHex: "#e07a30",
        };
        b.volumes = [...(b.volumes ?? []), vol];
        renderBuilding(b);
        setCustomRev((r) => r + 1);
    };

    const updateVolume = (volId: string, patch: Partial<BuildingVolume>) => {
        const bid = selectedBuildingIdRef.current;
        if (!bid) return;
        const b = buildingsRef.current[bid];
        if (!b?.volumes) return;
        b.volumes = b.volumes.map((v) => (v.id === volId ? { ...v, ...patch } : v));
        renderBuilding(b);
        setCustomRev((r) => r + 1);
    };

    /** Scale a volume's footprint uniformly around its centroid (in local meters). */
    const scaleVolume = (volId: string, scaleFactor: number) => {
        const bid = selectedBuildingIdRef.current;
        if (!bid) return;
        const b = buildingsRef.current[bid];
        if (!b?.volumes) return;
        const v = b.volumes.find((vv) => vv.id === volId);
        if (!v) return;
        // Centroid of ringLocal (simple mean — good enough for star-shaped volumes).
        const n = v.ringLocal.length;
        let cx = 0, cy = 0;
        for (const [x, y] of v.ringLocal) { cx += x; cy += y; }
        cx /= n; cy /= n;
        const next: [number, number][] = v.ringLocal.map(([x, y]) => [
            cx + (x - cx) * scaleFactor,
            cy + (y - cy) * scaleFactor,
        ]);
        const nextHoles = v.holesLocal?.map((h) => h.map(([x, y]) => [
            cx + (x - cx) * scaleFactor,
            cy + (y - cy) * scaleFactor,
        ] as [number, number]));
        updateVolume(volId, { ringLocal: next, holesLocal: nextHoles });
    };

    // ----- Vertex editing -----

    /**
     * Begin reshape mode on a building's parent footprint or a specific volume.
     * Drops a Polygon "edit handle" graphic into editLayer, switches the
     * SketchViewModel into reshape mode on it, and tags editingTargetRef so the
     * shared sketch-update handler routes drag events to the right target.
     *
     * For volumes: bakes any existing rotDeg into ringLocal and resets rotDeg=0
     * so the user edits in a clean unrotated frame.
     */
    const startVertexEdit = async (
        target:
            | { kind: "building" }
            | { kind: "volume"; volumeId: string },
    ) => {
        const bid = selectedBuildingIdRef.current;
        const vm = sketchRef.current;
        // SketchVM.update() ONLY reshapes graphics in its own layer. Use drawLayer.
        const layer = drawLayerRef.current;
        void editLayerRef; // kept for future overlays
        if (!bid || !vm || !layer) return;
        const b = buildingsRef.current[bid];
        if (!b) return;

        const removeAllHandles = () => {
            const handles = layer.graphics
                .toArray()
                .filter((g) => (g.attributes as any)?.editHandle === true);
            if (handles.length) layer.removeMany(handles);
        };

        // End any prior edit cleanly.
        if (editingTargetRef.current) {
            try { vm.cancel(); } catch {}
            removeAllHandles();
            editingTargetRef.current = null;
        }
        // Also cancel any in-progress transform on the building (selecting a
        // building puts SketchVM in transform mode; reshape won't take over
        // until that's released).
        try { vm.cancel(); } catch {}

        // Build the lng/lat ring + base height for the handle polygon.
        let ringLngLat: [number, number][];
        let baseZ: number;

        if (target.kind === "building") {
            // Auto-convert parametric → custom on first edit so any building is editable.
            if (!b.custom) {
                const p = b.params;
                const hl = p.len / 2, hw = p.wid / 2;
                // Build the rotated 4-corner ring in lng/lat from local meters.
                const R = 6371000;
                const mPerDegLat = R * (Math.PI / 180);
                const mPerDegLng = R * Math.cos((p.lat * Math.PI) / 180) * (Math.PI / 180);
                const rotRad = ((p.rot || 0) * Math.PI) / 180;
                const cR = Math.cos(rotRad), sR = Math.sin(rotRad);
                const localCorners: [number, number][] = [
                    [-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw],
                ];
                const ring: [number, number][] = localCorners.map(([x, y]) => {
                    const wx = x * cR - y * sR;
                    const wy = x * sR + y * cR;
                    return [p.lng + wx / mPerDegLng, p.lat + wy / mPerDegLat];
                });
                b.custom = {
                    ringLngLat: ring,
                    centerLat: p.lat,
                    centerLng: p.lng,
                    baseZ: p.elev,
                };
                // Reset rotation since it's now baked into the ring (otherwise
                // buildCustomFaces would double-rotate).
                b.params.rot = 0;
                renderBuilding(b);
            }
            ringLngLat = b.custom.ringLngLat.slice();
            baseZ = b.custom.baseZ;
        } else {
            const vol = b.volumes?.find((v) => v.id === target.volumeId);
            if (!vol) return;

            // Bake rotDeg into ringLocal so editing happens in unrotated frame.
            const rotDeg = vol.rotDeg ?? 0;
            if (rotDeg !== 0) {
                let cx = 0, cy = 0;
                for (const [x, y] of vol.ringLocal) { cx += x; cy += y; }
                cx /= vol.ringLocal.length; cy /= vol.ringLocal.length;
                const rad = (rotDeg * Math.PI) / 180;
                const cR = Math.cos(rad), sR = Math.sin(rad);
                vol.ringLocal = vol.ringLocal.map(([x, y]) => {
                    const dx = x - cx, dy = y - cy;
                    return [cx + dx * cR - dy * sR, cy + dx * sR + dy * cR];
                });
                vol.holesLocal = vol.holesLocal?.map((h) =>
                    h.map(([x, y]) => {
                        const dx = x - cx, dy = y - cy;
                        return [cx + dx * cR - dy * sR, cy + dx * sR + dy * cR] as [number, number];
                    }),
                );
                vol.rotDeg = 0;
            }

            // Convert ringLocal → world lng/lat using parent's center + rotation.
            const cLat = b.custom ? b.custom.centerLat : b.params.lat;
            const cLng = b.custom ? b.custom.centerLng : b.params.lng;
            const R = 6371000;
            const mPerDegLat = R * (Math.PI / 180);
            const mPerDegLng = R * Math.cos((cLat * Math.PI) / 180) * (Math.PI / 180);
            const rotRad = ((b.params.rot || 0) * Math.PI) / 180;
            const cR = Math.cos(rotRad), sR = Math.sin(rotRad);
            ringLngLat = vol.ringLocal.map(([x, y]) => {
                const wx = x * cR - y * sR;
                const wy = x * sR + y * cR;
                return [cLng + wx / mPerDegLng, cLat + wy / mPerDegLat];
            });
            const parentRoof = b.custom ? b.custom.baseZ + b.params.wh : b.params.elev + b.params.wh;
            baseZ = parentRoof + vol.baseOffset;
        }

        const Polygon = (await import("@arcgis/core/geometry/Polygon")).default;
        const Graphic = (await import("@arcgis/core/Graphic")).default;
        const closed = [...ringLngLat, ringLngLat[0]];
        const ringWithZ = closed.map(([lng, lat]) => [lng, lat, baseZ + 0.1]);
        const handle = new Graphic({
            geometry: new Polygon({ spatialReference: { wkid: 4326 } as any, rings: [ringWithZ as any] }),
            symbol: {
                type: "polygon-3d",
                symbolLayers: [{
                    type: "fill",
                    material: { color: [0, 200, 255, 0.18] },
                    outline: { color: [0, 200, 255, 1], size: 2.5 },
                }],
            } as any,
            attributes: {
                editHandle: true,
                buildingId: bid,
                ...(target.kind === "volume" ? { volumeId: target.volumeId } : {}),
            },
        });
        layer.add(handle);

        editingTargetRef.current =
            target.kind === "building"
                ? { kind: "building", buildingId: bid }
                : { kind: "volume", buildingId: bid, volumeId: target.volumeId };
        setEditMode(true);

        // Fire reshape on the handle. enableZ=false locks editing to the 2D plane.
        try {
            (vm as any).update([handle], { tool: "reshape", enableZ: false });
        } catch (e) {
            console.warn("Vertex edit start failed", e);
        }
    };

    const finishVertexEdit = () => {
        const vm = sketchRef.current;
        const layer = drawLayerRef.current;
        if (vm) { try { vm.cancel(); } catch {} }
        if (layer) {
            const handles = layer.graphics
                .toArray()
                .filter((g) => (g.attributes as any)?.editHandle === true);
            if (handles.length) layer.removeMany(handles);
        }
        editingTargetRef.current = null;
        setEditMode(false);
    };

    /** Set / nudge the rotation of a volume (degrees, around its centroid). */
    const rotateVolume = (volId: string, deg: number) => {
        updateVolume(volId, { rotDeg: ((deg % 360) + 360) % 360 });
    };

    /** Duplicate a volume; the copy is shifted ~3 m east+north so it's visible. */
    const duplicateVolume = (volId: string) => {
        const bid = selectedBuildingIdRef.current;
        if (!bid) return;
        const b = buildingsRef.current[bid];
        if (!b?.volumes) return;
        const v = b.volumes.find((vv) => vv.id === volId);
        if (!v) return;
        const dx = 3, dy = 3;
        const copy: BuildingVolume = {
            ...v,
            id: `v_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            ringLocal: v.ringLocal.map(([x, y]) => [x + dx, y + dy] as [number, number]),
            holesLocal: v.holesLocal?.map((h) => h.map(([x, y]) => [x + dx, y + dy] as [number, number])),
        };
        b.volumes = [...b.volumes, copy];
        renderBuilding(b);
        setCustomRev((r) => r + 1);
    };

    /**
     * Begin sketch-mode for a custom volume footprint on the selected building.
     * The sketched polygon is consumed by the create-handler in useArcGIS, which
     * pushes the result as a new volume on this building.
     */
    const startVolumeSketch = () => {
        const bid = selectedBuildingIdRef.current;
        if (!bid || !sketchRef.current) return;
        pendingVolumeRef.current = { buildingId: bid };
        setVolumeDrawMode(true);
        sketchRef.current.create("polygon");
    };

    /**
     * Begin sketch-mode for a roof "patch" — a thin colored region painted on
     * the parent's roof. Implemented as a very-low-height volume so it reuses
     * the volume rendering / edit / delete flow.
     */
    const startRoofPaint = (colorHex: string, heightM: number = 0.1) => {
        const bid = selectedBuildingIdRef.current;
        if (!bid || !sketchRef.current) return;
        pendingVolumeRef.current = {
            buildingId: bid,
            preset: {
                wh: heightM,
                wallColorHex: colorHex,
                roofColorHex: colorHex,
                parapet: 0,
                parapetWidth: 0,
            },
        };
        setVolumeDrawMode(true);
        sketchRef.current.create("polygon");
    };

    const removeVolume = (volId: string) => {
        const bid = selectedBuildingIdRef.current;
        if (!bid) return;
        const b = buildingsRef.current[bid];
        if (!b?.volumes) return;
        b.volumes = b.volumes.filter((v) => v.id !== volId);
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
        setCustomPitch,
        placeTemplate,
        addVolumeToSelected,
        updateVolume,
        scaleVolume,
        removeVolume,
        startVolumeSketch,
        rotateVolume,
        duplicateVolume,
        startVertexEdit,
        finishVertexEdit,
        startRoofPaint,
    };
}
