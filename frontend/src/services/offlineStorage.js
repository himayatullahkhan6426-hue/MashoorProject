import db from "../database/localDb";

function createId() {
  return crypto.randomUUID();
}

export async function getLocalAreas() {
  return db.areas.toArray();
}

export async function saveLocalAreas(areas) {
  await db.areas.bulkPut(areas);
}

export async function getLocalShops() {
  return db.shops.toArray();
}

export async function saveLocalShops(shops) {
  await db.shops.bulkPut(shops);
}

export async function getLocalShop(shopId) {
  return db.shops.get(shopId);
}

export async function getLocalAdjustments(shopId) {
  return db.adjustments
    .where("shop_id")
    .equals(shopId)
    .toArray();
}

export async function saveLocalAdjustment(adjustment) {
  const operationId = adjustment.operation_id || createId();

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