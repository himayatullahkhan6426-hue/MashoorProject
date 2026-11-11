import { syncPendingAdjustments } from "./offlineSync";

let isSyncing = false;

export function startSyncListener() {
  async function handleSync() {
    if (!navigator.onLine || isSyncing) return;

    isSyncing = true;

    try {
      await syncPendingAdjustments();
    } catch (error) {
      console.error("Automatic sync error:", error);
    } finally {
      isSyncing = false;
    }
  }

  window.addEventListener("online", handleSync);

  // Check pending data when the app opens.
  handleSync();

  return () => {
    window.removeEventListener("online", handleSync);
  };
}