import { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map";
import Basemap from "@arcgis/core/Basemap";
import SceneView from "@arcgis/core/views/SceneView";
import OpenStreetMapLayer from "@arcgis/core/layers/OpenStreetMapLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import SketchViewModel from "@arcgis/core/widgets/Sketch/SketchViewModel";
import Graphic from "@arcgis/core/Graphic";
import Polygon from "@arcgis/core/geometry/Polygon";
import { useBuildingStore } from "../context/BuildingContext";
import { makeBuildingGraphics } from "../utils/geometryBuilder";
import { SavedBuilding, BuildingVolume } from "../types/building.types";
import { lngLatToLocalMeters } from "../utils/geoUtils";

export function useArcGIS() {
    const mapRef = useRef<HTMLDivElement>(null);
    const {
        buildingsRef, setBuildingsCount,
        selectedBuildingIdRef, setSelectedBuildingId,
        placementModeRef, setPlacementMode,
        pendingCustomRef, setCustomDrawMode,
        pendingVolumeRef, setVolumeDrawMode,
        editingTargetRef, editLayerRef,
        roofTypeRef, paramsRef, setParams,
        drawLayerRef, sketchRef, viewRef,
        basemapId,
        setCustomRev,
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

    const placeBuildingAt = async (lat: number, lng: number) => {
        let groundElev = paramsRef.current.elev;
        const view = viewRef.current;
        if (view?.map?.ground) {
            try {
                const Point = (await import("@arcgis/core/geometry/Point")).default;
                const samplePoint = new Point({
                    latitude: lat,
                    longitude: lng,
                    spatialReference: { wkid: 4326 } as any,
                });
                const result = await view.map.ground.queryElevation(samplePoint);
                const z = (result.geometry as any)?.z;
                if (typeof z === "number" && !Number.isNaN(z)) groundElev = z;
            } catch (e) {
                console.warn("Ground elevation sample failed, using manual value", e);
            }
        }

        const id = `b_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const b: SavedBuilding = {
            id,
            params: { ...paramsRef.current, lat, lng, elev: groundElev, name: paramsRef.current.name },
            roofType: roofTypeRef.current,
            obstacles: [], // Need to get current obstacles from store if desired, but default code used refs
        };
        buildingsRef.current[id] = b;
        renderBuilding(b);
        selectedBuildingIdRef.current = id;
        setSelectedBuildingId(id);
        setBuildingsCount(Object.keys(buildingsRef.current).length);

        setParams((prev) => {
            const m = prev.name.match(/^(.*?)(\d+)$/);
            const next = m ? `${m[1]}${parseInt(m[2]) + 1}` : `${prev.name}_2`;
            return { ...prev, name: next, lat, lng, elev: groundElev };
        });
    };

    const buildBasemap = async (id: string): Promise<Basemap> => {
        if (id === "osm") {
            const osmLayer = new OpenStreetMapLayer();
            await osmLayer.load();
            return new Basemap({
                baseLayers: [osmLayer],
                title: "Custom OSM",
                id: "custom-osm-basemap",
            });
        }
        return Basemap.fromId(id) as Basemap;
    };

    useEffect(() => {
        const view = viewRef.current;
        if (!view || !view.map) return;
        let cancelled = false;
        buildBasemap(basemapId).then((bm) => {
            if (cancelled || !view.map) return;
            view.map.basemap = bm;
        }).catch((e) => console.warn("Basemap switch failed", e));
        return () => { cancelled = true; };
    }, [basemapId]);

    useEffect(() => {
        if (!mapRef.current) return;
        let cancelled = false;

        const init = async () => {
            const initialBasemap = await buildBasemap(basemapId);
            if (cancelled) return;

            const map = new Map({
                basemap: initialBasemap,
                ground: "world-elevation",
            });

            const view = new SceneView({
                container: mapRef.current!,
                map,
                camera: { position: { latitude: 24.711394, longitude: 46.674347, z: 1000 }, tilt: 30 },
                environment: { lighting: { directShadowsEnabled: true, date: new Date() } },
                qualityProfile: "high",
                zoom: 18,
            });
            viewRef.current = view;

            const drawLayer = new GraphicsLayer({
                title: "Generated Buildings",
                elevationInfo: { mode: "absolute-height" },
            });
            map.add(drawLayer);
            drawLayerRef.current = drawLayer;

            const editLayer = new GraphicsLayer({
                title: "Edit Handles",
                elevationInfo: { mode: "absolute-height" },
                listMode: "hide",
            });
            map.add(editLayer);
            editLayerRef.current = editLayer;

            const sketchViewModel = new SketchViewModel({
                view,
                layer: drawLayer,
                defaultUpdateOptions: { enableZ: false, tool: "transform", toggleToolOnClick: false, multipleSelectionEnabled: true, enableRotation: false, enableScaling: false },
                // Snap newly-drawn vertices to existing building edges/vertices
                // (parent-edge snap for volumes; helpful for custom footprints too).
                // selfEnabled = snap to the polygon being drawn (helps close cleanly).
                snappingOptions: {
                    enabled: true,
                    selfEnabled: true,
                    featureEnabled: true,
                    featureSources: [{ layer: drawLayer, enabled: true }],
                } as any,
            } as any);
            sketchRef.current = sketchViewModel;

            const clickHandle = view.on("click", async (event) => {
                if (placementModeRef.current) {
                    const mp = view.toMap(event);
                    if (!mp) return;
                    placementModeRef.current = false;
                    setPlacementMode(false);
                    placeBuildingAt(mp.latitude!, mp.longitude!);
                    return;
                }

                // Vertex-edit is active — let SketchViewModel keep reshape mode.
                // Selecting another building or re-entering transform here would
                // immediately cancel the user's drag.
                if (editingTargetRef.current) return;

                const hit = await view.hitTest(event);
                const r = hit.results.find((h: any) => h.graphic && h.graphic.layer === drawLayer);
                const g = (r as any)?.graphic;
                const bid = g?.attributes?.buildingId;
                if (!bid) {
                    selectedBuildingIdRef.current = null;
                    setSelectedBuildingId(null);
                    return;
                }
                selectedBuildingIdRef.current = bid;
                setSelectedBuildingId(bid);
                
                const groupGraphics = drawLayer.graphics.toArray().filter((gr) => (gr.attributes as any)?.buildingId === bid);
                sketchViewModel.update(groupGraphics, { tool: "transform", enableRotation: false, enableScaling: false, enableZ: false, multipleSelectionEnabled: true } as any);
            });

            const createHandle = sketchViewModel.on("create", async (event: any) => {
                if (event.state !== "complete") return;

                // ----- Volume sketch branch -----
                const volPending = pendingVolumeRef.current;
                if (volPending) {
                    pendingVolumeRef.current = null;
                    setVolumeDrawMode(false);

                    const sketched = event.graphic as Graphic;
                    let poly = sketched.geometry as Polygon;
                    if (!poly?.rings?.length) { drawLayer.remove(sketched); return; }
                    if (poly.spatialReference?.wkid !== 4326) {
                        const wmu = await import("@arcgis/core/geometry/support/webMercatorUtils");
                        const projected = wmu.webMercatorToGeographic(poly) as Polygon;
                        if (projected) poly = projected;
                    }
                    drawLayer.remove(sketched);

                    const parent = buildingsRef.current[volPending.buildingId];
                    if (!parent) return;
                    const ring = poly.rings[0].slice(0, poly.rings[0].length - 1) as [number, number][];

                    // Convert each [lng, lat] vertex to LOCAL meters in parent's
                    // unrotated frame (matching BuildingVolume.ringLocal convention).
                    const cLat = parent.custom ? parent.custom.centerLat : parent.params.lat;
                    const cLng = parent.custom ? parent.custom.centerLng : parent.params.lng;
                    const rotRad = ((parent.params.rot || 0) * Math.PI) / 180;
                    const cosR = Math.cos(-rotRad), sinR = Math.sin(-rotRad);
                    const ringLocal: [number, number][] = ring.map(([lng, lat]) => {
                        const { x, y } = lngLatToLocalMeters(lng, lat, cLat, cLng);
                        // Inverse-rotate so coords sit in parent's unrotated frame.
                        return [x * cosR - y * sinR, x * sinR + y * cosR];
                    });

                    const preset = volPending.preset ?? {};
                    const vol: BuildingVolume = {
                        id: `v_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                        ringLocal,
                        baseOffset: 0,
                        wh: 3,
                        roofType: "flat",
                        pitch: 0,
                        parapet: 0,
                        parapetWidth: 0,
                        wallColorHex: "#e8c060",
                        roofColorHex: "#e07a30",
                        ...preset,
                    };
                    parent.volumes = [...(parent.volumes ?? []), vol];
                    renderBuilding(parent);
                    setCustomRev((r) => r + 1);
                    return;
                }

                const pending = pendingCustomRef.current;
                if (!pending) return;
                pendingCustomRef.current = null;
                setCustomDrawMode(false);

                const sketched = event.graphic as Graphic;
                let poly = sketched.geometry as Polygon;
                if (!poly?.rings?.length) return;

                if (poly.spatialReference?.wkid !== 4326) {
                    const wmu = await import("@arcgis/core/geometry/support/webMercatorUtils");
                    const projected = wmu.webMercatorToGeographic(poly) as Polygon;
                    if (projected) poly = projected;
                }
                const ring = poly.rings[0];

                let baseZ = paramsRef.current.elev;
                try {
                    const center = poly.extent?.center;
                    if (center) {
                        const r = await view.map!.ground.queryElevation(center);
                        const z = (r.geometry as any)?.z;
                        if (typeof z === "number") baseZ = z;
                    }
                } catch (e) { console.warn("Custom footprint elevation sample failed", e); }

                drawLayer.remove(sketched);

                const id = `b_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                const cLat = poly.extent?.center?.latitude ?? paramsRef.current.lat;
                const cLng = poly.extent?.center?.longitude ?? paramsRef.current.lng;

                const lngLat: [number, number][] = ring.slice(0, ring.length - 1).map(([x, y]) => [x as number, y as number]);

                const newB: SavedBuilding = {
                    id,
                    params: { ...paramsRef.current, name: pending.name, elev: baseZ, lat: cLat, lng: cLng },
                    roofType: "flat",
                    obstacles: [],
                    custom: { ringLngLat: lngLat, centerLat: cLat, centerLng: cLng, baseZ },
                };

                buildingsRef.current[id] = newB;
                renderBuilding(newB);
                selectedBuildingIdRef.current = id;
                setSelectedBuildingId(id);
                setBuildingsCount(Object.keys(buildingsRef.current).length);

                setParams((prev) => {
                    const m = prev.name.match(/^(.*?)(\d+)$/);
                    const next = m ? `${m[1]}${parseInt(m[2]) + 1}` : `${prev.name}_2`;
                    return { ...prev, name: next };
                });
            });

            let moveStartCenter: { lat: number; lng: number } | null = null;

            const groupCenter = (graphics: Graphic[]): { lat: number; lng: number } | null => {
                let union: any = null;
                for (const g of graphics) {
                    const e: any = (g.geometry as any)?.extent;
                    if (!e) continue;
                    union = union ? union.union(e) : e.clone();
                }
                if (!union?.center) return null;
                return { lat: union.center.latitude, lng: union.center.longitude };
            };

            const updateHandle = sketchViewModel.on("update", async (event: any) => {
                // ----- Vertex-edit (reshape) branch -----
                const handle = event.graphics?.[0];
                const target = editingTargetRef.current;
                if (handle?.attributes?.editHandle && target) {
                    if (event.state !== "active" && event.state !== "complete") return;
                    let poly = handle.geometry as Polygon;
                    if (!poly?.rings?.length) return;
                    if (poly.spatialReference?.wkid !== 4326) {
                        const wmu = await import("@arcgis/core/geometry/support/webMercatorUtils");
                        const projected = wmu.webMercatorToGeographic(poly) as Polygon;
                        if (projected) poly = projected;
                    }
                    const ring = poly.rings[0];
                    const open: [number, number][] = ring
                        .slice(0, ring.length - 1)
                        .map((p: any) => [p[0] as number, p[1] as number]);
                    if (open.length < 3) return;

                    const b = buildingsRef.current[target.buildingId];
                    if (!b) return;

                    if (target.kind === "building") {
                        if (!b.custom) return;
                        b.custom.ringLngLat = open;
                    } else {
                        const vol = b.volumes?.find((v) => v.id === target.volumeId);
                        if (!vol) return;
                        // Convert lng/lat → parent's UNROTATED local meters.
                        // (Per-volume rotDeg was reset to 0 by startVertexEdit so we
                        // don't have to compose two rotations here.)
                        const cLat = b.custom ? b.custom.centerLat : b.params.lat;
                        const cLng = b.custom ? b.custom.centerLng : b.params.lng;
                        const R = 6371000;
                        const mPerDegLat = R * (Math.PI / 180);
                        const mPerDegLng = R * Math.cos((cLat * Math.PI) / 180) * (Math.PI / 180);
                        const rotRad = ((b.params.rot || 0) * Math.PI) / 180;
                        const cosR = Math.cos(-rotRad), sinR = Math.sin(-rotRad);
                        vol.ringLocal = open.map(([lng, lat]) => {
                            const x = (lng - cLng) * mPerDegLng;
                            const y = (lat - cLat) * mPerDegLat;
                            return [x * cosR - y * sinR, x * sinR + y * cosR];
                        });
                    }

                    renderBuilding(b);
                    setCustomRev((r) => r + 1);
                    return;
                }

                if (event.state === "start") {
                    moveStartCenter = groupCenter(event.graphics ?? []);
                    return;
                }
                if (event.state !== "complete") return;
                if (event.aborted) { moveStartCenter = null; return; }

                const bid = selectedBuildingIdRef.current;
                if (!bid) { moveStartCenter = null; return; }
                const b = buildingsRef.current[bid];
                if (!b || !moveStartCenter) { moveStartCenter = null; return; }

                const endCenter = groupCenter(event.graphics ?? []);
                if (!endCenter) { moveStartCenter = null; return; }

                const dLat = endCenter.lat - moveStartCenter.lat;
                const dLng = endCenter.lng - moveStartCenter.lng;
                moveStartCenter = null;
                if (dLat === 0 && dLng === 0) return;

                const newLat = b.params.lat + dLat;
                const newLng = b.params.lng + dLng;

                let newElev = b.params.elev;
                try {
                    const Point = (await import("@arcgis/core/geometry/Point")).default;
                    const pt = new Point({
                        latitude: newLat,
                        longitude: newLng,
                        spatialReference: { wkid: 4326 } as any,
                    });
                    const r = await view.map!.ground.queryElevation(pt);
                    const z = (r.geometry as any)?.z;
                    if (typeof z === "number" && !Number.isNaN(z)) newElev = z;
                } catch (e) {
                    console.warn("Move elevation resample failed", e);
                }

                const deltaZ = newElev - b.params.elev;

                b.params.lat = newLat;
                b.params.lng = newLng;
                b.params.elev = newElev;

                if (b.custom) {
                    b.custom.ringLngLat = b.custom.ringLngLat.map(
                        ([lng, lat]) => [lng + dLng, lat + dLat] as [number, number]
                    );
                    b.custom.centerLat = newLat;
                    b.custom.centerLng = newLng;
                    b.custom.baseZ = newElev;
                }

                if (deltaZ !== 0) {
                    const buildingGraphics = drawLayer.graphics
                        .toArray()
                        .filter((g) => (g.attributes as any)?.buildingId === bid);
                    for (const g of buildingGraphics) {
                        const poly: any = g.geometry;
                        if (!poly?.clone || !poly.rings) continue;
                        const cloned = poly.clone();
                        cloned.rings = cloned.rings.map((ring: number[][]) =>
                            ring.map((pt) => {
                                const x = pt[0];
                                const y = pt[1];
                                const z = pt[2] ?? 0;
                                return [x, y, z + deltaZ];
                            })
                        );
                        g.geometry = cloned;
                    }
                }

                setCustomRev((v) => v + 1);
            });

            view.ui.components = [];
            (view as any)._handles = [clickHandle, createHandle, updateHandle];
        };

        init().catch((err) => console.error(err));

        return () => {
            cancelled = true;
            const handles = (viewRef.current as any)?._handles as { remove: () => void }[] | undefined;
            handles?.forEach((h) => h.remove());
            sketchRef.current?.destroy();
            sketchRef.current = null;
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
        };
    }, []);

    return {
        mapRef,
        renderBuilding
    };
}
