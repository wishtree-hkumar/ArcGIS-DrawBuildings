import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DrawBuilding from "./pages/DrawBuilding";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DrawBuilding />
  </StrictMode>
);
