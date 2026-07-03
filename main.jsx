import React from "react";
import ReactDOM from "react-dom/client";
import JOINTRUNApp from "./JOINTRUN_UNIFIED.jsx";
import { registerServiceWorker } from "./registerServiceWorker.js";
import { initAnalytics } from "./lib/analytics.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <JOINTRUNApp />
  </React.StrictMode>
);

registerServiceWorker();
initAnalytics();
