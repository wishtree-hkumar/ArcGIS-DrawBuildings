import React from "react";
import { useBuildingStore } from "../../context/BuildingContext";
import { useArcGIS } from "../../hooks/useArcGIS";

export const MapViewer: React.FC = () => {
    const { placementMode, customDrawMode } = useBuildingStore();
    const { mapRef } = useArcGIS();

    return (
        <>
            <style>{`
                .placement-banner { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 1000;
                    background: #00d4ff; color: #000; padding: 8px 18px; border-radius: 4px; font-weight: 700;
                    font-family: 'Space Grotesk', sans-serif; font-size: 13px; letter-spacing: .04em; box-shadow: 0 4px 12px rgba(0,212,255,.4); }
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

            <div ref={mapRef} style={{ height: "100vh", width: "100%" }} />
        </>
    );
};
