import React, { useRef, useEffect } from "react";
import { useBuildingStore } from "../../context/BuildingContext";
import { useMapActions } from "../../hooks/useMapActions";
import { OBSTACLE_PRESETS } from "../../types/building.types";
import { lngLatToLocalMeters } from "../../utils/geoUtils";

export const ObstacleEditor2D: React.FC = () => {
    const { selectedBuildingId, buildingsRef, customRev, selectedObsIdx, obsSize } = useBuildingStore();
    const { setObstaclesOf } = useMapActions();

    void customRev;

    const selectedBuilding = selectedBuildingId ? buildingsRef.current[selectedBuildingId] : null;
    const params = selectedBuilding?.params;
    const roofType = selectedBuilding?.roofType ?? "flat";
    const obstacles = selectedBuilding?.obstacles ?? [];

    const obsCanvasRef = useRef<HTMLCanvasElement>(null);
    const obsHoverRef = useRef<number | null>(null);
    const obsDragRef = useRef<{ idx: number; offRx: number; offRy: number } | null>(null);

    const custom = selectedBuilding?.custom;

    // Footprint in local meters (relative to the obstacle/render origin).
    // For rectangle: centered on (0,0). For custom: projected from ringLngLat about centerLat/centerLng.
    const footprintMeters = (): { pts: { x: number; y: number }[]; minX: number; maxX: number; minY: number; maxY: number } | null => {
        if (!params) return null;
        if (custom) {
            const pts = custom.ringLngLat.map(([lng, lat]) =>
                lngLatToLocalMeters(lng, lat, custom.centerLat, custom.centerLng)
            );
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const p of pts) {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }
            return { pts, minX, maxX, minY, maxY };
        }
        const hx = params.len / 2;
        const hy = params.wid / 2;
        return {
            pts: [
                { x: -hx, y: -hy }, { x: hx, y: -hy },
                { x: hx, y: hy }, { x: -hx, y: hy },
            ],
            minX: -hx, maxX: hx, minY: -hy, maxY: hy,
        };
    };

    const computeLayout = () => {
        const canvas = obsCanvasRef.current;
        if (!canvas || !params) return null;
        const fp = footprintMeters();
        if (!fp) return null;
        const cw = canvas.width;
        const ch = canvas.height;
        const padL = 26, padR = 10, padT = 10, padB = 22;
        const maxW = cw - padL - padR;
        const maxH = ch - padT - padB;
        const lenM = Math.max(fp.maxX - fp.minX, 0.01);
        const widM = Math.max(fp.maxY - fp.minY, 0.01);
        const scale = Math.min(maxW / lenM, maxH / widM);
        const dw = lenM * scale;
        const dh = widM * scale;
        const ox = padL + (maxW - dw) / 2;
        const oy = padT + (maxH - dh) / 2;
        // origin (meters 0,0) in canvas pixels:
        const cxOrigin = ox - fp.minX * scale;
        const cyOrigin = oy - fp.minY * scale;
        return { fp, cw, ch, ox, oy, dw, dh, scale, cxOrigin, cyOrigin, lenM, widM };
    };

    const drawEditor = () => {
        const canvas = obsCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const cw = canvas.width;
        const ch = canvas.height;
        ctx.clearRect(0, 0, cw, ch);

        if (!params) {
            ctx.fillStyle = "rgba(30,37,53,0.4)";
            ctx.fillRect(0, 0, cw, ch);
            ctx.fillStyle = "#64748b";
            ctx.font = "500 11px monospace";
            ctx.textAlign = "center";
            ctx.fillText("Select a building to edit obstacles", cw / 2, ch / 2);
            return;
        }

        const L = computeLayout();
        if (!L) return;
        const { fp, ox, oy, dw, dh, scale, cxOrigin, cyOrigin, lenM, widM } = L;

        // Footprint shape
        ctx.beginPath();
        if (custom) {
            fp.pts.forEach((p, i) => {
                const x = cxOrigin + p.x * scale;
                const y = cyOrigin + p.y * scale;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
        } else {
            ctx.rect(ox, oy, dw, dh);
        }
        ctx.fillStyle = "rgba(30,37,53,0.85)";
        ctx.fill();

        if (!custom && roofType === "gabled") {
            ctx.strokeStyle = "rgba(0,255,157,0.6)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(ox, oy + dh / 2);
            ctx.lineTo(ox + dw, oy + dh / 2);
            ctx.stroke();
        } else if (!custom && roofType === "sawtooth") {
            ctx.strokeStyle = "rgba(0,212,255,0.25)";
            const sh = dh / params.spans;
            for (let i = 0; i < params.spans; i++) {
                ctx.beginPath();
                ctx.moveTo(ox, (oy + i * sh) | 0);
                ctx.lineTo(ox + dw, (oy + i * sh) | 0);
                ctx.stroke();
            }
        }

        // Footprint outline
        ctx.strokeStyle = "rgba(0,212,255,0.6)";
        ctx.lineWidth = 1.25;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        if (custom) {
            fp.pts.forEach((p, i) => {
                const x = cxOrigin + p.x * scale;
                const y = cyOrigin + p.y * scale;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
        } else {
            ctx.rect(ox + 0.5, oy + 0.5, dw - 1, dh - 1);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Vertex dots for custom
        if (custom) {
            ctx.fillStyle = "#00d4ff";
            fp.pts.forEach((p) => {
                const x = cxOrigin + p.x * scale;
                const y = cyOrigin + p.y * scale;
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        obstacles.forEach((o, idx) => {
            const cx = cxOrigin + o.rx * scale;
            const cy = cyOrigin + o.ry * scale;
            const ow = o.w * scale;
            const od = o.d * scale;
            const hov = obsHoverRef.current === idx;
            ctx.fillStyle = o.color + "bb";
            ctx.fillRect((cx - ow / 2) | 0, (cy - od / 2) | 0, ow | 0, od | 0);
            ctx.strokeStyle = o.color;
            ctx.lineWidth = hov ? 2.5 : 1.5;
            ctx.strokeRect((cx - ow / 2) | 0, (cy - od / 2) | 0, ow | 0, od | 0);
        });

        ctx.fillStyle = "rgba(0,212,255,0.75)";
        ctx.font = "600 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(`${lenM.toFixed(1)} m`, ox + dw / 2, oy + dh + 6);

        ctx.save();
        ctx.translate(ox - 8, oy + dh / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textBaseline = "bottom";
        ctx.fillText(`${widM.toFixed(1)} m`, 0, 0);
        ctx.restore();
    };

    const editorHitTest = (cx: number, cy: number): number | null => {
        const L = computeLayout();
        if (!L) return null;
        const { scale, cxOrigin, cyOrigin } = L;
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const o = obstacles[i];
            const ocx = cxOrigin + o.rx * scale;
            const ocy = cyOrigin + o.ry * scale;
            const hw = (o.w * scale) / 2;
            const hd = (o.d * scale) / 2;
            if (cx >= ocx - hw && cx <= ocx + hw && cy >= ocy - hd && cy <= ocy + hd) return i;
        }
        return null;
    };

    const pointInPolygon = (x: number, y: number, poly: { x: number; y: number }[]) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    const obstacleFitsInside = (rx: number, ry: number, w: number, d: number, L: NonNullable<ReturnType<typeof computeLayout>>) => {
        const hw = w / 2, hd = d / 2;
        if (rx - hw < L.fp.minX || rx + hw > L.fp.maxX || ry - hd < L.fp.minY || ry + hd > L.fp.maxY) return false;
        if (!custom) return true;
        const corners = [
            { x: rx - hw, y: ry - hd }, { x: rx + hw, y: ry - hd },
            { x: rx + hw, y: ry + hd }, { x: rx - hw, y: ry + hd },
        ];
        return corners.every((c) => pointInPolygon(c.x, c.y, L.fp.pts));
    };

    const editorToMeters = (cx: number, cy: number) => {
        const L = computeLayout();
        if (!L) return { rx: 0, ry: 0 };
        return { rx: (cx - L.cxOrigin) / L.scale, ry: (cy - L.cyOrigin) / L.scale };
    };

    useEffect(() => {
        drawEditor();
    }, [obstacles, params, roofType, selectedBuildingId, customRev]);

    const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = obsCanvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        return { cx: (e.clientX - rect.left) * sx, cy: (e.clientY - rect.top) * sy };
    };

    const onEditorMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!params) return;
        const { cx, cy } = getCanvasCoords(e);
        if (e.button === 2) {
            const i = editorHitTest(cx, cy);
            if (i !== null) setObstaclesOf((o) => o.filter((_, idx) => idx !== i));
            return;
        }
        const idx = editorHitTest(cx, cy);
        if (idx !== null) {
            const { rx, ry } = editorToMeters(cx, cy);
            const o = obstacles[idx];
            obsDragRef.current = { idx, offRx: o.rx - rx, offRy: o.ry - ry };
        } else {
            const { rx, ry } = editorToMeters(cx, cy);
            const L = computeLayout();
            if (!L) return;
            if (!obstacleFitsInside(rx, ry, obsSize.w, obsSize.d, L)) return;
            const preset = OBSTACLE_PRESETS[selectedObsIdx];
            setObstaclesOf((arr) => [...arr, { type: preset.type, color: preset.color, rx, ry, ...obsSize }]);
        }
    };

    const onEditorMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!params) return;
        const { cx, cy } = getCanvasCoords(e);
        if (obsDragRef.current) {
            const { idx, offRx, offRy } = obsDragRef.current;
            const { rx, ry } = editorToMeters(cx, cy);
            const L = computeLayout();
            setObstaclesOf((arr) =>
                arr.map((o, i) => {
                    if (i !== idx) return o;
                    if (!L) return { ...o, rx: rx + offRx, ry: ry + offRy };
                    const clampedRx = Math.max(L.fp.minX + o.w / 2, Math.min(L.fp.maxX - o.w / 2, rx + offRx));
                    const clampedRy = Math.max(L.fp.minY + o.d / 2, Math.min(L.fp.maxY - o.d / 2, ry + offRy));
                    if (custom && !obstacleFitsInside(clampedRx, clampedRy, o.w, o.d, L)) {
                        return o;
                    }
                    return { ...o, rx: clampedRx, ry: clampedRy };
                })
            );
            return;
        }
        const prev = obsHoverRef.current;
        obsHoverRef.current = editorHitTest(cx, cy);
        if (prev !== obsHoverRef.current) drawEditor();
    };

    const onEditorMouseUp = () => { obsDragRef.current = null; };

    return (
        <>
            <canvas
                ref={obsCanvasRef}
                width={290}
                height={180}
                style={{ width: "100%", marginTop: 8, borderRadius: 4, cursor: params ? "crosshair" : "not-allowed", display: "block", opacity: params ? 1 : 0.6 }}
                onMouseDown={onEditorMouseDown}
                onMouseMove={onEditorMouseMove}
                onMouseUp={onEditorMouseUp}
                onMouseLeave={onEditorMouseUp}
                onContextMenu={(e) => e.preventDefault()}
            />
            <div style={{
                marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                color: "#64748b", letterSpacing: ".04em", textAlign: "center",
                opacity: params ? 1 : 0.5,
            }}>
                Click to place · Drag to move · Right-click delete
            </div>
        </>
    );
};
