
import Dexie from "dexie";

export const db = new Dexie("MissNooriOfflineDB");

// Version 1: Initial local database
db.version(1).stores({
  areas: "id, &client_id, name, area_type, is_active",
  shops: "id, &client_id, area_id, shop_name, is_active",
  adjustments:
    "id, &operation_id, shop_id, adjustment_type, adjustment_date",
  meta: "&key",
});

// Version 2: Server ID mapping
db.version(2).stores({
  areas: "id, &client_id, server_id, name, area_type, is_active",
});

// Version 3: Local authentication and application settings
db.version(3).stores({
  areas: "id, &client_id, server_id, name, area_type, is_active",
  shops: "id, &client_id, server_id, area_id, shop_name, is_active",
  adjustments:
    "id, &operation_id, shop_id, adjustment_type, adjustment_date",
  meta: "&key",
  users: "id, &username, role, is_active",
  appSettings: "&key",
});

// Version 4: Remove old username-based user accounts
db.version(4).stores({
  areas: "id, &client_id, server_id, name, area_type, is_active",
  shops: "id, &client_id, server_id, area_id, shop_name, is_active",
  adjustments:
    "id, &operation_id, shop_id, adjustment_type, adjustment_date",
  meta: "&key",
  users: null,
  appSettings: "&key",
});

export default db;
