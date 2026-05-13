import React, { useRef, useEffect } from "react";
import { useBuildingStore } from "../../context/BuildingContext";
import { OBSTACLE_PRESETS } from "../../types/building.types";

export const ObstacleEditor2D: React.FC = () => {
    const { params, obstacles, setObstacles, roofType, selectedObsIdx, obsSize } = useBuildingStore();
    const obsCanvasRef = useRef<HTMLCanvasElement>(null);
    const obsHoverRef = useRef<number | null>(null);
    const obsDragRef = useRef<{ idx: number; offRx: number; offRy: number } | null>(null);

    const drawEditor = () => {
        const canvas = obsCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const cw = canvas.width;
        const ch = canvas.height;
        ctx.clearRect(0, 0, cw, ch);

        const aspect = params.len / params.wid;
        const maxW = cw - 20;
        const maxH = ch - 20;
        let dw: number, dh: number;
        if (aspect > maxW / maxH) {
            dw = maxW;
            dh = maxW / aspect;
        } else {
            dh = maxH;
            dw = dh * aspect;
        }
        const ox = (cw - dw) / 2;
        const oy = (ch - dh) / 2;
        const scale = dw / params.len;

        ctx.fillStyle = "rgba(30,37,53,0.85)";
        ctx.fillRect(ox, oy, dw, dh);
        
        if (roofType === "gabled") {
            ctx.strokeStyle = "rgba(0,255,157,0.6)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(ox, oy + dh / 2);
            ctx.lineTo(ox + dw, oy + dh / 2);
            ctx.stroke();
        } else if (roofType === "sawtooth") {
            ctx.strokeStyle = "rgba(0,212,255,0.25)";
            const sh = dh / params.spans;
            for (let i = 0; i < params.spans; i++) {
                ctx.beginPath();
                ctx.moveTo(ox, (oy + i * sh) | 0);
                ctx.lineTo(ox + dw, (oy + i * sh) | 0);
                ctx.stroke();
            }
        }

        ctx.strokeStyle = "rgba(0,212,255,0.5)";
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(ox + 0.5, oy + 0.5, dw - 1, dh - 1);
        ctx.setLineDash([]);

        obstacles.forEach((o, idx) => {
            const cx = ox + dw / 2 + o.rx * scale;
            const cy = oy + dh / 2 + o.ry * scale;
            const ow = o.w * scale;
            const od = o.d * scale;
            const hov = obsHoverRef.current === idx;
            ctx.fillStyle = o.color + "bb";
            ctx.fillRect((cx - ow / 2) | 0, (cy - od / 2) | 0, ow | 0, od | 0);
            ctx.strokeStyle = o.color;
            ctx.lineWidth = hov ? 2.5 : 1.5;
            ctx.strokeRect((cx - ow / 2) | 0, (cy - od / 2) | 0, ow | 0, od | 0);
        });

        ctx.fillStyle = "rgba(0,212,255,0.6)";
        ctx.font = "500 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${params.len.toFixed(1)}m`, ox + dw / 2, oy + dh + 12);
    };

    const editorHitTest = (cx: number, cy: number): number | null => {
        const canvas = obsCanvasRef.current;
        if (!canvas) return null;
        const cw = canvas.width;
        const ch = canvas.height;
        const aspect = params.len / params.wid;
        const maxW = cw - 20;
        const maxH = ch - 20;
        let dw: number, dh: number;
        if (aspect > maxW / maxH) { dw = maxW; dh = maxW / aspect; }
        else { dh = maxH; dw = dh * aspect; }
        const ox = (cw - dw) / 2;
        const oy = (ch - dh) / 2;
        const scale = dw / params.len;
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const o = obstacles[i];
            const ocx = ox + dw / 2 + o.rx * scale;
            const ocy = oy + dh / 2 + o.ry * scale;
            const hw = (o.w * scale) / 2;
            const hd = (o.d * scale) / 2;
            if (cx >= ocx - hw && cx <= ocx + hw && cy >= ocy - hd && cy <= ocy + hd) return i;
        }
        return null;
    };

    const editorToMeters = (cx: number, cy: number) => {
        const canvas = obsCanvasRef.current!;
        const cw = canvas.width;
        const ch = canvas.height;
        const aspect = params.len / params.wid;
        const maxW = cw - 20;
        const maxH = ch - 20;
        let dw: number, dh: number;
        if (aspect > maxW / maxH) { dw = maxW; dh = maxW / aspect; }
        else { dh = maxH; dw = dh * aspect; }
        const ox = (cw - dw) / 2;
        const oy = (ch - dh) / 2;
        const scale = dw / params.len;
        return { rx: (cx - ox - dw / 2) / scale, ry: (cy - oy - dh / 2) / scale };
    };

    useEffect(() => {
        drawEditor();
    }, [obstacles, params, roofType]);

    const onEditorMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = obsCanvasRef.current!.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        if (e.button === 2) {
            const i = editorHitTest(cx, cy);
            if (i !== null) setObstacles((o) => o.filter((_, idx) => idx !== i));
            return;
        }
        const idx = editorHitTest(cx, cy);
        if (idx !== null) {
            const { rx, ry } = editorToMeters(cx, cy);
            const o = obstacles[idx];
            obsDragRef.current = { idx, offRx: o.rx - rx, offRy: o.ry - ry };
        } else {
            const { rx, ry } = editorToMeters(cx, cy);
            if (Math.abs(rx) > params.len / 2 || Math.abs(ry) > params.wid / 2) return;
            const preset = OBSTACLE_PRESETS[selectedObsIdx];
            setObstacles((arr) => [...arr, { type: preset.type, color: preset.color, rx, ry, ...obsSize }]);
        }
    };

    const onEditorMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = obsCanvasRef.current!.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        if (obsDragRef.current) {
            const { idx, offRx, offRy } = obsDragRef.current;
            const { rx, ry } = editorToMeters(cx, cy);
            setObstacles((arr) =>
                arr.map((o, i) => {
                    if (i !== idx) return o;
                    return {
                        ...o,
                        rx: Math.max(-params.len / 2 + o.w / 2, Math.min(params.len / 2 - o.w / 2, rx + offRx)),
                        ry: Math.max(-params.wid / 2 + o.d / 2, Math.min(params.wid / 2 - o.d / 2, ry + offRy)),
                    };
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
                style={{ width: "100%", marginTop: 8, borderRadius: 4, cursor: "crosshair", display: "block" }}
                onMouseDown={onEditorMouseDown}
                onMouseMove={onEditorMouseMove}
                onMouseUp={onEditorMouseUp}
                onMouseLeave={onEditorMouseUp}
                onContextMenu={(e) => e.preventDefault()}
            />
            <div style={{ fontSize: 10, color: "#64748b", textAlign: "center", marginTop: 4, fontFamily: "monospace" }}>
                Click to place · Drag to move · Right-click delete
            </div>
        </>
    );
};
