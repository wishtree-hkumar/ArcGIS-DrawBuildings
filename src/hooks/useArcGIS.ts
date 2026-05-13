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
import { SavedBuilding } from "../types/building.types";
import { toLat, toLng } from "../utils/geoUtils";

export function useArcGIS() {
    const mapRef = useRef<HTMLDivElement>(null);
    const {
        buildingsRef, setBuildingsCount,
        selectedBuildingIdRef, setSelectedBuildingId,
        placementModeRef, setPlacementMode,
        pendingCustomRef, setCustomDrawMode,
        roofTypeRef, paramsRef, setParams,
        drawLayerRef, sketchRef, viewRef,
        basemapId,
    } = useBuildingStore();

    const renderBuilding = (b: SavedBuilding) => {
        const layer = drawLayerRef.current;
        if (!layer) return;
        const old = layer.graphics
            .toArray()
            .filter((g) => (g.attributes as any)?.buildingId === b.id);
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

            const sketchViewModel = new SketchViewModel({
                view,
                layer: drawLayer,
                defaultUpdateOptions: { enableZ: true, tool: "transform", toggleToolOnClick: false, multipleSelectionEnabled: true },
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
                sketchViewModel.update(groupGraphics, { tool: "transform", enableRotation: true, enableScaling: false, multipleSelectionEnabled: true } as any);
            });

            const createHandle = sketchViewModel.on("create", async (event: any) => {
                if (event.state !== "complete") return;
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

            const updateHandle = sketchViewModel.on("update", (event: any) => {
                if (event.state === "complete" || event.state === "cancel") {
                    const bid = selectedBuildingIdRef.current;
                    if (!bid) return;
                    const b = buildingsRef.current[bid];
                    if (!b) return;
                    const moved = event.graphics?.[0];
                    const ext = moved?.geometry?.extent;
                    if (ext) {
                        b.params.lat = ext.center.latitude;
                        b.params.lng = ext.center.longitude;
                    }
                }
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
