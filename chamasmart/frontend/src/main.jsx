import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import ErrorBoundary from "./components/ErrorBoundary";

// Register PWA service worker
// Register PWA service worker with simple configuration
// Disable immediate update to prevents potential reload loops in dev
registerSW({
  immediate: false,
  onNeedRefresh() {
    console.log("PWA: New content available, reload to update.");
  },
  onOfflineReady() {
    console.log("PWA: App ready to work offline");
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
