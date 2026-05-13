import React from "react";
import { useBuildingStore } from "../../context/BuildingContext";
import { RoofType } from "../../types/building.types";

export const LeftPanel: React.FC = () => {
    const { params, setParams, roofType, setRoofType, viewRef } = useBuildingStore();

    return (
        <div className="opv-panel left">
            <div className="opv-section">
                <div className="opv-section-title">Building Identity</div>
                <div className="opv-field">
                    <label>Name</label>
                    <input
                        className="opv-input"
                        value={params.name}
                        onChange={(e) => setParams((p) => ({ ...p, name: e.target.value }))}
                    />
                </div>
                <div className="opv-row2">
                    <div className="opv-field">
                        <label>Lat</label>
                        <input
                            className="opv-input"
                            type="number"
                            step={0.000001}
                            value={params.lat}
                            onChange={(e) => setParams((p) => ({ ...p, lat: parseFloat(e.target.value) || 0 }))}
                        />
                    </div>
                    <div className="opv-field">
                        <label>Lng</label>
                        <input
                            className="opv-input"
                            type="number"
                            step={0.000001}
                            value={params.lng}
                            onChange={(e) => setParams((p) => ({ ...p, lng: parseFloat(e.target.value) || 0 }))}
                        />
                    </div>
                </div>
                <div className="opv-field">
                    <label>Elevation (m ASL) — auto on placement</label>
                    <div style={{ display: "flex", gap: 4 }}>
                        <input
                            className="opv-input"
                            type="number"
                            step={0.1}
                            value={params.elev}
                            onChange={(e) => setParams((p) => ({ ...p, elev: parseFloat(e.target.value) || 0 }))}
                        />
                        <button
                            className="opv-btn"
                            style={{ flexShrink: 0, padding: "4px 8px", fontSize: 11 }}
                            title="Sample ground elevation at current Lat/Lng"
                            onClick={async () => {
                                const view = viewRef.current;
                                if (!view?.map?.ground) return;
                                try {
                                    const Point = (await import("@arcgis/core/geometry/Point")).default;
                                    const pt = new Point({
                                        latitude: params.lat,
                                        longitude: params.lng,
                                        spatialReference: { wkid: 4326 } as any,
                                    });
                                    const r = await view.map.ground.queryElevation(pt);
                                    const z = (r.geometry as any)?.z;
                                    if (typeof z === "number") {
                                        setParams((p) => ({ ...p, elev: z }));
                                    }
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
                <div className="opv-section-title">Dimensions</div>
                <div className="opv-row2">
                    <div className="opv-field">
                        <label>Length (m)</label>
                        <input className="opv-input" type="number" step={0.1} value={params.len} onChange={(e) => setParams((p) => ({ ...p, len: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="opv-field">
                        <label>Width (m)</label>
                        <input className="opv-input" type="number" step={0.1} value={params.wid} onChange={(e) => setParams((p) => ({ ...p, wid: parseFloat(e.target.value) || 0 }))} />
                    </div>
                </div>
                <div className="opv-row2">
                    <div className="opv-field">
                        <label>Wall H (m)</label>
                        <input className="opv-input" type="number" step={0.1} value={params.wh} onChange={(e) => setParams((p) => ({ ...p, wh: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="opv-field">
                        <label>Rotation (°)</label>
                        <input className="opv-input" type="number" step={1} value={params.rot} onChange={(e) => setParams((p) => ({ ...p, rot: parseFloat(e.target.value) || 0 }))} />
                    </div>
                </div>
                <div className="opv-row2">
                    <div className="opv-field">
                        <label>Parapet (m)</label>
                        <input className="opv-input" type="number" step={0.1} value={params.parapet} onChange={(e) => setParams((p) => ({ ...p, parapet: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="opv-field">
                        <label>Pitch (%)</label>
                        <input className="opv-input" type="number" step={0.1} value={params.pitch} onChange={(e) => setParams((p) => ({ ...p, pitch: parseFloat(e.target.value) || 0 }))} />
                    </div>
                </div>
            </div>

            <hr className="opv-divider" />

            <div className="opv-section">
                <div className="opv-section-title">Roof Type</div>
                <div className="roof-grid">
                    {(["flat", "gabled", "monopitch", "sawtooth", "hipped", "barrel"] as RoofType[]).map((t) => (
                        <div key={t} className={`rcard ${roofType === t ? "active" : ""}`} onClick={() => setRoofType(t)}>
                            {t.toUpperCase()}
                        </div>
                    ))}
                </div>
                {roofType === "sawtooth" && (
                    <div className="opv-field" style={{ marginTop: 8 }}>
                        <label>Spans: {params.spans}</label>
                        <input type="range" min={2} max={20} value={params.spans} onChange={(e) => setParams((p) => ({ ...p, spans: parseInt(e.target.value) }))} />
                    </div>
                )}
            </div>
        </div>
    );
};
