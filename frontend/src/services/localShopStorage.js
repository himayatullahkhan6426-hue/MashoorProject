
import db from "../database/localDb";

function createId() {
  return crypto.randomUUID();
}

function normalizeShop(shop) {
  return {
    ...shop,
    opening_balance: Number(shop.opening_balance || 0),
    is_active: shop.is_active !== false,
  };
}

// GET ALL ACTIVE SHOPS
export async function getLocalShops() {
  const shops = await db.shops.toArray();

  return shops
    .filter((shop) => shop.is_active !== false)
    .map(normalizeShop);
}

// GET SHOPS OF ONE AREA
export async function getLocalAreaShops(areaId) {
  const shops = await db.shops.toArray();

  return shops
    .filter(
      (shop) =>
        String(shop.area_id) === String(areaId) &&
        shop.is_active !== false
    )
    .map(normalizeShop);
}

// GET ONE SHOP
export async function getLocalShop(shopId) {
  let shop = await db.shops.get(shopId);

  if (!shop) {
    shop = await db.shops
      .where("server_id")
      .equals(shopId)
      .first();
  }

  return shop ? normalizeShop(shop) : null;
}

// CREATE SHOP
export async function createLocalShop(data) {
  const area = await db.areas.get(data.area_id);

  if (!area || area.is_active === false) {
    throw new Error("Please select an active area.");
  }

  if (!data.shop_name?.trim()) {
    throw new Error("Shop name is required.");
  }

  const clientId = createId();
  const now = new Date().toISOString();

  const shop = {
    id: `local-${clientId}`,
    client_id: clientId,
    server_id: null,

    area_id: area.id,
    area_client_id: area.client_id || null,
    area_name: area.name,

    shop_name: data.shop_name.trim(),
    owner_name: data.owner_name?.trim() || "",
    phone: data.phone?.trim() || "",
    whatsapp_number: data.whatsapp_number?.trim() || "",
    address: data.address?.trim() || "",
    notes: data.notes?.trim() || "",
    opening_balance: Number(data.opening_balance || 0),

    is_active: true,
    synced: true,
    created_at: now,
    updated_at: now,
  };

  await db.shops.add(shop);

  return normalizeShop(shop);
}

// UPDATE SHOP
export async function updateLocalShop(shopId, data) {
  const existing = await db.shops.get(shopId);

  if (!existing) {
    throw new Error("Shop not found.");
  }

  const area = await db.areas.get(data.area_id);

  if (!area || area.is_active === false) {
    throw new Error("Please select an active area.");
  }

  if (!data.shop_name?.trim()) {
    throw new Error("Shop name is required.");
  }

  const updatedShop = {
    ...existing,

    area_id: area.id,
    area_client_id: area.client_id || null,
    area_name: area.name,

    shop_name: data.shop_name.trim(),
    owner_name: data.owner_name?.trim() || "",
    phone: data.phone?.trim() || "",
    whatsapp_number: data.whatsapp_number?.trim() || "",
    address: data.address?.trim() || "",
    notes: data.notes?.trim() || "",
    opening_balance: Number(data.opening_balance || 0),

    updated_at: new Date().toISOString(),
    synced: true,
  };

  await db.shops.put(updatedShop);

  return normalizeShop(updatedShop);
}

// DEACTIVATE SHOP
// Financial history and adjustment records remain untouched.
export async function deactivateLocalShop(shopId) {
  const existing = await db.shops.get(shopId);

  if (!existing) {
    throw new Error("Shop not found.");
  }

  await db.shops.update(shopId, {
    is_active: false,
    updated_at: new Date().toISOString(),
    synced: true,
  });

  return true;
}
