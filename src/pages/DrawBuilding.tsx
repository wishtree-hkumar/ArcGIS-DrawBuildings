import { BuildingProvider } from "../context/BuildingContext";
import { MapViewer } from "../components/Map/MapViewer";
import { LeftPanel } from "../components/Panels/LeftPanel";
import { RightPanel } from "../components/Panels/RightPanel";
import "@arcgis/core/assets/esri/themes/light/main.css";
import "./DrawBuilding.css";

export default function DrawBuilding() {
    return (
        <BuildingProvider>
            <MapViewer />
            <LeftPanel />
            <RightPanel />
        </BuildingProvider>
    );
}
