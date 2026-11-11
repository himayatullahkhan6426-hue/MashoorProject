
import db from "../database/localDb";
import { apiRequest } from "./api";

// ==========================================
// HELPERS
// ==========================================

function getServerId(record) {
  if (!record) return null;

  if (record.server_id) {
    return record.server_id;
  }

  if (String(record.id).startsWith("local-")) {
    return null;
  }

  return record.id;
}

async function getServerAreaId(shop) {
  if (shop.area_client_id) {
    const area = await db.areas
      .where("client_id")
      .equals(shop.area_client_id)
      .first();

    const serverId = getServerId(area);

    if (serverId) return serverId;
  }

  if (shop.area_id) {
    const area = await db.areas.get(shop.area_id);

    if (area) {
      const serverId = getServerId(area);

      if (serverId) return serverId;
    }

    if (!String(shop.area_id).startsWith("local-")) {
      return shop.area_id;
    }
  }

  throw new Error("Server area ID is missing for this shop.");
}

async function markQueueSynced(item) {
  await db.syncQueue.update(item.queueId, {
    status: "synced",
    synced_at: new Date().toISOString(),
  });
}

// ==========================================
// AREAS SYNC
// ==========================================

async function syncArea(item) {
  const queuedArea = item.payload;

  const area = queuedArea.client_id
    ? await db.areas
        .where("client_id")
        .equals(queuedArea.client_id)
        .first()
    : null;

  const currentArea = area || queuedArea;

  if (item.action === "create") {
    const response = await apiRequest("/areas", {
      method: "POST",
      body: JSON.stringify({
        name: currentArea.name,
        area_type: currentArea.area_type,
        district: currentArea.district,
        description: currentArea.description,
        client_id: currentArea.client_id,
      }),
    });

    const serverArea = response.area;

    if (!serverArea?.id) {
      throw new Error("Server did not return the saved area.");
    }

    await db.transaction(
      "rw",
      db.areas,
      db.syncQueue,
      async () => {
        await db.areas.put({
          ...currentArea,
          ...serverArea,
          id: currentArea.id,
          server_id: serverArea.id,
          client_id: currentArea.client_id,
          synced: true,
        });

        await markQueueSynced(item);
      }
    );

    return;
  }

  const serverId =
    getServerId(currentArea) ||
    getServerId(queuedArea);

  if (!serverId) {
    throw new Error("Server area ID is missing.");
  }

  let response;

  if (item.action === "update") {
    response = await apiRequest(`/areas/${serverId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: currentArea.name,
        area_type: currentArea.area_type,
        district: currentArea.district,
        description: currentArea.description,
      }),
    });
  } else if (item.action === "deactivate") {
    response = await apiRequest(
      `/areas/${serverId}/deactivate`,
      { method: "PATCH" }
    );
  } else {
    throw new Error(`Unsupported area action: ${item.action}`);
  }

  if (!response?.success) {
    throw new Error("Area synchronization failed.");
  }

  await db.transaction(
    "rw",
    db.areas,
    db.syncQueue,
    async () => {
      const latestArea = await db.areas.get(currentArea.id);

      if (latestArea) {
        await db.areas.put({
          ...latestArea,
          ...(response.area || {}),
          id: currentArea.id,
          server_id: serverId,
          synced: true,
        });
      }

      await markQueueSynced(item);
    }
  );
}

// ==========================================
// SHOPS SYNC
// ==========================================

async function syncShop(item) {
  const queuedShop = item.payload;

  const shop = queuedShop.client_id
    ? await db.shops
        .where("client_id")
        .equals(queuedShop.client_id)
        .first()
    : null;

  const currentShop = shop || queuedShop;

  if (item.action === "create") {
    const serverAreaId = await getServerAreaId(currentShop);

    const response = await apiRequest("/shops", {
      method: "POST",
      body: JSON.stringify({
        shop_name: currentShop.shop_name,
        owner_name: currentShop.owner_name,
        phone: currentShop.phone,
        whatsapp_number: currentShop.whatsapp_number,
        address: currentShop.address,
        notes: currentShop.notes,
        opening_balance: currentShop.opening_balance,
        area_id: serverAreaId,
        client_id: currentShop.client_id,
      }),
    });

    const serverShop = response.shop;

    if (!serverShop?.id) {
      throw new Error("Server did not return the saved shop.");
    }

    await db.transaction(
      "rw",
      db.shops,
      db.syncQueue,
      async () => {
        await db.shops.put({
          ...currentShop,
          ...serverShop,
          id: currentShop.id,
          server_id: serverShop.id,
          client_id: currentShop.client_id,
          area_id: serverAreaId,
          area_client_id: currentShop.area_client_id,
          synced: true,
        });

        await markQueueSynced(item);
      }
    );

    return;
  }

  const serverId =
    getServerId(currentShop) ||
    getServerId(queuedShop);

  if (!serverId) {
    throw new Error("Server shop ID is missing.");
  }

  let response;

  if (item.action === "update") {
    const serverAreaId = await getServerAreaId(currentShop);

    response = await apiRequest(`/shops/${serverId}`, {
      method: "PUT",
      body: JSON.stringify({
        shop_name: currentShop.shop_name,
        owner_name: currentShop.owner_name,
        phone: currentShop.phone,
        whatsapp_number: currentShop.whatsapp_number,
        address: currentShop.address,
        notes: currentShop.notes,
        opening_balance: currentShop.opening_balance,
        area_id: serverAreaId,
      }),
    });
  } else if (item.action === "deactivate") {
    response = await apiRequest(
      `/shops/${serverId}/deactivate`,
      { method: "PATCH" }
    );
  } else {
    throw new Error(`Unsupported shop action: ${item.action}`);
  }

  if (!response?.success) {
    throw new Error("Shop synchronization failed.");
  }

  await db.transaction(
    "rw",
    db.shops,
    db.syncQueue,
    async () => {
      const latestShop = await db.shops.get(currentShop.id);

      if (latestShop) {
        await db.shops.put({
          ...latestShop,
          ...(response.shop || {}),
          id: currentShop.id,
          server_id: serverId,
          synced: true,
        });
      }

      await markQueueSynced(item);
    }
  );
}

// ==========================================
// BALANCE ADJUSTMENTS SYNC
// ==========================================

async function syncAdjustment(item) {
  const adjustment = item.payload;

  const shop = await db.shops.get(adjustment.shop_id);

  const serverShopId =
    getServerId(shop) ||
    (String(adjustment.shop_id).startsWith("local-")
      ? null
      : adjustment.shop_id);

  if (!serverShopId) {
    throw new Error("Server shop ID is missing for adjustment.");
  }

  const response = await apiRequest(
    `/shops/${serverShopId}/adjustments`,
    {
      method: "POST",
      body: JSON.stringify({
        ...adjustment,
        shop_id: serverShopId,
        operation_id: item.operation_id,
      }),
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
        shop_id: adjustment.shop_id,
        server_shop_id: serverShopId,
        synced: true,
      });

      await markQueueSynced(item);
    }
  );
}

// ==========================================
// MAIN SYNC FUNCTION
// ==========================================

export async function syncPendingAdjustments() {
  if (!navigator.onLine) return;

  const pendingItems = await db.syncQueue
    .where("status")
    .equals("pending")
    .sortBy("queueId");

  for (const item of pendingItems) {
    if (!navigator.onLine) break;

    try {
      if (item.entity === "area") {
        await syncArea(item);
      } else if (item.entity === "shop") {
        await syncShop(item);
      } else if (
        item.entity === "adjustment" &&
        item.action === "create"
      ) {
        await syncAdjustment(item);
      } else {
        console.warn("Unsupported sync item:", item);
        break;
      }
    } catch (error) {
      console.error(
        `Sync failed for ${item.entity}:`,
        error.message
      );

      // Stop here to preserve queue order.
      // The item will be retried during the next sync.
      break;
    }
  }
}
