
import db from "../database/localDb";

function createId() {
  return crypto.randomUUID();
}

// ==========================================
// AREA NAME NORMALIZATION
// ==========================================

function normalizeAreaName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// ==========================================
// CHECK DUPLICATE AREA
// ==========================================

async function checkDuplicateArea(name, excludeId = null) {
  const normalizedName = normalizeAreaName(name);

  if (!normalizedName) {
    throw new Error("Area name is required.");
  }

  const areas = await db.areas.toArray();

  const duplicate = areas.find(
    (area) =>
      area.is_active !== false &&
      String(area.id) !== String(excludeId) &&
      normalizeAreaName(area.name) === normalizedName
  );

  if (duplicate) {
    throw new Error(
      `"${name.trim()}" area already exists. Please use a different name.`
    );
  }
}

// ==========================================
// AREAS
// ==========================================

export async function getLocalAreas() {
  return db.areas.toArray();
}

export async function saveLocalAreas(areas) {
  await db.transaction(
    "rw",
    db.areas,
    db.syncQueue,
    async () => {
      for (const serverArea of areas) {
        const existingArea = serverArea.client_id
          ? await db.areas
              .where("client_id")
              .equals(serverArea.client_id)
              .first()
          : await db.areas.get(serverArea.id);

        const hasPendingChanges = existingArea
          ? await db.syncQueue
              .where("entity")
              .equals("area")
              .filter(
                (item) =>
                  item.status === "pending" &&
                  item.payload?.client_id ===
                    existingArea.client_id
              )
              .count()
          : 0;

        await db.areas.put({
          ...(existingArea || {}),
          ...(hasPendingChanges ? {} : serverArea),
          id: existingArea?.id ?? serverArea.id,
          server_id: serverArea.id,
          client_id:
            serverArea.client_id ||
            existingArea?.client_id ||
            null,
          synced: hasPendingChanges ? false : true,
        });
      }
    }
  );
}

// ==========================================
// CREATE LOCAL AREA
// ==========================================

export async function createLocalArea(area) {
  const areaName = String(area.name || "").trim();

  if (!areaName) {
    throw new Error("Area name is required.");
  }

  const clientId = createId();
  const localId = `local-${clientId}`;
  const operationId = createId();

  const record = {
    ...area,
    name: areaName,
    id: localId,
    client_id: clientId,
    server_id: null,
    is_active: true,
    synced: false,
  };

  await db.transaction(
    "rw",
    db.areas,
    db.syncQueue,
    async () => {
      await checkDuplicateArea(areaName);

      await db.areas.add(record);

      await db.syncQueue.add({
        operation_id: operationId,
        entity: "area",
        action: "create",
        status: "pending",
        created_at: new Date().toISOString(),
        payload: record,
      });
    }
  );

  return record;
}

// ==========================================
// UPDATE LOCAL AREA
// ==========================================

export async function updateLocalArea(areaId, changes) {
  const area = await db.areas.get(areaId);

  if (!area) {
    throw new Error("Area not found in local database.");
  }

  const updatedName =
    changes.name !== undefined
      ? String(changes.name).trim()
      : area.name;

  if (!updatedName) {
    throw new Error("Area name is required.");
  }

  const updated = {
    ...area,
    ...changes,
    name: updatedName,
    id: area.id,
    updated_at: new Date().toISOString(),
    synced: false,
  };

  await db.transaction(
    "rw",
    db.areas,
    db.syncQueue,
    async () => {
      await checkDuplicateArea(updatedName, area.id);

      await db.areas.put(updated);

      if (!area.server_id) {
        const pendingCreate = await db.syncQueue
          .where("entity")
          .equals("area")
          .filter(
            (item) =>
              item.action === "create" &&
              item.payload.client_id === area.client_id &&
              item.status === "pending"
          )
          .first();

        if (pendingCreate) {
          await db.syncQueue.update(pendingCreate.queueId, {
            payload: updated,
          });

          return;
        }
      }

      await db.syncQueue.add({
        operation_id: createId(),
        entity: "area",
        action: "update",
        status: "pending",
        created_at: new Date().toISOString(),
        payload: {
          ...updated,
          server_id: area.server_id ?? area.id,
        },
      });
    }
  );

  return updated;
}

// ==========================================
// DEACTIVATE LOCAL AREA
// ==========================================

export async function deactivateLocalArea(areaId) {
  const area = await db.areas.get(areaId);

  if (!area) {
    throw new Error("Area not found in local database.");
  }

  const updated = {
    ...area,
    is_active: false,
    synced: false,
  };

  await db.transaction(
    "rw",
    db.areas,
    db.syncQueue,
    async () => {
      await db.areas.put(updated);

      await db.syncQueue.add({
        operation_id: createId(),
        entity: "area",
        action: "deactivate",
        status: "pending",
        created_at: new Date().toISOString(),
        payload: {
          ...updated,
          server_id: area.server_id ?? area.id,
        },
      });
    }
  );

  return updated;
}

// ==========================================
// SHOPS
// ==========================================

export async function getLocalShops() {
  return db.shops.toArray();
}

export async function saveLocalShops(shops) {
  await db.transaction(
    "rw",
    db.shops,
    db.syncQueue,
    async () => {
      for (const serverShop of shops) {
        const existingShop = serverShop.client_id
          ? await db.shops
              .where("client_id")
              .equals(serverShop.client_id)
              .first()
          : await db.shops.get(serverShop.id);

        const hasPendingChanges = existingShop
          ? await db.syncQueue
              .where("entity")
              .equals("shop")
              .filter(
                (item) =>
                  item.status === "pending" &&
                  item.payload?.client_id ===
                    existingShop.client_id
              )
              .count()
          : 0;

        await db.shops.put({
          ...(existingShop || {}),
          ...(hasPendingChanges ? {} : serverShop),
          id: existingShop?.id ?? serverShop.id,
          server_id: serverShop.id,
          client_id:
            serverShop.client_id ||
            existingShop?.client_id ||
            null,
          synced: hasPendingChanges ? false : true,
        });
      }
    }
  );
}

export async function getLocalShop(shopId) {
  return db.shops.get(shopId);
}

// ==========================================
// BALANCE ADJUSTMENTS
// ==========================================

export async function getLocalAdjustments(shopId) {
  return db.adjustments
    .where("shop_id")
    .equals(shopId)
    .toArray();
}

export async function saveLocalAdjustment(adjustment) {
  const operationId =
    adjustment.operation_id || createId();

  const record = {
    ...adjustment,
    id: operationId,
    operation_id: operationId,
    synced: false,
  };

  await db.transaction(
    "rw",
    db.adjustments,
    db.syncQueue,
    async () => {
      await db.adjustments.put(record);

      await db.syncQueue.put({
        operation_id: operationId,
        entity: "adjustment",
        action: "create",
        status: "pending",
        created_at: new Date().toISOString(),
        payload: record,
      });
    }
  );

  return record;
}

// ==========================================
// SYNC QUEUE
// ==========================================

export async function getPendingSyncItems() {
  return db.syncQueue
    .where("status")
    .equals("pending")
    .sortBy("queueId");
}

export async function getPendingSyncCount() {
  return db.syncQueue
    .where("status")
    .equals("pending")
    .count();
}
