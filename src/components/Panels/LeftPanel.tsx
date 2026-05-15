import React from "react";
import { useBuildingStore } from "../../context/BuildingContext";
import { useMapActions } from "../../hooks/useMapActions";
import { OBSTACLE_PRESETS, RoofType, BuildingParams } from "../../types/building.types";
import { ObstacleEditor2D } from "../Editors/ObstacleEditor2D";
import { edgeMeters, rotateLngLatAround } from "../../utils/geoUtils";

export const LeftPanel: React.FC = () => {
    const {
        viewRef,
        selectedBuildingId, buildingsRef, customRev,
        selectedObsIdx, setSelectedObsIdx,
        obsSize, setObsSize,
        drawLayerRef,
    } = useBuildingStore();

    const [highlightEdge, setHighlightEdge] = React.useState<number | null>(null);

    React.useEffect(() => {
        const layer = drawLayerRef.current;
        if (!layer) return;
        const prev = layer.graphics.toArray().filter((g) => (g.attributes as any)?.edgeHighlight);
        layer.removeMany(prev);
        if (highlightEdge == null) return;
        const b = selectedBuildingId ? buildingsRef.current[selectedBuildingId] : null;
        if (!b?.custom) return;

        const c = b.custom;
        const rot = b.params.rot || 0;
        const scale = c.scale ?? 1;
        const transform = (lng: number, lat: number): [number, number] => {
            const sx = c.centerLng + (lng - c.centerLng) * scale;
            const sy = c.centerLat + (lat - c.centerLat) * scale;
            return rot ? rotateLngLatAround(sx, sy, c.centerLat, c.centerLng, rot) : [sx, sy];
        };

        const ring = c.ringLngLat;
        const a = ring[highlightEdge];
        const next = ring[(highlightEdge + 1) % ring.length];
        if (!a || !next) return;
        const [ax, ay] = transform(a[0], a[1]);
        const [bx, by] = transform(next[0], next[1]);
        const z = c.baseZ + b.params.wh + (b.params.parapet || 0) + 0.1;

        let cancelled = false;
        (async () => {
            const [{ default: Polyline }, { default: Graphic }] = await Promise.all([
                import("@arcgis/core/geometry/Polyline"),
                import("@arcgis/core/Graphic"),
            ]);
            if (cancelled) return;
            const line = new Polyline({
                paths: [[[ax, ay, z], [bx, by, z]]],
                spatialReference: { wkid: 4326 } as any,
                hasZ: true,
            } as any);
            const g = new Graphic({
                geometry: line,
                symbol: {
                    type: "line-3d",
                    symbolLayers: [
                        { type: "line", size: 6, material: { color: [0, 212, 255, 1] } },
                    ],
                } as any,
                attributes: { edgeHighlight: true, buildingId: b.id },
            });
            layer.add(g);
        })();
        return () => {
            cancelled = true;
            const stale = layer.graphics.toArray().filter((g) => (g.attributes as any)?.edgeHighlight);
            layer.removeMany(stale);
        };
    }, [highlightEdge, selectedBuildingId, customRev, drawLayerRef, buildingsRef]);

    const { setParam, setRoofTypeOf, setObstaclesOf, mutateBuilding, setCustomEdgeLength } = useMapActions();

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

    const updateObstacleDim = (i: number, key: "w" | "d" | "h", value: number) => {
        setObstaclesOf((arr) => arr.map((o, idx) => (idx === i ? { ...o, [key]: value } : o)));
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
                            title="Sync Elevation"
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
                                    if (typeof z !== "number" || Number.isNaN(z)) return;
                                    mutateBuilding((b) => {
                                        b.params.elev = z;
                                        if (b.custom) b.custom.baseZ = z;
                                    });
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
                        <label>Pitch (%)</label>
                        <input className="opv-input" type="number" step={0.1} disabled={disabled} value={p?.pitch ?? ""} onChange={(e) => setParam("pitch", parseFloat(e.target.value) || 0)} />
                    </div>
                </div>
                {(isCustom || roofType === "flat") && (
                    <div className="opv-field">
                        <label>Parapet</label>
                        <div style={{ display: "flex", gap: 6 }}>
                            <div className="opv-field" style={{ flex: 1, marginBottom: 0 }}>
                                <label style={{ fontSize: 10, color: "#9ca3af" }}>Height (m)</label>
                                <input className="opv-input" type="number" step={0.1} disabled={disabled} value={p?.parapet ?? ""} onChange={(e) => setParam("parapet", parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="opv-field" style={{ flex: 1, marginBottom: 0 }}>
                                <label style={{ fontSize: 10, color: "#9ca3af" }}>Width (m)</label>
                                <input className="opv-input" type="number" step={0.05} min={0} disabled={disabled || !isCustom} value={p?.parapetWidth ?? 0} onChange={(e) => setParam("parapetWidth", Math.max(0, parseFloat(e.target.value) || 0))} />
                            </div>
                        </div>
                    </div>
                )}
                <div className="opv-field">
                    <label>Rotation (°) <span className="opv-rot-value">{Math.round(Math.min(360, Math.max(0, p?.rot ?? 0)))}°</span></label>
                    <input
                        className="opv-range"
                        type="range"
                        min={0}
                        max={360}
                        step={1}
                        disabled={disabled}
                        value={Math.min(360, Math.max(0, p?.rot ?? 0))}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            const clamped = Math.min(360, Math.max(0, isNaN(v) ? 0 : v));
                            setParam("rot", clamped);
                        }}
                    />
                </div>
                {isCustom && (
                    <div className="opv-field">
                        <label>Scale (×) <span className="opv-rot-value">{(selectedBuilding?.custom?.scale ?? 1).toFixed(2)}×</span></label>
                        <input
                            className="opv-range"
                            type="range"
                            min={0.1}
                            max={5}
                            step={0.01}
                            disabled={disabled}
                            value={selectedBuilding?.custom?.scale ?? 1}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                const clamped = Math.min(5, Math.max(0.1, isNaN(v) ? 1 : v));
                                mutateBuilding((b) => {
                                    if (b.custom) b.custom.scale = clamped;
                                });
                            }}
                        />
                    </div>
                )}
                {isCustom && selectedBuilding?.custom && (() => {
                    const ring = selectedBuilding.custom.ringLngLat;
                    const scale = selectedBuilding.custom.scale ?? 1;
                    return (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
                                Side Lengths (m)
                            </div>
                            <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                                {ring.map((a, i) => {
                                    const b = ring[(i + 1) % ring.length];
                                    const len = edgeMeters(a, b) * scale;
                                    const active = highlightEdge === i;
                                    return (
                                        <div
                                            key={i}
                                            className="opv-field"
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 6,
                                                padding: 2,
                                                borderRadius: 3,
                                                background: active ? "rgba(0,212,255,0.12)" : undefined,
                                            }}
                                            onMouseEnter={() => setHighlightEdge(i)}
                                            onMouseLeave={() => setHighlightEdge((cur) => (cur === i ? null : cur))}
                                        >
                                            <label style={{ minWidth: 44, fontSize: 10 }}>Side {i + 1}</label>
                                            <input
                                                className="opv-input"
                                                type="number"
                                                step={0.1}
                                                min={0.5}
                                                disabled={disabled}
                                                value={Math.round(len * 100) / 100}
                                                onFocus={() => setHighlightEdge(i)}
                                                onBlur={() => setHighlightEdge((cur) => (cur === i ? null : cur))}
                                                onChange={(e) => {
                                                    const v = parseFloat(e.target.value);
                                                    if (isNaN(v) || v <= 0) return;
                                                    setCustomEdgeLength(i, v / (scale || 1));
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
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
                            <div key={i} style={{ marginBottom: 6, padding: 6, border: "1px solid rgba(100,116,139,0.2)", borderRadius: 4 }}>
                                <div className="obs-list-item" style={{ marginBottom: 4 }}>
                                    <div className="obs-dot" style={{ background: o.color }} />
                                    <span style={{ flex: 1 }}>{o.type}</span>
                                    <button onClick={() => removeObstacle(i)}>×</button>
                                </div>
                                <div className="opv-row3">
                                    <div className="opv-field">
                                        <label>W (m)</label>
                                        <input
                                            className="opv-input"
                                            type="number"
                                            step={0.1}
                                            value={o.w}
                                            onChange={(e) => updateObstacleDim(i, "w", parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="opv-field">
                                        <label>D (m)</label>
                                        <input
                                            className="opv-input"
                                            type="number"
                                            step={0.1}
                                            value={o.d}
                                            onChange={(e) => updateObstacleDim(i, "d", parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="opv-field">
                                        <label>H (m)</label>
                                        <input
                                            className="opv-input"
                                            type="number"
                                            step={0.1}
                                            value={o.h}
                                            onChange={(e) => updateObstacleDim(i, "h", parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
