import React from "react";
import { useBuildingStore } from "../../context/BuildingContext";
import { useMapActions } from "../../hooks/useMapActions";
import { TEMPLATE_LIST, TemplateId } from "../../utils/footprintTemplates";

export const RightPanel: React.FC = () => {
    const { selectedBuildingId, buildingsRef, customRev, editMode } = useBuildingStore();

    const {
        exportAll,
        editSelected,
        deleteSelected,
        duplicateSelected,
        startPlacement,
        startCustomDraw,
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
    } = useMapActions();

    const [paintColor, setPaintColor] = React.useState("#e07a30");
    const [paintHeight, setPaintHeight] = React.useState(0.1);

    void customRev;

    const [tplLen, setTplLen] = React.useState(40);
    const [tplWid, setTplWid] = React.useState(25);
    const [tplArm, setTplArm] = React.useState(10);
    const [tplInset, setTplInset] = React.useState(6);
    const handleTemplate = (id: TemplateId) =>
        placeTemplate(id, { len: tplLen, wid: tplWid, arm: tplArm, courtyardInset: tplInset });

    const selectedBuilding = selectedBuildingId
        ? buildingsRef.current[selectedBuildingId]
        : null;

    const area = selectedBuilding
        ? selectedBuilding.params.len * selectedBuilding.params.wid
        : 0;
    const obstacles = selectedBuilding?.obstacles ?? [];
    const blocked = obstacles.reduce((s, o) => s + o.w * o.d, 0);

    return (
        <div className="opv-panel">
            {editMode && (
                <div
                    style={{
                        background: "rgba(0, 200, 255, 0.15)",
                        border: "1px solid rgba(0, 200, 255, 0.6)",
                        color: "#cdf0ff",
                        padding: "8px 10px",
                        borderRadius: 6,
                        marginBottom: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: 12,
                    }}
                >
                    <span>✎ Editing vertices — drag corners on the map</span>
                    <button
                        className="opv-btn opv-btn-accent"
                        onClick={finishVertexEdit}
                        style={{ padding: "4px 10px", fontSize: 11 }}
                    >
                        Done
                    </button>
                </div>
            )}
            <div className="opv-section">
                <div className="opv-section-title">
                    Stats{" "}
                    {selectedBuilding
                        ? `— ${selectedBuilding.params.name}`
                        : "(no selection)"}
                </div>
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
                        <div className="sbox-v warn">
                            {Math.round(blocked)} m²
                        </div>
                    </div>
                    <div className="sbox">
                        <div className="sbox-l">Usable</div>
                        <div className="sbox-v green">
                            {Math.round(Math.max(0, area - blocked))} m²
                        </div>
                    </div>
                </div>
            </div>

            <hr className="opv-divider" />

            <div className="opv-section">
                <div className="opv-section-title">Map Actions</div>
                <button
                    className="opv-btn-action opv-btn-place"
                    onClick={startPlacement}
                >
                    <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span>{" "}
                    Place Building on Map
                </button>
                <button
                    className="opv-btn-action opv-btn-draw"
                    onClick={startCustomDraw}
                >
                    <span style={{ fontSize: 14, lineHeight: 1 }}>✏</span> Draw
                    Custom Footprint
                </button>
                <div className="opv-btn-row">
                    <button
                        className="opv-btn"
                        onClick={editSelected}
                        disabled={!selectedBuilding}
                    >
                        Move
                    </button>
                    <button
                        className="opv-btn"
                        onClick={duplicateSelected}
                        disabled={!selectedBuilding}
                    >
                        Duplicate
                    </button>
                    <button
                        className="opv-btn"
                        onClick={() => startVertexEdit({ kind: "building" })}
                        disabled={!selectedBuilding}
                        title="Drag corners on the map"
                    >
                        Edit Vertices
                    </button>
                    <button
                        className="opv-btn opv-btn-danger"
                        onClick={deleteSelected}
                        disabled={!selectedBuilding}
                    >
                        Delete
                    </button>
                    <button
                        className="opv-btn opv-btn-accent"
                        onClick={exportAll}
                        title="Export all buildings as GeoJSON (.geojson)"
                    >
                        Export Buildings (GeoJSON)
                    </button>
                </div>
            </div>

            <hr className="opv-divider" />

            <div className="opv-section">
                <div className="opv-section-title">Footprint Templates</div>
                <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 8 }}>
                    Drops a pre-shaped building at the map center. Use Move / vertex-edit to refine.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                    <label style={{ fontSize: 11 }}>
                        Length: {tplLen} m
                        <input type="range" min={10} max={120} value={tplLen}
                            onChange={(e) => setTplLen(+e.target.value)} style={{ width: "100%" }} />
                    </label>
                    <label style={{ fontSize: 11 }}>
                        Width: {tplWid} m
                        <input type="range" min={10} max={80} value={tplWid}
                            onChange={(e) => setTplWid(+e.target.value)} style={{ width: "100%" }} />
                    </label>
                    <label style={{ fontSize: 11 }}>
                        Arm thickness: {tplArm} m
                        <input type="range" min={2} max={Math.max(4, Math.min(tplLen, tplWid) / 2)}
                            value={Math.min(tplArm, Math.min(tplLen, tplWid) / 2)}
                            onChange={(e) => setTplArm(+e.target.value)} style={{ width: "100%" }} />
                    </label>
                    <label style={{ fontSize: 11 }}>
                        Courtyard inset: {tplInset} m
                        <input type="range" min={1} max={Math.max(2, Math.min(tplLen, tplWid) / 2 - 1)}
                            value={Math.min(tplInset, Math.min(tplLen, tplWid) / 2 - 1)}
                            onChange={(e) => setTplInset(+e.target.value)} style={{ width: "100%" }} />
                    </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {TEMPLATE_LIST.map((t) => (
                        <button
                            key={t.id}
                            className="opv-btn"
                            onClick={() => handleTemplate(t.id)}
                            title={`Place ${t.label}`}
                            style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 4px" }}
                        >
                            <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 700 }}>{t.icon}</span>
                            <span style={{ fontSize: 10, marginTop: 2 }}>{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <hr className="opv-divider" />

            <div className="opv-section">
                <div className="opv-section-title">
                    Floors / Volumes {selectedBuilding ? `(${selectedBuilding.volumes?.length ?? 0})` : "(no selection)"}
                </div>
                <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 8 }}>
                    Stack raised volumes on the selected building's roof — like a tower core on a podium, or a mechanical penthouse.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <button
                        className="opv-btn-action opv-btn-place"
                        onClick={addVolumeToSelected}
                        disabled={!selectedBuilding}
                        style={{ margin: 0 }}
                    >
                        <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span> Add Floor
                    </button>
                    <button
                        className="opv-btn-action opv-btn-draw"
                        onClick={startVolumeSketch}
                        disabled={!selectedBuilding}
                        style={{ margin: 0 }}
                        title="Click corners on the map to draw a custom floor footprint"
                    >
                        <span style={{ fontSize: 14, lineHeight: 1 }}>✏</span> Draw Floor Shape
                    </button>
                </div>

                <div
                    style={{
                        marginTop: 10,
                        padding: 8,
                        border: "1px dashed rgba(255,255,255,0.18)",
                        borderRadius: 6,
                    }}
                >
                    <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 6 }}>
                        🎨 <strong>Paint Roof Region</strong> — sketch a colored zone on the roof (e.g. orange center on a yellow podium).
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6, alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11 }}>Color</span>
                        <input
                            type="color"
                            value={paintColor}
                            onChange={(e) => setPaintColor(e.target.value)}
                            style={{ width: "100%", height: 24, padding: 0, border: "none", background: "none" }}
                        />
                        <span style={{ fontSize: 11 }}>Lift: {paintHeight.toFixed(2)} m</span>
                        <input
                            type="range"
                            min={0.05}
                            max={1}
                            step={0.05}
                            value={paintHeight}
                            onChange={(e) => setPaintHeight(+e.target.value)}
                            style={{ width: "100%" }}
                        />
                    </div>
                    <button
                        className="opv-btn-action opv-btn-draw"
                        onClick={() => startRoofPaint(paintColor, paintHeight)}
                        disabled={!selectedBuilding}
                        style={{ margin: 0, width: "100%" }}
                        title="Click corners on the map to paint a colored region on the roof"
                    >
                        <span style={{ fontSize: 14, lineHeight: 1 }}>🖌</span> Paint Roof Region
                    </button>
                </div>

                {selectedBuilding?.volumes?.map((v, i) => (
                    <div
                        key={v.id}
                        style={{
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 6,
                            padding: 8,
                            marginTop: 8,
                            background: "rgba(255,255,255,0.03)",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <strong style={{ fontSize: 12 }}>Floor {i + 1}</strong>
                            <div style={{ display: "flex", gap: 4 }}>
                                <button
                                    className="opv-btn"
                                    onClick={() => startVertexEdit({ kind: "volume", volumeId: v.id })}
                                    style={{ padding: "2px 8px", fontSize: 11 }}
                                    title="Drag this floor's corners on the map"
                                >
                                    Edit
                                </button>
                                <button
                                    className="opv-btn"
                                    onClick={() => duplicateVolume(v.id)}
                                    style={{ padding: "2px 8px", fontSize: 11 }}
                                    title="Duplicate this floor (offset 3 m)"
                                >
                                    Duplicate
                                </button>
                                <button
                                    className="opv-btn opv-btn-danger"
                                    onClick={() => removeVolume(v.id)}
                                    style={{ padding: "2px 8px", fontSize: 11 }}
                                >
                                    Remove
                                </button>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            <label style={{ fontSize: 11 }}>
                                Height: {v.wh.toFixed(1)} m
                                <input type="range" min={1} max={20} step={0.5} value={v.wh}
                                    onChange={(e) => updateVolume(v.id, { wh: +e.target.value })}
                                    style={{ width: "100%" }} />
                            </label>
                            <label style={{ fontSize: 11 }}>
                                Lift: {v.baseOffset.toFixed(1)} m
                                <input type="range" min={0} max={20} step={0.5} value={v.baseOffset}
                                    onChange={(e) => updateVolume(v.id, { baseOffset: +e.target.value })}
                                    style={{ width: "100%" }} />
                            </label>
                            <label style={{ fontSize: 11 }}>
                                Roof:&nbsp;
                                <select value={v.roofType}
                                    onChange={(e) => updateVolume(v.id, { roofType: e.target.value as any })}>
                                    <option value="flat">flat</option>
                                    <option value="monopitch">monopitch</option>
                                </select>
                            </label>
                            <label style={{ fontSize: 11 }}>
                                Parapet: {v.parapet.toFixed(1)} m
                                <input type="range" min={0} max={2} step={0.1} value={v.parapet}
                                    onChange={(e) => updateVolume(v.id, { parapet: +e.target.value })}
                                    style={{ width: "100%" }} />
                            </label>
                            <label style={{ fontSize: 11, gridColumn: "span 2" }}>
                                Rotation: {Math.round(v.rotDeg ?? 0)}°
                                <input type="range" min={0} max={359} value={v.rotDeg ?? 0}
                                    onChange={(e) => rotateVolume(v.id, +e.target.value)}
                                    style={{ width: "100%" }} />
                            </label>
                            <label style={{ fontSize: 11, gridColumn: "span 2" }}>
                                Resize footprint
                                <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                                    <button className="opv-btn" style={{ flex: 1, padding: "2px 6px", fontSize: 11 }}
                                        onClick={() => scaleVolume(v.id, 0.9)}>− 10%</button>
                                    <button className="opv-btn" style={{ flex: 1, padding: "2px 6px", fontSize: 11 }}
                                        onClick={() => scaleVolume(v.id, 1.1)}>+ 10%</button>
                                </div>
                            </label>
                            <label style={{ fontSize: 11 }}>
                                Wall color
                                <input type="color" value={v.wallColorHex ?? "#c8c8c8"}
                                    onChange={(e) => updateVolume(v.id, { wallColorHex: e.target.value })}
                                    style={{ width: "100%", height: 22, padding: 0, border: "none", background: "none" }} />
                            </label>
                            <label style={{ fontSize: 11 }}>
                                Roof color
                                <input type="color" value={v.roofColorHex ?? "#a08c64"}
                                    onChange={(e) => updateVolume(v.id, { roofColorHex: e.target.value })}
                                    style={{ width: "100%", height: 22, padding: 0, border: "none", background: "none" }} />
                            </label>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
