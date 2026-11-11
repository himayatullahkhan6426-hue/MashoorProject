import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { useEffect } from "react";

import "./index.css";
import App from "./App.jsx";
import { startSyncListener } from "./services/syncListener";

function Root() {
  useEffect(() => {
    const stopSyncListener = startSyncListener();

    return () => {
      stopSyncListener();
    };
  }, []);

  return <App />;
}

registerSW({
  immediate: true,
  onRegistered(registration) {
    console.log("PWA Service Worker registered:", registration);
  },
  onRegisterError(error) {
    console.error("PWA registration failed:", error);
  },
});

createRoot(document.getElementById("root")).render(<Root />);