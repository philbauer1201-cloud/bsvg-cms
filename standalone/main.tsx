import { createRoot } from "react-dom/client";
import StandaloneApp from "./portal";
import "../app/globals.css";
createRoot(document.getElementById("root")!).render(<StandaloneApp />);
