
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "./index.css";
import App from "./App.jsx";

// ==========================================
// PWA SERVICE WORKER
// ==========================================

registerSW({
  immediate: true,

  onRegistered(registration) {
    console.log("PWA Service Worker registered:", registration);
  },

  onRegisterError(error) {
    console.error("PWA registration failed:", error);
  },
});

// ==========================================
// APPLICATION
// ==========================================

createRoot(document.getElementById("root")).render(
  <App />
);
