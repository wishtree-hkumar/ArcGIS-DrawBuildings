import React from "react";
import { useBuildingStore } from "../../context/BuildingContext";
import { useMapActions } from "../../hooks/useMapActions";
import { OBSTACLE_PRESETS, RoofType, BuildingParams } from "../../types/building.types";
import { ObstacleEditor2D } from "../Editors/ObstacleEditor2D";

export const LeftPanel: React.FC = () => {
    const {
        viewRef,
        selectedBuildingId, buildingsRef, customRev,
        selectedObsIdx, setSelectedObsIdx,
        obsSize, setObsSize,
    } = useBuildingStore();

    const { setParam, setRoofTypeOf, setObstaclesOf } = useMapActions();

    void customRev;

    const selectedBuilding = selectedBuildingId ? buildingsRef.current[selectedBuildingId] : null;
    const disabled = !selectedBuilding;
    const isCustom = !!selectedBuilding?.custom;

    const p = selectedBuilding?.params;
    const roofType: RoofType = selectedBuilding?.roofType ?? "flat";
    const obstacles = selectedBuilding?.obstacles ?? [];

    const num = <K extends keyof BuildingParams>(key: K, step = 0.1) => (
        <input
            className="opv-input"
            type="number"
            step={step}
            disabled={disabled}
            value={(p?.[key] as number | string) ?? ""}
            onChange={(e) => setParam(key, (parseFloat(e.target.value) || 0) as BuildingParams[K])}
        />
    );

    const addObstacle = () => {
        if (disabled) return;
        const preset = OBSTACLE_PRESETS[selectedObsIdx];
        setObstaclesOf((o) => [...o, { type: preset.type, color: preset.color, rx: 0, ry: 0, ...obsSize }]);
    };

    const removeObstacle = (i: number) => {
        setObstaclesOf((o) => o.filter((_, idx) => idx !== i));
    };

    const dimDisabled = disabled || isCustom;

    return (
        <div className="opv-panel left">
            {!selectedBuilding && (
                <div className="opv-section" style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.3)", borderRadius: 4, padding: 10 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>
                        Place or draw a building on the map first. All settings here edit the currently selected building live.
                    </div>
                </div>
            )}

            <div className="opv-section">
                <div className="opv-section-title">Building Identity</div>
                <div className="opv-field">
                    <label>Name</label>
                    <input
                        className="opv-input"
                        disabled={disabled}
                        value={p?.name ?? ""}
                        onChange={(e) => setParam("name", e.target.value)}
                    />
                </div>
                <div className="opv-row2">
                    <div className="opv-field">
                        <label>Lat</label>
                        {num("lat", 0.000001)}
                    </div>
                    <div className="opv-field">
                        <label>Lng</label>
                        {num("lng", 0.000001)}
                    </div>
                </div>
                <div className="opv-field">
                    <label>Elevation (m ASL)</label>
                    <div style={{ display: "flex", gap: 4, alignItems: "stretch", width: "100%" }}>
                        <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
                            {num("elev", 0.1)}
                        </div>
                        <button
                            className="opv-btn"
                            style={{ flexShrink: 0, padding: "0 10px", fontSize: 11, lineHeight: 1 }}
                            disabled={disabled}
                            title="Sample ground elevation at current Lat/Lng"
                            onClick={async () => {
                                const view = viewRef.current;
                                if (!view?.map?.ground || !p) return;
                                try {
                                    const Point = (await import("@arcgis/core/geometry/Point")).default;
                                    const pt = new Point({
                                        latitude: p.lat,
                                        longitude: p.lng,
                                        spatialReference: { wkid: 4326 } as any,
                                    });
                                    const r = await view.map.ground.queryElevation(pt);
                                    const z = (r.geometry as any)?.z;
                                    if (typeof z === "number") setParam("elev", z);
                                } catch (e) {
                                    console.warn(e);
                                }
                            }}
                        >
                            ⛰
                        </button>
                    </div>
                </div>
            </div>

            <hr className="opv-divider" />

            <div className="opv-section">
                <div className="opv-section-title">
                    Dimensions {isCustom && <span style={{ fontWeight: 400, color: "#64748b", fontSize: 10 }}>(footprint locked for custom)</span>}
                </div>
                <div className="opv-row2">
                    <div className="opv-field">
                        <label>Length (m)</label>
                        <input className="opv-input" type="number" step={0.1} disabled={dimDisabled} value={p?.len ?? ""} onChange={(e) => setParam("len", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="opv-field">
                        <label>Width (m)</label>
                        <input className="opv-input" type="number" step={0.1} disabled={dimDisabled} value={p?.wid ?? ""} onChange={(e) => setParam("wid", parseFloat(e.target.value) || 0)} />
                    </div>
                </div>
                <div className="opv-row2">
                    <div className="opv-field">
                        <label>Wall H (m)</label>
                        <input className="opv-input" type="number" step={0.1} disabled={disabled} value={p?.wh ?? ""} onChange={(e) => setParam("wh", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="opv-field">
                        <label>Rotation (°)</label>
                        <input className="opv-input" type="number" step={1} disabled={dimDisabled} value={p?.rot ?? ""} onChange={(e) => setParam("rot", parseFloat(e.target.value) || 0)} />
                    </div>
                </div>
                <div className="opv-row2">
                    <div className="opv-field">
                        <label>Parapet (m)</label>
                        <input className="opv-input" type="number" step={0.1} disabled={disabled} value={p?.parapet ?? ""} onChange={(e) => setParam("parapet", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="opv-field">
                        <label>Pitch (%)</label>
                        <input className="opv-input" type="number" step={0.1} disabled={disabled} value={p?.pitch ?? ""} onChange={(e) => setParam("pitch", parseFloat(e.target.value) || 0)} />
                    </div>
                </div>
            </div>

            <hr className="opv-divider" />

            <div className="opv-section">
                <div className="opv-section-title">Roof Type</div>
                <div className="roof-grid">
                    {(["flat", "gabled", "monopitch", "sawtooth", "hipped", "barrel"] as RoofType[]).map((t) => {
                        const allowed = !isCustom || t === "flat" || t === "monopitch";
                        const isActive = roofType === t && !disabled;
                        const cardDisabled = disabled || !allowed;
                        return (
                            <div
                                key={t}
                                className={`rcard ${isActive ? "active" : ""}`}
                                style={cardDisabled ? { opacity: 0.4, pointerEvents: "none" } : undefined}
                                onClick={() => !cardDisabled && setRoofTypeOf(t)}
                            >
                                {t.toUpperCase()}
                            </div>
                        );
                    })}
                </div>
                {roofType === "sawtooth" && !disabled && (
                    <div className="opv-field" style={{ marginTop: 8 }}>
                        <label>Spans: {p?.spans}</label>
                        <input type="range" min={2} max={20} value={p?.spans ?? 2} onChange={(e) => setParam("spans", parseInt(e.target.value))} />
                    </div>
                )}
            </div>

            <hr className="opv-divider" />

            <div className="opv-section">
                <div className="opv-section-title">Place Obstacles</div>
                {OBSTACLE_PRESETS.map((preset, i) => (
                    <div
                        key={preset.type}
                        className={`obs-btn ${selectedObsIdx === i ? "selected" : ""}`}
                        style={disabled ? { opacity: 0.4, pointerEvents: "none" } : undefined}
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
                        <input className="opv-input" type="number" step={0.1} disabled={disabled} value={obsSize.w} onChange={(e) => setObsSize((s) => ({ ...s, w: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="opv-field">
                        <label>D (m)</label>
                        <input className="opv-input" type="number" step={0.1} disabled={disabled} value={obsSize.d} onChange={(e) => setObsSize((s) => ({ ...s, d: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="opv-field">
                        <label>H (m)</label>
                        <input className="opv-input" type="number" step={0.1} disabled={disabled} value={obsSize.h} onChange={(e) => setObsSize((s) => ({ ...s, h: parseFloat(e.target.value) || 0 }))} />
                    </div>
                </div>
                <button className="opv-btn" style={{ width: "100%", marginTop: 6 }} disabled={disabled} onClick={addObstacle}>
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
        </div>
    );
};
