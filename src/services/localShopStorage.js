import db from "../database/localDb";

function createId() {
  return crypto.randomUUID();
}

// ========================================
// SAFE LEGACY MIGRATION
// No automatic migration or deletion.
// ========================================

export async function migrateLegacyBalances() {
  return true;
}

// ========================================
// CALCULATE SHOP UNPAID BALANCE
// ========================================

async function normalizeShop(shop, adjustments = null) {
  if (!shop) return null;

  const allAdjustments =
    adjustments || (await db.adjustments.toArray());

  const shopAdjustments = allAdjustments.filter(
    (item) => String(item.shop_id) === String(shop.id)
  );

  let totalAdded = 0;
  let totalSubtracted = 0;

  for (const item of shopAdjustments) {
    const amount = Number(item.amount || 0);

    if (item.adjustment_type === "ADD") {
      totalAdded += amount;
    } else if (item.adjustment_type === "SUBTRACT") {
      totalSubtracted += amount;
    }
  }

  const hasAdjustmentHistory = shopAdjustments.length > 0;

  const hasStoredUnpaid =
    shop.unpaid_balance !== undefined &&
    shop.unpaid_balance !== null;

  const hasLegacyOpeningBalance =
    shop.opening_balance !== undefined &&
    shop.opening_balance !== null;

  let unpaidBalance;

  if (hasAdjustmentHistory) {
    const baseBalance = hasStoredUnpaid
      ? Number(shop.unpaid_balance)
      : Number(shop.opening_balance || 0);

    // If unpaid_balance already includes adjustments,
    // do not add adjustment history again.
    unpaidBalance = hasStoredUnpaid
      ? baseBalance
      : baseBalance + totalAdded - totalSubtracted;
  } else if (hasStoredUnpaid) {
    unpaidBalance = Number(shop.unpaid_balance);
  } else if (hasLegacyOpeningBalance) {
    unpaidBalance = Number(shop.opening_balance || 0);
  } else {
    unpaidBalance = Number(
      shop.Unpaid ??
      shop.balance ??
      shop.current_balance ??
      shop.remaining_balance ??
      shop.outstanding_balance ??
      0
    );
  }

  return {
    ...shop,
    unpaid_balance: unpaidBalance,
    is_active: shop.is_active !== false,
  };
}

// ========================================
// GET ALL ACTIVE SHOPS
// ========================================

export async function getLocalShops() {
  const [shops, adjustments] = await Promise.all([
    db.shops.toArray(),
    db.adjustments.toArray(),
  ]);

  const activeShops = shops.filter(
    (shop) => shop.is_active !== false
  );

  return Promise.all(
    activeShops.map((shop) =>
      normalizeShop(shop, adjustments)
    )
  );
}

// ========================================
// GET SHOPS OF ONE AREA
// ========================================

export async function getLocalAreaShops(areaId) {
  const [shops, adjustments] = await Promise.all([
    db.shops.toArray(),
    db.adjustments.toArray(),
  ]);

  const areaShops = shops.filter(
    (shop) =>
      String(shop.area_id) === String(areaId) &&
      shop.is_active !== false
  );

  return Promise.all(
    areaShops.map((shop) =>
      normalizeShop(shop, adjustments)
    )
  );
}

// ========================================
// GET ONE SHOP
// ========================================

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

// ========================================
// CREATE SHOP
// ========================================

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

  const unpaidBalance = Number(data.unpaid_balance || 0);

  if (!Number.isFinite(unpaidBalance) || unpaidBalance < 0) {
    throw new Error("Please enter a valid Unpaid amount.");
  }

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

    unpaid_balance: unpaidBalance,

    is_active: true,
    synced: true,
    created_at: now,
    updated_at: now,
  };

  await db.shops.add(shop);

  return normalizeShop(shop, []);
}

// ========================================
// UPDATE SHOP
// ========================================

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

  const unpaidBalance =
    data.unpaid_balance !== undefined
      ? Number(data.unpaid_balance)
      : Number(
          existing.unpaid_balance ??
          existing.opening_balance ??
          0
        );

  if (!Number.isFinite(unpaidBalance) || unpaidBalance < 0) {
    throw new Error("Please enter a valid Unpaid amount.");
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

    unpaid_balance: unpaidBalance,

    updated_at: new Date().toISOString(),
    synced: true,
  };

  // Preserve existing legacy fields and adjustment history.
  await db.shops.put(updatedShop);

  return normalizeShop(updatedShop);
}

// ========================================
// DEACTIVATE SHOP
// ========================================

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