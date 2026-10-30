import { createRoot } from "react-dom/client";
import CMS from "../app/cms";
import "../app/globals.css";
createRoot(document.getElementById("root")!).render(<CMS displayName="Lokaler Admin" mode="standalone" />);
