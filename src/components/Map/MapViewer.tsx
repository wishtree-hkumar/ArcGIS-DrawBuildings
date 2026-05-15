import React from "react";
import { useBuildingStore, BasemapId } from "../../context/BuildingContext";
import { useArcGIS } from "../../hooks/useArcGIS";

const BASEMAP_OPTIONS: { id: BasemapId; label: string }[] = [
    { id: "osm", label: "Streets (OSM)" },
    { id: "satellite", label: "Satellite" },
    { id: "hybrid", label: "Hybrid" },
    { id: "topo-vector", label: "Topographic" },
];

export const MapViewer: React.FC = () => {
    const { placementMode, customDrawMode, basemapId, setBasemapId } = useBuildingStore();
    const { mapRef } = useArcGIS();

    return (
        <>
            <style>{`
                .placement-banner { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 1000;
                    background: #00d4ff; color: #000; padding: 8px 18px; border-radius: 4px; font-weight: 700;
                    font-family: 'Space Grotesk', sans-serif; font-size: 13px; letter-spacing: .04em; box-shadow: 0 4px 12px rgba(0,212,255,.4); }
                .basemap-selector { position: absolute; top: 16px; right: 348px; z-index: 1000;
                    background: rgba(20, 20, 28, 0.92); color: #fff; padding: 8px 10px; border-radius: 6px;
                    font-family: 'Space Grotesk', sans-serif; font-size: 12px; letter-spacing: .04em;
                    box-shadow: 0 4px 12px rgba(0,0,0,.35); border: 1px solid rgba(0,212,255,.35); display: flex; align-items: center; gap: 8px; }
                .basemap-selector select { background: #0e0e16; color: #fff; border: 1px solid rgba(255,255,255,.15);
                    border-radius: 4px; padding: 4px 6px; font: inherit; outline: none; }
                .basemap-selector select:focus { border-color: #00d4ff; }
            `}</style>

            {placementMode && (
                <div className="placement-banner">
                    CLICK ON MAP TO PLACE BUILDING
                </div>
            )}
            {customDrawMode && (
                <div className="placement-banner">
                    CLICK TO ADD VERTICES · DOUBLE-CLICK TO FINISH FOOTPRINT
                </div>
            )}

            <div className="basemap-selector">
                <label htmlFor="basemap-select">VIEW</label>
                <select
                    id="basemap-select"
                    value={basemapId}
                    onChange={(e) => setBasemapId(e.target.value as BasemapId)}
                >
                    {BASEMAP_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                </select>
            </div>

            <div ref={mapRef} style={{ height: "100vh", width: "100%" }} />
        </>
    );
};
