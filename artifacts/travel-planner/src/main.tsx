import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import { apiBaseUrl } from "./lib/api-url";
import App from "./App";
import "./index.css";

setBaseUrl(apiBaseUrl || null);

createRoot(document.getElementById("root")!).render(<App />);
