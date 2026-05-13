import React from "react";
import { useBuildingStore } from "../../context/BuildingContext";
import { useMapActions } from "../../hooks/useMapActions";

export const RightPanel: React.FC = () => {
    const {
        selectedBuildingId, buildingsRef, customRev
    } = useBuildingStore();

    const {
        exportAll, editSelected, deleteSelected, duplicateSelected,
        startPlacement, startCustomDraw,
    } = useMapActions();

    void customRev;

    const selectedBuilding = selectedBuildingId ? buildingsRef.current[selectedBuildingId] : null;

    const area = selectedBuilding ? selectedBuilding.params.len * selectedBuilding.params.wid : 0;
    const obstacles = selectedBuilding?.obstacles ?? [];
    const blocked = obstacles.reduce((s, o) => s + o.w * o.d, 0);

    return (
        <div className="opv-panel">
            <div className="opv-section">
                <div className="opv-section-title">Stats {selectedBuilding ? `— ${selectedBuilding.params.name}` : "(no selection)"}</div>
                <div className="stats-grid">
                    <div className="sbox">
                        <div className="sbox-l">Area</div>
                        <div className="sbox-v cyan">{Math.round(area)} m²</div>
                    </div>
                    <div className="sbox">
                        <div className="sbox-l">Obstacles</div>
                        <div className="sbox-v warn">{obstacles.length}</div>
                    </div>
                    <div className="sbox">
                        <div className="sbox-l">Blocked</div>
                        <div className="sbox-v warn">{Math.round(blocked)} m²</div>
                    </div>
                    <div className="sbox">
                        <div className="sbox-l">Usable</div>
                        <div className="sbox-v green">{Math.round(Math.max(0, area - blocked))} m²</div>
                    </div>
                </div>
            </div>

            <hr className="opv-divider" />

            <div className="opv-section">
                <div className="opv-section-title">Map Actions</div>
                <button className="opv-btn opv-btn-primary" style={{ width: "100%", marginBottom: 6 }} onClick={startPlacement}>+ Place Building on Map</button>
                <button className="opv-btn opv-btn-primary" style={{ width: "100%", marginBottom: 6 }} onClick={startCustomDraw}>✏ Draw Custom Footprint</button>
                <div className="opv-btn-row">
                    <button className="opv-btn" onClick={editSelected} disabled={!selectedBuilding}>Move / Rotate</button>
                    <button className="opv-btn" onClick={duplicateSelected} disabled={!selectedBuilding}>Duplicate</button>
                    <button className="opv-btn opv-btn-danger" onClick={deleteSelected} disabled={!selectedBuilding}>Delete</button>
                    <button className="opv-btn opv-btn-accent" onClick={exportAll}>Export All</button>
                </div>
            </div>
        </div>
    );
};
