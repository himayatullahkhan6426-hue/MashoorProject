
import Dexie from "dexie";

export const db = new Dexie("MissNooriOfflineDB");

db.version(1).stores({
  areas: "id, &client_id, name, area_type, is_active",

  shops: "id, &client_id, area_id, shop_name, is_active",

  adjustments:
    "id, &operation_id, shop_id, adjustment_type, adjustment_date",

  meta: "&key",
});

// Version 2: server ID mapping
db.version(2).stores({
  areas: "id, &client_id, server_id, name, area_type, is_active",
});

// Version 3: local authentication and application settings
db.version(3).stores({
  areas: "id, &client_id, server_id, name, area_type, is_active",

  shops: "id, &client_id, server_id, area_id, shop_name, is_active",

  adjustments:
    "id, &operation_id, shop_id, adjustment_type, adjustment_date",
    
  meta: "&key",

  users: "id, &username, role, is_active",

  appSettings: "&key",
});

export default db;
