import React, { createContext, useContext, useState, useRef, MutableRefObject, Dispatch, SetStateAction } from "react";
import type SceneView from "@arcgis/core/views/SceneView";
import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import type SketchViewModel from "@arcgis/core/widgets/Sketch/SketchViewModel";
import { BuildingParams, RoofType, Obstacle, SavedBuilding } from "../types/building.types";

interface BuildingContextType {
    buildingsRef: MutableRefObject<Record<string, SavedBuilding>>;
    buildingsCount: number;
    setBuildingsCount: Dispatch<SetStateAction<number>>;

    selectedBuildingIdRef: MutableRefObject<string | null>;
    selectedBuildingId: string | null;
    setSelectedBuildingId: Dispatch<SetStateAction<string | null>>;

    customRev: number;
    setCustomRev: Dispatch<SetStateAction<number>>;

    placementModeRef: MutableRefObject<boolean>;
    placementMode: boolean;
    setPlacementMode: Dispatch<SetStateAction<boolean>>;

    pendingCustomRef: MutableRefObject<{ wh: number; parapet: number; name: string } | null>;
    customDrawMode: boolean;
    setCustomDrawMode: Dispatch<SetStateAction<boolean>>;

    roofTypeRef: MutableRefObject<RoofType>;
    roofType: RoofType;
    setRoofType: Dispatch<SetStateAction<RoofType>>;

    paramsRef: MutableRefObject<BuildingParams>;
    params: BuildingParams;
    setParams: Dispatch<SetStateAction<BuildingParams>>;

    obstaclesRef: MutableRefObject<Obstacle[]>;
    obstacles: Obstacle[];
    setObstacles: Dispatch<SetStateAction<Obstacle[]>>;

    selectedObsIdx: number;
    setSelectedObsIdx: Dispatch<SetStateAction<number>>;

    obsSize: { w: number; d: number; h: number };
    setObsSize: Dispatch<SetStateAction<{ w: number; d: number; h: number }>>;

    drawLayerRef: MutableRefObject<GraphicsLayer | null>;
    sketchRef: MutableRefObject<SketchViewModel | null>;
    viewRef: MutableRefObject<SceneView | null>;
}

const BuildingContext = createContext<BuildingContextType | undefined>(undefined);

export const BuildingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const buildingsRef = useRef<Record<string, SavedBuilding>>({});
    const selectedBuildingIdRef = useRef<string | null>(null);
    const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
    const [customRev, setCustomRev] = useState(0);

    const placementModeRef = useRef(false);
    const [placementMode, setPlacementMode] = useState(false);

    const pendingCustomRef = useRef<{ wh: number; parapet: number; name: string } | null>(null);
    const [customDrawMode, setCustomDrawMode] = useState(false);

    const [roofType, setRoofType] = useState<RoofType>("gabled");
    const roofTypeRef = useRef(roofType);
    React.useEffect(() => { roofTypeRef.current = roofType; }, [roofType]);

    const [params, setParams] = useState<BuildingParams>({
        name: "Building_1",
        lat: 24.711394,
        lng: 46.674347,
        elev: 600,
        len: 20,
        wid: 10,
        wh: 6,
        rot: 0,
        parapet: 0.5,
        pitch: 15,
        spans: 2,
    });
    const paramsRef = useRef(params);
    React.useEffect(() => { paramsRef.current = params; }, [params]);

    const [obstacles, setObstacles] = useState<Obstacle[]>([]);
    const obstaclesRef = useRef(obstacles);
    React.useEffect(() => { obstaclesRef.current = obstacles; }, [obstacles]);

    const [selectedObsIdx, setSelectedObsIdx] = useState(0);
    const [obsSize, setObsSize] = useState({ w: 2, d: 2, h: 1.2 });
    const [buildingsCount, setBuildingsCount] = useState(0);

    const drawLayerRef = useRef<GraphicsLayer | null>(null);
    const sketchRef = useRef<SketchViewModel | null>(null);
    const viewRef = useRef<SceneView | null>(null);

    return (
        <BuildingContext.Provider
            value={{
                buildingsRef,
                buildingsCount, setBuildingsCount,
                selectedBuildingIdRef, selectedBuildingId, setSelectedBuildingId,
                customRev, setCustomRev,
                placementModeRef, placementMode, setPlacementMode,
                pendingCustomRef, customDrawMode, setCustomDrawMode,
                roofTypeRef, roofType, setRoofType,
                paramsRef, params, setParams,
                obstaclesRef, obstacles, setObstacles,
                selectedObsIdx, setSelectedObsIdx,
                obsSize, setObsSize,
                drawLayerRef, sketchRef, viewRef
            }}
        >
            {children}
        </BuildingContext.Provider>
    );
};

export const useBuildingStore = () => {
    const context = useContext(BuildingContext);
    if (!context) {
        throw new Error("useBuildingStore must be used within a BuildingProvider");
    }
    return context;
};
