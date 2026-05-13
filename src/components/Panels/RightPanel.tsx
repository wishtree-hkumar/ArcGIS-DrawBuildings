import React from "react";
import { useBuildingStore } from "../../context/BuildingContext";
import { useMapActions } from "../../hooks/useMapActions";
import { OBSTACLE_PRESETS, RoofType } from "../../types/building.types";
import { ObstacleEditor2D } from "../Editors/ObstacleEditor2D";

export const RightPanel: React.FC = () => {
    const {
        obstacles, setObstacles,
        selectedObsIdx, setSelectedObsIdx,
        obsSize, setObsSize,
        params,
        selectedBuildingId, buildingsRef
    } = useBuildingStore();

    const {
        exportAll, editSelected, deleteSelected, duplicateSelected,
        startPlacement, startCustomDraw,
        setCustomWallHeight, setCustomParapet, setCustomRoofType, setCustomPitch
    } = useMapActions();

    const area = params.len * params.wid;
    const blocked = obstacles.reduce((s, o) => s + o.w * o.d, 0);

    const selectedBuilding = selectedBuildingId ? buildingsRef.current[selectedBuildingId] : null;
    const isCustomSelected = !!selectedBuilding?.custom;

    const addObstacle = () => {
        const preset = OBSTACLE_PRESETS[selectedObsIdx];
        setObstacles((o) => [...o, { type: preset.type, color: preset.color, rx: 0, ry: 0, ...obsSize }]);
    };

    const removeObstacle = (i: number) => {
        setObstacles((o) => o.filter((_, idx) => idx !== i));
    };

    return (
        <div className="opv-panel">
            <div className="opv-section">
                <div className="opv-section-title">Place Obstacles</div>
                {OBSTACLE_PRESETS.map((preset, i) => (
                    <div
                        key={preset.type}
                        className={`obs-btn ${selectedObsIdx === i ? "selected" : ""}`}
                        onClick={() => {
                            setSelectedObsIdx(i);
                            setObsSize({ w: preset.w, d: preset.d, h: preset.h });
                        }}
                    >
                        <div className="obs-dot" style={{ background: preset.color }} />
                        {preset.type}
                        <span className="obs-sub">{preset.sub}</span>
                    </div>
                ))}
                <div className="opv-row3" style={{ marginTop: 8 }}>
                    <div className="opv-field">
                        <label>W (m)</label>
                        <input className="opv-input" type="number" step={0.1} value={obsSize.w} onChange={(e) => setObsSize((s) => ({ ...s, w: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="opv-field">
                        <label>D (m)</label>
                        <input className="opv-input" type="number" step={0.1} value={obsSize.d} onChange={(e) => setObsSize((s) => ({ ...s, d: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="opv-field">
                        <label>H (m)</label>
                        <input className="opv-input" type="number" step={0.1} value={obsSize.h} onChange={(e) => setObsSize((s) => ({ ...s, h: parseFloat(e.target.value) || 0 }))} />
                    </div>
                </div>
                <button className="opv-btn" style={{ width: "100%", marginTop: 6 }} onClick={addObstacle}>
                    + Add at center
                </button>
                
                <ObstacleEditor2D />

                {obstacles.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                        {obstacles.map((o, i) => (
                            <div key={i} className="obs-list-item">
                                <div className="obs-dot" style={{ background: o.color }} />
                                <span style={{ flex: 1 }}>{o.type}</span>
                                <span style={{ fontFamily: "monospace", fontSize: 9, color: "#64748b" }}>{o.w}×{o.d}m</span>
                                <button onClick={() => removeObstacle(i)}>×</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="opv-section">
                <div className="opv-section-title">Stats (current draft)</div>
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

            {isCustomSelected && selectedBuilding && (
                <>
                    <hr className="opv-divider" />
                    <div className="opv-section">
                        <div className="opv-section-title">Custom Editor — {selectedBuilding.params.name}</div>
                        <div className="opv-row2">
                            <div className="opv-field">
                                <label>Wall H (m)</label>
                                <input className="opv-input" type="number" step={0.1} value={selectedBuilding.params.wh} onChange={(e) => setCustomWallHeight(parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="opv-field">
                                <label>Parapet (m)</label>
                                <input className="opv-input" type="number" step={0.1} value={selectedBuilding.params.parapet} onChange={(e) => setCustomParapet(parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                        <div className="opv-row2">
                            <div className="opv-field">
                                <label>Roof</label>
                                <select className="opv-select" value={selectedBuilding.roofType} onChange={(e) => setCustomRoofType(e.target.value as RoofType)}>
                                    <option value="flat">Flat</option>
                                    <option value="monopitch">Monopitch</option>
                                </select>
                            </div>
                            <div className="opv-field">
                                <label>Pitch (%)</label>
                                <input className="opv-input" type="number" step={0.1} value={selectedBuilding.params.pitch} onChange={(e) => setCustomPitch(parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                    </div>
                </>
            )}

            <hr className="opv-divider" />

            <div className="opv-section">
                <div className="opv-section-title">Map Actions</div>
                <div className="opv-btn-row">
                    <button className="opv-btn opv-btn-primary" onClick={startPlacement}>Place Building</button>
                    <button className="opv-btn opv-btn-primary" onClick={startCustomDraw}>Draw Custom</button>
                    <button className="opv-btn" onClick={editSelected} disabled={!selectedBuilding}>Move / Rotate</button>
                    <button className="opv-btn" onClick={duplicateSelected} disabled={!selectedBuilding}>Duplicate</button>
                    <button className="opv-btn opv-btn-danger" onClick={deleteSelected} disabled={!selectedBuilding}>Delete</button>
                    <button className="opv-btn opv-btn-accent" onClick={exportAll}>Export All</button>
                </div>
            </div>
        </div>
    );
};
