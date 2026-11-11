import db from "../database/localDb";
import { apiRequest } from "./api";

export async function syncPendingAdjustments() {
  if (!navigator.onLine) return;

  const pendingItems = await db.syncQueue
    .where("status")
    .equals("pending")
    .sortBy("queueId");

  for (const item of pendingItems) {
    if (
      item.entity !== "adjustment" ||
      item.action !== "create"
    ) {
      continue;
    }

    try {
      const adjustment = item.payload;

      const response = await apiRequest(
        `/shops/${adjustment.shop_id}/adjustments`,
        {
          method: "POST",
          body: JSON.stringify(adjustment),
        }
      );

      const serverAdjustment = response.adjustment;

      if (!serverAdjustment) {
        throw new Error("Server did not return the saved adjustment.");
      }

      await db.transaction(
        "rw",
        db.syncQueue,
        db.adjustments,
        async () => {
          await db.adjustments.put({
            ...serverAdjustment,
            id: item.operation_id,
            operation_id: item.operation_id,
            synced: true,
          });

          await db.syncQueue.update(item.queueId, {
            status: "synced",
            synced_at: new Date().toISOString(),
          });
        }
      );
    } catch (error) {
      console.error(
        "Adjustment sync failed:",
        error.message
      );

      break;
    }
  }
}