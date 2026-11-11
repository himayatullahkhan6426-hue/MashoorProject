import Dexie from "dexie";

export const db = new Dexie("MissNooriOfflineDB");

db.version(1).stores({
  areas: "id, &client_id, name, area_type, is_active",

  shops: "id, &client_id, area_id, shop_name, is_active",

  adjustments:
    "id, &operation_id, shop_id, adjustment_type, adjustment_date",

  syncQueue:
    "++queueId, &operation_id, entity, action, status, created_at",

  meta: "&key",
});

export default db;