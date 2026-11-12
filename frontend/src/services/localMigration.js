
import db from "../database/localDb";
import { createAndDownloadBackup } from "./localBackup";

// ========================================
// VALIDATE MIGRATION FILE
// ========================================

function validateExport(data) {
  if (
    data?.application !==
      "Miss Noori Cosmetics Management Software" ||
    data?.export_type !== "LOCAL_ONLY_MIGRATION" ||
    data?.version !== 1
  ) {
    throw new Error("Invalid Miss Noori migration file.");
  }

  const required = [
    "areas",
    "shops",
    "balance_adjustments",
    "owners",
  ];

  for (const key of required) {
    if (!Array.isArray(data.data?.[key])) {
      throw new Error(`Invalid migration data: ${key}`);
    }
  }
}

// ========================================
// HELPERS
// ========================================

function normalizeId(id) {
  if (id === null || id === undefined || id === "") {
    throw new Error("Migration contains a record without an ID.");
  }

  return String(id);
}

function validAmount(value, fieldName) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid amount in ${fieldName}.`);
  }

  return amount;
}

async function findExistingRecord(table, source) {
  if (source.client_id) {
    const byClientId = await table
      .where("client_id")
      .equals(String(source.client_id))
      .first();

    if (byClientId) return byClientId;
  }

  if (source.id !== undefined && source.id !== null) {
    const byServerId = await table
      .where("server_id")
      .equals(source.id)
      .first();

    if (byServerId) return byServerId;

    const byOriginalId = await table.get(source.id);

    if (byOriginalId) return byOriginalId;
  }

  return null;
}

// ========================================
// IMPORT OLD ONLINE DATABASE
// ========================================

export async function importLocalMigration(data) {
  validateExport(data);

  const areas = data.data.areas;
  const shops = data.data.shops;
  const adjustments = data.data.balance_adjustments;
  const owners = data.data.owners;

  if (owners.length === 0) {
    throw new Error("Migration file contains no OWNER account.");
  }

  // Existing OWNER accounts must be preserved.
  for (const owner of owners) {
    const username = String(owner.username || "")
      .trim()
      .toLowerCase();

    if (!username) {
      throw new Error(
        "Migration contains an invalid OWNER username."
      );
    }

    const existingOwner = await db.users
      .where("username")
      .equals(username)
      .first();

    if (!existingOwner || existingOwner.role !== "OWNER") {
      throw new Error(
        `Existing OWNER account not found for ${username}. Import the OWNER account first.`
      );
    }
  }

  const areaIdMap = new Map();
  const shopIdMap = new Map();

  // Only newly imported shops are recalculated.
  // Existing local shops are never overwritten.
  const importedShopBases = new Map();

  const result = {
    areas: { imported: 0, skipped: 0 },
    shops: { imported: 0, skipped: 0 },
    adjustments: { imported: 0, skipped: 0 },
    owners: { preserved: owners.length },
  };

  // Protect current local data before migration.
  await createAndDownloadBackup();

  await db.transaction(
    "rw",
    db.areas,
    db.shops,
    db.adjustments,
    async () => {
      // ====================================
      // IMPORT AREAS
      // ====================================

      for (const source of areas) {
        const sourceId = normalizeId(source.id);

        const existing = await findExistingRecord(
          db.areas,
          source
        );

        if (existing) {
          areaIdMap.set(sourceId, existing.id);
          result.areas.skipped++;
          continue;
        }

        const localId = `aiven-${sourceId}`;
        const collision = await db.areas.get(localId);

        if (collision) {
          throw new Error(
            `Area ID conflict detected: ${sourceId}.`
          );
        }

        const clientId =
          source.client_id ||
          `migration-area-${sourceId}`;

        const duplicateClientId = await db.areas
          .where("client_id")
          .equals(String(clientId))
          .first();

        if (duplicateClientId) {
          throw new Error(
            `Area client ID conflict: ${sourceId}.`
          );
        }

        const record = {
          ...source,
          id: localId,
          client_id: String(clientId),
          server_id: source.id,
          synced: true,
        };

        await db.areas.add(record);

        areaIdMap.set(sourceId, localId);
        result.areas.imported++;
      }

      // ====================================
      // IMPORT SHOPS
      // ====================================

      for (const source of shops) {
        const sourceId = normalizeId(source.id);
        const sourceAreaId = normalizeId(source.area_id);
        const localAreaId = areaIdMap.get(sourceAreaId);

        if (!localAreaId) {
          throw new Error(
            `Area reference missing for shop ${source.shop_name || sourceId}.`
          );
        }

        const existing = await findExistingRecord(
          db.shops,
          source
        );

        if (existing) {
          shopIdMap.set(sourceId, existing.id);
          result.shops.skipped++;
          continue;
        }

        const localId = `aiven-${sourceId}`;
        const collision = await db.shops.get(localId);

        if (collision) {
          throw new Error(
            `Shop ID conflict detected: ${sourceId}.`
          );
        }

        const clientId =
          source.client_id ||
          `migration-shop-${sourceId}`;

        const duplicateClientId = await db.shops
          .where("client_id")
          .equals(String(clientId))
          .first();

        if (duplicateClientId) {
          throw new Error(
            `Shop client ID conflict: ${sourceId}.`
          );
        }

        // Opening Balance becomes the starting Unpaid.
        // If source already contains unpaid_balance,
        // preserve that value as the final balance.
        const hasSourceUnpaid =
          source.unpaid_balance !== undefined &&
          source.unpaid_balance !== null;

        const startingUnpaid = hasSourceUnpaid
          ? validAmount(source.unpaid_balance, "Unpaid")
          : validAmount(source.opening_balance, "Opening Balance");

        // Never store opening_balance in the new record.
        const {
          unpaid_balance,
          ...shopFields
        } = source;

        const record = {
          ...shopFields,

          id: localId,
          client_id: String(clientId),
          server_id: source.id,

          area_id: localAreaId,

          unpaid_balance: startingUnpaid,

          is_active: source.is_active !== false,
          synced: true,
        };

        await db.shops.add(record);

        shopIdMap.set(sourceId, localId);

        importedShopBases.set(localId, {
          startingUnpaid,
          alreadyIncludesAdjustments: hasSourceUnpaid,
        });

        result.shops.imported++;
      }

      // ====================================
      // IMPORT ADJUSTMENT HISTORY
      // ====================================

      for (const source of adjustments) {
        const operationId = String(
          source.operation_id || ""
        ).trim();

        if (!operationId) {
          throw new Error(
            "A balance adjustment is missing its operation ID."
          );
        }

        const sourceShopId = normalizeId(source.shop_id);
        const localShopId = shopIdMap.get(sourceShopId);

        if (!localShopId) {
          throw new Error(
            `Shop reference missing for adjustment ${operationId}.`
          );
        }

        const existing = await db.adjustments
          .where("operation_id")
          .equals(operationId)
          .first();

        if (existing) {
          result.adjustments.skipped++;
          continue;
        }

        const collision = await db.adjustments.get(
          operationId
        );

        if (collision) {
          throw new Error(
            `Adjustment ID conflict: ${operationId}.`
          );
        }

        const amount = validAmount(
          source.amount,
          `adjustment ${operationId}`
        );

        const record = {
          ...source,

          id: operationId,
          operation_id: operationId,
          server_id: source.id,
          shop_id: localShopId,
          amount,
          synced: true,
        };

        await db.adjustments.add(record);

        result.adjustments.imported++;
      }

      // ====================================
      // FINALIZE IMPORTED SHOP UNPAID
      // ====================================

      for (const [shopId, base] of importedShopBases) {
        let finalUnpaid = base.startingUnpaid;

        // When source unpaid_balance already represents
        // the final balance, do not add history again.
        if (!base.alreadyIncludesAdjustments) {
          const shopAdjustments = await db.adjustments
            .where("shop_id")
            .equals(shopId)
            .toArray();

          let totalAdded = 0;
          let totalSubtracted = 0;

          for (const adjustment of shopAdjustments) {
            const amount = Number(adjustment.amount || 0);

            if (adjustment.adjustment_type === "ADD") {
              totalAdded += amount;
            } else if (
              adjustment.adjustment_type === "SUBTRACT"
            ) {
              totalSubtracted += amount;
            }
          }

          finalUnpaid =
            base.startingUnpaid +
            totalAdded -
            totalSubtracted;
        }

        if (!Number.isFinite(finalUnpaid)) {
          throw new Error(
            `Invalid final Unpaid balance for shop ${shopId}.`
          );
        }

        await db.shops.update(shopId, {
          unpaid_balance: finalUnpaid,
        });
      }
    }
  );

  return result;
}
